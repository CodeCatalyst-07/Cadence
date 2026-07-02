/**
 * chordMapping.ts
 *
 * Pure, side-effect-free functions for mapping a SongSpec's chordProgression
 * onto its sections.  No Tone.js, no browser APIs — safe to unit-test in Node.
 */

import type { SongSection } from "@/lib/songSchema";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface BarEvent {
  /** Chord symbol, e.g. "Am", "F#", "Bbmaj7" */
  chord: string;
  /** Section this bar belongs to */
  sectionName: string;
  /**
   * 0-based index of this bar within its section.
   * e.g. barIndex 0 is the first bar of the section.
   */
  barIndex: number;
  /**
   * Absolute bar index across the entire song (0-based).
   * Useful for scheduling against a global timeline.
   */
  globalBarIndex: number;
}

// ---------------------------------------------------------------------------
// Core mapping — the function the spec asks to be unit-testable
// ---------------------------------------------------------------------------

/**
 * Expands a chord progression over every section's bar count by cycling the
 * progression on repeat (wrap-around), one chord per bar.
 *
 * @param chordProgression  Flat array of chord symbols from SongSpec.
 * @param sections          Ordered sections from SongSpec.
 * @returns                 Flat, ordered array of BarEvents for the whole song.
 *
 * @example
 * // 5-chord progression, 8-bar section → chords[0..4, 0..2]
 * buildBarList(["Am","F","C","G","Em"], [{ name:"verse", bars:8 }])
 * // → 8 BarEvents cycling through the 5 chords
 */
export function buildBarList(
  chordProgression: string[],
  sections: SongSection[]
): BarEvent[] {
  if (chordProgression.length === 0 || sections.length === 0) return [];

  const result: BarEvent[] = [];
  let globalBarIndex = 0;

  for (const section of sections) {
    for (let barIndex = 0; barIndex < section.bars; barIndex++) {
      result.push({
        chord: chordProgression[globalBarIndex % chordProgression.length],
        sectionName: section.name,
        barIndex,
        globalBarIndex,
      });
      globalBarIndex++;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Chord → MIDI note helpers (no Tone.js, pure arithmetic)
// ---------------------------------------------------------------------------

/** Semitone offsets (C=0) for each note name. */
const NOTE_SEMITONES: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3,
  E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8,
  Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
};

/**
 * Parses a chord symbol and returns:
 *   root  — note name with octave, e.g. "C4"
 *   triad — array of three notes forming the triad, e.g. ["C4","E4","G4"]
 *
 * Supports: root (A–G) + optional accidental (#/b) + optional modifier
 * (m, min7, maj7, dim, aug, sus2, sus4, 7).
 * Unrecognised chords fall back to a C major triad.
 */
export function parseChord(
  symbol: string,
  octave = 4
): { root: string; triad: string[] } {
  // Match root note + optional modifier
  const match = symbol.match(/^([A-G][#b]?)(m(?:aj7|in7)?|maj7|dim|aug|sus2|sus4|7)?$/);
  if (!match) {
    return { root: `C${octave}`, triad: [`C${octave}`, `E${octave}`, `G${octave}`] };
  }

  const rootName = match[1];
  const modifier = match[2] ?? "";
  const rootSemitone = NOTE_SEMITONES[rootName] ?? 0;

  // Intervals above root (semitones): [third, fifth]
  let intervals: [number, number];
  if (modifier === "m" || modifier === "min7") {
    intervals = [3, 7]; // minor third + perfect fifth
  } else if (modifier === "dim") {
    intervals = [3, 6]; // minor third + diminished fifth
  } else if (modifier === "aug") {
    intervals = [4, 8]; // major third + augmented fifth
  } else if (modifier === "sus2") {
    intervals = [2, 7]; // major second + perfect fifth
  } else if (modifier === "sus4") {
    intervals = [5, 7]; // perfect fourth + perfect fifth
  } else {
    intervals = [4, 7]; // major third + perfect fifth (default)
  }

  function semitoneToNoteName(semitone: number): string {
    const NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
    const normalized = ((semitone % 12) + 12) % 12;
    return NAMES[normalized];
  }

  function buildNote(rootSemi: number, intervalSemi: number, baseOctave: number): string {
    const totalSemi = rootSemi + intervalSemi;
    const octaveShift = Math.floor(totalSemi / 12);
    const noteName = semitoneToNoteName(totalSemi);
    return `${noteName}${baseOctave + octaveShift}`;
  }

  const root = `${rootName}${octave}`;
  const third = buildNote(rootSemitone, intervals[0], octave);
  const fifth = buildNote(rootSemitone, intervals[1], octave);

  return { root, triad: [root, third, fifth] };
}
