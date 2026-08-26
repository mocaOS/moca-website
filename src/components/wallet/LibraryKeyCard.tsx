"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthSession } from "@/hooks/useAuthSession";
import { isEligibleToSubmit, KEY_REQUIREMENT_TEXT } from "@/lib/web3/eligibility";
import type { Holdings } from "@/lib/web3/types";

const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace";

/**
 * "Library API Key" card in the account sidebar: eligible wallets (≥100 $MOCA,
 * or ≥1 Art DeCC0 / MOCA ROOM) mint a personal read-only Cortex key
 * here. Deliberately minimal — explainer, one button (generate or rotate, the
 * latter behind an inline "old key stops working" confirm), and a one-time
 * reveal of the fresh secret. Key state lives in Cortex; the app stores nothing.
 */

interface KeyInfo {
  keyPrefix: string | null;
  isActive: boolean;
  createdAt: string | null;
  lastUsedAt: string | null;
}

interface KeyStatus {
  configured: boolean;
  authed: boolean;
  apiUrl?: string;
  key?: KeyInfo | null;
}

async function fetchKeyStatus(): Promise<KeyStatus> {
  const res = await fetch("/api/keys", { cache: "no-store" });
  if (res.status === 503) return { configured: false, authed: false };
  if (res.status === 401) return { configured: true, authed: false };
  if (!res.ok) {
    // Surface the server's reason (e.g. a misconfigured admin key) verbatim.
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error || "Failed to read key status");
  }
  const json = (await res.json()) as { apiUrl: string; key: KeyInfo | null };
  return { configured: true, authed: true, apiUrl: json.apiUrl, key: json.key };
}

const BUTTON =
  "rounded-[var(--radius)] border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--muted)] disabled:pointer-events-none disabled:opacity-50";

const CORTEX_SKILLS_URL = "https://cortexskills.org";

const KEY_PLACEHOLDER = "<key>";

/**
 * The one-paste agent setup prompt. The real secret only exists client-side
 * right after a generate/rotate (Cortex reveals it once) — with an existing
 * key, a modal offers rotating into a fresh one (auto-filled) or copying with
 * the <key> placeholder to fill in manually.
 */
function installPrompt(apiUrl: string, key: string): string {
  return (
    `Install the MOCA Cortex. You find the installation instructions for the ` +
    `Cortex Skill at ${CORTEX_SKILLS_URL}. The base URL is ${apiUrl} and my ` +
    `API key is ${key}. The Cortex is called "MOCA Library".`
  );
}

