"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SongSpec } from "@/types/song";
import { parseSongSpec } from "@/lib/songSchema";
import type { AudioEngine } from "@/lib/audioEngine";
import { buildBarList } from "@/lib/chordMapping";
import TopNav from "@/app/components/TopNav";
import Footer from "@/app/components/Footer";

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

interface HistoryEntry {
  instruction: string | null;
  label: string;
  spec: SongSpec;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Error helpers  (unchanged business logic)
// ---------------------------------------------------------------------------

function friendlyGenerateError(err: unknown, status?: number): string {
  if (status === 401 || status === 403)
    return "API key is invalid or missing. Check your watsonx credentials and try again.";
  if (status === 502)
    return "Couldn't generate a song right now — the AI model returned an unexpected response. Please try again.";
  if (status !== undefined)
    return `Couldn't generate a song right now (server error ${status}). Please try again.`;
  if (err instanceof TypeError && /fetch|network|failed/i.test(err.message))
    return "Network error — please check your connection and try again.";
  if (err instanceof DOMException && err.name === "AbortError")
    return "The request timed out. Please try again.";
  return "Couldn't generate a song right now. Please try again.";
}

function friendlyIterateError(err: unknown, status?: number): string {
  if (status === 401 || status === 403)
    return "API key is invalid or missing. Check your watsonx credentials and try again.";
  if (status === 502)
    return "Couldn't apply this revision — the AI model returned an unexpected response. Your previous version is still intact.";
  if (status !== undefined)
    return `Couldn't apply this revision (server error ${status}). Your previous version is still intact.`;
  if (err instanceof TypeError && /fetch|network|failed/i.test(err.message))
    return "Network error — please check your connection and try again.";
  if (err instanceof DOMException && err.name === "AbortError")
    return "The request timed out. Please try again.";
  return "Couldn't apply this revision right now. Your previous version is still intact.";
}

// ---------------------------------------------------------------------------
// Design-system sub-components (UI only — no logic)
// ---------------------------------------------------------------------------

/** Animated gradient skeleton bar */
function SkeletonBar({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded-md bg-surface-container-high animate-pulse ${className ?? ""}`}
      style={style}
    />
  );
}

/** Full-spec loading skeleton */
function SpecSkeleton() {
  return (
    <div className="mt-6 rounded-3xl glass p-6 animate-pulse space-y-5">
      <div className="flex flex-wrap gap-2">
        <SkeletonBar className="h-7 w-20 rounded-full" />
        <SkeletonBar className="h-7 w-24 rounded-full" />
        <SkeletonBar className="h-7 w-32 rounded-full" />
      </div>
      <div className="space-y-2">
        <SkeletonBar className="h-3 w-28" />
        <div className="flex gap-2 flex-wrap">
          {[48, 56, 40, 56, 48].map((w, i) => (
            <SkeletonBar key={i} className="h-8 rounded-lg" style={{ width: w }} />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <SkeletonBar className="h-3 w-20" />
        <div className="flex gap-2 flex-wrap">
          {[1, 2, 3, 4, 5].map((i) => <SkeletonBar key={i} className="h-10 w-24 rounded-xl" />)}
        </div>
      </div>
      <div className="space-y-1.5">
        <SkeletonBar className="h-3 w-16" />
        {[80, 95, 70, 88, 60].map((w, i) => (
          <SkeletonBar key={i} className="h-3" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}



/** Error dismissible banner */
function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="mt-4 flex items-start gap-3 rounded-2xl border border-error/30 bg-error-container/20 px-4 py-3">
      <span className="material-symbols-outlined text-error text-[18px] mt-0.5 shrink-0">error</span>
      <p className="flex-1 font-body-md text-body-md text-error">{message}</p>
      <button
        onClick={onDismiss}
        className="text-error/60 hover:text-error text-xl leading-none mt-0.5"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}







// ---------------------------------------------------------------------------
// How It Works section
// ---------------------------------------------------------------------------

const HOW_IT_WORKS = [
  {
    icon: "edit",
    iconHex: "#ddb7ff",
    hoverGlow: "radial-gradient(circle at 30% 30%, rgba(221,183,255,0.12), transparent 70%)",
    shadowColor: "rgba(221,183,255,0.35)",
    title: "1. Describe",
    body: "Input a mood, feeling, or technical description. Our engine understands complex emotional prompts and specific musical terminology alike.",
  },
  {
    icon: "auto_awesome",
    iconHex: "#4fdbc8",
    hoverGlow: "radial-gradient(circle at 30% 30%, rgba(79,219,200,0.12), transparent 70%)",
    shadowColor: "rgba(79,219,200,0.35)",
    title: "2. Generate",
    body: "The AI synthesizes unique audio stems instantly. Watch the visualizer as your prompt is transformed into high-fidelity, royalty-free audio.",
  },
  {
    icon: "download",
    iconHex: "#b76dff",
    hoverGlow: "radial-gradient(circle at 30% 30%, rgba(183,109,255,0.12), transparent 70%)",
    shadowColor: "rgba(183,109,255,0.35)",
    title: "3. Export",
    body: "Download full mixes, individual stems, or MIDI data to drop directly into your DAW for further production and mastering.",
  },
];

function HowItWorksSection() {
  return (
    <section
      className="w-full border-t border-white/5 py-[80px]"
      style={{ background: "#060e20" }}
    >
      <div className="max-w-[900px] mx-auto px-6 md:px-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h2
            className="text-[32px] font-bold text-white mb-3"
            style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
          >
            How it works
          </h2>
          <p className="text-[18px] text-white/60" style={{ fontFamily: "var(--font-inter, 'Inter', sans-serif)" }}>
            From imagination to finished track in three steps.
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {HOW_IT_WORKS.map((step) => (
            <div
              key={step.title}
              className="relative overflow-hidden group rounded-xl p-6 flex flex-col items-start transition-colors duration-500"
              style={{
                background: "rgba(11,19,38,0.4)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {/* Hover glow overlay */}
              <div
                className="absolute -inset-4 opacity-0 group-hover:opacity-100 transition-opacity blur-2xl pointer-events-none"
                style={{ background: step.hoverGlow, zIndex: -1 }}
              />

              {/* Icon circle */}
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mb-6 transition-all duration-300"
                style={{
                  background: "rgba(23,31,51,0.8)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: step.iconHex,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 15px ${step.shadowColor}`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "";
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "28px", color: step.iconHex }}
                >
                  {step.icon}
                </span>
              </div>

              <h3
                className="text-[20px] font-semibold text-white mb-3"
                style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
              >
                {step.title}
              </h3>
              <p
                className="text-[15px] text-white/60 leading-relaxed"
                style={{ fontFamily: "var(--font-inter, 'Inter', sans-serif)" }}
              >
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Mood suggestion chips
// ---------------------------------------------------------------------------

const MOOD_SUGGESTIONS = [
  "Melancholic rainy evening",
  "Cyberpunk neon chase",
  "Ethereal ambient forest",
  "Upbeat retro synthwave",
];

// ---------------------------------------------------------------------------
// Waveform visualizers & Timeline helpers for Your Generated Song
// ---------------------------------------------------------------------------

function DesktopWaveform({ playing }: { playing: boolean }) {
  const numBars = 80;
  const containerRef = useRef<HTMLDivElement>(null);
  const barsRef = useRef<{ element: HTMLDivElement; baseHeight: number }[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = "";
    barsRef.current = [];

    for (let i = 0; i < numBars; i++) {
      const bar = document.createElement("div");
      bar.className = "desktop-waveform-bar";
      const distanceToCenter = Math.abs((i - numBars / 2) / (numBars / 2));
      const baseHeight = 20 + (1 - distanceToCenter) * 100;
      bar.style.height = `${baseHeight}px`;
      containerRef.current.appendChild(bar);
      barsRef.current.push({ element: bar, baseHeight });
    }
  }, []);

