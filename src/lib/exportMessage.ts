import { ChatMessage } from "@/types";
import { t } from "@/lib/i18n";

// One message as a self-contained Markdown section: role heading, the content
// verbatim (citation markers like [src_N] stay in place), and — for answers —
// a numbered footnote list of the cited documents. Port of cortex-chat's
// per-message download (src/lib/exportChat.ts there).
export function messageToMarkdown(message: ChatMessage): string {
  const lines: string[] = [
    message.role === "user" ? `## ${t("exportRoleUser")}` : `## ${t("exportRoleAssistant")}`,
    "",
    message.content.trim(),
  ];
  if (message.role === "assistant" && message.sources?.length) {
    lines.push("");
    lines.push(`**${t("exportSources")}**`);
    message.sources.forEach((s, i) => {
      lines.push(`${i + 1}. ${s.metadata.filename}`);
    });
  }
  return lines.join("\n") + "\n";
}

// Filesystem-safe basename from the message's first line, so several
// downloads from one chat stay tellable apart.
function safeFilename(text: string, fallback: string): string {
  return (
    text
      .replace(/[^\p{L}\p{N} _-]/gu, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60) || fallback
  );
}

export function downloadMessageMarkdown(message: ChatMessage): void {
  const firstLine = message.content.trim().split("\n")[0] ?? "";
  const name = safeFilename(firstLine, message.role === "user" ? "question" : "answer");
  const blob = new Blob([messageToMarkdown(message)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
