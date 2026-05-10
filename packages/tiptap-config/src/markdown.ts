import { TiptapTransformer } from "@hocuspocus/transformer";
import * as Y from "yjs";
import { marked } from "marked";
import { getExtensions } from "./extensions.js";

/** Default Y.js field name used by Hocuspocus + Tiptap. Both consumers must
 * agree on this. Atlas uses "default" — we follow. */
export const Y_FIELD = "default";

const extensionsForTransformer = getExtensions({ context: "server" });

/**
 * Convert markdown source to a Tiptap ProseMirror JSON document.
 *
 * Strategy: marked → HTML → DOMParser-equivalent in @tiptap/core schema.
 * This is the same path Atlas uses (HTML intermediate) because direct
 * markdown→ProseMirror parsers don't cover all Tiptap extensions cleanly.
 *
 * For server-side (no DOM): we parse markdown→HTML and rely on
 * TiptapTransformer.toYdoc which uses prosemirror's parseDOM internally
 * via jsdom-style shims. The hocuspocus transformer accepts JSON, so we
 * use the marked → JSON path here directly via tiptap's HTMLContent.
 */
export async function markdownToTiptapJson(md: string): Promise<unknown> {
  // Cheap cooperative path: convert known-safe markdown structures to a
  // ProseMirror-shaped JSON without needing a real DOM. We rely on marked's
  // tokeniser to give us a structured AST, then walk it. This intentionally
  // covers only the structures our extension list supports — anything else
  // round-trips through a paragraph.
  const tokens = marked.lexer(md);
  return { type: "doc", content: tokensToContent(tokens) };
}

/**
 * Convert a Tiptap JSON document back to markdown.
 *
 * Mirror of markdownToTiptapJson. Uses our own walker because
 * prosemirror-markdown doesn't know about TaskItem/TaskList/Table out of
 * the box.
 */
