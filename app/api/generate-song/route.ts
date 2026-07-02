// app/api/generate-song/route.ts
//
// POST /api/generate-song
//
// Accepts one of two shapes:
//   { prompt: string }                                      — initial generation
//   { currentSpec: SongSpec, instruction: string }          — iterative revision
//   { prompt: string, previousSpec?: SongSpec, instruction?: string }  — legacy / mixed
//
// Returns:
//   { spec: SongSpec }   on success
//   { error: string }    on validation or upstream failure
//
// The watsonx API key never leaves this file — it only lives in the
// server-side environment and is never forwarded to the client.

import { NextRequest, NextResponse } from "next/server";
import { generateSong } from "@/lib/watsonx";
import { validateAndRepair } from "@/lib/songSchema";
import { SongSpec } from "@/types/song";

export interface GenerateSongRequest {
  // Initial generation
  prompt?: string;
  // Iterative revision
  currentSpec?: SongSpec;
  instruction?: string;
  // Legacy alias kept for back-compat
  previousSpec?: SongSpec;
}

export async function POST(req: NextRequest) {
  let body: GenerateSongRequest;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Resolve the spec to mutate: prefer currentSpec, fall back to previousSpec.
  const specToRevise = body.currentSpec ?? body.previousSpec;

  // Validate: must have either a prompt OR a (currentSpec + instruction) pair.
  const hasPrompt = typeof body.prompt === "string" && body.prompt.trim() !== "";
  const hasIteration =
    specToRevise !== undefined &&
    typeof body.instruction === "string" &&
    body.instruction.trim() !== "";

  if (!hasPrompt && !hasIteration) {
    return NextResponse.json(
      {
        error:
          "Provide either a non-empty `prompt` for initial generation, " +
          "or both `currentSpec` and `instruction` for iterative revision.",
      },
      { status: 400 }
    );
  }

  let spec: SongSpec;
  try {
    spec = await generateSong({
      // Pass an empty string for prompt when doing iteration-only — buildUserMessage
      // in watsonx.ts will ignore it when previousSpec + instruction are present.
      prompt: body.prompt ?? "",
      previousSpec: specToRevise,
      instruction: body.instruction,
    });
  } catch (err) {
    console.error("[generate-song] generateSong error:", err);
    return NextResponse.json(
      { error: "Failed to generate song spec from AI model" },
      { status: 502 }
    );
  }

  // Use validateAndRepair so invalid-but-fixable section names (e.g. "pre-chorus"
  // from Llama) are normalised/dropped rather than hard-failing the request.
  const parsed = validateAndRepair(spec);
  if (!parsed.success) {
    console.error("[generate-song] schema validation failed:", parsed.errors);
    return NextResponse.json(
      { error: "AI returned an invalid song spec", details: parsed.errors },
      { status: 502 }
    );
  }

  return NextResponse.json({ spec: parsed.data });
}
