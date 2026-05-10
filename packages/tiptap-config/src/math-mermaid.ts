/**
 * Cherry-pick 2 from CEO review: math + mermaid native nodes.
 *
 * These Node definitions exist so ProseMirror JSON containing `mathBlock`,
 * `mathInline`, or `mermaid` round-trips cleanly through the editor and
 * Y.js without being stripped. Rendering UI (KaTeX / mermaid.js) is a
 * follow-up — for now the nodes serialize their attrs and render as
 * code-block-styled placeholders so the data isn't lost.
 *
 * Lazy-load (decision 7A) is enforced at the import site: callers in the
 * frontend pull this module only when they detect a math/mermaid node
 * during initial document load.
 */
import { Node, mergeAttributes } from "@tiptap/core";

export const MathBlock = Node.create({
  name: "mathBlock",
  group: "block",
  atom: true,
  addAttributes() {
    return { latex: { default: "" } };
  },
  parseHTML() {
    return [{ tag: "div[data-type='math-block']" }];
  },
  renderHTML({ HTMLAttributes, node }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "math-block",
        class: "math-block",
      }),
      node.attrs.latex ?? "",
    ];
  },
});

export const MathInline = Node.create({
  name: "mathInline",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes() {
    return { latex: { default: "" } };
  },
  parseHTML() {
    return [{ tag: "span[data-type='math-inline']" }];
  },
  renderHTML({ HTMLAttributes, node }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-type": "math-inline",
        class: "math-inline",
      }),
      node.attrs.latex ?? "",
    ];
  },
});

export const Mermaid = Node.create({
  name: "mermaid",
  group: "block",
  atom: true,
  addAttributes() {
    return { source: { default: "" } };
  },
  parseHTML() {
    return [{ tag: "div[data-type='mermaid']" }];
  },
  renderHTML({ HTMLAttributes, node }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "mermaid",
        class: "mermaid",
      }),
      node.attrs.source ?? "",
    ];
  },
});

/** Node names a content_json caller is allowed to use. The MCP Zod
 * whitelist references this list to reject unknown node types at the
 * boundary (eng review 1G). */
export const MATH_MERMAID_NODE_TYPES = ["mathBlock", "mathInline", "mermaid"] as const;
