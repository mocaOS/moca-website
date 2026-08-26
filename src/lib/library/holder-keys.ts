import "server-only";
import { getAddress } from "viem";
import { getCortexUrl, getCortexAdminKey } from "@/lib/cortex";
import { getHoldings } from "@/lib/web3/holdings";
import { isEligibleToSubmit } from "@/lib/web3/eligibility";

/**
 * Per-holder read-only Cortex API keys ("Library API keys").
 *
 * Wallets that pass the holdings gate (≥100 $MOCA, or ≥1 Art DeCC0 / MOCA ROOM
 * — the `isEligibleToSubmit` rule in web3/eligibility.ts) can mint one
 * personal read-only key for the Library's Cortex backend from the account
 * sidebar.
 *
 * There is no database: Cortex's own key store IS the registry. Every key we
 * issue is named `moca-holder:0x<address>` (lowercase), so listing keys via the
 * admin API and filtering on that prefix yields every connected account —
 * that's what the periodic sweep (`recheckAllHolderKeys`) walks to disable keys
 * whose wallet no longer holds enough, and to re-enable them when it does again.
 *
 * All calls run through CORTEX_ADMIN_API_KEY (key CRUD needs the `admin`
 * permission). One key per address: issuing deletes any previous keys for that
 * address before creating the new one, which is also how "rotate" works.
 */

export const HOLDER_KEY_PREFIX = "moca-holder:";

const ADDRESS_RE = /^0x[a-f0-9]{40}$/;

export function holderKeysConfigured(): boolean {
  return !!(getCortexAdminKey() && getCortexUrl());
}

function call(path: string, init: RequestInit = {}): Promise<Response> {
  const key = getCortexAdminKey() || "";
  return fetch(`${getCortexUrl()}${path}`, {
    ...init,
    headers: { "X-API-Key": key, ...(init.headers || {}) },
  });
}

// Cortex /api/admin/api-keys list entry (snake_case, per the Cortex API).
interface CortexKeyRow {
  id: string;
  name: string;
  key_prefix?: string | null;
  permissions?: string[];
  is_active?: boolean;
  last_used_at?: string | null;
  created_at?: string | null;
}

/** A holder key as exposed to the museum app (address parsed from the name). */
export interface HolderKey {
  id: string;
  /** Lowercased wallet address the key was issued to. */
  address: string;
  /** Masked prefix for display, e.g. "cortex_user_abc...". */
  keyPrefix: string | null;
  isActive: boolean;
  createdAt: string | null;
  lastUsedAt: string | null;
}

function toHolderKey(row: CortexKeyRow): HolderKey | null {
  if (!row.name?.startsWith(HOLDER_KEY_PREFIX)) return null;
  const address = row.name.slice(HOLDER_KEY_PREFIX.length).toLowerCase();
  if (!ADDRESS_RE.test(address)) return null;
  return {
    id: row.id,
    address,
    keyPrefix: row.key_prefix ?? null,
    isActive: row.is_active !== false,
    createdAt: row.created_at ?? null,
    lastUsedAt: row.last_used_at ?? null,
  };
}

/** Every holder key currently registered in Cortex (the whole registry). */
export async function listHolderKeys(): Promise<HolderKey[]> {
  const res = await call("/api/admin/api-keys");
  if (!res.ok) {
    throw new Error(`Cortex key list failed (${res.status})`);
  }
  // Deployed Cortex returns a bare array; the docs show {keys: [...]}. Accept both.
  const json = (await res.json()) as CortexKeyRow[] | { keys?: CortexKeyRow[] };
  const rows = Array.isArray(json) ? json : (json.keys ?? []);
  return rows.map(toHolderKey).filter((k): k is HolderKey => k !== null);
}

/** The key issued to one wallet, or null. */
export async function getHolderKey(address: string): Promise<HolderKey | null> {
  const addr = address.toLowerCase();
  const keys = await listHolderKeys();
  return keys.find((k) => k.address === addr) ?? null;
}