export function LibraryKeyCard({ holdings }: { holdings: Holdings }) {
  const qc = useQueryClient();
  const { isAuthenticated, signIn } = useAuthSession();
  const eligible = isEligibleToSubmit(holdings);

  // Stable key (NOT keyed on auth state): sign-in refetches this query in
  // place instead of remounting it, so the card never blanks out mid-flow.
  const {
    data: status,
    isPending,
    isError,
    error: statusError,
    refetch,
  } = useQuery({
    queryKey: ["library-key", holdings.address],
    queryFn: fetchKeyStatus,
    staleTime: 30_000,
  });

  const [busy, setBusy] = useState(false);
  const [confirmingRotate, setConfirmingRotate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The fresh secret, shown exactly once (cleared when the sheet unmounts).
  const [minted, setMinted] = useState<{ key: string; apiUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [installCopied, setInstallCopied] = useState(false);
  // Existing-key warning modal: "choose" offers rotate-and-copy vs. copy with
  // the <key> placeholder; "reveal" shows the finished prompt after a rotate
  // (auto-copy is attempted, but the text stays visible for manual copy).
  const [installModal, setInstallModal] = useState<"choose" | "reveal" | null>(
    null,
  );

  // First load: nothing yet (the card pops in when the status arrives).
  if (isPending) return null;

  // A status read failure must NOT hide the card silently (a misconfigured
  // admin key would otherwise look like the feature doesn't exist).
  if (isError || !status) {
    return (
      <section
        className="rounded-[var(--radius)] border p-4"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <div
          className="mb-1 text-[11px] uppercase tracking-[0.08em]"
          style={{ color: "var(--fg2)" }}
        >
          Library API Key
        </div>
        <p className="mb-3 text-[13px]" style={{ color: "var(--fg2)" }}>
          {statusError instanceof Error && statusError.message
            ? statusError.message
            : "Couldn’t read your key status."}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className={BUTTON}
          style={{ borderColor: "var(--border)", color: "var(--fg1)" }}
        >
          Retry
        </button>
      </section>
    );
  }

  // Not configured on the server (no admin key) → no card at all.
  if (!status.configured) return null;

  const handleSignIn = async () => {
    setError(null);
    setBusy(true);
    try {
      await signIn();
      // Stay busy until the authed status is actually in — otherwise the
      // sign-in button re-renders idle for a beat before the card updates.
      await refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  const generate = async (): Promise<{ key: string; apiUrl: string } | null> => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/keys", { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as {
        key?: string;
        apiUrl?: string;
        error?: string;
      };
      if (!res.ok || !json.key) {
        throw new Error(json.error || "Could not issue the key");
      }
      const fresh = { key: json.key, apiUrl: json.apiUrl || "" };
      setMinted(fresh);
      setConfirmingRotate(false);
      await qc.invalidateQueries({ queryKey: ["library-key"] });
      return fresh;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not issue the key");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const copyKey = async () => {
    if (!minted) return;
    try {
      await navigator.clipboard.writeText(minted.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard blocked — the key is selectable text */
    }
  };

  const key = status.key;
  const installApiUrl = minted?.apiUrl || status.apiUrl || "https://cortex.eco";

  const copyInstallText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setInstallCopied(true);
      setTimeout(() => setInstallCopied(false), 1200);
    } catch {
      /* clipboard blocked — the modal keeps the text selectable */
    }
  };

  const handleInstallCopy = () => {
    // Fresh secret in memory → the prompt is complete, copy straight away.
    if (minted) {
      void copyInstallText(installPrompt(installApiUrl, minted.key));
      return;
    }
    // Existing key whose secret we can't know → let the user choose.
    if (status.authed && key) {
      setError(null);
      setInstallModal("choose");
      return;
    }
    // No key yet (or not signed in) → placeholder; the hint below explains.
    void copyInstallText(installPrompt(installApiUrl, KEY_PLACEHOLDER));
  };

  const rotateAndCopy = async () => {
    const fresh = await generate();
    if (!fresh) return; // error renders inside the modal
    setInstallModal("reveal");
    void copyInstallText(installPrompt(fresh.apiUrl || installApiUrl, fresh.key));
  };

  return (
    <section
      className="rounded-[var(--radius)] border p-4"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}
    >
      <div
        className="mb-1 text-[11px] uppercase tracking-[0.08em]"
        style={{ color: "var(--fg2)" }}
      >
        Library API Key
      </div>
      <p className="mb-3 text-[13px] leading-relaxed" style={{ color: "var(--fg2)" }}>
        Get your personal key to the MOCA Library! Use it to connect your
        agents and apps. Your account needs to hold at least 100 $MOCA, 1
        DeCC0, or 1 ROOM — we periodically check and revoke keys when
        conditions are not met.
      </p>

      {/* Existing key status */}
      {status.authed && key && !minted && (
        <div
          className="mb-3 flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border px-3 py-2"
          style={{ borderColor: "var(--border)", background: "var(--muted)" }}
        >
          <span
            className="truncate text-xs"
            style={{ fontFamily: MONO, color: "var(--fg1)" }}
          >
            {key.keyPrefix || "cortex_user_…"}
          </span>
          <span
            className="shrink-0 text-[11px] uppercase tracking-[0.08em]"
            style={{ color: key.isActive ? "var(--accent)" : "var(--fg3)" }}
          >
            {key.isActive ? "Active" : "Disabled"}
          </span>
        </div>
      )}

      {/* One-time reveal of a freshly minted key */}
      {minted && (
        <div
          className="mb-3 rounded-[var(--radius-sm)] border p-3"
          style={{ borderColor: "var(--accent)", background: "var(--muted)" }}
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <code
              className="break-all text-xs"
              style={{ fontFamily: MONO, color: "var(--fg1)" }}
            >
              {minted.key}
            </code>
            <button
              type="button"
              onClick={copyKey}
              className="shrink-0 rounded-[var(--radius-sm)] border px-2 py-1 text-[11px] transition-colors hover:bg-[var(--card)]"
              style={{ borderColor: "var(--border)", color: "var(--fg1)" }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: "var(--fg2)" }}>
            Shown once — store it now. Send it as the{" "}
            <code style={{ fontFamily: MONO }}>X-API-Key</code> header to{" "}
            <code className="break-all" style={{ fontFamily: MONO }}>
              {minted.apiUrl}
            </code>
          </p>
        </div>
      )}

      {/* Action row */}
      {!status.authed ? (
        <button
          type="button"
          onClick={handleSignIn}
          disabled={busy}
          className={BUTTON}
          style={{ borderColor: "var(--border)", color: "var(--fg1)" }}
        >
          {busy ? "Waiting for signature…" : "Sign in to manage your key"}
        </button>
      ) : !key && !minted ? (
        <>
          <button
            type="button"
            onClick={generate}
            disabled={busy || !eligible}
            className={BUTTON}
            style={{ borderColor: "var(--border)", color: "var(--fg1)" }}
          >
            {busy ? "Generating…" : "Generate API key"}
          </button>
          {!eligible && (
            <p className="mt-2 text-[11px]" style={{ color: "var(--fg3)" }}>
              {KEY_REQUIREMENT_TEXT}
            </p>
          )}
        </>
      ) : !minted ? (
        confirmingRotate ? (
          <div>
            <p className="mb-2 text-[12px] leading-relaxed" style={{ color: "var(--fg1)" }}>
              Rotating creates a new key and disables the current one
              immediately — anything still using it will stop working.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={generate}
                disabled={busy}
                className={BUTTON}
                style={{ borderColor: "var(--accent)", color: "var(--fg1)" }}
              >
                {busy ? "Rotating…" : "Rotate now"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingRotate(false)}
                disabled={busy}
                className={BUTTON}
                style={{ borderColor: "var(--border)", color: "var(--fg2)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setConfirmingRotate(true)}
              disabled={!eligible}
              className={BUTTON}
              style={{ borderColor: "var(--border)", color: "var(--fg1)" }}
            >
              Rotate key
            </button>
            {!eligible && (
              <p className="mt-2 text-[11px]" style={{ color: "var(--fg3)" }}>
                {KEY_REQUIREMENT_TEXT}
              </p>
            )}
          </>
        )
      ) : null}

      {error && (
        <p className="mt-2 text-[12px]" style={{ color: "var(--destructive)" }}>
          {error}
        </p>
      )}

      {/* Install in your agents */}
      <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--border)" }}>
        <div
          className="mb-1 text-[11px] uppercase tracking-[0.08em]"
          style={{ color: "var(--fg2)" }}
        >
          Install in your agents
        </div>
        <p
          className="mb-3 text-[13px] leading-relaxed"
          style={{ color: "var(--fg2)" }}
        >
          Any AI agent can use the MOCA Library through the Cortex Skill — you
          find the installation instructions at{" "}
          <a
            href={CORTEX_SKILLS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 transition-colors hover:text-[var(--fg1)]"
            style={{ color: "var(--fg1)" }}
          >
            cortexskills.org
          </a>
          . Copy the setup prompt below and paste it to your agent.
        </p>
        <button
          type="button"
          onClick={handleInstallCopy}
          className={BUTTON}
          style={{ borderColor: "var(--border)", color: "var(--fg1)" }}
        >
          {installCopied && !installModal ? "Copied" : "Copy setup prompt"}
        </button>
        {!minted && !key && (
          <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "var(--fg3)" }}>
            Generate your key above first and the prompt includes it
            automatically — otherwise it copies with a{" "}
            <code style={{ fontFamily: MONO }}>{KEY_PLACEHOLDER}</code>{" "}
            placeholder to replace with your actual key.
          </p>
        )}
      </div>

      {/* Existing-key modal: rotate into a fresh key (auto-filled) or copy
          with the <key> placeholder. */}
      {installModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Copy setup prompt"
          >
            <button
              type="button"
              aria-label="Close"
              onClick={() => setInstallModal(null)}
              className="absolute inset-0 cursor-default"
              style={{ background: "oklch(0 0 0 / 0.6)" }}
            />
            <div
              className="relative w-full max-w-[400px] rounded-[var(--radius-xl)] border p-5"
              style={{
                background: "var(--popover)",
                borderColor: "var(--border)",
                boxShadow: "var(--shadow-xl)",
              }}
            >
              {installModal === "choose" ? (
                <>
                  <div
                    className="mb-2 text-sm font-medium"
                    style={{ color: "var(--fg1)" }}
                  >
                    Include your API key?
                  </div>
                  <p
                    className="mb-3 text-[12px] leading-relaxed"
                    style={{ color: "var(--fg2)" }}
                  >
                    Your key was revealed only once when it was created, so it
                    can&rsquo;t be filled in automatically.
                  </p>
                  <div
                    className="mb-3 break-words rounded-[var(--radius-sm)] border p-2.5 text-[11px] leading-relaxed"
                    style={{
                      fontFamily: MONO,
                      borderColor: "var(--border)",
                      background: "var(--muted)",
                      color: "var(--fg2)",
                    }}
                  >
                    {installPrompt(installApiUrl, KEY_PLACEHOLDER)}
                  </div>
                  <p
                    className="mb-4 text-[12px] leading-relaxed"
                    style={{ color: "var(--fg2)" }}
                  >
                    If you never used your current key, rotate into a fresh one
                    and it&rsquo;s filled in for you — the old key stops working
                    immediately. Otherwise copy as is and replace{" "}
                    <code style={{ fontFamily: MONO }}>{KEY_PLACEHOLDER}</code>{" "}
                    with your actual key.
                  </p>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={rotateAndCopy}
                      disabled={busy || !eligible}
                      className={BUTTON}
                      style={{ borderColor: "var(--accent)", color: "var(--fg1)" }}
                    >
                      {busy ? "Rotating…" : "Rotate key & copy"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void copyInstallText(
                          installPrompt(installApiUrl, KEY_PLACEHOLDER),
                        );
                        setInstallModal(null);
                      }}
                      disabled={busy}
                      className={BUTTON}
                      style={{ borderColor: "var(--border)", color: "var(--fg1)" }}
                    >
                      Copy with placeholder
                    </button>
                    <button
                      type="button"
                      onClick={() => setInstallModal(null)}
                      disabled={busy}
                      className={BUTTON}
                      style={{ borderColor: "var(--border)", color: "var(--fg2)" }}
                    >
                      Cancel
                    </button>
                  </div>
                  {!eligible && (
                    <p className="mt-2 text-[11px]" style={{ color: "var(--fg3)" }}>
                      {KEY_REQUIREMENT_TEXT}
                    </p>
                  )}
                  {error && (
                    <p
                      className="mt-2 text-[12px]"
                      style={{ color: "var(--destructive)" }}
                    >
                      {error}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div
                    className="mb-2 text-sm font-medium"
                    style={{ color: "var(--fg1)" }}
                  >
                    Setup prompt ready
                  </div>
                  <p
                    className="mb-3 text-[12px] leading-relaxed"
                    style={{ color: "var(--fg2)" }}
                  >
                    Your new key is included
                    {installCopied
                      ? " and the prompt is copied to your clipboard."
                      : " — copy the prompt below."}{" "}
                    This is the only time it&rsquo;s shown; it also appears once
                    in the key card behind this dialog.
                  </p>
                  <div
                    className="mb-4 break-words rounded-[var(--radius-sm)] border p-2.5 text-[11px] leading-relaxed"
                    style={{
                      fontFamily: MONO,
                      borderColor: "var(--accent)",
                      background: "var(--muted)",
                      color: "var(--fg1)",
                    }}
                  >
                    {minted && installPrompt(installApiUrl, minted.key)}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        minted &&
                        void copyInstallText(
                          installPrompt(installApiUrl, minted.key),
                        )
                      }
                      className={BUTTON}
                      style={{ borderColor: "var(--border)", color: "var(--fg1)" }}
                    >
                      {installCopied ? "Copied" : "Copy"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setInstallModal(null)}
                      className={BUTTON}
                      style={{ borderColor: "var(--border)", color: "var(--fg2)" }}
                    >
                      Done
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}
