/**
 * Centralized scope system for costate authorization.
 *
 * Auth Lambda and Worker both import this module. A single source of truth
 * for what each role/grant can do, what each MCP tool requires, and how
 * grant scope strings map to internal Scope values.
 */

// ─── Scope definitions ───────────────────────────────────────

export type Scope =
  | "files:read"
  | "files:write"
  | "sql:read"
  | "sql:write"
  | "sql:ddl"
  | "workspace:manage"
  | "workspace:invite";

export type Role = "admin" | "write" | "read";

export const ROLE_SCOPES: Record<Role, Scope[]> = {
  admin: [
    "files:read",
    "files:write",
    "sql:read",
    "sql:write",
    "sql:ddl",
    "workspace:manage",
    "workspace:invite",
  ],
  write: ["files:read", "files:write", "sql:read", "sql:write"],
  read: ["files:read", "sql:read"],
};

// ─── Grant scope strings ─────────────────────────────────────
// These are the user-facing scope labels used in GRANT rows and
// the invite/grant UI. They map to internal Scope arrays.

export const GRANT_SCOPE_STRINGS = [
  "read",
  "write",
  "sql:read",
  "sql:write",
  "sql:ddl",
  "full",
] as const;

export type GrantScope = (typeof GRANT_SCOPE_STRINGS)[number];

const GRANT_TO_SCOPES: Record<GrantScope, Scope[]> = {
  read: ["files:read", "sql:read"],
  write: ["files:read", "files:write", "sql:read", "sql:write"],
  "sql:read": ["sql:read"],
  "sql:write": ["sql:read", "sql:write"],
  "sql:ddl": ["sql:read", "sql:write", "sql:ddl"],
  full: [
    "files:read",
    "files:write",
    "sql:read",
    "sql:write",
    "sql:ddl",
    "workspace:invite",
  ],
};

export function grantToScopes(grantScopes: GrantScope[]): Scope[] {
  const set = new Set<Scope>();
  for (const g of grantScopes) {
    const mapped = GRANT_TO_SCOPES[g];
    if (mapped) for (const s of mapped) set.add(s);
  }
  return [...set];
}

export function isValidGrantScope(s: string): s is GrantScope {
  return (GRANT_SCOPE_STRINGS as readonly string[]).includes(s);
}

// ─── Scope checking ──────────────────────────────────────────

export function hasScope(granted: Scope[], required: Scope): boolean {
  return granted.includes(required);
}

export function hasAllScopes(granted: Scope[], required: Scope[]): boolean {
  return required.every((r) => granted.includes(r));
}

// ─── MCP tool scope requirements ─────────────────────────────
// Each MCP tool declares the minimum scope it needs. The wrap
// helper in mcp-server.ts checks this before calling the handler.

export const TOOL_SCOPES: Record<string, Scope> = {
  costate_read: "files:read",
  costate_write: "files:write",
  costate_edit: "files:write",
  costate_delete: "files:write",
  costate_mkdir: "files:write",
  costate_list: "files:read",
  costate_search: "files:read",
  costate_sql: "sql:read", // handler further checks sql:write/sql:ddl based on SQL classification
  costate_log: "files:read",
  costate_watch: "files:read",
  costate_status: "files:read",
  costate_snapshot: "files:read",
  costate_snapshots: "files:read",
  costate_handoff: "files:write",
  costate_list_workspaces: "files:read",
  // Workspace + access tools bypass the per-tool gate because their
  // operations have heterogeneous permission semantics (create needs
  // can_create_workspaces, grant needs admin + can_share_external,
  // revoke_self needs nothing). The handler enforces per-op.
};
