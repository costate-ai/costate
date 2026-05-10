import StarterKit from "@tiptap/starter-kit";
import { Link } from "@tiptap/extension-link";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import type { Extensions } from "@tiptap/core";

const lowlight = createLowlight(common);

export interface ExtensionsOptions {
  /** Placeholder text shown when the document is empty. Frontend default
   * matches the design spec (Pass 7 / 7B); the server passes undefined since
   * placeholders never reach the persisted JSON. */
  placeholder?: string;
  /** Where the editor lives. Drives a few collab-only extensions
   * (cursor/selection from y-prosemirror) on the frontend. The server side
   * always passes "server" — Y.js sync extensions are added by the
   * HocuspocusProvider on the frontend, not by this list. */
  context?: "frontend" | "server";
}

/**
 * Canonical Tiptap extension list shared between frontend and Hocuspocus.
 *
 * Schema invariant: any change here must be deployed simultaneously to both
 * surfaces. Drift = silent data loss in the Y.js round-trip. See README.
 */
export function getExtensions(opts: ExtensionsOptions = {}): Extensions {
  const { placeholder, context = "server" } = opts;

  return [
    StarterKit.configure({
      // CodeBlockLowlight replaces the default code block. Everything else
      // ships from StarterKit.
      codeBlock: false,
      // Y.js (UndoManager) handles history on the frontend; disable
      // Tiptap's undoRedo so the two don't fight. Server keeps the
      // default since it never actually applies user input.
      undoRedo: context === "frontend" ? false : undefined,
    }),
    CodeBlockLowlight.configure({
      lowlight,
      defaultLanguage: "plaintext",
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      protocols: ["http", "https", "mailto"],
    }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    TaskList,
    TaskItem.configure({ nested: true }),
    ...(placeholder
      ? [Placeholder.configure({ placeholder })]
      : []),
  ];
}
