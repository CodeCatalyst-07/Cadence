// watsonx.ai client wrapper.
//
// Calls the IBM watsonx.ai REST API (Granite instruct model).
// Same exported function signature as the Phase 1 stub so callers need no changes.

import { SongSpec } from "@/types/song";
import { parseSongSpec, MUSICAL_KEYS, SECTION_NAMES } from "@/lib/songSchema";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface GenerateOptions {
  prompt: string;           // user's mood/scene description
  previousSpec?: SongSpec;  // present on iteration turns
  instruction?: string;     // the follow-up mutation instruction
}

// ---------------------------------------------------------------------------
// Typed error classes — lets the route handler distinguish failure kinds
// ---------------------------------------------------------------------------

/** Thrown when the AI model returns text that doesn't pass schema validation
 *  after one retry. */
export class SongGenerationError extends Error {
  readonly validationErrors: string[];
  constructor(message: string, validationErrors: string[]) {
    super(message);
    this.name = "SongGenerationError";
    this.validationErrors = validationErrors;
  }
}

/** Thrown for network / auth / non-200 HTTP failures. */
export class WatsonxNetworkError extends Error {
  readonly statusCode?: number;
  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "WatsonxNetworkError";
    this.statusCode = statusCode;
  }
}

// ---------------------------------------------------------------------------
// Environment config — read once at module load time
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new WatsonxNetworkError(`Missing required environment variable: ${name}`);
  return v;
}

// ---------------------------------------------------------------------------
// IAM token cache
// ---------------------------------------------------------------------------

interface TokenCache {
  token: string;
  expiresAt: number; // epoch ms
}
let _tokenCache: TokenCache | null = null;