export function tiptapJsonToMarkdown(json: unknown): string {
  if (!json || typeof json !== "object" || (json as { type?: string }).type !== "doc") {
    return "";
  }
  const content = (json as { content?: unknown[] }).content ?? [];
  return content.map(nodeToMarkdown).join("\n\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

/**
 * Build a Y.Doc from markdown source. Used by Hocuspocus Database.fetch
 * when the file row has content_text but no yjs_data yet (first edit).
 */
export async function markdownToYDoc(md: string): Promise<Y.Doc> {
  const json = await markdownToTiptapJson(md);
  return TiptapTransformer.toYdoc(json, Y_FIELD, extensionsForTransformer);
}

/**
 * Materialise a Y.Doc back to markdown. Used by Hocuspocus Database.store
 * to populate the content_text derived view + by the activity-coalesce
 * extension for the audit hash.
 */
export function yDocToMarkdown(yDoc: Y.Doc): string {
  const json = TiptapTransformer.fromYdoc(yDoc, Y_FIELD);
  return tiptapJsonToMarkdown(json);
}

// ─── Walkers ────────────────────────────────────────────────────────

interface MarkedToken {
  type: string;
  text?: string;
  raw?: string;
  depth?: number;
  ordered?: boolean;
  items?: MarkedToken[];
  task?: boolean;
  checked?: boolean;
  lang?: string;
  tokens?: MarkedToken[];
  href?: string;
  /** GFM table: flat array of cell objects, one per column. */
  header?: MarkedTableCell[];
  /** GFM table: array of rows, each row is an array of cell objects. */
  rows?: MarkedTableCell[][];
}

interface MarkedTableCell {
  text?: string;
  tokens?: InlineToken[];
  header?: boolean;
}

function tokensToContent(tokens: MarkedToken[]): unknown[] {
  const out: unknown[] = [];
  for (const t of tokens) {
    const node = tokenToNode(t);
    if (node) out.push(node);
  }
  return out;
}

function tokenToNode(t: MarkedToken): unknown | null {
  switch (t.type) {
    case "heading":
      return {
        type: "heading",
        attrs: { level: t.depth ?? 1 },
        content: inlineFromText(t.text ?? "", t.tokens),
      };
    case "paragraph":
      return {
        type: "paragraph",
        content: inlineFromText(t.text ?? "", t.tokens),
      };
    case "blockquote":
      return {
        type: "blockquote",
        content: t.tokens ? tokensToContent(t.tokens) : [],
      };
    case "code":
      return {
        type: "codeBlock",
        attrs: { language: t.lang ?? "plaintext" },
        content: t.text ? [{ type: "text", text: t.text }] : [],
      };
    case "list":
      return listToNode(t);
    case "hr":
      return { type: "horizontalRule" };
    case "table":
      return tableToNode(t);
    case "space":
      return null;
    default:
      // Fallback: dump as paragraph with raw text. Better than dropping
      // unrecognised content silently.
      if (t.raw) {
        return {
          type: "paragraph",
          content: [{ type: "text", text: t.raw.trim() }],
        };
      }
      return null;
  }
}

function listToNode(t: MarkedToken): unknown {
  const isTask = t.items?.some((i) => i.task) ?? false;
  if (isTask) {
    return {
      type: "taskList",
      content: (t.items ?? []).map((item) => ({
        type: "taskItem",
        attrs: { checked: !!item.checked },
        content: item.tokens ? tokensToContent(item.tokens) : [],
      })),
    };
  }
  return {
    type: t.ordered ? "orderedList" : "bulletList",
    content: (t.items ?? []).map((item) => ({
      type: "listItem",
      content: item.tokens ? tokensToContent(item.tokens) : [],
    })),
  };
}

function tableToNode(t: MarkedToken): unknown {
  const rows: unknown[] = [];
  if (t.header && t.header.length > 0) {
    rows.push({
      type: "tableRow",
      content: t.header.map((cell) => ({
        type: "tableHeader",
        content: [
          { type: "paragraph", content: inlineFromText(cell.text ?? "", cell.tokens) },
        ],
      })),
    });
  }
  for (const row of t.rows ?? []) {
    rows.push({
      type: "tableRow",
      content: row.map((cell) => ({
        type: "tableCell",
        content: [
          { type: "paragraph", content: inlineFromText(cell.text ?? "", cell.tokens) },
        ],
      })),
    });
  }
  return { type: "table", content: rows };
}

interface InlineToken {
  type: string;
  text?: string;
  raw?: string;
  href?: string;
  tokens?: InlineToken[];
}

/**
 * Convert inline markdown (bold/italic/code/links) to Tiptap text + marks.
 * If `tokens` are provided (marked's parsed inline tokens), we walk them.
 * Otherwise we treat `text` as plain text.
 */
function inlineFromText(text: string, tokens?: InlineToken[]): unknown[] {
  if (!tokens || tokens.length === 0) {
    if (!text) return [];
    return [{ type: "text", text }];
  }
  const out: unknown[] = [];
  for (const tok of tokens) {
    const node = inlineTokenToNode(tok);
    if (Array.isArray(node)) out.push(...node);
    else if (node) out.push(node);
  }
  return out;
}

function inlineTokenToNode(t: InlineToken): unknown | unknown[] | null {
  switch (t.type) {
    case "text":
    case "escape":
      return { type: "text", text: t.text ?? "" };
    case "strong":
      return wrapMark(t, "bold");
    case "em":
      return wrapMark(t, "italic");
    case "del":
      return wrapMark(t, "strike");
    case "codespan":
      return {
        type: "text",
        text: t.text ?? "",
        marks: [{ type: "code" }],
      };
    case "link":
      return wrapMark(t, "link", { href: t.href ?? "" });
    case "br":
      return { type: "hardBreak" };
    default:
      return t.text ? { type: "text", text: t.text } : null;
  }
}

function wrapMark(
  t: InlineToken,
  markType: string,
  attrs?: Record<string, unknown>,
): unknown[] {
  const inner = t.tokens ? inlineFromText(t.text ?? "", t.tokens) : [
    { type: "text", text: t.text ?? "" },
  ];
  const mark = attrs ? { type: markType, attrs } : { type: markType };
  return inner.map((n) => {
    const node = n as { type: string; text?: string; marks?: unknown[] };
    if (node.type !== "text") return node;
    const existing = (node.marks as unknown[]) ?? [];
    return { ...node, marks: [...existing, mark] };
  });
}

// ─── JSON → Markdown walker ─────────────────────────────────────────

interface PMNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PMNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

function nodeToMarkdown(n: unknown): string {
  const node = n as PMNode;
  switch (node.type) {
    case "heading": {
      const level = (node.attrs?.level as number) ?? 1;
      return "#".repeat(level) + " " + childrenToInline(node.content);
    }
    case "paragraph":
      return childrenToInline(node.content);
    case "blockquote":
      return (node.content ?? [])
        .map(nodeToMarkdown)
        .join("\n\n")
        .split("\n")
        .map((l) => "> " + l)
        .join("\n");
    case "codeBlock": {
      const lang = (node.attrs?.language as string) ?? "";
      const text = (node.content ?? []).map((c) => (c as PMNode).text ?? "").join("");
      return "```" + lang + "\n" + text + "\n```";
    }
    case "bulletList":
      return (node.content ?? [])
        .map((item) => "- " + childrenToBlockMd((item as PMNode).content).replace(/\n/g, "\n  "))
        .join("\n");
    case "orderedList":
      return (node.content ?? [])
        .map((item, i) => `${i + 1}. ` + childrenToBlockMd((item as PMNode).content).replace(/\n/g, "\n   "))
        .join("\n");
    case "taskList":
      return (node.content ?? [])
        .map((item) => {
          const ti = item as PMNode;
          const checked = ti.attrs?.checked === true ? "x" : " ";
          return `- [${checked}] ` + childrenToBlockMd(ti.content).replace(/\n/g, "\n  ");
        })
        .join("\n");
    case "horizontalRule":
      return "---";
    case "table":
      return tableToMarkdown(node);
    case "hardBreak":
      return "  \n";
    default:
      return childrenToInline(node.content);
  }
}

function childrenToInline(content: PMNode[] | undefined): string {
  if (!content) return "";
  return content.map(inlineToMarkdown).join("");
}

function childrenToBlockMd(content: PMNode[] | undefined): string {
  if (!content) return "";
  return content.map(nodeToMarkdown).join("\n\n");
}

function inlineToMarkdown(n: PMNode): string {
  if (n.type === "hardBreak") return "  \n";
  if (n.type !== "text") return childrenToInline(n.content);
  const text = n.text ?? "";
  const marks = n.marks ?? [];
  let out = text;
  for (const m of marks) {
    switch (m.type) {
      case "bold":
        out = `**${out}**`;
        break;
      case "italic":
        out = `*${out}*`;
        break;
      case "strike":
        out = `~~${out}~~`;
        break;
      case "code":
        out = "`" + out + "`";
        break;
      case "link": {
        const href = (m.attrs?.href as string) ?? "";
        out = `[${out}](${href})`;
        break;
      }
    }
  }
  return out;
}

function tableToMarkdown(n: PMNode): string {
  const rows = n.content ?? [];
  if (rows.length === 0) return "";
  const renderRow = (r: PMNode) =>
    "| " +
    (r.content ?? [])
      .map((cell) => childrenToInline((cell as PMNode).content?.[0]?.content))
      .join(" | ") +
    " |";
  const header = renderRow(rows[0] as PMNode);
  const colCount = ((rows[0] as PMNode).content ?? []).length;
  const sep = "| " + Array(colCount).fill("---").join(" | ") + " |";
  const body = rows.slice(1).map((r) => renderRow(r as PMNode));
  return [header, sep, ...body].join("\n");
}
