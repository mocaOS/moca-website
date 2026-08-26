import type { Holdings } from "./types";

/**
 * Holdings rule for the personal Library API keys: a wallet must hold at least
 * `MIN_MOCA_TO_SUBMIT` $MOCA, OR at least one Art DeCC0, OR at least one MOCA
 * ROOM. Pure + client-safe. Document submissions are NOT gated on this anymore
 * — any connected wallet may submit; spam control is the admin review step.
 */

export const MIN_MOCA_TO_SUBMIT = 100;

// Gates the personal Library API keys (holder-keys.ts); the cron sweep
// disables a key when its wallet drops below this.
export const KEY_REQUIREMENT_TEXT =
  "Hold at least 100 $MOCA, 1 Art DeCC0, or 1 MOCA ROOM to keep a Library API key.";

export function isEligibleToSubmit(
  holdings: Holdings | null | undefined,
): boolean {
  if (!holdings) return false;
  const moca = Number(holdings.moca?.total ?? "0");
  if (Number.isFinite(moca) && moca >= MIN_MOCA_TO_SUBMIT) return true;
  return (holdings.collections ?? []).some((c) => (c.items?.length ?? 0) > 0);
}
