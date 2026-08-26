import "server-only";
import { getCortexUrl, getCortexManagementKey } from "@/lib/cortex";

/**
 * Write-side Cortex client for promoting approved submissions into the
 * "Collective" collection. Uses the management key (`CORTEX_MANAGEMENT_API_KEY`)
 * exclusively — never the read-only chat key. Mirrors the ingest flow in
 * apps/hyperfy/harvest-hyperfy-docs.mjs (resolve-or-create collection + upload).
 */

const COLLECTIVE_NAME = process.env.CORTEX_COLLECTIVE_COLLECTION || "Collective";

// Cortex enforces this; enforce it here too so we fail before the upload.
export const MAX_SUBMISSION_BYTES = 50 * 1024 * 1024;
export const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".md", ".docx", ".xlsx"];

// crawl4ai content filter for web imports — "fit" = readability extraction.
const CRAWL_CONTENT_FILTER = "fit";
// Soft client-side cap on how many pages a single URL submission crawls (the
// submitted page + discovered same-host links). Keeps a community submission
// bounded even against a large site; Cortex's own per-job cap still applies on
// top. Set `CORTEX_CRAWL_MAX_URLS` to tune.
const CRAWL_MAX_URLS = Math.max(
  1,
  parseInt(process.env.CORTEX_CRAWL_MAX_URLS || "100", 10) || 100,
);

let collectiveIdCache: string | null = null;

export function managementConfigured(): boolean {
  return !!(getCortexManagementKey() && getCortexUrl());
}

function call(path: string, init: RequestInit = {}): Promise<Response> {
  const key = getCortexManagementKey() || "";
  return fetch(`${getCortexUrl()}${path}`, {
    ...init,
    headers: { "X-API-Key": key, ...(init.headers || {}) },
  });
}

/** Resolve (or lazily create) the target collection id, cached per process. */
export async function resolveCollectiveId(): Promise<string> {
  if (collectiveIdCache) return collectiveIdCache;

  const listRes = await call("/api/collections");
  if (!listRes.ok) {
    throw new Error(`Cortex collections list failed (${listRes.status})`);
  }
  const { collections } = (await listRes.json()) as {
    collections: { id: string; name: string }[];
  };
  const hit = collections.find(
    (c) => c.name.toLowerCase() === COLLECTIVE_NAME.toLowerCase(),
  );
  if (hit) {
    collectiveIdCache = hit.id;
    return hit.id;
  }

  const created = await call("/api/collections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: COLLECTIVE_NAME,
      description:
        "Community-submitted documents reviewed and approved into the MOCA Library.",
    }),
  });
  if (!created.ok) {
    throw new Error(`Cortex collection create failed (${created.status})`);
  }
  const col = (await created.json()) as { id: string };
  collectiveIdCache = col.id;
  return col.id;
}

/**
 * Upload a file into the Collective collection and start processing. Encodes the
 * submitter address into Cortex's free-text `source` field for provenance.
 * Returns the created Cortex document id.
 */
export async function uploadToCollective(params: {
  bytes: ArrayBuffer;
  filename: string;
  contentType: string;
  submittedBy: string;
}): Promise<string> {
  const collectionId = await resolveCollectiveId();

  const form = new FormData();
  form.append(
    "file",
    new Blob([params.bytes], { type: params.contentType || "application/octet-stream" }),
    params.filename,
  );

  const qs = new URLSearchParams({
    collection_id: collectionId,
    start_processing: "true",
    source: `community:${params.submittedBy.toLowerCase()}`,
  });

  const res = await call(`/api/upload?${qs.toString()}`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    // 507 = Cortex free-disk guardrail (MIN_FREE_DISK_MB); 429 with a
    // month-scale Retry-After = monthly unit quota (MAX_QUERIES_PER_MONTH).
    if (res.status === 507) {
      throw new Error(
        "Cortex refused the upload: the instance is out of disk space. Free up storage on the Cortex host and approve again.",
      );
    }
    if (res.status === 429) {
      throw new Error(
        `Cortex refused the upload: rate limit or monthly usage quota reached${detail ? ` — ${detail.slice(0, 200)}` : ""}. Approve again later.`,
      );
    }
    throw new Error(
      `Cortex upload failed (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`,
    );
  }
  const data = (await res.json()) as { document_id?: string };
  if (!data.document_id) throw new Error("Cortex upload returned no document_id");
  return data.document_id;
}

/** True for a well-formed http(s) URL. */
export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** FastAPI errors are `{"detail": "..."}`; fall back to the raw body. */
async function cortexDetail(res: Response): Promise<string> {
  const raw = await res.text().catch(() => "");
  try {
    const j = JSON.parse(raw) as { detail?: unknown };
    return typeof j.detail === "string" ? j.detail : raw;
  } catch {
    return raw;
  }
}

/**
 * POST /api/web-import for a URL list, retrying once (truncated) if Cortex
 * rejects the batch for exceeding its per-job cap. Returns the async task id.
 */
