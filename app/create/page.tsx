"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import TopNav from "@/app/components/TopNav";
import Footer from "@/app/components/Footer";
import { parseSongSpec } from "@/lib/songSchema";

// ---------------------------------------------------------------------------
// Genre/Sonic Palette config
// ---------------------------------------------------------------------------

const GENRES = [
  { label: "Synthwave",   defaultSelected: true,  activeStyle: "outline" as const  },
  { label: "Lo-Fi Chill", defaultSelected: false, activeStyle: "outline" as const  },
  { label: "Cinematic",   defaultSelected: true,  activeStyle: "fill"    as const  },
  { label: "Dark Techno", defaultSelected: false, activeStyle: "outline" as const  },
  { label: "Ambient",     defaultSelected: false, activeStyle: "outline" as const  },
];

const ENERGY_LABELS: Record<number, string> = {
  0:   "Silent",
  20:  "Low",
  40:  "Moderate",
  60:  "Medium",
  80:  "High",
  100: "Max",
};

function energyLabel(value: number): string {
  const key = Math.round(value / 20) * 20;
  return ENERGY_LABELS[key] ?? "High";
}

// ---------------------------------------------------------------------------
// Loading state sub-component
// ---------------------------------------------------------------------------

function LoadingState() {
  const [statusText, setStatusText] = useState("Composing melody...");
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    const statusTexts = [
      "Composing melody...",
      "Choosing instruments...",
      "Tuning the mood..."
    ];
    let currentIndex = 0;
    const interval = setInterval(() => {
      setOpacity(0);
      setTimeout(() => {
        currentIndex = (currentIndex + 1) % statusTexts.length;
        setStatusText(statusTexts[currentIndex]);
        setOpacity(1);
      }, 500); // Wait half a second before fading back in
    }, 3000); // Change text every 3 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative z-10 flex flex-col items-center justify-center px-6 py-20 w-full max-w-4xl min-h-[60vh] mx-auto animate-[fade-in-up_0.6s_ease-out] overflow-hidden">
      {/* Ambient Background Glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px] ambient-glow pointer-events-none z-0"></div>
      <div className="absolute top-1/3 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-secondary/5 rounded-full blur-[100px] ambient-glow pointer-events-none z-0" style={{ animationDelay: "-2s" }}></div>

      <div className="relative z-10 flex flex-col items-center justify-center">
        {/* Animated Waveform Visual */}
        <div className="relative flex items-end justify-center gap-2 h-32 mb-12">
          <div className="w-3 bg-gradient-to-t from-secondary to-primary rounded-full bar h-16 shadow-[0_0_15px_rgba(79,219,200,0.5)]"></div>
          <div className="w-3 bg-gradient-to-t from-secondary to-primary rounded-full bar h-24 shadow-[0_0_15px_rgba(79,219,200,0.5)]"></div>
          <div className="w-3 bg-gradient-to-t from-secondary to-primary rounded-full bar h-32 shadow-[0_0_15px_rgba(221,183,255,0.6)]"></div>
          <div className="w-3 bg-gradient-to-t from-secondary to-primary rounded-full bar h-20 shadow-[0_0_15px_rgba(79,219,200,0.5)]"></div>
          <div className="w-3 bg-gradient-to-t from-secondary to-primary rounded-full bar h-12 shadow-[0_0_15px_rgba(79,219,200,0.5)]"></div>
        </div>
        {/* Cycling Status Text */}
        <div className="text-center space-y-4">
          <h1 
            className="font-display text-headline-lg text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary transition-opacity duration-500"
            style={{ opacity }}
          >
            {statusText}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-md mx-auto">
            Our AI engine is currently analyzing parameters and synthesizing unique audio tracks. This usually takes a few moments.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CreatePage() {
  const router = useRouter();

  // Form states
  const [prompt, setPrompt] = useState("");
  const [tempo, setTempo] = useState(120);
  const [energy, setEnergy] = useState(80);
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(
    new Set(GENRES.filter((g) => g.defaultSelected).map((g) => g.label))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill prompt from query parameters on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const queryPrompt = params.get("prompt");
      if (queryPrompt) {
        setPrompt(queryPrompt);
      }
    }
  }, []);

  function toggleGenre(label: string) {
    setSelectedGenres((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }

  async function handleGenerate() {
    if (!prompt.trim() || loading) return;
    setError(null);
    setLoading(true);

    // Build enriched prompt from all inputs
    const genres = Array.from(selectedGenres).join(", ");
    const enrichedPrompt = [
      prompt.trim(),
      genres ? `Genre/style: ${genres}.` : "",
      `Tempo: approximately ${tempo} BPM.`,
      `Energy level: ${energyLabel(energy)}.`,
    ]
      .filter(Boolean)
      .join(" ");

    try {
      const res = await fetch("/api/generate-song", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: enrichedPrompt }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? `Server error ${res.status}. Please try again.`);
        setLoading(false);
        return;
      }

      const parsed = parseSongSpec(data.spec);
      if (!parsed.success) {
        setError("Couldn't generate a song spec — the AI returned an unexpected response. Please try again.");
        setLoading(false);
        return;
      }

      // Transition back to home page — pass spec and original prompt via sessionStorage
      sessionStorage.setItem("cadence_spec", JSON.stringify(parsed.data));
      sessionStorage.setItem("cadence_prompt", prompt.trim());
      router.push("/");
    } catch (err) {
      setError(
        err instanceof TypeError && /fetch|network|failed/i.test((err as TypeError).message)
          ? "Network error — please check your connection and try again."
          : "Couldn't generate a song right now. Please try again."
      );
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen relative overflow-x-hidden flex flex-col justify-between"
      style={{ background: "#0b1326" }}
    >
      {/* Ambient background glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div
          className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] rounded-full ambient-blob-1 mix-blend-screen"
          style={{
            background: "radial-gradient(circle, rgba(221,183,255,0.12) 0%, rgba(11,19,38,0) 70%)",
          }}
        />
        <div
          className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full ambient-blob-2 mix-blend-screen"
          style={{
            background: "radial-gradient(circle, rgba(79,219,200,0.12) 0%, rgba(11,19,38,0) 70%)",
          }}
        />
      </div>

      {/* Top Nav */}
      <TopNav />

      {loading ? (
        <LoadingState />
      ) : (
        <main className="relative z-10 flex flex-col items-center justify-center flex-1 px-6 md:px-16 py-12 overflow-y-auto w-full">
          <div className="w-full max-w-3xl flex flex-col gap-lg animate-[fade-in-up_0.6s_ease-out]">
            
            {/* Header */}
            <div className="text-center mb-md">
              <h2 className="font-display text-display text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary pb-2">
                Describe the Vibe
              </h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant mt-2">
                Paint a picture with words. The AI will translate it into sound.
              </p>
            </div>

            {/* Mood Textarea */}
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary to-secondary rounded-2xl blur opacity-20 group-hover:opacity-40 group-focus-within:opacity-60 transition duration-500"></div>
              <div className="relative bg-surface-container/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={loading}
                  rows={4}
                  placeholder="e.g., Driving through a neon-lit cyber city at midnight, rain on the windshield, feeling unstoppable..."
                  className="w-full bg-transparent border-none outline-none ring-0 focus:ring-0 resize-none font-body-lg text-body-lg text-on-surface disabled:opacity-50"
                  style={{
                    fontFamily: "var(--font-inter, 'Inter', sans-serif)",
                    color: "#dae2fd",
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.ctrlKey && prompt.trim() && !loading) {
                      e.preventDefault();
                      handleGenerate();
                    }
                  }}
                />
              </div>
            </div>

            {/* Control Panel */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
              {/* Sliders Card */}
              <div className="bg-surface-container/40 backdrop-blur-lg border border-white/5 rounded-xl p-6 flex flex-col gap-6">
                {/* Tempo Slider */}
                <div className="flex flex-col gap-sm">
                  <div className="flex justify-between items-center">
                    <label className="font-label-md text-label-md text-on-surface-variant flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">speed</span>
                      Tempo (BPM)
                    </label>
                    <span className="font-mono-label text-mono-label text-secondary">{tempo}</span>
                  </div>
                  <input
                    type="range"
                    min={60}
                    max={200}
                    value={tempo}
                    onChange={(e) => setTempo(Number(e.target.value))}
                    disabled={loading}
                    className="w-full appearance-none bg-transparent cadence-range disabled:opacity-50"
                  />
                </div>

                {/* Energy Slider */}
                <div className="flex flex-col gap-sm">
                  <div className="flex justify-between items-center">
                    <label className="font-label-md text-label-md text-on-surface-variant flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">bolt</span>
                      Energy
                    </label>
                    <span className="font-mono-label text-mono-label text-primary">{energyLabel(energy)}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={100}
                    value={energy}
                    onChange={(e) => setEnergy(Number(e.target.value))}
                    disabled={loading}
                    className="w-full appearance-none bg-transparent cadence-range disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Genre Tags Card */}
              <div className="bg-surface-container/40 backdrop-blur-lg border border-white/5 rounded-xl p-6">
                <label className="font-label-md text-label-md text-on-surface-variant mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">category</span>
                  Sonic Palette
                </label>
                <div className="flex flex-wrap gap-3 mt-4">
                  {GENRES.map((genre) => {
                    const isSelected = selectedGenres.has(genre.label);
                    let btnClass = "px-4 py-2 rounded-full font-label-md text-label-md transition-all ";
                    if (isSelected) {
                      if (genre.activeStyle === "fill") {
                        btnClass += "bg-gradient-to-r from-primary/80 to-secondary/80 text-on-surface shadow-[0_0_15px_rgba(221,183,255,0.3)] border border-transparent";
                      } else {
                        btnClass += "border border-secondary/30 text-secondary hover:bg-secondary/10";
                      }
                    } else {
                      btnClass += "border border-white/10 text-on-surface-variant hover:bg-white/10";
                    }
                    return (
                      <button
                        key={genre.label}
                        onClick={() => toggleGenre(genre.label)}
                        disabled={loading}
                        className={btnClass}
                      >
                        {genre.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Error banner */}
            {error && (
              <div className="flex items-start gap-3 rounded-2xl border border-error/30 bg-error-container/20 px-4 py-3">
                <span className="material-symbols-outlined text-error shrink-0 text-[18px] mt-0.5">
                  error
                </span>
                <p className="flex-1 font-body-md text-body-md text-error">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="text-error/60 hover:text-error text-xl leading-none mt-0.5"
                  aria-label="Dismiss error"
                >
                  ×
                </button>
              </div>
            )}

            {/* Generate CTA */}
            <div className="mt-lg flex justify-center">
              <button
                onClick={handleGenerate}
                disabled={loading || !prompt.trim()}
                className="relative group overflow-hidden rounded-full p-[2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Generate Song"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-primary via-secondary to-primary bg-[length:200%_auto] animate-[cadence-gradient-shift_3s_linear_infinite] opacity-70 group-hover:opacity-100 transition-opacity"></span>
                <div className="relative bg-surface-container-high px-12 py-4 rounded-full flex items-center gap-3 transition-transform group-hover:scale-[0.98]">
                  <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>
                    auto_awesome
                  </span>
                  <span className="font-headline-md text-headline-md font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
                    Generate Song
                  </span>
                </div>
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary blur-xl opacity-30 group-hover:opacity-60 transition-opacity -z-10"></div>
              </button>
            </div>

          </div>
        </main>
      )}

      {/* Footer — identical to home page */}
      <Footer />
    </div>
  );
}
