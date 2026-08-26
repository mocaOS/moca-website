/**
 * Client-side escape hatch for a wedged web3 session. A stale WalletConnect
 * pairing (wallet dropped the session, relay handshake never resolves) leaves
 * wagmi stuck in "reconnecting" forever — the connect button reads
 * "Connecting…" and there is no UI path to disconnect. Clearing every store
 * the connect stack persists to and reloading is the only reliable recovery:
 *
 * - wagmi state lives in cookies (Web3Provider uses `cookieStorage`)
 * - WalletConnect v2 sessions live in localStorage (`wc@2:*`) and IndexedDB
 * - AppKit/W3M keep their own localStorage entries (`@appkit*`, `@w3m*`, …)
 *
 * Scoped to those prefixes only — never touches the museum's own localStorage
 * (chats, exhibits, world layout).
 */

const WEB3_STORAGE_PREFIXES = [
  "wc@2:",
  "@appkit",
  "@w3m",
  "W3M",
  "WCM",
  "wagmi",
  "reown",
];

const WC_INDEXED_DB = "WALLET_CONNECT_V2_INDEXED_DB";

function isWeb3Key(key: string): boolean {
  return WEB3_STORAGE_PREFIXES.some((p) => key.startsWith(p));
}

/** Wipe all persisted wallet/WalletConnect/AppKit state. Best-effort, never throws. */
export function clearWeb3Storage(): void {
  for (const store of [window.localStorage, window.sessionStorage]) {
    try {
      for (let i = store.length - 1; i >= 0; i--) {
        const key = store.key(i);
        if (key && isWeb3Key(key)) store.removeItem(key);
      }
    } catch {
      /* storage blocked — nothing to clear */
    }
  }

  // wagmi persists via cookieStorage (see Web3Provider) — expire those cookies.
  try {
    for (const cookie of document.cookie.split(";")) {
      const name = cookie.split("=")[0]?.trim();
      if (name && isWeb3Key(name)) {
        document.cookie = `${name}=; Max-Age=0; path=/`;
      }
    }
  } catch {
    /* cookies blocked */
  }

  try {
    window.indexedDB?.deleteDatabase(WC_INDEXED_DB);
  } catch {
    /* indexedDB blocked */
  }
}

/**
 * Fully reset the web3 session: try a graceful disconnect (bounded — a dead
 * WalletConnect session can hang the relay call indefinitely), then hard-clear
 * all persisted state and reload so the providers boot from a clean slate.
 */
export async function resetWeb3Session(
  disconnect?: () => Promise<unknown>,
): Promise<void> {
  if (disconnect) {
    await Promise.race([
      disconnect().catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  }
  clearWeb3Storage();
  window.location.reload();
}
