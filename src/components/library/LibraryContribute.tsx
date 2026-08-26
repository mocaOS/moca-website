"use client";

import { useState } from "react";
import Link from "next/link";
import { useWallet } from "@/hooks/useWallet";
import { useAuthSession } from "@/hooks/useAuthSession";
import { SubmitDocumentDialog } from "@/components/library/SubmitDocumentDialog";

const PlusIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const ReviewIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" />
  </svg>
);

const PILL =
  "flex h-9 items-center gap-1.5 rounded-[var(--radius)] border px-3 text-sm font-medium transition-colors active:scale-[0.98]";

/**
 * Library toolbar entry points, shown next to the account button:
 *   - "Submit" (any connected wallet) → the submission dialog.
 *   - "Review" (whitelisted admins) → the moderation table at /library/review.
 * Submissions are not holdings-gated — spam control is the admin review step.
 */
export function LibraryContribute() {
  const { isConnected } = useWallet();
  const { isAdmin } = useAuthSession();
  const [open, setOpen] = useState(false);

  if (!isConnected) return null;

  return (
    <>
      {isAdmin && (
        <Link
          href="/library/review"
          className={`${PILL} hover:bg-[var(--muted)]`}
          style={{ borderColor: "var(--border)", color: "var(--fg1)" }}
        >
          <ReviewIcon />
          <span className="hidden sm:inline">Review</span>
        </Link>
      )}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${PILL} hover:bg-[var(--muted)]`}
        style={{ borderColor: "var(--border)", color: "var(--fg1)" }}
      >
        <PlusIcon />
        <span className="hidden sm:inline">Submit</span>
      </button>

      <SubmitDocumentDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