async function webImport(
  urls: string[],
  collectionId: string,
  submittedBy?: string,
): Promise<{ taskId: string; acceptedUrls: number }> {
  const send = (list: string[]) =>
    call("/api/web-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        urls: list,
        collection_id: collectionId,
        content_filter: CRAWL_CONTENT_FILTER,
        // Attribute the crawl to the submitter (source: `crawl:<domain>
        // community:<addr>`), mirroring uploadToCollective's provenance.
        ...(submittedBy ? { submitted_by: submittedBy.toLowerCase() } : {}),
      }),
    });

  let res = await send(urls);
  if (res.status === 400) {
    const detail = await cortexDetail(res);
    // "Too many URLs (N); this plan allows M per job." — retry with the first M
    // (the submitted page stays first, so it's always kept).
    const m = detail.match(/allows\s+(\d+)\s+per job/i);
    if (m) {
      const cap = Math.max(1, parseInt(m[1], 10));
      res = await send(urls.slice(0, cap));
    } else {
      throw new Error(
        `Cortex rejected the web import${detail ? `: ${detail.slice(0, 200)}` : ""}.`,
      );
    }
  }

  if (!res.ok) {
    const detail = await cortexDetail(res);
    if (res.status === 404) {
      throw new Error(
        "Cortex web crawling is disabled on this instance (ENABLE_WEB_CRAWL). Enable it to approve URL submissions.",
      );
    }
    if (res.status === 403) {
      throw new Error(
        `Cortex refused the import: ${detail.slice(0, 200) || "document or graph limit reached"}.`,
      );
    }
    if (res.status === 429) {
      throw new Error(
        `Cortex refused the import: rate limit or monthly usage quota reached${detail ? ` — ${detail.slice(0, 200)}` : ""}. Approve again later.`,
      );
    }
    if (res.status === 507) {
      throw new Error(
        "Cortex refused the import: the instance is out of disk space. Free up storage on the Cortex host and approve again.",
      );
    }
    throw new Error(
      `Cortex web import failed (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ""}.`,
    );
  }

  const data = (await res.json()) as {
    task_id?: string;
    accepted_urls?: number;
  };
  if (!data.task_id) throw new Error("Cortex web import returned no task_id");
  return { taskId: data.task_id, acceptedUrls: data.accepted_urls ?? urls.length };
}

/** How much of a submitted URL to ingest. */
export type CrawlMode = "site" | "page";

/**
 * Ingest a submitted URL into the Collective collection.
 *
 * - `"site"` (personal website): discover same-host links, then web-import the
 *   submitted page plus every discovered link — the whole site as one document.
 * - `"page"` (article / interview): import ONLY the submitted URL. No discovery,
 *   so a single article on a large third-party domain (a magazine, gallery, news
 *   outlet) never drags in ~100 unrelated pages.
 *
 * The URL analogue of `uploadToCollective`: hands the work to Cortex's async
 * crawl+ingest pipeline and returns the import task id (processing continues in
 * Cortex and is inspectable there).
 */
export async function crawlIntoCollective(params: {
  url: string;
  submittedBy?: string;
  mode?: CrawlMode;
}): Promise<{ taskId: string; acceptedUrls: number; discovered: number }> {
  if (!isHttpUrl(params.url)) {
    throw new Error("Submission is not a valid http(s) URL");
  }
  // Legacy rows (submitted before crawl_mode existed) fall back to site-crawl,
  // preserving prior behavior; new submissions always carry an explicit mode.
  const mode: CrawlMode = params.mode ?? "site";
  const collectionId = await resolveCollectiveId();

  // 1) In "site" mode, discover same-host links. A 502 (crawl service
  //    unreachable) or 404 (feature disabled) is fatal — the import would fail
  //    too — so surface it and leave the row pending for retry. Zero links is
  //    fine (SPA / single page): we still import the submitted page below.
  //    "page" mode skips discovery entirely — just the submitted URL.
  let links: string[] = [];
  if (mode === "site") {
    const disc = await call("/api/web-import/discover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: params.url }),
    });
    if (disc.ok) {
      const data = (await disc.json()) as { links?: { url: string }[] };
      links = (data.links || [])
        .map((l) => l.url)
        .filter((u): u is string => typeof u === "string" && isHttpUrl(u));
    } else if (disc.status === 404) {
      throw new Error(
        "Cortex web crawling is disabled on this instance (ENABLE_WEB_CRAWL). Enable it to approve URL submissions.",
      );
    } else if (disc.status === 502) {
      throw new Error(
        "Cortex could not reach the crawl service to discover links. Check the crawl4ai service and approve again.",
      );
    } else {
      const detail = await cortexDetail(disc);
      throw new Error(
        `Cortex link discovery failed (${disc.status})${detail ? `: ${detail.slice(0, 200)}` : ""}.`,
      );
    }
  }

  // 2) Import the submitted page first, then discovered links, deduped and
  //    bounded by the soft client cap. Cortex's per-job cap is enforced (with a
  //    truncating retry) inside webImport().
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const u of [params.url, ...links]) {
    if (isHttpUrl(u) && !seen.has(u)) {
      seen.add(u);
      urls.push(u);
      if (urls.length >= CRAWL_MAX_URLS) break;
    }
  }

  const { taskId, acceptedUrls } = await webImport(
    urls,
    collectionId,
    params.submittedBy,
  );
  return { taskId, acceptedUrls, discovered: links.length };
}
