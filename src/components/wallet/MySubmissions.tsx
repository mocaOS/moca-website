"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthSession } from "@/hooks/useAuthSession";

const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace";

/**
 * "Library submissions" card in the account sidebar's Community tab: the
 * wallet's own document submissions and their review status. Reads the same
 * session-gated GET /api/library/submissions the review table uses — the
 * server scopes non-admins to their own rows.
 */

interface Submission {
  id: string;
  date_created?: string | null;
  submission_type?: "document" | "url";
  title?: string | null;
  filename?: string | null;
  url?: string | null;
  status?: "pending" | "approved" | "rejected";
  rejected_reason?: string | null;
}

async function fetchMySubmissions(): Promise<Submission[]> {
  const res = await fetch("/api/library/submissions", { cache: "no-store" });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error || "Could not read submissions");
  }
  const json = (await res.json()) as { submissions?: Submission[] };
  return json.submissions ?? [];
}

const STATUS_COLOR: Record<string, string> = {
  pending: "var(--fg2)",
  approved: "var(--success)",
  rejected: "var(--destructive)",
};

const BUTTON =
  "rounded-[var(--radius)] border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--muted)] disabled:pointer-events-none disabled:opacity-50";

export function MySubmissions() {
  const qc = useQueryClient();
  const { address, isAuthenticated, signIn } = useAuthSession();
  const [busy, setBusy] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["my-submissions", address],
    queryFn: fetchMySubmissions,
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  const handleSignIn = async () => {
    setSignInError(null);
    setBusy(true);
    try {
      await signIn();
      // The key card's status query is 401-cached — refresh it too so one
      // sign-in unlocks the whole Community tab.
      await qc.invalidateQueries({ queryKey: ["library-key"] });
    } catch (e) {
      setSignInError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
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
        Library submissions
      </div>

      {!isAuthenticated ? (
        <>
          <p
            className="mb-3 text-[13px] leading-relaxed"
            style={{ color: "var(--fg2)" }}
          >
            Documents you submit to the MOCA Library and their review status.
          </p>
          <button
            type="button"
            onClick={handleSignIn}
            disabled={busy}
            className={BUTTON}
            style={{ borderColor: "var(--border)", color: "var(--fg1)" }}
          >
            {busy ? "Waiting for signature…" : "Sign in to view your submissions"}
          </button>
          {signInError && (
            <p className="mt-2 text-[12px]" style={{ color: "var(--destructive)" }}>
              {signInError}
            </p>
          )}
        </>
      ) : isPending ? (
        <p className="py-3 text-[13px]" style={{ color: "var(--fg2)" }}>
          Reading your submissions…
        </p>
      ) : isError ? (
        <div>
          <p className="mb-3 text-[13px]" style={{ color: "var(--fg2)" }}>
            Couldn&rsquo;t read your submissions.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className={BUTTON}
            style={{ borderColor: "var(--border)", color: "var(--fg1)" }}
          >
            Retry
          </button>
        </div>
      ) : data.length === 0 ? (
        <p className="text-[13px] leading-relaxed" style={{ color: "var(--fg2)" }}>
          No submissions yet — use the Submit button in the Library to
          contribute documents to the museum&rsquo;s knowledge base.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.map((s) => (
            <li
              key={s.id}
              className="rounded-[var(--radius-sm)] border px-3 py-2"
              style={{ borderColor: "var(--border)", background: "var(--muted)" }}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className="truncate text-[13px]"
                  style={{ color: "var(--fg1)" }}
                  title={s.url || s.filename || undefined}
                >
                  {s.title || s.filename || s.url || "Untitled"}
                </span>
                <span
                  className="shrink-0 text-[11px] uppercase tracking-[0.08em]"
                  style={{ color: STATUS_COLOR[s.status || "pending"] }}
                >
                  {s.status || "pending"}
                </span>
              </div>
              {(s.submission_type === "url" || (s.url && !s.filename)) && s.url && (
                <div
                  className="mt-0.5 truncate text-[11px]"
                  style={{ color: "var(--fg3)" }}
                  title={s.url}
                >
                  {s.url}
                </div>
              )}
              {s.date_created && (
                <div
                  className="mt-0.5 text-[11px]"
                  style={{ fontFamily: MONO, color: "var(--fg3)" }}
                >
                  {new Date(s.date_created).toLocaleDateString()}
                </div>
              )}
              {s.status === "rejected" && s.rejected_reason && (
                <p
                  className="mt-1 text-[11px] leading-relaxed"
                  style={{ color: "var(--fg2)" }}
                >
                  {s.rejected_reason}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
