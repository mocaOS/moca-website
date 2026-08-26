import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/web3/session";
import { isLibraryAdmin } from "@/lib/web3/admins";
import {
  submissionsConfigured,
  uploadSubmissionFile,
  createSubmission,
  createUrlSubmission,
  listSubmissions,
  type SubmissionStatus,
} from "@/lib/library/submissions";
import {
  MAX_SUBMISSION_BYTES,
  ALLOWED_EXTENSIONS,
  isHttpUrl,
} from "@/lib/library/cortex-management";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

/**
 * Submit a contribution for review. Requires a SIWE session; the submitter
 * address comes from the verified session, never from client input. Two kinds:
 *  - a **file** (multipart `file`) → uploaded to Directus, or
 *  - a **website URL** (`url` field) → crawled into Cortex on approval.
 * Either way the row lands in the Directus queue as `pending` — nothing is sent
 * to Cortex until an admin approves it.
 */
export async function POST(req: NextRequest) {
  if (!submissionsConfigured()) {
    return NextResponse.json(
      { error: "Submissions are not configured" },
      { status: 503 },
    );
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in to submit" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form" }, { status: 400 });
  }

  const rawTitle = (form.get("title") as string | null)?.trim();
  const file = form.get("file");
  const rawUrl = (form.get("url") as string | null)?.trim();

  // URL (website) submission — only when no file was attached.
  if (!(file instanceof File) || file.size === 0) {
    if (!rawUrl) {
      return NextResponse.json(
        { error: "Provide a file or a website URL" },
        { status: 400 },
      );
    }
    if (!isHttpUrl(rawUrl) || rawUrl.length > 2048) {
      return NextResponse.json(
        { error: "Enter a valid http(s) URL" },
        { status: 400 },
      );
    }
    const url = rawUrl;
    let host = url;
    try {
      host = new URL(url).host;
    } catch {
      /* validated above */
    }
    const title = (rawTitle || host).slice(0, 200);
    // "page" (just this URL) is the safe default; "site" crawls the whole domain.
    const crawlMode = (form.get("crawl_mode") as string | null) === "site" ? "site" : "page";
    try {
      const submission = await createUrlSubmission({
        title,
        url,
        submitted_by: session.address,
        crawl_mode: crawlMode,
      });
      return NextResponse.json({ submission }, { status: 201 });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Submission failed" },
        { status: 502 },
      );
    }
  }

  // Document (file) submission.
  const ext = fileExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json(
      { error: `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}` },
      { status: 400 },
    );
  }
  if (file.size > MAX_SUBMISSION_BYTES) {
    return NextResponse.json(
      { error: "File too large (max 50 MB)" },
      { status: 400 },
    );
  }

  const title = (rawTitle || file.name).slice(0, 200);

  try {
    const fileId = await uploadSubmissionFile(file, title);
    const submission = await createSubmission({
      title,
      file: fileId,
      filename: file.name.slice(0, 255),
      file_type: file.type || "application/octet-stream",
      file_size: file.size,
      submitted_by: session.address,
    });
    return NextResponse.json({ submission }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Submission failed" },
      { status: 502 },
    );
  }
}

const listQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  submitted_by: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
});

/**
 * List submissions. Admins see everything (the review table, with optional
 * filters); any other signed-in wallet sees only their OWN submissions (the
 * account sidebar) — the submitter filter is forced to the session address so
 * no one can browse other people's queue.
 */
export async function GET(req: NextRequest) {
  if (!submissionsConfigured()) {
    return NextResponse.json({ submissions: [] });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const admin = isLibraryAdmin(session.address);

  const parsed = listQuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid filter" }, { status: 400 });
  }

  try {
    const submissions = await listSubmissions({
      status: parsed.data.status as SubmissionStatus | undefined,
      submittedBy: admin ? parsed.data.submitted_by : session.address,
    });
    return NextResponse.json({ submissions });
  } catch {
    return NextResponse.json(
      { error: "Could not read submissions" },
      { status: 502 },
    );
  }
}
