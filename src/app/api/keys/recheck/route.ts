import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getSession } from "@/lib/web3/session";
import { isLibraryAdmin } from "@/lib/web3/admins";
import {
  holderKeysConfigured,
  recheckAllHolderKeys,
} from "@/lib/library/holder-keys";

export const dynamic = "force-dynamic";
export const revalidate = 0;
// A sweep re-reads holdings for every issued key — give it room.
export const maxDuration = 300;

/**
 * The holder-key holdings sweep, as an HTTP trigger for external schedulers
 * (Coolify scheduled task / system cron):
 *
 *   curl -X POST -H "Authorization: Bearer $HOLDER_KEYS_CRON_SECRET" \
 *     https://museumofcryptoart.com/api/keys/recheck
 *
 * The same sweep also runs in-process on an interval (instrumentation.ts,
 * HOLDER_KEYS_RECHECK_HOURS), so an external cron is optional. Library admins
 * with a SIWE session may trigger it manually too.
 */

function secretMatches(req: NextRequest): boolean {
  const secret = process.env.HOLDER_KEYS_CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  const presented = header.replace(/^Bearer\s+/i, "");
  const a = Buffer.from(presented);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!holderKeysConfigured()) {
    return NextResponse.json(
      { error: "Library API keys are not configured" },
      { status: 503 },
    );
  }

  if (!secretMatches(req)) {
    const session = await getSession();
    if (!session || !isLibraryAdmin(session.address)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 401 });
    }
  }

  try {
    const summary = await recheckAllHolderKeys();
    console.log(
      `[holder-keys] sweep: ${summary.checked} checked, ${summary.revoked} revoked, ` +
        `${summary.reactivated} reactivated, ${summary.skipped} skipped`,
    );
    return NextResponse.json(summary);
  } catch (err) {
    console.warn(
      "[holder-keys] sweep failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json({ error: "Sweep failed" }, { status: 502 });
  }
}
