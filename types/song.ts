// TypeScript types for a Cadence song spec.
// These are re-exported from the Zod schema in lib/songSchema.ts —
// always import the *type* from here, never re-declare it.

export type {
  MusicalKey,
  SectionName,
  SongSection,
  SongLyrics,
  SongSpec,
} from "@/lib/songSchema";

// A single turn in the iterative co-pilot conversation
export interface ConversationTurn {
  role: "user" | "assistant";
  content: string; // user: plain text instruction; assistant: raw JSON string
}
