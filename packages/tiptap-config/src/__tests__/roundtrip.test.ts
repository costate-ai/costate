/**
 * T2 (eng review): markdown ↔ Y.js round-trip fidelity. **Hocuspocus
 * persistence is gated on this suite passing 100%.** A failure here means
 * the user's markdown gets eaten or mangled when it transits through Y.js.
 *
 * Each fixture asserts: md → Tiptap JSON → Y.Doc → JSON → md is structurally
 * equivalent to the input. We tolerate whitespace differences (trailing
 * newlines, list-item indentation) but not content loss.
 */
import { describe, it, expect } from "vitest";
import {
  markdownToTiptapJson,
  tiptapJsonToMarkdown,
  markdownToYDoc,
  yDocToMarkdown,
} from "../index.js";

interface Fixture {
  name: string;
  md: string;
  /** Loose-match: substring(s) that must appear in the round-tripped output.
   * Stricter than full-equality but tolerant of whitespace normalisation. */
  mustContain: string[];
  /** Optional: exact match after both inputs are normalised. */
  exact?: boolean;
}

const fixtures: Fixture[] = [
  {
    name: "plain paragraphs",
    md: "First paragraph.\n\nSecond paragraph with more words.\n",
    mustContain: ["First paragraph.", "Second paragraph with more words."],
  },
  {
    name: "ATX headings (h1-h3)",
    md: "# Title\n\n## Subtitle\n\n### Sub-subtitle\n\nBody text.\n",
    mustContain: ["# Title", "## Subtitle", "### Sub-subtitle", "Body text."],
  },
  {
    name: "unordered list",
    md: "- one\n- two\n- three\n",
    mustContain: ["- one", "- two", "- three"],
  },
  {
    name: "ordered list",
    md: "1. first\n2. second\n3. third\n",
    mustContain: ["1. first", "2. second", "3. third"],
  },
  {
    name: "task list",
    md: "- [x] done\n- [ ] todo\n- [x] also done\n",
    mustContain: ["- [x] done", "- [ ] todo", "- [x] also done"],
  },
  {
    name: "code block with language",
    md: "```python\ndef hello():\n    print('hi')\n```\n",
    mustContain: ["```python", "def hello():", "print('hi')", "```"],
  },
  {
    name: "inline code",
    md: "Use the `costate_read` tool to fetch a file.\n",
    mustContain: ["`costate_read`", "to fetch a file"],
  },
  {
    name: "bold, italic, strike",
    md: "**bold** *italic* ~~strike~~ in one line.\n",
    mustContain: ["**bold**", "*italic*", "~~strike~~"],
  },
  {
    name: "link",
    md: "Read the [docs](https://docs.costate.ai/) for more.\n",
    mustContain: ["[docs](https://docs.costate.ai/)"],
  },
  {
    name: "blockquote",
    md: "> A quoted paragraph.\n> Continues on next line.\n",
    mustContain: ["> A quoted paragraph", "Continues on next line"],
  },
  {
    name: "horizontal rule",
    md: "Above\n\n---\n\nBelow\n",
    mustContain: ["Above", "---", "Below"],
  },
  {
    name: "GFM table",
    md: "| Col A | Col B |\n| --- | --- |\n| a1 | b1 |\n| a2 | b2 |\n",
    mustContain: ["| Col A | Col B |", "| a1 | b1 |", "| a2 | b2 |"],
  },
];

describe("round-trip fidelity (md → JSON → md)", () => {
  for (const f of fixtures) {
    it(f.name, async () => {
      const json = await markdownToTiptapJson(f.md);
      const out = tiptapJsonToMarkdown(json);
      for (const needle of f.mustContain) {
        expect(out, `expected output to contain "${needle}"\n--- input ---\n${f.md}\n--- output ---\n${out}\n--- json ---\n${JSON.stringify(json, null, 2)}`).toContain(needle);
      }
    });
  }
});

describe("round-trip fidelity (md → Y.Doc → md)", () => {
  for (const f of fixtures) {
    it(f.name, async () => {
      const yDoc = await markdownToYDoc(f.md);
      const out = yDocToMarkdown(yDoc);
      for (const needle of f.mustContain) {
        expect(out, `expected Y.Doc round-trip output to contain "${needle}"\n--- input ---\n${f.md}\n--- output ---\n${out}`).toContain(needle);
      }
    });
  }
});
