"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function TopNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  // Only real, working routes are listed.
  // "My Music" is omitted — no page or data layer exists yet.
  const navLinks = [
    { label: "Explore", href: "/" },
    { label: "About",   href: "/about" },
  ] as const;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header
      className="sticky top-0 z-50 w-full border-b border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]"
      style={{ background: "rgba(11,19,38,0.6)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
    >
      <div className="flex items-center justify-between w-full px-6 py-4">

        {/* Brand logo — navigates home */}
        <Link
          href="/"
          className="font-space text-[22px] font-bold leading-none select-none"
          style={{
            fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)",
            background: "linear-gradient(90deg, #ddb7ff 0%, #4fdbc8 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: "transparent",
          }}
        >
          Cadence
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
                className={[
                  "text-[13px] font-semibold tracking-widest uppercase transition-all duration-300 pb-1",
                  active
                    ? "text-[#4fdbc8] border-b-2 border-[#4fdbc8]"
                    : "text-white/60 hover:text-white/90",
                ].join(" ")}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Trailing actions — only the working CTA */}
        <div className="flex items-center gap-3">

          {/* "Create New" pill — links to /create */}
          <Link
            href="/create"
            className="hidden md:inline-flex items-center justify-center rounded-full text-[13px] font-semibold tracking-wide transition-all"
            style={{
              fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)",
              background: "#b76dff",
              color: "#fff",
              padding: "8px 20px",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 0 18px rgba(183,109,255,0.55)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.boxShadow = "";
            }}
          >
            Create New
          </Link>

          {/* Mobile hamburger */}
          <button
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-full text-white/60 hover:text-white transition-all"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
              {menuOpen ? "close" : "menu"}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div
          className="md:hidden border-t border-white/10 px-6 py-4 flex flex-col gap-4"
          style={{ background: "rgba(23,31,51,0.95)", backdropFilter: "blur(20px)" }}
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
              className={[
                "text-[13px] font-semibold tracking-widest uppercase py-2",
                isActive(link.href) ? "text-[#4fdbc8]" : "text-white/60",
              ].join(" ")}
            >
              {link.label}
            </Link>
          ))}

          {/* Mobile CTA */}
          <Link
            href="/create"
            onClick={() => setMenuOpen(false)}
            className="mt-2 w-full py-3 rounded-full text-white font-semibold text-[14px] text-center block"
            style={{
              background: "#b76dff",
              fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)",
            }}
          >
            Create New
          </Link>
        </div>
      )}
    </header>
  );
}