/**
 * Issue (or rotate) the read-only key for a wallet. Any existing keys for the
 * address are DELETED first — the old secret stops working immediately — then a
 * fresh `read`-permission key is created. Returns the full secret, which Cortex
 * only ever reveals at creation time. Eligibility is the CALLER's job (the API
 * route re-checks holdings before invoking this).
 */
export async function issueHolderKey(address: string): Promise<{
  key: string;
  holder: HolderKey;
}> {
  const addr = getAddress(address).toLowerCase(); // throws on malformed input
  const name = `${HOLDER_KEY_PREFIX}${addr}`;

  // Rotate = delete every previous key for this address (dedupes any
  // same-name strays from a lost race too).
  const existing = (await listHolderKeys()).filter((k) => k.address === addr);
  for (const key of existing) {
    const res = await call(`/api/admin/api-keys/${key.id}`, { method: "DELETE" });
    // 404 = already gone (concurrent rotate) — fine. Anything else is fatal:
    // never leave two live secrets for one wallet.
    if (!res.ok && res.status !== 404) {
      throw new Error(`Cortex key delete failed (${res.status})`);
    }
  }

  const created = await call("/api/admin/api-keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, permissions: ["read"] }),
  });
  if (!created.ok) {
    throw new Error(`Cortex key create failed (${created.status})`);
  }
  const row = (await created.json()) as CortexKeyRow & { key: string };
  const holder = toHolderKey(row);
  if (!row.key || !holder) {
    throw new Error("Cortex returned an unexpected key shape");
  }
  return { key: row.key, holder };
}

async function setKeyActive(id: string, active: boolean): Promise<void> {
  const res = await call(
    `/api/admin/api-keys/${id}/${active ? "activate" : "revoke"}`,
    { method: "POST" },
  );
  if (!res.ok) {
    throw new Error(
      `Cortex key ${active ? "activate" : "revoke"} failed (${res.status})`,
    );
  }
}

export interface RecheckSummary {
  checked: number;
  revoked: number;
  reactivated: number;
  unchanged: number;
  /** Wallets whose holdings couldn't be read this run (left untouched). */
  skipped: number;
}

/**
 * The holdings sweep behind the cron: walk every issued holder key, re-read the
 * wallet's on-chain holdings, and revoke keys whose wallet dropped below the
 * gate / reactivate keys whose wallet qualifies again.
 *
 * Fail-safe by design: a wallet whose holdings READ throws is skipped, never
 * revoked — an RPC/Moralis outage must not mass-disable members. (getHoldings
 * fails soft per source, so a total outage can still read as "holds nothing";
 * the auto-reactivate on the next healthy sweep is the recovery for that.)
 * Wallets are checked a few at a time to stay gentle on Moralis quota.
 */
export async function recheckAllHolderKeys(): Promise<RecheckSummary> {
  const keys = await listHolderKeys();
  const summary: RecheckSummary = {
    checked: keys.length,
    revoked: 0,
    reactivated: 0,
    unchanged: 0,
    skipped: 0,
  };

  const CONCURRENCY = 3;
  for (let i = 0; i < keys.length; i += CONCURRENCY) {
    await Promise.all(
      keys.slice(i, i + CONCURRENCY).map(async (key) => {
        let eligible: boolean;
        try {
          eligible = isEligibleToSubmit(await getHoldings(key.address));
        } catch {
          summary.skipped += 1;
          return;
        }
        try {
          if (!eligible && key.isActive) {
            await setKeyActive(key.id, false);
            summary.revoked += 1;
            console.log(`[holder-keys] revoked key for ${key.address} (below holdings gate)`);
          } else if (eligible && !key.isActive) {
            await setKeyActive(key.id, true);
            summary.reactivated += 1;
            console.log(`[holder-keys] reactivated key for ${key.address} (holdings restored)`);
          } else {
            summary.unchanged += 1;
          }
        } catch (err) {
          summary.skipped += 1;
          console.warn(
            `[holder-keys] could not update key for ${key.address}:`,
            err instanceof Error ? err.message : err,
          );
        }
      }),
    );
  }

  return summary;
}
