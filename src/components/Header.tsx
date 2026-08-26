"use client";

import Link from "next/link";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n-client";
import { getCachedConfig } from "@/lib/config";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { LibraryContribute } from "@/components/library/LibraryContribute";

// Mirror the museum's primary nav (components/site/SiteHeader.tsx) EXACTLY so the
// Library reads as the same site chrome — same entries, same order, same styling.
// The right-hand museum links (Collections/Writings/Timeline) are intentionally
// dropped here to make room for the Library-specific controls; "Enter the Library"
// becomes "Leave Library" (you're already inside). Keep this list in sync with the
// left group of SiteHeader.
const NAV = [
  { href: "/decc0s", label: "DeCC0s" },
  { href: "/cortex", label: "Cortex" },
  { href: "/soulweaver", label: "Soulweaver" },
  { href: "/rooms", label: "ROOMs" },
];

const LeaveIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 12H5" />
    <path d="M12 19l-7-7 7-7" />
  </svg>
);

export default function Header({
  logoUrl,
  onToggleSidebar,
}: {
  logoUrl: string;
  onToggleSidebar: () => void;
}) {
  useLocale();
  // Support link is seeded server-side via ConfigBootstrap, so it's present
  // on first paint. Empty URL → no button. Empty label → localized fallback.
  const cfg = getCachedConfig();
  const supportUrl = cfg?.supportUrl?.trim() || "";
  const supportLabel = cfg?.supportLabel?.trim() || t("support");

  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{
        background: "oklch(0.14 0 0 / 0.72)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderColor: "var(--border)",
      }}
    >
      {/* Centered page wrapper — matches every other page. A left gutter (pl) is
          reserved for the chat-history toggle, which floats in it, outside the
          content flow, just left of the logo. */}
      <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between pl-16 pr-5 sm:pr-8">
        {/* Chat-history toggle — absolute, in the left gutter, left of the logo */}
        <button
          onClick={onToggleSidebar}
          className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[var(--radius)] transition-colors hover:bg-[var(--muted)] cursor-pointer sm:left-3"
          style={{ color: "var(--fg2)" }}
          aria-label={t("toggleSidebar")}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Left: logo + primary museum nav (identical to SiteHeader) */}
        <div className="flex items-center gap-1">
          <Link href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="Museum of Crypto Art" className="h-7 w-auto" />
          </Link>
          <nav className="ml-3 hidden items-center gap-1 sm:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="relative rounded-[var(--radius)] px-3.5 py-2 text-sm transition-colors"
                style={{ color: "var(--fg2)" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right: Leave Library + Submit/Review + wallet (+ optional support) */}
        <div className="flex items-center gap-1">
          <Link
            href="/"
            className="mr-1 flex h-9 items-center gap-1.5 rounded-[var(--radius)] px-3 text-sm transition-colors hover:bg-[var(--muted)]"
            style={{ color: "var(--fg2)" }}
          >
            <LeaveIcon />
            <span className="hidden sm:inline">Leave Library</span>
          </Link>
          <LibraryContribute />
          <ConnectButton />
          {supportUrl ? (
            <a
              href={supportUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={supportLabel}
              className="group relative w-9 h-9 rounded-[var(--radius)] flex items-center justify-center text-[var(--accent)] hover:text-white hover:bg-[var(--muted)] transition-colors cursor-pointer"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <path d="M12 17h.01" />
              </svg>
              {/* Instant CSS tooltip — native title attribute has a browser hover delay */}
              <span
                role="tooltip"
                className="pointer-events-none absolute right-0 top-full mt-1.5 whitespace-nowrap rounded-[var(--radius-sm)] border px-2.5 py-1 text-[13px] opacity-0 group-hover:opacity-100 transition-opacity duration-100"
                style={{
                  background: "var(--card)",
                  borderColor: "var(--border)",
                  color: "var(--fg1)",
                  boxShadow: "var(--shadow-xl)",
                }}
              >
                {supportLabel}
              </span>
            </a>
          ) : null}
        </div>
      </div>
    </header>
  );
}
