// Zod schema for SongSpec — lives here so both the API route (server)
// and the client can import and validate against the same shape.

import { z } from "zod";

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

/**
 * Valid musical keys: natural + sharp/flat notes, each in major and minor.
 * Major keys are bare ("C", "C#"), minor keys are suffixed with "m" ("Cm", "C#m").
 */
export const MUSICAL_KEYS = [
  "C", "C#", "Db", "D", "D#", "Eb", "E", "F",
  "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B",
  "Cm", "C#m", "Dbm", "Dm", "D#m", "Ebm", "Em", "Fm",
  "F#m", "Gbm", "Gm", "G#m", "Abm", "Am", "A#m", "Bbm", "Bm",
] as const;

export type MusicalKey = (typeof MUSICAL_KEYS)[number];

export const MusicalKeySchema = z.enum(MUSICAL_KEYS);

/** Section names that the AI is allowed to produce. */
export const SECTION_NAMES = [
  "intro",
  "verse",
  "chorus",
  "bridge",
  "outro",
] as const;

export type SectionName = (typeof SECTION_NAMES)[number];

export const SectionNameSchema = z.enum(SECTION_NAMES);

/**
 * Basic chord regex: root note (A-G) + optional accidental (#/b) +
 * optional modifier (m, maj7, min7, dim, aug, sus2, sus4, 7).
 */
const CHORD_RE = /^[A-G][#b]?(m|maj7|min7|dim|aug|sus2|sus4|7)?$/;

// ---------------------------------------------------------------------------
// Sub-schemas
// ---------------------------------------------------------------------------

export const SongSectionSchema = z.object({
  name: SectionNameSchema,
  bars: z.number().int().positive(),
  /** Kept from Phase 1 to avoid breaking existing data — optional. */
  moodShift: z.string().optional(),
});

/**
 * Lyrics are keyed by section name so they always mirror the sections array.
 * Each value is the lyric text for that section.
 */
export const SongLyricsSchema = z.record(SectionNameSchema, z.string());

export const SongSpecSchema = z.object({
  key: MusicalKeySchema,
  tempoBPM: z.number().min(40).max(220),
  mood: z.string().min(1).max(100),
  chordProgression: z
    .array(z.string().regex(CHORD_RE, "Each chord must match root + optional modifier"))
    .min(1),
  sections: z.array(SongSectionSchema).min(1),
  lyrics: SongLyricsSchema,
});

// Infer the TS types directly from Zod so they stay in sync.
export type SongSection = z.infer<typeof SongSectionSchema>;
export type SongLyrics = z.infer<typeof SongLyricsSchema>;
export type SongSpec = z.infer<typeof SongSpecSchema>;

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/** Converts a ZodIssue array to flat human-readable strings (path: message). */
function issuesToStrings(issues: z.ZodIssue[]): string[] {
  return issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") + ": " : "";
    return `${path}${issue.message}`;
  });
}

/**
 * Validates `input` against SongSpecSchema.
 * Never throws — wraps safeParse and converts issues to readable strings.
 */
export function parseSongSpec(
  input: unknown
): { success: true; data: SongSpec } | { success: false; errors: string[] } {
  const result = SongSpecSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: issuesToStrings(result.error.issues) };
}

// ---------------------------------------------------------------------------
// validateAndRepair
// ---------------------------------------------------------------------------

/**
 * Attempts light auto-repair before validating:
 *  - Clamps tempoBPM into [40, 220] instead of failing.
 *  - Trims + lowercases section names so they hit the enum.
 *  - Drops sections with missing required fields (name or bars) instead of
 *    failing the whole spec.
 *  - Trims mood string if present.
 *
 * Returns success: false only when repair genuinely cannot fix the input
 * (e.g. the `key` field is missing entirely).
 */
export function validateAndRepair(
  input: unknown
): { success: true; data: SongSpec } | { success: false; errors: string[] } {
  // We need a plain object to mutate; bail early if input isn't an object.
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { success: false, errors: ["Input must be a plain object"] };
  }

  // Shallow clone so we don't mutate the caller's object.
  const candidate: Record<string, unknown> = { ...(input as Record<string, unknown>) };

  // 1. Clamp tempoBPM
  if (typeof candidate.tempoBPM === "number") {
    candidate.tempoBPM = Math.min(220, Math.max(40, candidate.tempoBPM));
  }

  // 2. Trim mood string
  if (typeof candidate.mood === "string") {
    candidate.mood = candidate.mood.trim();
  }

  // 3. Repair sections array
  if (Array.isArray(candidate.sections)) {
    candidate.sections = (candidate.sections as unknown[])
      .map((s) => {
        if (typeof s !== "object" || s === null) return null;
        const sec = { ...(s as Record<string, unknown>) };
        // Normalise name: trim + lowercase
        if (typeof sec.name === "string") {
          sec.name = sec.name.trim().toLowerCase();
        }
        return sec;
      })
      // Drop sections that still lack required fields after repair
      .filter((s): s is Record<string, unknown> => {
        if (s === null) return false;
        // name must be a valid SectionName enum value
        if (!SECTION_NAMES.includes(s.name as SectionName)) return false;
        // bars must be a positive integer
        if (typeof s.bars !== "number" || !Number.isInteger(s.bars) || s.bars <= 0) {
          return false;
        }
        return true;
      });
  }

  return parseSongSpec(candidate);
}
