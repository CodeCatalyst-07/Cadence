/**
 * export.ts
 *
 * Client-side export helpers for MIDI and Lyrics+Chords.
 * Both functions derive their data from buildBarList so the output
 * matches exactly what the AudioEngine plays.
 *
 * Runs only in the browser (uses dynamic import for midi-writer-js
 * so Next.js doesn't attempt to SSR it).
 */

import type { SongSpec } from "@/types/song";
import { buildBarList, parseChord } from "@/lib/chordMapping";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Trigger a browser download for arbitrary binary/text data. */
function triggerDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Export MIDI
// ---------------------------------------------------------------------------

/**
 * Generates a two-track MIDI file from the current spec:
 *   Track 0 – chord pad (triad per bar at 4/4 whole-bar duration)
 *   Track 1 – bass (root note one octave lower, whole-bar duration)
 *
 * Tempo is set from spec.tempoBPM.
 * Filename: cadence-<key>-<mood>.mid (spaces → hyphens, lowercased).
 */
export async function exportMidi(spec: SongSpec): Promise<void> {
  // Dynamic import — midi-writer-js uses browser globals and must not be
  // imported at module evaluation time (SSR would fail).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MidiWriter = ((await import("midi-writer-js")) as any).default as any;

  const bars = buildBarList(spec.chordProgression, spec.sections);

  // One whole note = duration "1" in midi-writer-js = 4 beats.
  // We map each bar to one whole note so the MIDI matches the audio engine's
  // one-chord-per-bar grid.
  const chordTrack = new MidiWriter.Track();
  chordTrack.addTrackName("Chord Pad");
  chordTrack.setTempo(spec.tempoBPM);

  const bassTrack = new MidiWriter.Track();
  bassTrack.addTrackName("Bass");
  bassTrack.setTempo(spec.tempoBPM);

  for (const bar of bars) {
    const { root, triad } = parseChord(bar.chord, 4);

    // Chord pad — triad played as a block chord for one whole bar
    chordTrack.addEvent(
      new MidiWriter.NoteEvent({
        pitch: triad,
        duration: "1",
        velocity: 70,
        channel: 1,
      })
    );

    // Bass — root note one octave lower (octave 3) for one whole bar
    const bassRoot = root.replace(/(\d)$/, (_, oct) => String(Number(oct) - 1));
    bassTrack.addEvent(
      new MidiWriter.NoteEvent({
        pitch: [bassRoot],
        duration: "1",
        velocity: 85,
        channel: 2,
      })
    );
  }

  const writer = new MidiWriter.Writer([chordTrack, bassTrack]);
  const bytes: Uint8Array = writer.buildFile() as Uint8Array;

  const safeKey = spec.key.replace("#", "s");
  const safeMood = spec.mood.toLowerCase().replace(/\s+/g, "-").slice(0, 30);
  const filename = `cadence-${safeKey}-${safeMood}.mid`;

  triggerDownload(
    filename,
    new Blob([bytes.buffer as ArrayBuffer], { type: "audio/midi" })
  );
}

// ---------------------------------------------------------------------------
// Export Lyrics & Chords (.txt)
// ---------------------------------------------------------------------------

/**
 * Generates a plain-text file with the song structure:
 *
 *   [Verse]
 *   Chords: Bm - Eb - Fm
 *   In this café, I once found a place...
 *
 * Chords per section are collapsed to unique values (in order of first
 * appearance) rather than repeating every bar.
 */
export function exportLyricsChords(spec: SongSpec): void {
  const bars = buildBarList(spec.chordProgression, spec.sections);

  // Group bars by section (preserving section order from spec.sections)
  const chordsPerSection: Map<string, string[]> = new Map();
  for (const section of spec.sections) {
    chordsPerSection.set(section.name, []);
  }
  for (const bar of bars) {
    const list = chordsPerSection.get(bar.sectionName)!;
    if (list[list.length - 1] !== bar.chord) {
      // Only push when chord changes — gives unique-ordered deduplication
      list.push(bar.chord);
    }
  }

  const lines: string[] = [
    `Key: ${spec.key}  |  Tempo: ${spec.tempoBPM} BPM  |  Mood: ${spec.mood}`,
    "",
  ];

  for (const section of spec.sections) {
    const chords = chordsPerSection.get(section.name) ?? [];
    const lyric = spec.lyrics[section.name] ?? "";

    lines.push(`[${capitalise(section.name)}]`);
    lines.push(`Chords: ${chords.join(" - ")}`);
    if (lyric) lines.push(lyric);
    lines.push("");
  }

  const content = lines.join("\n");
  const safeKey = spec.key.replace("#", "s");
  const safeMood = spec.mood.toLowerCase().replace(/\s+/g, "-").slice(0, 30);
  const filename = `cadence-${safeKey}-${safeMood}.txt`;

  triggerDownload(filename, new Blob([content], { type: "text/plain" }));
}

// ---------------------------------------------------------------------------

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
