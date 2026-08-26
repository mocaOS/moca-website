// Rybbit analytics constants + typed helpers for the MOCA museum site.
// Client-safe (no server-only imports) — imported by the root layout and any
// client component that fires custom events.
//
// siteId + host are PUBLIC identifiers (they ship in the browser by design), so
// they carry baked-in defaults for our self-hosted analytics.cortex.eco instance
// (this site = siteId 3) and are overridable at BUILD time via NEXT_PUBLIC_RYBBIT_*.
// `|| default` (not `??`) so an empty-string build arg still falls back cleanly.

export const RYBBIT_HOST =
  process.env.NEXT_PUBLIC_RYBBIT_HOST || "https://analytics.cortex.eco";

export const RYBBIT_SITE_ID = process.env.NEXT_PUBLIC_RYBBIT_SITE_ID || "3";

// Only load the tracker in production builds (local `next dev` stays untracked),
// with a build-time kill switch.
export const RYBBIT_ENABLED =
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PUBLIC_RYBBIT_DISABLED !== "true";

type RybbitEventProps = Record<
  string,
  string | number | boolean | null | undefined
>;

interface RybbitApi {
  event: (name: string, properties?: RybbitEventProps) => void;
  pageview: () => void;
  identify: (userId: string) => void;
  clearUserId: () => void;
}

declare global {
  interface Window {
    rybbit?: RybbitApi;
  }
}

/**
 * Fire a custom Rybbit event. No-op if the tracker isn't loaded (SSR, local dev,
 * or blocked), so it's always safe to call from client components.
 */
export function trackEvent(name: string, properties?: RybbitEventProps): void {
  if (typeof window !== "undefined" && window.rybbit?.event) {
    window.rybbit.event(name, properties);
  }
}