  useEffect(() => {
    if (!playing) {
      barsRef.current.forEach((b) => {
        b.element.classList.remove("peak");
      });
      return;
    }

    const interval = setInterval(() => {
      barsRef.current.forEach((barObj) => {
        const variance = (Math.random() - 0.5) * 40;
        let newHeight = barObj.baseHeight + variance;
        newHeight = Math.max(10, Math.min(180, newHeight));
        barObj.element.style.height = `${newHeight}px`;

        if (newHeight > barObj.baseHeight + 15 && Math.random() > 0.5) {
          barObj.element.classList.add("peak");
        } else {
          barObj.element.classList.remove("peak");
        }
      });
    }, 100);

    return () => clearInterval(interval);
  }, [playing]);

  return (
    <div
      ref={containerRef}
      className="h-48 w-full flex items-end justify-center gap-[3px] overflow-hidden px-4"
      id="waveform"
    />
  );
}

function MobileWaveform({ playing }: { playing: boolean }) {
  const barCount = 40;
  const [bars, setBars] = useState<{ isSecondary: boolean; delay: number; duration: number; height: number }[]>([]);

  useEffect(() => {
    const newBars = [];
    for (let i = 0; i < barCount; i++) {
      newBars.push({
        isSecondary: Math.random() > 0.5,
        delay: Math.random() * -1.5,
        duration: 0.8 + Math.random() * 0.8,
        height: 20 + Math.random() * 80,
      });
    }
    setBars(newBars);
  }, []);

  return (
    <div className="absolute inset-x-0 bottom-8 h-32 flex items-end justify-center gap-1 px-8" id="waveform-container">
      {bars.map((bar, i) => {
        const colorClass = bar.isSecondary
          ? "from-secondary to-primary"
          : "from-primary to-secondary";
        return (
          <div
            key={i}
            className={`mobile-waveform-bar bg-gradient-to-t ${colorClass} ${playing ? "animate-pulse-height" : ""}`}
            style={{
              height: `${bar.height}%`,
              animationDelay: `${bar.delay}s`,
              animationDuration: `${bar.duration}s`,
              animationPlayState: playing ? "running" : "paused",
            }}
          />
        );
      })}
    </div>
  );
}

interface TimelineItem {
  name: string;
  startSec: number;
  endSec: number;
  chords: string[];
}

function getTimelineData(spec: SongSpec): TimelineItem[] {
  const result: TimelineItem[] = [];
  const barList = buildBarList(spec.chordProgression, spec.sections);
  
  let currentSecStart = 0;
  for (const section of spec.sections) {
    const durationSec = (section.bars * 4 / spec.tempoBPM) * 60;
    
    const sectionChords = Array.from(
      new Set(
        barList
          .filter((b) => b.sectionName === section.name)
          .map((b) => b.chord)
      )
    );
    
    result.push({
      name: section.name,
      startSec: currentSecStart,
      endSec: currentSecStart + durationSec,
      chords: sectionChords,
    });
    
    currentSecStart += durationSec;
  }
  return result;
}

function getInstrumentsForMood(mood: string): string[] {
  const m = mood.toLowerCase();
  if (m.includes("lo-fi") || m.includes("chill") || m.includes("relax")) {
    return ["Rhodes Electric Piano", "Vinyl Crackle", "Lo-Fi Drum Loop", "Warm Synth Bass", "Ambient Pad"];
  }
  if (m.includes("cyberpunk") || m.includes("synthwave") || m.includes("techno") || m.includes("retro") || m.includes("neon")) {
    return ["Analog Bass Synth", "TR-808 Drum Kit", "Granular Pad", "Arpeggiated Lead", "White Noise Sweeps"];
  }
  if (m.includes("cinematic") || m.includes("ambient") || m.includes("ethereal") || m.includes("forest")) {
    return ["Ethereal Pad", "Orchestral Strings", "Sub-Bass", "Acoustic Piano", "Granular Texture"];
  }
  return ["Acoustic Guitar", "Grand Piano", "Subtle Drums", "Electric Bass", "Warm Pad"];
}

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  spec: SongSpec;
  initialFormat: 'midi' | 'text';
}

