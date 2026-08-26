export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  // Back-compat: LIBRARY_API_URL and NEXT_PUBLIC_API_URL were renamed to
  // CORTEX_API_URL (server-only — the browser never calls the backend directly,
  // so a NEXT_PUBLIC_ prefix was a misnomer). Mirror the deprecated names onto
  // the new one so the rest of the codebase can read CORTEX_API_URL exclusively.
  if (!process.env.CORTEX_API_URL && process.env.LIBRARY_API_URL) {
    process.env.CORTEX_API_URL = process.env.LIBRARY_API_URL;
    console.warn(
      "[env] LIBRARY_API_URL is deprecated; please rename to CORTEX_API_URL."
    );
  }
  if (!process.env.CORTEX_API_URL && process.env.NEXT_PUBLIC_API_URL) {
    process.env.CORTEX_API_URL = process.env.NEXT_PUBLIC_API_URL;
    console.warn(
      "[env] NEXT_PUBLIC_API_URL is deprecated; please rename to CORTEX_API_URL (server-only)."
    );
  }

  // The museum boots without a Cortex key — galleries/exhibitions work
  // regardless, and the Library degrades to a "not configured" state. Warn so
  // an operator notices, but don't block startup.
  if (!process.env.CORTEX_API_KEY) {
    console.warn(
      "[env] No CORTEX_API_KEY set — the Library (Cortex chat) is disabled until one is provided."
    );
  }

  // Periodic holder-key sweep: re-check every issued Library API key against
  // its wallet's holdings, revoking/reactivating as they change. In-process so
  // it works with zero external setup; POST /api/keys/recheck exists for
  // external schedulers. HOLDER_KEYS_RECHECK_HOURS=0 disables.
  const sweepHours = Number(process.env.HOLDER_KEYS_RECHECK_HOURS ?? "6");
  if (Number.isFinite(sweepHours) && sweepHours > 0) {
    const { holderKeysConfigured, recheckAllHolderKeys } = await import(
      "@/lib/library/holder-keys"
    );
    const g = globalThis as { __mocaHolderKeySweep?: NodeJS.Timeout };
    if (holderKeysConfigured() && !g.__mocaHolderKeySweep) {
      const sweep = async () => {
        try {
          const s = await recheckAllHolderKeys();
          console.log(
            `[holder-keys] sweep: ${s.checked} checked, ${s.revoked} revoked, ` +
              `${s.reactivated} reactivated, ${s.skipped} skipped`
          );
        } catch (err) {
          console.warn(
            "[holder-keys] sweep failed:",
            err instanceof Error ? err.message : err
          );
        }
      };
      // First pass shortly after boot (let the app settle), then the interval.
      setTimeout(sweep, 60_000).unref?.();
      g.__mocaHolderKeySweep = setInterval(sweep, sweepHours * 3_600_000);
      g.__mocaHolderKeySweep.unref?.();
      console.log(`[holder-keys] sweep scheduled every ${sweepHours}h`);
    }
  }
}