async function getIamToken(apiKey: string): Promise<string> {
  const now = Date.now();
  // Reuse cached token if it has > 60 s left
  if (_tokenCache && _tokenCache.expiresAt - now > 60_000) {
    return _tokenCache.token;
  }

  const res = await fetch("https://iam.cloud.ibm.com/identity/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ibm:params:oauth:grant-type:apikey",
      apikey: apiKey,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new WatsonxNetworkError(
      `IAM token request failed: HTTP ${res.status} ${res.statusText}`,
      res.status
    );
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  _tokenCache = {
    token: json.access_token,
    // expires_in is in seconds; pad by 30 s for safety
    expiresAt: now + (json.expires_in - 30) * 1000,
  };
  return _tokenCache.token;
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a music composition assistant. Your ONLY output must be a single valid JSON object — no markdown code fences, no prose before or after, no comments.

The JSON object must exactly match this structure:
{
  "key": "<MusicalKey>",
  "tempoBPM": <number 40-220>,
  "mood": "<non-empty string, max 100 chars>",
  "chordProgression": ["<chord>", ...],
  "sections": [{ "name": "<SectionName>", "bars": <positive integer> }, ...],
  "lyrics": { "<sectionName>": "<lyric text>", ... }
}

Field constraints:
- key: must be one of: ${MUSICAL_KEYS.join(", ")}
- tempoBPM: integer between 40 and 220 inclusive
- mood: non-empty string, max 100 characters
- chordProgression: array of 1+ chord strings; each chord must match root note (A-G) + optional accidental (#/b) + optional modifier (m, maj7, min7, dim, aug, sus2, sus4, 7). Examples: "Am", "F#maj7", "Bb7"
- sections: array of 1+ objects; name must be one of: ${SECTION_NAMES.join(", ")}; bars must be a positive integer
- lyrics: object whose keys are the section names used in "sections"; each value is a non-empty lyric string

Few-shot example
User: "upbeat summer pop song about road trips and freedom"
Assistant:
{"key":"G","tempoBPM":128,"mood":"carefree and energetic","chordProgression":["G","D","Em","C"],"sections":[{"name":"intro","bars":4},{"name":"verse","bars":8},{"name":"chorus","bars":8},{"name":"bridge","bars":4},{"name":"outro","bars":4}],"lyrics":{"intro":"Wind in your hair, engine roar.","verse":"Packed up the car at the break of dawn,\\nNo map, no plan, just moving on.\\nEvery mile another story told,\\nOn this open road we turn to gold.","chorus":"Roll the windows down, let the music play,\\nWe were born to drive on a sun-kissed day.\\nNothing holding back, nothing left to say,\\nJust the open road and the USA.","bridge":"When the sky turns pink and the stars appear,\\nWe know that home is everywhere.","outro":"Miles behind us, freedom ahead."}}

Return ONLY the JSON object. No extra text.`;

// ---------------------------------------------------------------------------
// Raw model call
// ---------------------------------------------------------------------------

async function callGranite(userMessage: string): Promise<string> {
  const apiKey = requireEnv("WATSONX_API_KEY");
  const projectId = requireEnv("WATSONX_PROJECT_ID");
  const baseUrl = requireEnv("WATSONX_URL").replace(/\/$/, "");

  const iamToken = await getIamToken(apiKey);

  const endpoint = `${baseUrl}/ml/v1/text/chat?version=2024-05-31`;

  const body = {
    model_id: "meta-llama/llama-3-3-70b-instruct",
    project_id: projectId,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    parameters: {
      max_new_tokens: 1000,
      temperature: 0.7,
    },
  };

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${iamToken}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    throw new WatsonxNetworkError(
      `Network error calling watsonx.ai: ${(err as Error).message}`
    );
  }

  if (!res.ok) {
    let detail = "";
    try { detail = await res.text(); } catch { /* ignore */ }
    throw new WatsonxNetworkError(
      `watsonx.ai returned HTTP ${res.status}: ${detail.slice(0, 200)}`,
      res.status
    );
  }

  const json = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const text = json.choices?.[0]?.message?.content ?? "";
  if (!text) {
    throw new WatsonxNetworkError("watsonx.ai returned an empty response body");
  }
  return text;
}

// ---------------------------------------------------------------------------
// Strip accidental markdown fences
// ---------------------------------------------------------------------------

function stripFences(raw: string): string {
  // Remove ```json ... ``` or ``` ... ``` wrappers the model might emit
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

// ---------------------------------------------------------------------------
// Build a user message from GenerateOptions
// ---------------------------------------------------------------------------

function buildUserMessage(options: GenerateOptions): string {
  if (options.previousSpec && options.instruction) {
    return (
      `Here is the current song spec:\n${JSON.stringify(options.previousSpec)}\n\n` +
      `Apply this change: ${options.instruction}`
    );
  }
  return options.prompt;
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

export async function generateSong(options: GenerateOptions): Promise<SongSpec> {
  const userMessage = buildUserMessage(options);

  // --- First attempt ---
  const rawFirst = await callGranite(userMessage);
  let parsedFirst: unknown;
  try {
    parsedFirst = JSON.parse(stripFences(rawFirst));
  } catch {
    parsedFirst = null;
  }

  const firstResult = parseSongSpec(parsedFirst);
  if (firstResult.success) {
    return firstResult.data;
  }

  // --- Retry with correction message ---
  const correctionMessage =
    `Your previous response was not valid. Here is what you returned:\n` +
    `${rawFirst}\n\n` +
    `It failed schema validation with these errors:\n` +
    firstResult.errors.map((e) => `  - ${e}`).join("\n") +
    `\n\nFix only those fields and return corrected JSON. No markdown, no prose — only the JSON object.`;

  const rawRetry = await callGranite(correctionMessage);
  let parsedRetry: unknown;
  try {
    parsedRetry = JSON.parse(stripFences(rawRetry));
  } catch {
    parsedRetry = null;
  }

  const retryResult = parseSongSpec(parsedRetry);
  if (retryResult.success) {
    return retryResult.data;
  }

  // Both attempts failed — throw typed error with all validation errors
  throw new SongGenerationError(
    "AI model returned invalid SongSpec after retry",
    retryResult.errors
  );
}
