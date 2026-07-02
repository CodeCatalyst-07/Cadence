/**
 * audioEngine.ts
 *
 * Tone.js-based playback engine for a validated SongSpec.
 *
 * Public surface:
 *   play()                        – start / resume Transport
 *   pause()                       – pause Transport (position retained)
 *   stop()                        – stop Transport and reset position to 0
 *   previewSection(sectionName)   – loop just that section's bars
 *   dispose()                     – tear down all Tone.js nodes
 *
 * This module must only run in a browser context (no SSR).
 * Import it dynamically with next/dynamic or inside useEffect.
 */

"use client";

import type { SongSpec } from "@/lib/songSchema";
import { buildBarList, parseChord } from "@/lib/chordMapping";
import type { BarEvent } from "@/lib/chordMapping";

// ---------------------------------------------------------------------------
// Lazy Tone.js import helpers — keeps the import at the call site so Next.js
// SSR never touches Tone (it uses the Web Audio API which is browser-only).
// ---------------------------------------------------------------------------
type ToneModule = typeof import("tone");
let _tone: ToneModule | null = null;

async function getTone(): Promise<ToneModule> {
  if (!_tone) {
    _tone = await import("tone");
  }
  return _tone;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Pad chord octave — kept low-ish for a lush, full sound. */
const PAD_OCTAVE = 4;
/** Bass root note octave — two octaves below pad. */
const BASS_OCTAVE = 2;
/** Gain (dB) for each instrument bus. */
const PAD_VOLUME_DB = -14;
const BASS_VOLUME_DB = -10;
const KICK_VOLUME_DB = -6;
const HAT_VOLUME_DB = -22;

// ---------------------------------------------------------------------------
// AudioEngine class
// ---------------------------------------------------------------------------

export class AudioEngine {
  private spec: SongSpec;
  private barList: BarEvent[];

  /** Set to true once createInstruments() has run */
  private initialized = false;

  /** Tone.js node references — all nullable until init */
  private pad: import("tone").PolySynth | null = null;
  private bass: import("tone").Synth | null = null;
  private kick: import("tone").MembraneSynth | null = null;
  private hihat: import("tone").MetalSynth | null = null;

  /** Scheduled event IDs returned by Transport.schedule / scheduleRepeat */
  private scheduledIds: number[] = [];

  /** Whether we're currently in section-preview mode */
  private previewMode = false;

  constructor(spec: SongSpec) {
    this.spec = spec;
    this.barList = buildBarList(spec.chordProgression, spec.sections);
  }

  // -------------------------------------------------------------------------
  // Lazy initialisation (must be called from a user-gesture handler in
  // browser so AudioContext can be resumed)
  // -------------------------------------------------------------------------

  private async init(): Promise<void> {
    if (this.initialized) return;

    const Tone = await getTone();

    // Resume AudioContext (required after user gesture)
    await Tone.start();

    // --- Pad (PolySynth with soft, slow-attack pad patch) ---
    this.pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: {
        attack: 0.4,
        decay: 0.1,
        sustain: 0.9,
        release: 1.2,
      },
      volume: PAD_VOLUME_DB,
    }).toDestination();

    // --- Bass (MonoSynth-style via Synth with slow attack, long sustain) ---
    this.bass = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: {
        attack: 0.02,
        decay: 0.1,
        sustain: 0.8,
        release: 0.5,
      },
      volume: BASS_VOLUME_DB,
    }).toDestination();

    // --- Kick (MembraneSynth) ---
    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 6,
      envelope: {
        attack: 0.001,
        decay: 0.35,
        sustain: 0,
        release: 0.1,
      },
      volume: KICK_VOLUME_DB,
    }).toDestination();

    // --- Hi-hat (MetalSynth — very short, high-pitched metallic click) ---
    // Note: `frequency` is a Signal on the instance, not a constructor option.
    this.hihat = new Tone.MetalSynth({
      envelope: {
        attack: 0.001,
        decay: 0.05,
        release: 0.01,
      },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
      volume: HAT_VOLUME_DB,
    }).toDestination();
    this.hihat.frequency.value = 400;

    // Set BPM on the Transport
    const transport = Tone.getTransport();
    transport.bpm.value = this.spec.tempoBPM;
    transport.timeSignature = 4;

    this.initialized = true;
  }

  // -------------------------------------------------------------------------
  // Schedule helpers
  // -------------------------------------------------------------------------

  /**
   * Clears all previously scheduled events and optionally resets Transport
   * loop settings back to "no loop".
   */
  private async clearScheduled(clearLoop = true): Promise<void> {
    const Tone = await getTone();
    const transport = Tone.getTransport();

    // cancel() removes all events at or after t=0
    transport.cancel(0);
    this.scheduledIds = [];

    if (clearLoop) {
      transport.loop = false;
    }
  }

  /**
   * Schedules pad + bass + drums for the given list of BarEvents, starting
   * at transportOffset bars from 0.  Returns the total duration in bars.
   */
  private async scheduleBars(
    bars: BarEvent[],
    transportOffset: number
  ): Promise<void> {
    const Tone = await getTone();
    const transport = Tone.getTransport();

    bars.forEach((bar) => {
      // Position in the transport timeline:  e.g. "4:0:0" means bar 4, beat 0, 16th 0
      const barPos = bar.globalBarIndex - bars[0].globalBarIndex + transportOffset;
      const barTime = `${barPos}:0:0` as const;

      // -- Pad chord (attack on beat 1, release just before next bar) --
      const { triad } = parseChord(bar.chord, PAD_OCTAVE);
      const barDurationSec = (60 / this.spec.tempoBPM) * 4; // 4 beats per bar

      const id1 = transport.schedule((time) => {
        if (this.pad) {
          this.pad.triggerAttack(triad, time);
        }
      }, barTime);
      // Release just before the next bar starts
      const releaseTime = `${barPos + 1}:0:0` as const;
      const id2 = transport.schedule((time) => {
        if (this.pad) {
          this.pad.triggerRelease(triad, time);
        }
      }, releaseTime);

      // -- Bass root on beat 1 and beat 3 --
      const { root } = parseChord(bar.chord, BASS_OCTAVE);
      const beatDuration = barDurationSec / 4; // quarter-note in seconds

      // Beat 1
      const id3 = transport.schedule((time) => {
        if (this.bass) this.bass.triggerAttackRelease(root, "8n", time);
      }, `${barPos}:0:0`);

      // Beat 3  (offset = 2 quarter-notes = "2n" after barTime)
      const id4 = transport.schedule((time) => {
        if (this.bass) this.bass.triggerAttackRelease(root, "8n", time);
      }, `${barPos}:2:0`);

      // -- Drums --
      // Kick on beat 1
      const id5 = transport.schedule((time) => {
        if (this.kick) this.kick.triggerAttackRelease("C1", "8n", time);
      }, `${barPos}:0:0`);

      // Hi-hat on the "and" of each quarter note only (4 hits per bar):
      // 8th-note step 1 = "and of 1", 3 = "and of 2", 5 = "and of 3", 7 = "and of 4"
      // In "Bars:Beats:Sixteenths": odd steps sit on sixteenth 2 of beats 0,1,2,3.
      const hatBeats = [1, 3, 5, 7]; // off-beat 8th-note steps only
      const hatIds = hatBeats.map((step) => {
        // "barPos:beat:sixteenth"  where each beat = 2 sixteenths
        const beatNum = Math.floor(step / 2);
        const sixteenth = (step % 2) * 2; // 0 or 2
        return transport.schedule((time) => {
          if (this.hihat) this.hihat.triggerAttackRelease("16n", time);
        }, `${barPos}:${beatNum}:${sixteenth}`);
      });

      this.scheduledIds.push(id1, id2, id3, id4, id5, ...hatIds);

      // suppress unused-var warning — barDurationSec is conceptually useful but
      // Tone time strings handle the arithmetic
      void barDurationSec;
      void beatDuration;
    });
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Start playback of the whole song from the beginning (or resume if paused).
   */
  async play(): Promise<void> {
    await this.init();
    const Tone = await getTone();
    const transport = Tone.getTransport();

    if (this.previewMode || transport.state === "stopped") {
      // Fresh start (or returning from section-preview): rebuild schedule from bar 0.
      this.previewMode = false;
      await this.clearScheduled(true);
      await this.scheduleBars(this.barList, 0);
      transport.position = "0:0:0";
      transport.start();
    } else if (transport.state === "paused") {
      // Resume from pause.  The pad was silenced by pause() → releaseAll(), so
      // re-attack the chord for whichever bar we're currently in so there's no
      // silence gap until the next bar's scheduled attack fires.
      const posStr = transport.position as string; // e.g. "3:2:1"
      const currentBar = parseInt(posStr.split(":")[0], 10);
      const barEvent = this.barList.find((b) => b.globalBarIndex === currentBar);
      if (barEvent && this.pad) {
        const { triad } = parseChord(barEvent.chord, PAD_OCTAVE);
        this.pad.triggerAttack(triad, Tone.now());
      }
      transport.start();
    } else {
      // Already playing — nothing to do.
    }
  }

  /**
   * Pause playback, retaining the current position.
   * releaseAll() silences any sustained pad notes whose scheduled release
   * callback won't fire while the transport clock is stopped.
   */
  async pause(): Promise<void> {
    if (!this.initialized) return;
    const Tone = await getTone();
    Tone.getTransport().pause();
    // Silence sustained pad notes — the transport clock is now frozen so the
    // scheduled triggerRelease callbacks will never fire until resume.
    if (this.pad) this.pad.releaseAll();
  }

  /**
   * Stop playback and reset position to the beginning.
   */
  async stop(): Promise<void> {
    if (!this.initialized) return;
    const Tone = await getTone();
    const transport = Tone.getTransport();
    transport.stop();
    transport.position = "0:0:0";
    // Release any sustained pad notes
    if (this.pad) this.pad.releaseAll();
    this.previewMode = false;
  }

  /**
   * Play only the bars belonging to `sectionName`, looping them continuously
   * until pause() or stop() is called.
   *
   * @param sectionName  One of the section names present in the spec.
   */
  async previewSection(sectionName: string): Promise<void> {
    await this.init();
    const Tone = await getTone();
    const transport = Tone.getTransport();

    // Stop any current playback cleanly
    transport.stop();
    if (this.pad) this.pad.releaseAll();
    await this.clearScheduled(true);

    const sectionBars = this.barList.filter((b) => b.sectionName === sectionName);
    if (sectionBars.length === 0) {
      console.warn(`[AudioEngine] previewSection: no bars found for "${sectionName}"`);
      return;
    }

    // Schedule bars starting at position 0
    const tempBars = sectionBars.map((b, i) => ({
      ...b,
      globalBarIndex: i, // re-index so scheduling starts at 0:0:0
    }));
    await this.scheduleBars(tempBars, 0);

    // Loop the transport over exactly this section's bar count
    const totalBars = sectionBars.length;
    transport.loop = true;
    transport.loopStart = "0:0:0";
    transport.loopEnd = `${totalBars}:0:0`;
    transport.position = "0:0:0";

    this.previewMode = true;
    transport.start();
  }

  /**
   * Dispose of all Tone.js nodes.  Call this when the component unmounts.
   */
  async dispose(): Promise<void> {
    if (!this.initialized) return;
    const Tone = await getTone();
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel(0);

    this.pad?.dispose();
    this.bass?.dispose();
    this.kick?.dispose();
    this.hihat?.dispose();

    this.pad = null;
    this.bass = null;
    this.kick = null;
    this.hihat = null;
    this.initialized = false;
    this.previewMode = false;
  }
}

// ---------------------------------------------------------------------------
// Convenience factory
// ---------------------------------------------------------------------------

/**
 * Creates a new AudioEngine for the given spec.
 * Always call this from a browser context (not during SSR).
 */
export function createAudioEngine(spec: SongSpec): AudioEngine {
  return new AudioEngine(spec);
}
