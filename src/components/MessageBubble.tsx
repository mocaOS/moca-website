"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChatMessage, Source } from "@/types";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n-client";
import { downloadMessageMarkdown } from "@/lib/exportMessage";
import ThinkingIndicator from "./ThinkingIndicator";

interface Props {
  message: ChatMessage;
  onSourceClick: (source: Source) => void;
  // Conversation-wide source pool keyed by `sid`, accumulated across all turns.
  // Lets a message resolve `[src_N]` markers that point at documents first
  // retrieved on an earlier turn (the backend's additive source ledger).
  sourceLedger?: Map<string, Source>;
}

// A resolved citation: which source `[src_N]` points to, and the compact
// 1-based number we actually render for it within this message.
type CitationMap = Map<string, { displayIndex: number; source: Source }>;

function CitationBadge({
  index,
  source,
  onClick,
}: {
  index: number;
  source: Source;
  onClick: () => void;
}) {
  return (
    <span
      className="source-citation"
      title={source.metadata.filename}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {index}
    </span>
  );
}

// Marker that survives markdown parsing (not a link, not a comment)
const CITE_PREFIX = "\u200Bcite:";
const CITE_REGEX = /\u200Bcite:(\d+)\u200B/g;
const CITE_SPLIT = /(\u200Bcite:\d+\u200B)/g;

