import Link from "next/link";

export default function Footer() {
  // Only internal links to real, working pages are kept.
  // Terms / Privacy / API Documentation / Contact removed — no pages exist for these
  // in the submission scope and dead links are worse than no links.
  const navLinks = [
    { label: "Explore", href: "/" },
    { label: "About",   href: "/about" },
    { label: "Create",  href: "/create" },
  ];

  return (
    <footer className="bg-surface-container-lowest w-full py-12 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-md md:px-margin-desktop flex flex-col md:flex-row justify-between items-center gap-6">

        {/* Brand */}
        <div className="font-display text-headline-md text-on-surface opacity-80 hover:opacity-100 transition-opacity">
          Cadence
        </div>

        {/* Internal nav links — all real, working routes */}
        <div className="flex flex-wrap items-center justify-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Copyright + tech credit */}
        <div className="font-body-md text-body-md text-primary opacity-80 text-center">
          © 2026 Cadence AI · Powered by IBM watsonx.ai
        </div>
      </div>
    </footer>
  );
}
