"use client";

import { useRouter } from "next/navigation";
import TopNav from "@/app/components/TopNav";
import Footer from "@/app/components/Footer";

export default function AboutPage() {
  const router = useRouter();

  const steps = [
    {
      num: "01",
      icon: "psychology",
      title: "Semantic Interpretation",
      colorHex: "#ddb7ff",
      shadowColor: "rgba(221,183,255,0.2)",
      borderColor: "rgba(221,183,255,0.3)",
      description:
        "User prompts are analyzed for musical intent, genre constraints, and emotional valence before being structured for the generation engine.",
    },
    {
      num: "02",
      icon: "model_training",
      title: "watsonx.ai Generation",
      colorHex: "#4fdbc8",
      shadowColor: "rgba(79,219,200,0.2)",
      borderColor: "rgba(79,219,200,0.3)",
      description:
        "Leveraging IBM watsonx.ai foundation models, the system predicts melodic structures, harmonic progressions, and rhythmic patterns in symbolic space.",
    },
    {
      num: "03",
      icon: "graphic_eq",
      title: "Tone.js Synthesis",
      colorHex: "#ffafd3",
      shadowColor: "rgba(255,175,211,0.2)",
      borderColor: "rgba(255,175,211,0.3)",
      description:
        "Symbolic data is rendered in real-time via the browser Web Audio API using Tone.js, translating notes into high-fidelity, manipulatable soundwaves.",
    },
  ];

  const whyItems = [
    {
      icon: "speed",
      colorClass: "text-secondary",
      title: "Zero Latency Iteration",
      description:
        "By handling synthesis client-side with Tone.js, users can tweak parameters and hear results instantly, eliminating the traditional server round-trip bottleneck.",
    },
    {
      icon: "architecture",
      colorClass: "text-primary",
      title: "Deterministic Control",
      description:
        "Unlike monolithic raw audio generation models, our symbolic approach allows deep, granular control over every instrument, note, and effect post-generation.",
    },
    {
      icon: "security",
      colorClass: "text-tertiary",
      title: "Enterprise-Grade Security",
      description:
        "All AI processing is handled server-side via IBM Cloud. Your API keys and project credentials never reach the browser, keeping your data private.",
    },
  ];

  const eqBars = [
    { h: 48, color: "#4fdbc8" },
    { h: 80, color: "#4fdbc8" },
    { h: 64, color: "#ddb7ff" },
    { h: 96, color: "#4fdbc8" },
    { h: 40, color: "#ddb7ff" },
    { h: 72, color: "#4fdbc8" },
    { h: 56, color: "#ddb7ff" },
    { h: 88, color: "#4fdbc8" },
  ];

  const techStack = [
    { icon: "hub", label: "IBM watsonx.ai", sub: "LLM Foundation Model" },
    { icon: "music_note", label: "Tone.js", sub: "Web Audio Synthesis" },
    { icon: "code", label: "Next.js 14", sub: "React App Framework" },
    { icon: "piano", label: "MIDI Export", sub: "midi-writer-js" },
  ];

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-x-hidden"
      style={{ background: "#0b1326", color: "#dae2fd" }}
    >
      {/* Ambient background blobs */}
      <div
        className="pointer-events-none fixed"
        style={{
          top: "10%", left: "5%",
          width: 600, height: 600,
          background: "radial-gradient(circle, rgba(221,183,255,0.06) 0%, transparent 65%)",
          borderRadius: "50%",
        }}
      />
      <div
        className="pointer-events-none fixed"
        style={{
          bottom: "15%", right: "5%",
          width: 500, height: 500,
          background: "radial-gradient(circle, rgba(79,219,200,0.06) 0%, transparent 65%)",
          borderRadius: "50%",
        }}
      />

      <TopNav />

      <main className="flex-grow w-full max-w-7xl mx-auto px-4 md:px-16 py-20 flex flex-col gap-24 relative z-10">

        {/* Hero */}
        <section className="flex flex-col items-center text-center gap-6 max-w-4xl mx-auto">
          <span
            className="px-3 py-1 rounded-full text-xs font-semibold tracking-widest uppercase border"
            style={{
              color: "#4fdbc8",
              borderColor: "rgba(79,219,200,0.25)",
              background: "rgba(79,219,200,0.08)",
              fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)",
            }}
          >
            How It Works
          </span>

          <h1
            className="text-5xl md:text-6xl font-bold leading-tight"
            style={{
              fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)",
              background: "linear-gradient(to right, #ddb7ff, #4fdbc8)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              color: "transparent",
            }}
          >
            The Architecture of Sound
          </h1>

          <p
            className="text-lg text-white/60 max-w-2xl leading-relaxed"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            Cadence bridges the gap between technical precision and artistic intuition.
            Powered by enterprise-grade AI and real-time audio synthesis, we translate
            creative intent into studio-quality sonic experiences.
          </p>
        </section>

        {/* Generation Pipeline */}
        <section className="flex flex-col gap-8">
          <h2
            className="text-3xl font-semibold text-white"
            style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
          >
            The Generation Pipeline
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((step) => (
              <div
                key={step.num}
                className="group relative rounded-2xl p-6 flex flex-col gap-4 overflow-hidden border border-white/10 transition-all duration-300 hover:border-white/20"
                style={{
                  background: "rgba(15, 23, 42, 0.6)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                }}
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity duration-300 select-none pointer-events-none">
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "80px", color: step.colorHex }}
                  >
                    {step.icon}
                  </span>
                </div>

                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
                  style={{
                    background: "rgba(34,42,61,0.8)",
                    border: `1px solid ${step.borderColor}`,
                    color: step.colorHex,
                    boxShadow: `0 0 15px ${step.shadowColor}`,
                    fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)",
                  }}
                >
                  {step.num}
                </div>

                <h3
                  className="text-xl font-semibold"
                  style={{ color: step.colorHex, fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
                >
                  {step.title}
                </h3>

                <p className="text-white/60 text-sm leading-relaxed" style={{ fontFamily: "Inter, sans-serif" }}>
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Why Cadence */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div className="flex flex-col gap-8">
            <h2
              className="text-3xl font-semibold text-white"
              style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
            >
              Why Build Cadence?
            </h2>

            <div className="flex flex-col gap-8">
              {whyItems.map((item) => (
                <div key={item.title} className="flex items-start gap-4">
                  <span
                    className={`material-symbols-outlined mt-1 shrink-0 ${item.colorClass}`}
                    style={{ fontSize: "22px" }}
                  >
                    {item.icon}
                  </span>
                  <div>
                    <h4
                      className="text-sm font-semibold tracking-wide text-white mb-1"
                      style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
                    >
                      {item.title}
                    </h4>
                    <p className="text-white/60 text-sm leading-relaxed" style={{ fontFamily: "Inter, sans-serif" }}>
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Animated EQ panel */}
          <div
            className="relative w-full h-[380px] rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center group"
            style={{
              background: "rgba(15, 23, 42, 0.6)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <div
              className="absolute inset-0 opacity-50"
              style={{ background: "linear-gradient(135deg, rgba(23,31,51,0.8), rgba(11,19,38,0.8))" }}
            />
            <div className="relative z-10 flex flex-col items-center gap-6">
              <div className="flex items-end gap-2 h-28">
                {eqBars.map((bar, i) => (
                  <div
                    key={i}
                    className="w-3 rounded-t-sm"
                    style={{
                      height: bar.h,
                      background: bar.color,
                      boxShadow: `0 0 10px ${bar.color}80`,
                      animation: `eqPulse ${0.8 + i * 0.15}s ease-in-out infinite alternate`,
                      transformOrigin: "bottom",
                    }}
                  />
                ))}
              </div>
              <div className="flex flex-col items-center gap-2">
                <p
                  className="text-white/40 text-xs tracking-widest uppercase"
                  style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
                >
                  cadence.engine.render()
                </p>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                  <span
                    className="text-secondary text-xs font-semibold tracking-wide"
                    style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
                  >
                    LIVE SYNTHESIS
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Tech Stack */}
        <section className="flex flex-col gap-8">
          <h2
            className="text-3xl font-semibold text-white"
            style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
          >
            Technology Stack
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {techStack.map((tech) => (
              <div
                key={tech.label}
                className="rounded-xl p-5 border border-white/10 flex flex-col gap-3 group hover:border-white/20 transition-all"
                style={{ background: "rgba(23,31,51,0.6)", backdropFilter: "blur(8px)" }}
              >
                <span
                  className="material-symbols-outlined text-primary/80 group-hover:text-primary transition-colors"
                  style={{ fontSize: "28px" }}
                >
                  {tech.icon}
                </span>
                <div>
                  <p
                    className="text-white text-sm font-semibold"
                    style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
                  >
                    {tech.label}
                  </p>
                  <p className="text-white/40 text-xs mt-0.5" style={{ fontFamily: "Inter, sans-serif" }}>
                    {tech.sub}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="flex flex-col items-center text-center gap-6 py-12">
          <h2
            className="text-4xl font-bold text-white"
            style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
          >
            Ready to compose?
          </h2>
          <p className="text-white/60 text-lg max-w-md" style={{ fontFamily: "Inter, sans-serif" }}>
            Describe a feeling, a scene, or a genre. Cadence takes it from there.
          </p>
          <button
            onClick={() => router.push("/create")}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full font-semibold text-sm transition-all"
            style={{
              background: "linear-gradient(to right, #ddb7ff, #4fdbc8)",
              color: "#0b1326",
              fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)",
              boxShadow: "0 0 30px rgba(221,183,255,0.3)",
            }}
          >
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            Start Creating
          </button>
        </section>

      </main>

      <style>{`
        @keyframes eqPulse {
          from { transform: scaleY(0.4); }
          to   { transform: scaleY(1); }
        }
      `}</style>

      <Footer />
    </div>
  );
}
