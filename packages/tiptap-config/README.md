# @costate-ai/tiptap-config

Shared Tiptap schema and markdown↔Y.js helpers used by both the costate
frontend (Tiptap editor) and the Hocuspocus server (Database extension's
`store` hook materializes a JSON view via the same schema).

The single most important property of this package: **the schema configured
on the Hocuspocus server must match the schema configured on the frontend
exactly.** Drift = silent data loss when Y.js is decoded server-side and
re-encoded client-side. Round-trip fidelity is tested here, not in either
consumer.

## Exports

- `getExtensions()` — the canonical Tiptap extension list. Pass this to
  `useEditor({ extensions })` on the frontend and to
  `TiptapTransformer.toYdoc(json, 'default', extensions)` on the server.
- `markdownToYDoc(md)` — parse markdown to a Y.Doc (used by Hocuspocus
  `Database.fetch` when the row has `content_text` but no `yjs_data`).
- `yDocToMarkdown(yDoc)` — serialize a Y.Doc back to markdown (used by the
  Hocuspocus `store` hook to populate the `content_text` derived view).
- `markdownToTiptapJson(md)` / `tiptapJsonToMarkdown(json)` — same but
  through the JSON intermediate. Useful for the worker's
  `costate_edit` path (regenerate-from-edited-markdown, see C2 in plan).

## Test fixtures

`src/__tests__/roundtrip.test.ts` covers 12 markdown shapes that must
round-trip cleanly. **Hocuspocus persistence is gated on this suite passing
100%** — the migration plan calls this T2 ship-blocker.