function ExportModal({ isOpen, onClose, spec, initialFormat }: ExportModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<'midi' | 'text'>(initialFormat);
  const [exportState, setExportState] = useState<'idle' | 'processing' | 'success'>('idle');
  const [includeMasterFx, setIncludeMasterFx] = useState(true);

  useEffect(() => {
    setSelectedFormat(initialFormat);
  }, [initialFormat, isOpen]);

  if (!isOpen) return null;

  const handleExport = () => {
    setExportState('processing');
    
    // Simulate processing delay for the micro-interaction UI
    setTimeout(async () => {
      try {
        if (selectedFormat === 'midi') {
          const { exportMidi } = await import("@/lib/export");
          await exportMidi(spec);
        } else {
          const { exportLyricsChords } = await import("@/lib/export");
          exportLyricsChords(spec);
        }
        setExportState('success');
        
        // Auto-close modal after success showing
        setTimeout(() => {
          setExportState('idle');
          onClose();
        }, 2500);
      } catch (err) {
        console.error("Export failed:", err);
        setExportState('idle');
      }
    }, 1500);
  };

  const safeKey = spec.key.replace("#", "s");
  const safeMood = spec.mood.toLowerCase().replace(/\s+/g, "-").slice(0, 30);
  const midiFilename = `cadence-${safeKey}-${safeMood}.mid`;
  const txtFilename = `cadence-${safeKey}-${safeMood}.txt`;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      {/* Modal Container */}
      <div className="relative glass rounded-2xl w-[800px] max-w-[95vw] flex flex-col shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] overflow-hidden border border-white/10 bg-surface-container/95 backdrop-blur-xl">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-white/10">
          <h2 className="font-display text-headline-md text-on-surface">Export Project</h2>
          <button 
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[24px]">close</span>
          </button>
        </div>

        {/* Main Content Layout (Bento Grid) */}
        <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[380px]">
          {/* Left Column: Options */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="font-mono-label text-mono-label text-on-surface-variant uppercase tracking-wider mb-1">
              Export Format
            </div>
            
            {/* Option 1: MIDI */}
            <button 
              onClick={() => setSelectedFormat('midi')}
              className={`flex items-center gap-4 p-4 rounded-xl border transition-all text-left group ${
                selectedFormat === 'midi'
                  ? 'border-primary/40 bg-primary/10 shadow-[0_0_15px_rgba(221,183,255,0.15)]'
                  : 'border-white/5 bg-surface/40 hover:bg-white/5'
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                selectedFormat === 'midi' ? 'bg-primary/20 text-primary shadow-[0_0_10px_rgba(221,183,255,0.4)]' : 'bg-surface-bright text-on-surface-variant'
              }`}>
                <span className="material-symbols-outlined text-[20px]">piano</span>
              </div>
              <div>
                <div className="font-label-md text-on-surface font-semibold text-sm">Download MIDI</div>
                <div className="font-mono-label text-[10px] text-on-surface-variant mt-1">Stems &amp; Automation</div>
              </div>
              {selectedFormat === 'midi' && (
                <span className="material-symbols-outlined text-primary ml-auto">check_circle</span>
              )}
            </button>

            {/* Option 2: Text Spec */}
            <button 
              onClick={() => setSelectedFormat('text')}
              className={`flex items-center gap-4 p-4 rounded-xl border transition-all text-left group ${
                selectedFormat === 'text'
                  ? 'border-secondary/40 bg-secondary/10 shadow-[0_0_15px_rgba(79,219,200,0.15)]'
                  : 'border-white/5 bg-surface/40 hover:bg-white/5'
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                selectedFormat === 'text' ? 'bg-secondary/20 text-secondary' : 'bg-surface-bright text-on-surface-variant'
              }`}>
                <span className="material-symbols-outlined text-[20px]">description</span>
              </div>
              <div>
                <div className="font-label-md text-on-surface font-semibold text-sm">Download Chords &amp; Lyrics</div>
                <div className="font-mono-label text-[10px] text-on-surface-variant mt-1">Plain Text Document</div>
              </div>
              {selectedFormat === 'text' && (
                <span className="material-symbols-outlined text-secondary ml-auto">check_circle</span>
              )}
            </button>

            {/* Settings Toggle */}
            <div className="mt-auto pt-4 border-t border-white/10 flex items-center justify-between">
              <span className="font-body-md text-sm text-on-surface-variant">Include Master FX</span>
              <button 
                onClick={() => setIncludeMasterFx(!includeMasterFx)}
                className={`w-10 h-6 rounded-full relative transition-colors duration-200 ${
                  includeMasterFx ? 'bg-secondary' : 'bg-surface-bright'
                }`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-200 ${
                  includeMasterFx ? 'right-1' : 'left-1'
                }`} />
              </button>
            </div>
          </div>

          {/* Right Column: Preview Window */}
          <div className="lg:col-span-7 bg-surface-container-lowest rounded-xl border border-white/5 p-4 flex flex-col relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5 opacity-50"></div>
            
            {selectedFormat === 'midi' ? (
              // MIDI Preview Mode
              <>
                <div className="flex justify-between items-center mb-4 relative z-10">
                  <span className="font-mono-label text-[10px] text-on-surface-variant uppercase tracking-wider truncate max-w-[220px]">
                    Preview: {midiFilename}
                  </span>
                  <span className="font-mono-label text-[10px] text-secondary bg-secondary/10 px-2 py-0.5 rounded">
                    4 tracks
                  </span>
                </div>
                
                {/* Fake MIDI Piano Roll Grid */}
                <div className="flex-1 relative z-10 border-l border-b border-white/15 flex flex-col gap-2 overflow-hidden justify-center min-h-[160px]">
                  <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTAgMjBoMjBWMEgwem0xOSAxOUgxVjFoMTh2MTh6IiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIi8+PC9zdmc+')] opacity-20"></div>
                  
                  {/* Track 1: Synthesizer */}
                  <div className="h-6 relative">
                    <div className="absolute left-[15%] w-[25%] h-full bg-primary/40 rounded-sm border border-primary/60"></div>
                    <div className="absolute left-[50%] w-[35%] h-full bg-primary/40 rounded-sm border border-primary/60"></div>
                  </div>
                  
                  {/* Track 2: Bass */}
                  <div className="h-6 relative">
                    <div className="absolute left-[5%] w-[40%] h-full bg-secondary/40 rounded-sm border border-secondary/60"></div>
                    <div className="absolute left-[55%] w-[30%] h-full bg-secondary/40 rounded-sm border border-secondary/60"></div>
                  </div>

                  {/* Track 3: Drums */}
                  <div className="h-6 relative">
                    <div className="absolute left-[10%] w-[8%] h-full bg-primary-container/40 rounded-sm border border-primary-container/60"></div>
                    <div className="absolute left-[30%] w-[8%] h-full bg-primary-container/40 rounded-sm border border-primary-container/60"></div>
                    <div className="absolute left-[50%] w-[8%] h-full bg-primary-container/40 rounded-sm border border-primary-container/60"></div>
                  </div>
                </div>
              </>
            ) : (
              // Plain-Text Preview Mode
              <>
                <div className="flex justify-between items-center mb-4 relative z-10">
                  <span className="font-mono-label text-[10px] text-on-surface-variant uppercase tracking-wider truncate max-w-[220px]">
                    Preview: {txtFilename}
                  </span>
                  <span className="font-mono-label text-[10px] text-secondary bg-secondary/10 px-2 py-0.5 rounded">
                    TXT DOCUMENT
                  </span>
                </div>
                
                {/* Real spec preview text box */}
                <div className="flex-1 relative z-10 rounded border border-white/10 bg-black/30 p-3 overflow-y-auto custom-scrollbar max-h-[180px]">
                  <pre className="font-mono text-[10px] text-on-surface-variant leading-relaxed whitespace-pre-wrap select-all">
                    {`Key: ${spec.key}\nTempo: ${spec.tempoBPM} BPM\nMood: ${spec.mood}\n\n` + 
                     spec.sections.map(s => `[${s.name.toUpperCase()}]\nChords: ${spec.chordProgression.join(" - ")}\n${spec.lyrics[s.name as keyof typeof spec.lyrics] || ""}`).join("\n\n")}
                  </pre>
                </div>
              </>
            )}

            {/* Success Overlay */}
            {exportState === 'success' && (
              <div className="absolute inset-0 bg-surface-container-highest/95 backdrop-blur-sm z-20 flex flex-col items-center justify-center text-center p-6">
                <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center text-secondary mb-4 shadow-[0_0_20px_rgba(79,219,200,0.4)]">
                  <span className="material-symbols-outlined text-[32px]">task_alt</span>
                </div>
                <div className="font-display text-headline-md text-on-surface">Export Complete</div>
                <div className="font-body-md text-sm text-on-surface-variant mt-2">
                  {selectedFormat === 'midi' ? midiFilename : txtFilename} saved to Downloads
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-white/10 bg-surface-container-low flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-6 py-2 rounded-full font-label-md text-sm text-on-surface hover:bg-white/5 border border-white/10 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleExport}
            disabled={exportState === 'processing'}
            className="px-6 py-2 rounded-full font-label-md text-sm text-background bg-gradient-to-r from-primary to-secondary hover:brightness-110 shadow-[0_0_15px_rgba(79,219,200,0.3)] transition-all flex items-center gap-2"
          >
            {exportState === 'processing' ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                Processing...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">download</span>
                Export Now
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

interface StudioViewProps {
  spec: SongSpec;
  playing: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  iterInstruction: string;
  setIterInstruction: (v: string) => void;
  iterLoading: boolean;
  iterError: string | null;
  onIterate: () => void;
  history: HistoryEntry[];
  onRestore: (entry: HistoryEntry) => void;
}

function StudioView({
  spec,
  playing,
  onPlay,
  onPause,
  onStop,
  iterInstruction,
  setIterInstruction,
  iterLoading,
  iterError,
  onIterate,
  history,
  onRestore,
}: StudioViewProps) {
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [drawerExpanded, setDrawerExpanded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // --- NEW ITERATE & REFINE STATES ---
  const [activeInstruments, setActiveInstruments] = useState<string[]>([]);
  useEffect(() => {
    setActiveInstruments(getInstrumentsForMood(spec.mood));
  }, [spec]);

  const [instrumentVolumes, setInstrumentVolumes] = useState<Record<string, number>>({});
  useEffect(() => {
    const vols: Record<string, number> = {};
    activeInstruments.forEach((inst) => {
      vols[inst] = vols[inst] ?? 75;
    });
    setInstrumentVolumes(vols);
  }, [activeInstruments]);

  const [masterTempo, setMasterTempo] = useState(spec.tempoBPM);
  useEffect(() => {
    setMasterTempo(spec.tempoBPM);
  }, [spec.tempoBPM]);

  const handleTempoChange = (newBpm: number) => {
    setMasterTempo(newBpm);
    import("tone").then((Tone) => {
      Tone.getTransport().bpm.value = newBpm;
    });
  };

  const [creativity, setCreativity] = useState(80);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [exportModalFormat, setExportModalFormat] = useState<'midi' | 'text'>('midi');
  const [showExportModal, setShowExportModal] = useState(false);

  const openExportModal = (format: 'midi' | 'text') => {
    setExportModalFormat(format);
    setShowExportModal(true);
  };

  const handleSaveVersion = () => {
    setSaveStatus("Version saved!");
    setTimeout(() => setSaveStatus(null), 2000);
  };

  const formatAge = (timestamp: number) => {
    const diffMs = Date.now() - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    return `${diffMins}m ago`;
  };

  const handleSwapInstrument = (idx: number) => {
    const alternatives = [
      "Felt Piano", "Analog Bass Synth", "Lo-Fi Kit", "Rhodes Electric Piano",
      "Vinyl Crackle", "Lo-Fi Drum Loop", "Warm Synth Bass", "Ambient Pad",
      "Ethereal Pad", "Orchestral Strings", "Sub-Bass", "Acoustic Piano",
      "Granular Texture", "Acoustic Guitar", "Grand Piano", "Subtle Drums",
      "Electric Bass"
    ];
    const current = activeInstruments[idx];
    const filtered = alternatives.filter((a) => a !== current);
    const randomAlternative = filtered[Math.floor(Math.random() * filtered.length)];
    const copy = [...activeInstruments];
    copy[idx] = randomAlternative;
    setActiveInstruments(copy);
  };

  const handleAddInstrument = () => {
    const alternatives = [
      "Subtle Percussion", "Violin Solo", "Sitar FX", "Chiptune Lead",
      "Brass Chord", "Jazz Saxophone", "Acoustic Bass", "Flute Pad"
    ];
    const unused = alternatives.filter((a) => !activeInstruments.includes(a));
    if (unused.length === 0) return;
    const randomInst = unused[Math.floor(Math.random() * unused.length)];
    setActiveInstruments([...activeInstruments, randomInst]);
  };

  const getInstrumentIcon = (instName: string): string => {
    const name = instName.toLowerCase();
    if (name.includes("piano") || name.includes("rhodes") || name.includes("keyboard")) {
      return "piano";
    }
    if (name.includes("drum") || name.includes("kit") || name.includes("beat") || name.includes("percussion")) {
      return "nightlife";
    }
    if (name.includes("synth") || name.includes("bass") || name.includes("lead")) {
      return "sanitizer";
    }
    if (name.includes("pad") || name.includes("string") || name.includes("vocal") || name.includes("wave")) {
      return "surround_sound";
    }
    return "music_note";
  };
  // ------------------------------------

  const totalBars = spec.sections.reduce((acc, s) => acc + s.bars, 0);
  const totalBeats = totalBars * 4;
  const duration = (totalBeats / masterTempo) * 60;

  const formatTime = (secs: number, pad = false) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const minStr = pad ? String(m).padStart(2, "0") : String(m);
    const secStr = String(s).padStart(2, "0");
    return `${minStr}:${secStr}`;
  };

  const currentTimeRef = useRef(currentTime);
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  const onStopRef = useRef(onStop);
  useEffect(() => {
    onStopRef.current = onStop;
  }, [onStop]);

  useEffect(() => {
    if (!playing) return;
    const startTime = Date.now() - currentTimeRef.current * 1000;
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed >= duration) {
        setCurrentTime(0);
        onStopRef.current();
      } else {
        setCurrentTime(elapsed);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [playing, duration]);

  const handleStopClick = async () => {
    await onStop();
    setCurrentTime(0);
  };

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * duration;
    setCurrentTime(newTime);
    
    import("tone").then((Tone) => {
      Tone.getTransport().seconds = newTime;
    });
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const timelineData = getTimelineData(spec);

  return (
    <>
      {/* ── DESKTOP VIEW ── */}
      <div className="hidden lg:grid grid-cols-12 gap-gutter w-full">
        {/* Header Section */}
        <header className="col-span-12 flex justify-between items-end mb-8 border-b border-white/5 pb-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="px-3 py-1 bg-surface-bright rounded-full font-mono-label text-secondary text-xs uppercase tracking-widest border border-secondary/20">
                Generation Complete
              </span>
            </div>
            <h1 className="font-display text-display text-on-surface mb-2 capitalize">
              {spec.mood} Spec
            </h1>
            <p className="text-on-surface-variant font-body-lg flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-sm">auto_awesome</span>
              Synthesized by Cadence AI
            </p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => {
                const el = document.getElementById("revision-section");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className="px-6 py-2.5 rounded-lg border border-white/10 bg-surface/50 backdrop-blur-md hover:bg-white/10 transition-all text-on-surface flex items-center gap-2 font-label-md"
            >
              <span className="material-symbols-outlined text-sm">tune</span>
              Revise Song
            </button>
            <button
              onClick={() => openExportModal('midi')}
              className="px-6 py-2.5 rounded-lg bg-secondary text-on-secondary hover:bg-secondary-fixed transition-all flex items-center gap-2 font-label-md shadow-[0_0_15px_rgba(79,219,200,0.3)]"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              Export MIDI
            </button>
            <button
              onClick={() => openExportModal('text')}
              className="px-6 py-2.5 rounded-lg border border-white/10 bg-surface/50 backdrop-blur-md hover:bg-white/10 transition-all text-on-surface flex items-center gap-2 font-label-md"
            >
              <span className="material-symbols-outlined text-sm">description</span>
              Lyrics &amp; Chords
            </button>
          </div>
        </header>

        {/* Left Column: Player & Instrument Rack */}
        <div className="col-span-8 flex flex-col gap-lg">
          {/* Main Player Card */}
          <div className="bg-surface-container/60 backdrop-blur-xl border border-white/10 rounded-2xl p-xl flex flex-col gap-xl relative overflow-hidden group shadow-2xl">
            <div className="absolute top-0 left-1/4 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
            
            {/* Animated Waveform Visualizer */}
            <DesktopWaveform playing={playing} />
            
            {/* Scrub Bar */}
            <div className="flex flex-col gap-3">
              <div
                onClick={handleScrub}
                className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden cursor-pointer relative group"
              >
                <div
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary to-secondary rounded-full shadow-[0_0_10px_rgba(79,219,200,0.5)]"
                  style={{ width: `${progressPercent}%` }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,1)] opacity-0 group-hover:opacity-100 transition-opacity transform -translate-x-1/2"
                  style={{ left: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between font-mono-label text-on-surface-variant text-sm">
                <span className="text-secondary">{formatTime(currentTime, true)}</span>
                <span>{formatTime(duration, true)}</span>
              </div>
            </div>

            {/* Transport Controls */}
            <div className="flex items-center justify-center gap-8 mt-2">
              <button
                onClick={() => setShuffle(!shuffle)}
                className={`transition-colors ${shuffle ? "text-primary" : "text-on-surface-variant hover:text-primary"}`}
              >
                <span className="material-symbols-outlined text-2xl">shuffle</span>
              </button>
              <button
                onClick={() => {
                  setCurrentTime(0);
                  import("tone").then((Tone) => {
                    Tone.getTransport().seconds = 0;
                  });
                }}
                className="text-on-surface hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-4xl">skip_previous</span>
              </button>
              <button
                onClick={playing ? onPause : onPlay}
                className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary-container text-surface flex items-center justify-center shadow-[0_0_30px_rgba(221,183,255,0.4)] hover:scale-105 transition-transform relative group"
              >
                <div className="absolute inset-0 rounded-full bg-white/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <span className="material-symbols-outlined text-5xl ml-1 relative z-10" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {playing ? "pause" : "play_arrow"}
                </span>
              </button>
              <button
                onClick={handleStopClick}
                className="text-on-surface hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-4xl">stop</span>
              </button>
              <button
                onClick={() => setRepeat(!repeat)}
                className={`transition-colors ${repeat ? "text-secondary" : "text-on-surface-variant hover:text-secondary"}`}
              >
                <span className="material-symbols-outlined text-2xl">repeat</span>
              </button>
            </div>
          </div>

          {/* Metadata Bento Grid */}
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-surface-container-low/80 backdrop-blur-xl border border-white/5 rounded-xl p-6 flex flex-col gap-2 shadow-lg">
              <span className="text-on-surface-variant font-mono-label uppercase tracking-widest flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">music_note</span> Key
              </span>
              <span className="font-display text-headline-lg text-primary mt-1">{spec.key}</span>
            </div>
            <div className="bg-surface-container-low/80 backdrop-blur-xl border border-white/5 rounded-xl p-6 flex flex-col gap-2 shadow-lg">
              <span className="text-on-surface-variant font-mono-label uppercase tracking-widest flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">speed</span> Tempo
              </span>
              <span className="font-display text-headline-lg text-secondary mt-1">{masterTempo} BPM</span>
            </div>
            <div className="bg-surface-container-low/80 backdrop-blur-xl border border-white/5 rounded-xl p-6 flex flex-col gap-2 shadow-lg">
              <span className="text-on-surface-variant font-mono-label uppercase tracking-widest flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">mood</span> Vibe
              </span>
              <span className="font-display text-headline-md text-on-surface mt-1 pt-1 capitalize">{spec.mood}</span>
            </div>
          </div>

          {/* Instrument Rack Card */}
          <div className="bg-surface-container/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col shadow-2xl gap-4">
            <h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">piano</span>
              Instrument Rack
            </h3>
            <div className="flex flex-col gap-3">
              {activeInstruments.map((inst, idx) => {
                const isFirst = idx === 0;
                const volume = instrumentVolumes[inst] ?? 75;
                const icon = getInstrumentIcon(inst);
                return (
                  <div
                    key={idx}
                    className={`bg-surface/60 backdrop-blur-xl border rounded-xl p-4 flex items-center gap-4 relative overflow-hidden transition-all ${
                      isFirst
                        ? "border-secondary/40 shadow-[inset_0_0_30px_rgba(79,219,200,0.05)]"
                        : "border-white/5 hover:border-white/10"
                    }`}
                  >
                    {isFirst && <div className="absolute left-0 top-0 bottom-0 w-1 bg-secondary shadow-[0_0_10px_rgba(79,219,200,0.8)]"></div>}
                    <div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center border border-white/5 shrink-0">
                      <span className={`material-symbols-outlined ${isFirst ? "text-secondary" : "text-on-surface-variant"}`}>
                        {icon}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-end mb-2">
                        <span className="font-label-md text-on-surface truncate text-sm">{inst}</span>
                        <span className={`font-mono-label text-[10px] ${isFirst ? "text-secondary" : "text-on-surface-variant/70"}`}>
                          {isFirst ? "ACTIVE" : "STANDBY"}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={volume}
                        onChange={(e) => setInstrumentVolumes({ ...instrumentVolumes, [inst]: Number(e.target.value) })}
                        className="w-full h-1 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-secondary"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSwapInstrument(idx)}
                        className="px-4 py-2 rounded-lg bg-surface-bright text-on-surface font-label-md text-xs hover:bg-surface-container-highest transition-colors border border-white/5 shrink-0"
                      >
                        Swap
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              onClick={handleAddInstrument}
              className="w-full py-3 rounded-xl border border-dashed border-white/20 text-on-surface-variant hover:text-on-surface hover:border-white/40 hover:bg-white/5 transition-all flex justify-center items-center gap-2 font-label-md text-sm mt-1"
            >
              <span className="material-symbols-outlined text-sm">add</span> Add Instrument
            </button>
          </div>
        </div>

        {/* Right Column: AI Copilot, Tempo, and Song Structure */}
        <div className="col-span-4 flex flex-col gap-6">
          {/* Master Tempo Panel */}
          <div className="bg-surface-container/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
            <h4 className="font-mono-label text-mono-label text-on-surface-variant mb-4 uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">speed</span> Master Tempo
            </h4>
            <div className="flex items-center justify-between mb-4">
              <span className="font-display text-headline-lg text-on-surface">{masterTempo}</span>
              <span className="font-label-md text-secondary">BPM</span>
            </div>
            <input
              type="range"
              min="60"
              max="180"
              value={masterTempo}
              onChange={(e) => handleTempoChange(Number(e.target.value))}
              className="w-full accent-secondary h-1 bg-surface-container-highest rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* AI Copilot Panel */}
          <div className="bg-surface-container/60 backdrop-blur-xl border border-primary/30 rounded-2xl p-6 flex flex-col relative shadow-[inset_0_0_40px_rgba(221,183,255,0.03)] gap-4">
            <div className="absolute top-4 right-4">
              <span className="material-symbols-outlined text-primary/50 text-[28px] animate-pulse">auto_awesome</span>
            </div>
            <h4 className="font-mono-label text-mono-label text-primary uppercase tracking-wider">AI Copilot</h4>
            
            <div className="flex flex-col gap-2">
              <label className="font-label-md text-xs text-on-surface-variant">Prompt (Current Section)</label>
              <textarea
                value={iterInstruction}
                onChange={(e) => setIterInstruction(e.target.value)}
                disabled={iterLoading}
                className="w-full bg-surface-container border border-white/10 rounded-lg p-3 text-on-surface font-body-md text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none h-24 placeholder-on-surface-variant/40"
                placeholder="Describe how to change this section... e.g. 'Make it more aggressive, add distortion to the bass.'"
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between font-label-md text-xs text-on-surface-variant">
                <span>Creativity Level</span>
                <span className="text-primary text-mono-label font-mono-label uppercase">
                  {creativity > 70 ? "HIGH" : creativity > 40 ? "BALANCED" : "CONSERVATIVE"}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                value={creativity}
                onChange={(e) => setCreativity(Number(e.target.value))}
                className="w-full accent-primary h-1 bg-surface-container-highest rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {iterError && (
              <p className="text-error text-xs font-mono-label border border-error/20 bg-error/5 p-2 rounded-lg">
                {iterError}
              </p>
            )}

            <button
              onClick={onIterate}
              disabled={iterLoading || iterInstruction.trim() === ""}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-background font-label-md hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(221,183,255,0.3)] flex items-center justify-center gap-2"
            >
              {iterLoading ? (
                <>
                  <span className="h-4 w-4 border-2 border-background border-t-transparent rounded-full animate-spin"></span>
                  Regenerating...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">restart_alt</span>
                  Regenerate Section
                </>
              )}
            </button>
          </div>

          {/* Song Structure Timeline */}
          <div className="bg-surface-container/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 flex flex-col shadow-xl max-h-[400px]">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
              <h3 className="font-headline-md text-md text-on-surface">Song Structure</h3>
              <span className="material-symbols-outlined text-secondary bg-secondary/10 p-2 rounded-lg text-sm">segment</span>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar flex flex-col gap-4 relative before:absolute before:left-[11px] before:top-4 before:bottom-4 before:w-[2px] before:bg-white/5">
              {timelineData.map((item, idx) => {
                const isActive = currentTime >= item.startSec && currentTime < item.endSec;
                return (
                  <div key={idx} className="relative pl-8 group">
                    {isActive ? (
                      <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center z-10 animate-pulse">
                        <div className="w-2.5 h-2.5 rounded-full bg-secondary shadow-[0_0_10px_rgba(79,219,200,1)]"></div>
                      </div>
                    ) : (
                      <div className="absolute left-1.5 top-2.5 w-3 h-3 rounded-full bg-surface-bright border-2 border-white/20 z-10"></div>
                    )}
                    <div className={`rounded-xl p-3 border transition-colors ${
                      isActive
                        ? "bg-gradient-to-br from-surface-bright/50 to-surface-container-highest border-secondary/30 shadow-[0_4px_20px_rgba(79,219,200,0.1)]"
                        : "bg-surface-bright/20 border-white/5"
                    }`}>
                      <div className="flex justify-between items-center mb-2">
                        <span className={`font-label-md text-xs capitalize ${isActive ? "text-secondary" : "text-on-surface-variant"}`}>
                          {item.name}
                        </span>
                        <span className={`font-mono-label text-[10px] ${isActive ? "text-secondary" : "text-on-surface-variant"}`}>
                          {formatTime(item.startSec)} - {formatTime(item.endSec)}
                        </span>
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {item.chords.map((chord, cIdx) => (
                          <span
                            key={cIdx}
                            className={`px-2 py-0.5 bg-surface rounded text-[10px] font-mono-label border ${
                              isActive ? "text-secondary border-secondary/20" : "text-on-surface border-white/5"
                            }`}
                          >
                            {chord}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── VERSION HISTORY STRIP ── */}
        <div className="col-span-12 mt-12 bg-surface-container-highest/90 backdrop-blur-2xl border border-white/10 rounded-2xl flex items-center p-6 gap-6 relative shadow-lg overflow-hidden">
          {saveStatus && (
            <div className="absolute top-2 left-6 px-3 py-1 bg-secondary text-background font-label-md text-xs rounded-full shadow-[0_0_10px_rgba(79,219,200,0.8)] animate-bounce z-50">
              {saveStatus}
            </div>
          )}
          {/* Save Action */}
          <button
            onClick={handleSaveVersion}
            className="flex flex-col items-center justify-center px-6 h-[70px] rounded-xl bg-surface-bright border border-white/10 hover:border-secondary/50 hover:bg-surface-bright/80 transition-all shrink-0 shadow-lg"
          >
            <span className="material-symbols-outlined text-secondary mb-1">save</span>
            <span className="font-label-md text-on-surface text-[12px]">Save Version</span>
          </button>
          <div className="w-[1px] h-[50px] bg-white/10 mx-2 shrink-0"></div>
          {/* Scrollable Versions */}
          <div className="flex-1 flex items-center gap-4 overflow-x-auto version-scroll pb-2 pt-2">
            {history.map((entry, idx) => {
              const isCurrent = entry.spec === spec;
              const isBase = idx === 0;
              const label = isBase ? "v.01 (Base)" : `v.0${idx + 1}`;
              return (
                <div
                  key={entry.timestamp || idx}
                  onClick={() => onRestore(entry)}
                  className={`relative shrink-0 w-[180px] h-[70px] rounded-xl p-2 cursor-pointer flex flex-col justify-between overflow-hidden transition-all ${
                    isCurrent
                      ? "bg-surface-container-low border-2 border-secondary"
                      : "bg-surface border border-white/5 hover:border-white/20"
                  }`}
                >
                  {isCurrent && <div className="absolute inset-0 bg-secondary/5 pointer-events-none"></div>}
                  <div className="flex justify-between items-start z-10 w-full">
                    <span className={`font-label-md text-label-md text-[12px] ${isCurrent ? "text-on-surface" : "text-on-surface-variant"}`}>
                      {label} {isCurrent ? "(Current)" : ""}
                    </span>
                    {isCurrent ? (
                      <span className="w-2 h-2 rounded-full bg-secondary shadow-[0_0_5px_#4fdbc8]"></span>
                    ) : (
                      <span className="text-[10px] text-on-surface-variant font-mono-label">
                        {formatAge(entry.timestamp)}
                      </span>
                    )}
                  </div>
                  <div className="h-4 flex items-end gap-[2px] opacity-35 z-10">
                    <div className="w-1.5 h-full bg-secondary"></div>
                    <div className="w-1.5 h-3/4 bg-secondary"></div>
                    <div className="w-1.5 h-1/2 bg-secondary"></div>
                    <div className="w-1.5 h-full bg-secondary"></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── MOBILE VIEW ── */}
      <div className="block lg:hidden w-full relative">
        <main className="flex-1 flex flex-col z-10 relative pb-[80px]">
          {/* Artwork / Visualizer (Top Half) */}
          <div className="w-full aspect-square mt-4 mb-8 relative rounded-3xl overflow-hidden border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] glow-overlay">
            {/* Generative Art Background */}
            <div
              className="absolute inset-0 bg-cover bg-center opacity-60 mix-blend-screen"
              style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDj_5y2f4jGBi_Fd4ODwARhJvn-yiECDkEzcATyYGD1kM6z1MWHy46qEPLHzzIROlrCekPTL0xEPyasbxKGS8qR915qoC8KnlUegpe6LRXbFOMMA2rKYOmqJeKcXTCSyLu1PcbHQPqLGkHe25TgNYilyieEevSfUOd1D0BUl7BTk92eyYvfT8C6_iKwaE7b9Qo7jYK7tPqLPEOz3YQrNPhb1aLpx6jUYY4IxmR3-DdAkTaXKmxZT4pL6UWdMXPP-TGiJkucMO8HHOo')" }}
            />
            {/* Glass Overlay */}
            <div className="absolute inset-0 bg-surface/20 backdrop-blur-[2px]"></div>
            
            {/* Waveform Visualizer */}
            <MobileWaveform playing={playing} />
          </div>

          {/* Track Info */}
          <div className="flex flex-col items-center mb-8">
            <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface text-center tracking-tight mb-2 capitalize">
              {spec.mood} Spec
            </h1>
            <p className="font-body-md text-body-md text-primary/80 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">graphic_eq</span>
              Cadence Audio Engine v4
            </p>
          </div>

          {/* Playback Controls */}
          <div className="w-full mt-auto mb-12">
            {/* Progress Bar */}
            <div className="w-full flex items-center gap-3 mb-8">
              <span className="font-mono-label text-mono-label text-on-surface-variant w-10 text-right">
                {formatTime(currentTime)}
              </span>
              <div
                onClick={handleScrub}
                className="flex-1 h-1.5 bg-surface-container-high rounded-full relative overflow-hidden cursor-pointer"
              >
                <div
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary to-secondary rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="font-mono-label text-mono-label text-on-surface-variant w-10">
                {formatTime(duration)}
              </span>
            </div>
            
            {/* Main Buttons */}
            <div className="flex justify-center items-center gap-8">
              <button
                onClick={() => setShuffle(!shuffle)}
                className={`transition-colors ${shuffle ? "text-primary" : "text-on-surface-variant hover:text-secondary"}`}
              >
                <span className="material-symbols-outlined text-[28px]">shuffle</span>
              </button>
              <button
                onClick={() => {
                  setCurrentTime(0);
                  import("tone").then((Tone) => {
                    Tone.getTransport().seconds = 0;
                  });
                }}
                className="w-12 h-12 flex items-center justify-center rounded-full bg-surface-container/50 border border-white/5 text-on-surface hover:bg-white/10 transition-all"
              >
                <span className="material-symbols-outlined text-[32px] pl-1">skip_previous</span>
              </button>
              <button
                onClick={playing ? onPause : onPlay}
                className="w-20 h-20 flex items-center justify-center rounded-full bg-gradient-to-br from-primary-container to-secondary-container text-on-primary-container shadow-[0_0_40px_rgba(4,180,162,0.5)] hover:scale-105 active:scale-95 transition-all duration-300"
              >
                <span className="material-symbols-outlined text-[40px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {playing ? "pause" : "play_arrow"}
                </span>
              </button>
              <button
                onClick={handleStopClick}
                className="w-12 h-12 flex items-center justify-center rounded-full bg-surface-container/50 border border-white/5 text-on-surface hover:bg-white/10 transition-all"
              >
                <span className="material-symbols-outlined text-[32px] pr-1">stop</span>
              </button>
              <button
                onClick={() => setRepeat(!repeat)}
                className={`transition-colors ${repeat ? "text-secondary" : "text-on-surface-variant hover:text-secondary"}`}
              >
                <span className="material-symbols-outlined text-[28px]">repeat</span>
              </button>
            </div>
          </div>
        </main>

        {/* Expandable Bottom Drawer (Song Spec & Metadata) */}
        <div
          className={`fixed bottom-0 left-0 w-full h-[530px] bg-surface-container/90 backdrop-blur-3xl border-t border-white/10 rounded-t-3xl z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] flex flex-col transition-transform duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            drawerExpanded ? "translate-y-0" : "translate-y-[calc(100%-64px)]"
          }`}
          id="bottom-drawer"
        >
          {/* Drawer Header / Handle */}
          <div className="w-full pt-4 pb-2 px-6 flex flex-col items-center cursor-pointer select-none" onClick={() => setDrawerExpanded(!drawerExpanded)}>
            <div className="w-12 h-1.5 bg-outline-variant rounded-full mb-4"></div>
            <div className="w-full flex justify-between items-center">
              <span className="font-label-md text-label-md text-on-surface uppercase tracking-wider">Track Spec &amp; Revision</span>
              <span className="material-symbols-outlined text-secondary" id="drawer-icon">
                {drawerExpanded ? "expand_more" : "expand_less"}
              </span>
            </div>
          </div>
          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto px-6 pb-8 pt-4 custom-scrollbar">
            {/* Exports inside drawer */}
            <div className="flex gap-3 mb-6">
              <button
                onClick={() => openExportModal('midi')}
                className="flex-1 py-2.5 rounded-lg border border-white/10 bg-surface/50 text-center text-sm font-label-md font-semibold"
              >
                Export MIDI
              </button>
              <button
                onClick={() => openExportModal('text')}
                className="flex-1 py-2.5 rounded-lg bg-secondary text-on-secondary text-center text-sm font-label-md shadow-[0_0_10px_rgba(79,219,200,0.3)]"
              >
                Export Lyrics
              </button>
            </div>
            
            {/* Master Tempo (Mobile) */}
            <div className="mb-6 p-4 rounded-xl bg-surface/50 border border-white/5 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="font-mono-label text-secondary uppercase">Tempo</span>
                <span className="font-headline-md text-on-surface">{masterTempo} BPM</span>
              </div>
              <input
                type="range"
                min="60"
                max="180"
                value={masterTempo}
                onChange={(e) => handleTempoChange(Number(e.target.value))}
                className="w-full accent-secondary h-1.5 bg-surface-container-highest rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Instrument Rack (Mobile) */}
            <div className="mb-6 p-4 rounded-xl bg-surface/50 border border-white/5 flex flex-col gap-4">
              <h4 className="font-mono-label text-secondary uppercase">Instrument Rack</h4>
              <div className="flex flex-col gap-3">
                {activeInstruments.map((inst, idx) => {
                  const isFirst = idx === 0;
                  const volume = instrumentVolumes[inst] ?? 75;
                  const icon = getInstrumentIcon(inst);
                  return (
                    <div
                      key={idx}
                      className="bg-surface-container/60 border border-white/5 rounded-xl p-3 flex items-center gap-3"
                    >
                      <span className="material-symbols-outlined text-secondary text-xl">{icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-on-surface truncate">{inst}</span>
                          <span className="text-[9px] text-on-surface-variant/70 font-mono-label">
                            {isFirst ? "ACTIVE" : "STANDBY"}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={volume}
                          onChange={(e) => setInstrumentVolumes({ ...instrumentVolumes, [inst]: Number(e.target.value) })}
                          className="w-full h-1 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-secondary"
                        />
                      </div>
                      <button
                        onClick={() => handleSwapInstrument(idx)}
                        className="px-2.5 py-1 rounded bg-surface-bright text-on-surface text-[10px] font-label-md border border-white/5"
                      >
                        Swap
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={handleAddInstrument}
                className="w-full py-2.5 rounded-xl border border-dashed border-white/20 text-on-surface-variant text-xs flex justify-center items-center gap-2 font-label-md"
              >
                <span className="material-symbols-outlined text-xs">add</span> Add Instrument
              </button>
            </div>

            {/* AI Copilot (Mobile) */}
            <div className="mb-6 p-4 rounded-xl bg-surface/50 border border-primary/20 flex flex-col gap-4">
              <h4 className="font-mono-label text-primary uppercase">AI Copilot</h4>
              <div className="flex flex-col gap-2">
                <textarea
                  value={iterInstruction}
                  onChange={(e) => setIterInstruction(e.target.value)}
                  disabled={iterLoading}
                  className="w-full bg-surface-container border border-white/10 rounded-lg p-3 text-on-surface text-sm focus:border-primary outline-none resize-none h-20"
                  placeholder="Change instructions..."
                />
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-xs font-label-md">
                  <span>Creativity</span>
                  <span className="text-primary font-mono-label">{creativity}%</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={creativity}
                  onChange={(e) => setCreativity(Number(e.target.value))}
                  className="w-full accent-primary h-1 bg-surface-container-highest rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <button
                onClick={onIterate}
                disabled={iterLoading || iterInstruction.trim() === ""}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-secondary text-background font-label-md font-semibold text-sm"
              >
                {iterLoading ? "Regenerating..." : "Regenerate Section"}
              </button>
            </div>

            {/* Version History (Mobile) */}
            {history.length > 0 && (
              <div className="mb-6">
                <h4 className="font-mono-label text-secondary uppercase mb-3">Version History</h4>
                <div className="flex items-center gap-3 overflow-x-auto version-scroll pb-2 pt-2">
                  {history.map((entry, idx) => {
                    const isCurrent = entry.spec === spec;
                    const isBase = idx === 0;
                    const label = isBase ? "v.01" : `v.0${idx + 1}`;
                    return (
                      <div
                        key={idx}
                        onClick={() => onRestore(entry)}
                        className={`relative shrink-0 w-[140px] h-[60px] rounded-xl p-2 cursor-pointer flex flex-col justify-between overflow-hidden transition-all ${
                          isCurrent
                            ? "bg-surface-container-low border-2 border-secondary"
                            : "bg-surface border border-white/5"
                        }`}
                      >
                        <span className="font-label-md text-[11px] text-on-surface">{label}</span>
                        <span className="text-[9px] text-on-surface-variant font-mono-label">
                          {isCurrent ? "(Current)" : "Restorable"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Technical Specs */}
            <div className="border-t border-white/10 pt-4">
              <ul className="space-y-3">
                <li className="flex justify-between items-center">
                  <span className="font-body-md text-[14px] text-on-surface-variant">Model Version</span>
                  <span className="font-mono-label text-mono-label text-secondary">watsonx.ai llama-3.3-70b</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="font-body-md text-[14px] text-on-surface-variant">Generation status</span>
                  <span className="font-mono-label text-mono-label text-primary">Success</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        spec={spec}
        initialFormat={exportModalFormat}
      />
    </>
  );
}

// Main page
// ---------------------------------------------------------------------------


export default function Home() {
  const router = useRouter();
  // ── Generation form ──
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [spec, setSpec] = useState<SongSpec | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Playback ──
  const [playing, setPlaying] = useState(false);
  const engineRef = useRef<AudioEngine | null>(null);

  // ── Iteration ──
  const [iterInstruction, setIterInstruction] = useState("");
  const [iterLoading, setIterLoading] = useState(false);
  const [iterError, setIterError] = useState<string | null>(null);

  // ── History ──
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Dispose engine whenever spec changes
  useEffect(() => {
    const prev = engineRef.current;
    engineRef.current = null;
    setPlaying(false);
    prev?.dispose();
  }, [spec]);

  // Dispose on unmount
  useEffect(() => {
    return () => { engineRef.current?.dispose(); };
  }, []);

  // Load spec from sessionStorage if redirected from /create
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedSpec = sessionStorage.getItem("cadence_spec");
      const storedPrompt = sessionStorage.getItem("cadence_prompt");
      if (storedSpec) {
        try {
          const parsed = JSON.parse(storedSpec);
          setSpec(parsed);
          if (storedPrompt) {
            setPrompt(storedPrompt);
            setHistory([{ instruction: null, label: storedPrompt, spec: parsed, timestamp: Date.now() }]);
          } else {
            setHistory([{ instruction: null, label: parsed.mood || "Generated Song", spec: parsed, timestamp: Date.now() }]);
          }
        } catch (e) {
          console.error("Failed to parse stored spec from sessionStorage", e);
        }
        sessionStorage.removeItem("cadence_spec");
        sessionStorage.removeItem("cadence_prompt");
      }
    }
  }, []);

  // ── Audio helpers ──
  async function getEngine(): Promise<AudioEngine> {
    if (!engineRef.current && spec) {
      const { createAudioEngine } = await import("@/lib/audioEngine");
      engineRef.current = createAudioEngine(spec);
    }
    return engineRef.current!;
  }

  async function handlePlay() {
    const engine = await getEngine();
    await engine.play();
    setPlaying(true);
  }

  async function handlePause() {
    await engineRef.current?.pause();
    setPlaying(false);
  }

  async function handleStop() {
    await engineRef.current?.stop();
    setPlaying(false);
  }

  // ── Initial generate ──
  async function handleGenerate() {
    if (!prompt.trim()) return;
    setLoading(true);
    setSpec(null);
    setError(null);
    setIterError(null);
    setIterInstruction("");

    try {
      const res = await fetch("/api/generate-song", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(friendlyGenerateError(null, res.status));
        return;
      }

      const parsed = parseSongSpec(data.spec);
      if (!parsed.success) {
        setError("Couldn't generate a song right now — the AI returned an unexpected response. Please try again.");
        return;
      }

      const newSpec = parsed.data;
      setSpec(newSpec);
      setHistory([{ instruction: null, label: prompt, spec: newSpec, timestamp: Date.now() }]);
    } catch (err) {
      setError(friendlyGenerateError(err));
    } finally {
      setLoading(false);
    }
  }

  // ── Iteration ──
  async function handleIterate() {
    if (!spec) return;
    setIterLoading(true);
    setIterError(null);

    try {
      const res = await fetch("/api/generate-song", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentSpec: spec, instruction: iterInstruction }),
      });

      const data = await res.json();

      if (!res.ok) {
        setIterError(friendlyIterateError(null, res.status));
        return;
      }

      const parsed = parseSongSpec(data.spec);
      if (!parsed.success) {
        setIterError("Couldn't apply this revision — the AI returned an unexpected response. Your previous version is still intact.");
        return;
      }

      const newSpec = parsed.data;
      const instruction = iterInstruction;
      setSpec(newSpec);
      setHistory((prev) => [
        ...prev,
        { instruction, label: instruction, spec: newSpec, timestamp: Date.now() },
      ]);
      setIterInstruction("");
    } catch (err) {
      setIterError(friendlyIterateError(err));
    } finally {
      setIterLoading(false);
    }
  }

  function handleRestoreHistory(entry: HistoryEntry) {
    setSpec(entry.spec);
    setIterError(null);
  }

  const isGenerating = loading || iterLoading;

  // ── View state: "hero" (no spec) or "studio" (spec present) ──
  const hasSpec = !loading && !!spec;

  return (
    <div
      className="min-h-screen relative overflow-x-hidden"
      style={{ background: "#0b1326" }}
    >
      {/* Ambient background glows */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(circle at 50% 0%, rgba(221,183,255,0.13) 0%, transparent 60%), " +
            "radial-gradient(circle at 90% 50%, rgba(79,219,200,0.08) 0%, transparent 50%)",
        }}
      />

      {/* ── Nav ── */}
      <TopNav />

      <main className="relative z-10">

        {/* ──────────────────────────────────────────────────
            HERO SECTION
        ────────────────────────────────────────────────── */}
        <section className="relative w-full min-h-[80vh] flex flex-col items-center justify-center px-6 md:px-16 overflow-hidden">
          {/* Central glow blob */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              width: 800, height: 800,
              background: "radial-gradient(circle, rgba(221,183,255,0.08) 0%, transparent 65%)",
              borderRadius: "50%",
            }}
          />
          {/* Bottom-right teal blob */}
          <div
            className="absolute pointer-events-none"
            style={{
              bottom: 0, right: 0,
              width: 450, height: 450,
              background: "radial-gradient(circle, rgba(79,219,200,0.07) 0%, transparent 65%)",
              borderRadius: "50%",
            }}
          />

          <div className="relative z-10 w-full max-w-[720px] mx-auto text-center flex flex-col items-center py-20">

            {/* ── Main heading ── */}
            <h1
              className="font-bold tracking-tight mb-5"
              style={{
                fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)",
                fontSize: "clamp(52px, 8vw, 80px)",
                lineHeight: 1.05,
                color: "#dae2fd",
                letterSpacing: "-0.03em",
              }}
            >
              Cadence
            </h1>

            {/* ── Subtitle ── */}
            <p
              className="mb-12 max-w-[520px]"
              style={{
                fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)",
                fontSize: "clamp(20px, 3vw, 28px)",
                fontWeight: 600,
                lineHeight: 1.3,
                color: "rgba(218,226,253,0.65)",
              }}
            >
              Turn your mood into music.
            </p>

            {/* ── Prompt input pill ── */}
            <div className="relative w-full max-w-[640px]">
              {/* Glow halo behind input — always faint, brightens on focus */}
              <div
                className="absolute inset-0 rounded-full pointer-events-none transition-opacity duration-500"
                style={{
                  background: "linear-gradient(90deg, rgba(221,183,255,0.25), rgba(79,219,200,0.25))",
                  filter: "blur(12px)",
                  opacity: 0.5,
                }}
              />
              {/* The pill itself */}
              <div
                className="relative flex items-center"
                style={{
                  background: "rgba(23,31,51,0.85)",
                  backdropFilter: "blur(24px)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 9999,
                  padding: "6px 6px 6px 16px",
                }}
              >
                {/* Left icon */}
                <span
                  className="material-symbols-outlined shrink-0 mr-2"
                  style={{ fontSize: "22px", color: "#4fdbc8" }}
                >
                  graphic_eq
                </span>

                {/* Text input */}
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={isGenerating}
                  placeholder="Describe your mood or idea..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && prompt.trim()) {
                      e.preventDefault();
                      router.push(`/create?prompt=${encodeURIComponent(prompt.trim())}`);
                    }
                  }}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "#dae2fd",
                    fontSize: "16px",
                    lineHeight: 1.5,
                    fontFamily: "var(--font-inter, 'Inter', sans-serif)",
                    padding: "10px 8px",
                  }}
                />

                {/* Right arrow button — gradient circle */}
                <button
                  onClick={() => {
                    if (prompt.trim()) {
                      router.push(`/create?prompt=${encodeURIComponent(prompt.trim())}`);
                    }
                  }}
                  disabled={prompt.trim() === ""}
                  aria-label="Generate"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #ddb7ff, #4fdbc8)",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: prompt.trim() ? "pointer" : "not-allowed",
                    opacity: prompt.trim() ? 1 : 0.4,
                    flexShrink: 0,
                    transition: "box-shadow 0.2s ease, opacity 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (prompt.trim())
                      (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 20px rgba(79,219,200,0.55)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "";
                  }}
                >
                  {loading ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 0.8s linear infinite" }}>
                      <circle cx="12" cy="12" r="10" stroke="#1a0030" strokeWidth="4" strokeOpacity="0.25" />
                      <path fill="#1a0030" fillOpacity="0.9" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                  ) : (
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontSize: "20px",
                        color: "#1a0030",
                        fontVariationSettings: "'FILL' 1",
                      }}
                    >
                      arrow_forward
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* ── Mood suggestion chips ── */}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              {MOOD_SUGGESTIONS.map((mood) => (
                <button
                  key={mood}
                  onClick={() => setPrompt(mood)}
                  disabled={isGenerating}
                  style={{
                    padding: "8px 20px",
                    borderRadius: 9999,
                    border: "1px solid rgba(79,219,200,0.25)",
                    background: "rgba(79,219,200,0.05)",
                    color: "#4fdbc8",
                    fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)",
                    fontSize: "13px",
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    cursor: isGenerating ? "not-allowed" : "pointer",
                    opacity: isGenerating ? 0.4 : 1,
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isGenerating) {
                      const el = e.currentTarget as HTMLButtonElement;
                      el.style.background = "linear-gradient(90deg, #ddb7ff, #4fdbc8)";
                      el.style.color = "#1a0030";
                      el.style.borderColor = "transparent";
                      el.style.boxShadow = "0 0 14px rgba(79,219,200,0.35)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.background = "rgba(79,219,200,0.05)";
                    el.style.color = "#4fdbc8";
                    el.style.borderColor = "rgba(79,219,200,0.25)";
                    el.style.boxShadow = "";
                  }}
                >
                  {mood}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ──────────────────────────────────────────────────
            STUDIO SECTION  (visible after generation)
        ────────────────────────────────────────────────── */}
        {(loading || spec || error) && (
          <section className={`${hasSpec ? "max-w-[1400px]" : "max-w-2xl"} mx-auto px-6 md:px-margin-desktop pb-2xl`}>

            {/* Error banner */}
            {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

            {/* Loading skeleton */}
            {loading && <SpecSkeleton />}

            {/* Responsive Player Studio */}
            {hasSpec && (
              <StudioView
                spec={spec!}
                playing={playing}
                onPlay={handlePlay}
                onPause={handlePause}
                onStop={handleStop}
                iterInstruction={iterInstruction}
                setIterInstruction={setIterInstruction}
                iterLoading={iterLoading}
                iterError={iterError}
                onIterate={handleIterate}
                history={history}
                onRestore={handleRestoreHistory}
              />
            )}
          </section>
        )}

        {/* ──────────────────────────────────────────────────
            HOW IT WORKS  (always visible, below hero / studio)
        ────────────────────────────────────────────────── */}
        {!spec && !loading && <HowItWorksSection />}

      </main>

      {/* Mobile sticky CTA — only visible when no spec yet */}
      {!spec && !loading && (
        <div className="md:hidden fixed bottom-0 left-0 w-full p-4 bg-gradient-to-t from-background via-background/90 to-transparent z-50 pb-8 pt-12">
          <button
            onClick={handleGenerate}
            disabled={prompt.trim() === "" || isGenerating}
            className="btn-gradient w-full py-4 flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(221,183,255,0.4)] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              play_arrow
            </span>
            Start Generating Free
          </button>
        </div>
      )}

      <Footer />
    </div>
  );
}
