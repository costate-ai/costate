import { describe, expect, it } from "vitest";
import {
  normalizeUri,
  ReadInput,
  WriteInput,
  EditInput,
  DeleteInput,
  MkdirInput,
  SnapshotInput,
} from "./index.js";

describe("normalizeUri", () => {
  it("appends .md when basename has zero dots", () => {
    expect(normalizeUri("notes")).toBe("notes.md");
  });

  it("is idempotent on already-normalized URIs", () => {
    expect(normalizeUri("notes.md")).toBe("notes.md");
  });

  it("preserves non-md extensions", () => {
    expect(normalizeUri("notes.txt")).toBe("notes.txt");
    expect(normalizeUri("data.json")).toBe("data.json");
  });

  it("appends .md to Dockerfile-style names (known tradeoff)", () => {
    expect(normalizeUri("Dockerfile")).toBe("Dockerfile.md");
    expect(normalizeUri("Makefile")).toBe("Makefile.md");
  });

  it("preserves dotfiles (leading dot counts as dot in basename)", () => {
    expect(normalizeUri(".gitignore")).toBe(".gitignore");
    expect(normalizeUri(".env")).toBe(".env");
  });

  it("preserves multi-dot filenames", () => {
    expect(normalizeUri("v1.2.3")).toBe("v1.2.3");
    expect(normalizeUri("foo.bar.baz")).toBe("foo.bar.baz");
  });

  it("preserves dotted date-like names (edge case)", () => {
    // 2026-04-17 has no dots — would normalize. Test the truly-dotted case.
    expect(normalizeUri("2026.04.17")).toBe("2026.04.17");
  });

  it("normalizes nested paths using basename only", () => {
    expect(normalizeUri("path/to/notes")).toBe("path/to/notes.md");
    expect(normalizeUri("path/to/notes.md")).toBe("path/to/notes.md");
  });

  it("preserves folder URIs (trailing slash)", () => {
    expect(normalizeUri("my-folder/")).toBe("my-folder/");
    expect(normalizeUri("notes/subfolder/")).toBe("notes/subfolder/");
  });

  it("handles basename with only dot (degenerate input)", () => {
    // `.` has a dot — passes through. Caller is on their own.
    expect(normalizeUri(".")).toBe(".");
  });
});

describe("schema transforms apply normalizeUri bidirectionally", () => {
  it("WriteInput.uri normalizes extensionless input", () => {
    const parsed = WriteInput.parse({ uri: "notes", content: "hi" });
    expect(parsed.uri).toBe("notes.md");
  });

  it("ReadInput.uri normalizes extensionless input", () => {
    const parsed = ReadInput.parse({ uri: "notes" });
    expect(parsed.uri).toBe("notes.md");
  });

  it("EditInput.uri normalizes", () => {
    const parsed = EditInput.parse({
      uri: "notes",
      old_string: "a",
      new_string: "b",
    });
    expect(parsed.uri).toBe("notes.md");
  });

  it("DeleteInput.uri normalizes", () => {
    const parsed = DeleteInput.parse({ uri: "notes" });
    expect(parsed.uri).toBe("notes.md");
  });

  it("SnapshotInput.uri normalizes", () => {
    const parsed = SnapshotInput.parse({ uri: "notes" });
    expect(parsed.uri).toBe("notes.md");
  });

  it("preserves trailing slash on Write (folder intent bypasses .md)", () => {
    const parsed = WriteInput.parse({ uri: "my-folder/", content: "" });
    expect(parsed.uri).toBe("my-folder/");
  });
});

describe("MkdirInput", () => {
  it("requires trailing slash", () => {
    expect(() => MkdirInput.parse({ uri: "my-folder" })).toThrow();
  });

  it("accepts trailing-slash URIs", () => {
    const parsed = MkdirInput.parse({ uri: "my-folder/" });
    expect(parsed.uri).toBe("my-folder/");
  });

  it("rejects empty string", () => {
    expect(() => MkdirInput.parse({ uri: "" })).toThrow();
  });
});