// Citation patterns. The writer is instructed to cite as [src_1], [src_2], but
// models (especially the smaller chat model) frequently group sources inside a
// single bracket: [src_1, src_3, src_6] or [src_1, 3, 6] \u2014 and often fold prose
// into the bracket too: [Research Summary, src_6, src_7] or [src_6, Research
// Summary]. Match ANY bracket that contains at least one src_N (capturing leading
// space, and not a markdown link `[...](url)`), then pull only the citation ids
// out of it \u2014 the prose is dropped. This is the key to not letting mixed groups
// fall through as raw text.
const CITATION_GROUP_REGEX = /(\s?)(\[[^\]]*?src_\d+[^\]]*\])(?!\()/g;

// Extract citation ids from a matched bracket group (brackets included). Split on
// citation separators and keep only pure `src_N` / bare-number tokens, so folded
// prose ("Research Summary", "Q3 2024 report") and numbers embedded in words are
// never mistaken for a source id.
function citationIdsFrom(group: string): string[] {
  const inner = group.replace(/^\[\s*/, "").replace(/\s*\]$/, "");
  const ids: string[] = [];
  for (const part of inner.split(/\s*[,;&]\s*|\s+and\s+/i)) {
    const mm = part.trim().match(/^(?:src_)?(\d+)$/i);
    if (mm) ids.push(mm[1]);
  }
  return ids;
}

export default function MessageBubble({
  message,
  onSourceClick,
  sourceLedger,
}: Props) {
  useLocale();
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const [userCollapsed, setUserCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);
  const thinkingScrollRef = useRef<HTMLDivElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUser = message.role === "user";

  const handleCopy = () => {
    // Copy the prose without the inline citation brackets (single, grouped, or
    // prose-folded like "[Research Summary, src_6]").
    const text = (message.content || "").replace(CITATION_GROUP_REGEX, "");
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 1500);
    });
  };

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  // Auto-expand thinking while streaming, auto-collapse when done
  const thinkingCount = message.thinking?.length ?? 0;
  const isStreaming = message.isStreaming ?? false;
  useEffect(() => {
    if (isStreaming && thinkingCount > 0 && !userCollapsed) {
      setThinkingExpanded(true);
    }
    if (!isStreaming) {
      setThinkingExpanded(false);
      setUserCollapsed(false);
    }
  }, [isStreaming, thinkingCount, userCollapsed]);

  // Auto-scroll thinking steps to bottom
  useEffect(() => {
    if (thinkingScrollRef.current && isStreaming) {
      thinkingScrollRef.current.scrollTop = thinkingScrollRef.current.scrollHeight;
    }
  }, [thinkingCount, isStreaming]);

  // Resolve every `[src_N]` in the answer. N is the backend's conversation-stable
  // `sid`, not a positional index \u2014 so we look it up by `sid`, first in this
  // message's own sources, then in the conversation-wide ledger (for documents
  // carried over from an earlier turn), and finally fall back to positional
  // (`src_N` \u2192 sources[N-1]) for legacy responses that carry no `sid`. Cited
  // sources are renumbered compactly (1..k in order of first appearance) so the
  // inline badges and the source strip share one consistent numbering.
  const { processedContent, citedSources, citationMap } = useMemo(() => {
    const content = message.content || "";
    const empty = { processedContent: content, citedSources: [] as Source[], citationMap: new Map() as CitationMap };
    if (!content) return empty;

    const resolve = (sid: string): Source | undefined => {
      const local = message.sources?.find((s) => s.sid === sid);
      if (local) return local;
      const fromLedger = sourceLedger?.get(sid);
      if (fromLedger) return fromLedger;
      const idx = parseInt(sid, 10) - 1;
      return message.sources?.[idx];
    };

    const map: CitationMap = new Map();
    const cited: Source[] = [];
    let m: RegExpExecArray | null;
    const scan = new RegExp(CITATION_GROUP_REGEX.source, "g");
    while ((m = scan.exec(content)) !== null) {
      // Resolve every source number in the bracket group so
      // [src_1, src_3, src_6] registers all three, in citation order.
      const nums = citationIdsFrom(m[2]);
      for (const sid of nums) {
        if (map.has(sid)) continue;
        const source = resolve(sid);
        if (source) map.set(sid, { displayIndex: cited.push(source), source });
      }
    }

    // Only markers we can actually resolve become citation badges, one per
    // resolved source (so a grouped [src_1, src_3] renders two badges). A group
    // whose numbers all resolve to nothing (the backend can stream citation
    // markers without ever emitting a matching source) is stripped \u2014 along with
    // any space in front of it \u2014 so it never renders as literal "[src_1]" text.
    const processed = content.replace(
      CITATION_GROUP_REGEX,
      (full, ws, group) => {
        const nums = citationIdsFrom(group);
        const markers = nums
          .filter((sid) => map.has(sid))
          .map((sid) => `${CITE_PREFIX}${sid}\u200B`)
          .join("");
        return markers ? `${ws}${markers}` : "";
      }
    );

    return { processedContent: processed, citedSources: cited, citationMap: map };
  }, [message.content, message.sources, sourceLedger]);

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[85%] md:max-w-[70%] rounded-2xl rounded-br-md px-4 py-2.5 text-[14px] leading-[1.55] whitespace-pre-wrap"
          style={{
            background: "var(--primary)",
            color: "var(--primary-fg)",
          }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  const hasThinking = message.thinking && message.thinking.length > 0;
  const hasSources = citedSources.length > 0;

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] md:max-w-[80%] space-y-2 w-full">
        {/* Thinking steps card */}
        {hasThinking && (
          <div
            className="rounded-[var(--radius-lg)] overflow-hidden text-xs border"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <button
              onClick={() => {
                setThinkingExpanded(!thinkingExpanded);
                setUserCollapsed(thinkingExpanded);
              }}
              className="flex items-center gap-2 px-3.5 py-2.5 w-full text-left text-[var(--fg2)] hover:text-[var(--fg1)] transition-colors"
            >
              {/* Sparkle icon — accent because this represents live AI work */}
              <svg
                className="w-3.5 h-3.5 flex-shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: "var(--accent)" }}
              >
                <path d="M12 3l1.9 5.8L20 10l-5.8 1.9L12 18l-1.9-5.8L4 10l6.1-1.2L12 3z" />
              </svg>
              <span
                className="font-medium flex-1 uppercase tracking-[0.08em] text-[10.5px]"
                style={{ color: "var(--fg2)" }}
              >
                {isStreaming
                  ? `${t("thinking")}…`
                  : `${t("thinking")} · ${message.thinking!.length} ${t("steps")}`}
              </span>
              {isStreaming ? (
                <svg className="w-3.5 h-3.5 animate-spin flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" d="M12 2a10 10 0 0 1 10 10" />
                </svg>
              ) : (
                <svg
                  className={`w-3 h-3 transition-transform ${thinkingExpanded ? "rotate-90" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
            {(isStreaming && !userCollapsed || !isStreaming && thinkingExpanded) && (
              <div
                ref={thinkingScrollRef}
                className="max-h-[200px] overflow-y-auto px-3.5 pb-2.5 thinking-steps-fade"
              >
                {message.thinking!.map((step, i) => (
                  <div key={i} className="flex gap-3 py-0.5 leading-relaxed">
                    <span
                      className="text-[var(--fg3)] select-none w-4 text-right flex-shrink-0 tabular-nums"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {i + 1}
                    </span>
                    <span className="text-[var(--fg2)]">{step}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sub-questions */}
        {message.subQuestions && message.subQuestions.length > 0 && (
          <div
            className="text-xs text-[var(--fg2)] rounded-[var(--radius)] px-3.5 py-2.5 border"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <span
              className="font-medium uppercase tracking-[0.08em] text-[10.5px]"
              style={{ color: "var(--fg2)" }}
            >
              {t("researchAreas")}
            </span>
            <ul className="ml-3 mt-1.5 space-y-0.5 list-disc text-[var(--fg1)]">
              {message.subQuestions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Retrieval progress */}
        {message.isStreaming && message.retrieval && message.retrieval.length > 0 && (
          <div
            className="text-xs text-[var(--fg2)] flex items-center gap-2 px-1"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <svg className="w-3 h-3 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{message.retrieval[message.retrieval.length - 1]}</span>
          </div>
        )}

        {/* Main AI answer card */}
        <div
          className={`group/answer relative rounded-[var(--radius-lg)] border px-4 py-3.5 text-[14.5px] leading-[1.65] ${
            !message.content && message.isStreaming ? "w-fit" : ""
          }`}
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
            color: "var(--fg1)",
          }}
        >
          {/* Copy / download answer — appear on hover/focus once the answer settled */}
          {!message.isStreaming && message.content && (
            <div className="absolute top-2 right-2 flex gap-0.5 opacity-0 group-hover/answer:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100 transition-opacity">
              <button
                onClick={handleCopy}
                title={copied ? t("copied") : t("copyAnswer")}
                aria-label={copied ? t("copied") : t("copyAnswer")}
                className="w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center transition-colors hover:bg-[var(--muted)]"
                style={{ color: copied ? "var(--accent)" : "var(--fg3)" }}
              >
                {copied ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </button>
              {/* Download the answer as a standalone .md (same section format as
                  cortex-chat's transcript export, sources as footnotes). */}
              <button
                onClick={() => downloadMessageMarkdown(message)}
                title={t("downloadMessage")}
                aria-label={t("downloadMessage")}
                className="w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center transition-colors hover:bg-[var(--muted)]"
                style={{ color: "var(--fg3)" }}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <path d="m7 10 5 5 5-5" />
                  <path d="M12 15V3" />
                </svg>
              </button>
            </div>
          )}
          {message.content ? (
            <div className="markdown-content">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children, ...props }) => (
                    <p {...props}>
                      {injectCitations(children, citationMap, onSourceClick)}
                    </p>
                  ),
                  li: ({ children, ...props }) => (
                    <li {...props}>
                      {injectCitations(children, citationMap, onSourceClick)}
                    </li>
                  ),
                  strong: ({ children, ...props }) => (
                    <strong {...props}>
                      {injectCitations(children, citationMap, onSourceClick)}
                    </strong>
                  ),
                  em: ({ children, ...props }) => (
                    <em {...props}>
                      {injectCitations(children, citationMap, onSourceClick)}
                    </em>
                  ),
                }}
              >
                {processedContent}
              </ReactMarkdown>
            </div>
          ) : message.isStreaming ? (
            <ThinkingIndicator message={message} />
          ) : null}

          {/* Sources strip inside the answer card — MOCA pattern */}
          {hasSources && !message.isStreaming && (
            <div
              className="flex flex-wrap gap-1.5 mt-3.5 pt-3 border-t"
              style={{ borderColor: "var(--border)" }}
            >
              {citedSources.map((source, i) => (
                <button
                  key={`${source.chunk_id}-${i}`}
                  onClick={() => onSourceClick(source)}
                  className="group inline-flex items-center gap-1.5 text-[11.5px] px-2.5 py-1 rounded-[6px] transition-colors"
                  style={{
                    background: "var(--muted)",
                    color: "var(--fg1)",
                  }}
                >
                  <span
                    className="text-[10px] leading-none"
                    style={{
                      color: "var(--fg3)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    [{i + 1}]
                  </span>
                  <svg
                    className="w-3.5 h-3.5 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ color: "var(--fg2)" }}
                  >
                    <path d="M14 2H6a2 2 0 0 0 -2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2V8z" />
                    <path d="M14 2v6h6" />
                    <path d="M16 13H8" />
                    <path d="M16 17H8" />
                    <path d="M10 9H8" />
                  </svg>
                  <span className="truncate max-w-[160px]">
                    {source.metadata.filename}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Answer-quality notice — the backend flags a canned safety refusal
              (refused) or a token-capped answer (truncated) on its done frame;
              without this both read exactly like a complete answer. */}
          {!message.isStreaming && (message.refused || message.truncated) && (
            <div
              className="flex items-start gap-2 mt-3 pt-3 border-t text-[12px] leading-snug"
              style={{ borderColor: "var(--border)", color: "var(--fg2)" }}
            >
              <svg
                className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
              <span>
                {message.refused ? (
                  message.refusalSource === "heuristic" ||
                  message.refusalSource === "classifier" ? (
                    <>
                      {/* Which safeguard fired — a bare deflection reads like
                          "no data"; naming the guard tells the user the search
                          never ran and a rephrase (or an admin) fixes it. */}
                      <span
                        className="font-mono uppercase text-[10.5px] tracking-[0.08em] mr-1.5"
                        style={{ color: "var(--fg1)" }}
                      >
                        {t("promptGuardLabel")}
                      </span>
                      {message.refusalSource === "classifier"
                        ? t("answerRefusedClassifier")
                        : t("answerRefusedHeuristic")}
                    </>
                  ) : message.refusalSource === "model" ? (
                    t("answerRefusedModel")
                  ) : (
                    t("answerRefused")
                  )
                ) : (
                  t("answerTruncated")
                )}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function injectCitations(
  children: React.ReactNode,
  citationMap: CitationMap,
  onSourceClick: (source: Source) => void
): React.ReactNode {
  if (!children) return children;
  if (!citationMap.size) return children;

  const childArray = Array.isArray(children) ? children : [children];

  return childArray.flatMap((child, i) => {
    if (typeof child !== "string") return child;

    const parts = child.split(CITE_SPLIT);
    if (parts.length === 1) return child;

    return parts.map((part, j) => {
      const match = part.match(/\u200Bcite:(\d+)\u200B/);
      if (match) {
        const cite = citationMap.get(match[1]);
        if (cite) {
          return (
            <CitationBadge
              key={`c-${i}-${j}`}
              index={cite.displayIndex}
              source={cite.source}
              onClick={() => onSourceClick(cite.source)}
            />
          );
        }
        return null;
      }
      return part || null;
    });
  });
}
