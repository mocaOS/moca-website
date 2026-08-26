import { NextResponse } from "next/server";
import { getSession } from "@/lib/web3/session";
import { getHoldings } from "@/lib/web3/holdings";
import { isEligibleToSubmit, KEY_REQUIREMENT_TEXT } from "@/lib/web3/eligibility";
import {
  holderKeysConfigured,
  getHolderKey,
  issueHolderKey,
} from "@/lib/library/holder-keys";
import { getCortexUrl } from "@/lib/cortex";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Personal Library API keys, self-served from the account sidebar. Both verbs
 * act on the SIWE-verified session address — the wallet is never taken from
 * client input, so you can only ever see/rotate YOUR key.
 */

/** Status of the caller's key (never the secret — that's shown once at mint). */
export async function GET() {
  if (!holderKeysConfigured()) {
    return NextResponse.json(
      { error: "Library API keys are not configured" },
      { status: 503 },
    );
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  try {
    const key = await getHolderKey(session.address);
    return NextResponse.json({
      apiUrl: getCortexUrl(),
      key: key && {
        keyPrefix: key.keyPrefix,
        isActive: key.isActive,
        createdAt: key.createdAt,
        lastUsedAt: key.lastUsedAt,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[holder-keys] status read failed:", msg);
    // 401/403 from Cortex = the #1 misconfiguration: CORTEX_ADMIN_API_KEY is
    // wrong or lacks the `admin` permission. Say so — a generic error sends
    // the operator log-digging for what the status code already tells us.
    const misconfigured = /\((401|403)\)/.test(msg);
    return NextResponse.json(
      {
        error: misconfigured
          ? "The museum's Cortex admin key is invalid or lacks the admin permission"
          : "Could not read key status",
      },
      { status: 502 },
    );
  }
}

/**
 * Generate — or rotate — the caller's read-only key. Holdings gate enforced
 * here (mirrors the sidebar button, so a disabled button can't be bypassed).
 * Rotating deletes the previous key: the old secret stops working immediately.
 * The full secret is returned exactly once.
 */
export async function POST() {
  if (!holderKeysConfigured()) {
    return NextResponse.json(
      { error: "Library API keys are not configured" },
      { status: 503 },
    );
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  try {
    const holdings = await getHoldings(session.address);
    if (!isEligibleToSubmit(holdings)) {
      return NextResponse.json({ error: KEY_REQUIREMENT_TEXT }, { status: 403 });
    }
  } catch {
    return NextResponse.json(
      { error: "Couldn't verify your holdings — please try again" },
      { status: 502 },
    );
  }

  try {
    const { key, holder } = await issueHolderKey(session.address);
    return NextResponse.json(
      {
        key,
        apiUrl: getCortexUrl(),
        keyPrefix: holder.keyPrefix,
        createdAt: holder.createdAt,
      },
      { status: 201 },
    );
  } catch (err) {
    console.warn(
      "[holder-keys] issue failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: "Could not issue the key — please try again" },
      { status: 502 },
    );
  }
}
