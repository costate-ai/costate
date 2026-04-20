/**
 * Centralized scope system for costate authorization.
 *
 * Auth Lambda and Worker both import this module. A single source of truth
 * for what each role/grant can do, what each MCP tool requires, and how
 * grant scope strings map to internal Scope values.
 *
 * Design rule (post-refactor): one resource, one scope family. No silent
 * cross-grants — `task_handoff: write` does NOT imply `files:write`. If a
 * grant needs file access, the admin grants `files: write` explicitly. This
 * makes the permission matrix in the UI mean exactly what it says.
 */

// ─── Scope definitions ───────────────────────────────────────

export type Scope =
  // Files
  | "files:read"
  | "files:write"
  // SQL
  | "sql:read"
  | "sql:write"
  | "sql:ddl"
  // Tasks (handoff lifecycle)
  | "tasks:read"
  | "tasks:write"
  | "tasks:admin"
  // Activity log
  | "activity:read"
  | "activity:write"
  // Snapshots
  | "snapshots:read"
  | "snapshots:write"
  // Workspace metadata
  | "metadata:read"
  | "metadata:write"
  | "metadata:admin"
  // Workspace lifecycle (account-level: rename / delete / invite)
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
    "tasks:read",
    "tasks:write",
    "tasks:admin",
    "activity:read",
    "activity:write",
    "snapshots:read",
    "snapshots:write",
    "metadata:read",
    "metadata:write",
    "metadata:admin",
    "workspace:manage",
    "workspace:invite",
  ],
  write: [
    "files:read",
    "files:write",
    "sql:read",
    "sql:write",
    "tasks:read",
    "tasks:write",
    "activity:read",
    "activity:write",
    "snapshots:read",
    "snapshots:write",
    "metadata:read",
    "metadata:write",
  ],
  read: [
    "files:read",
    "sql:read",
    "tasks:read",
    "activity:read",
    "snapshots:read",
    "metadata:read",
  ],
};

// ─── Grant scope strings (legacy v1 grant API) ───────────────
// These are the user-facing scope labels used in legacy GRANT rows.
// New grants use the WorkspacePermissions matrix (see permissions.ts).
// Kept for backward compat reads of pre-v2 rows; new code should prefer
// permissionsToScopes.

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
// Each MCP tool declares the minimum scope it needs. The wrap helper in
// mcp-server.ts checks this before calling the handler. Some tools (like
// costate_handoff and costate_sql) gate further per-action / per-statement
// inside the handler; the entry here is the FLOOR.

export const TOOL_SCOPES: Record<string, Scope> = {
  // Files
  costate_read: "files:read",
  costate_write: "files:write",
  costate_edit: "files:write",
  costate_delete: "files:write",
  costate_mkdir: "files:write",
  costate_move: "files:write",
  costate_list: "files:read",
  costate_search: "files:read",
  // SQL — handler further checks sql:write/sql:ddl based on classification
  costate_sql: "sql:read",
  // Activity log
  costate_log: "activity:read",
  costate_watch: "activity:read",
  // Workspace metadata
  costate_status: "metadata:read",
  // Snapshots
  costate_snapshot: "snapshots:write",
  costate_snapshots: "snapshots:read",
  // Tasks — minimum is read (for list/get); handler enforces tasks:write for
  // create/claim/complete/fail/cancel and tasks:admin for approve/reject.
  costate_handoff: "tasks:read",
  // Discovery
  costate_list_workspaces: "metadata:read",
  // costate_workspace + costate_access bypass per-tool gate (heterogeneous
  // semantics; handlers enforce per-op).
};
