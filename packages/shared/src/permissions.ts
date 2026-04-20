/**
 * Fine-grained permission taxonomy for PATs and cross-tenant grants.
 *
 * Two layers:
 *   1. PAT/Grant permissions — what the USER chose in the UI. Stored on the
 *      PAT row and the GRANT row. GitHub-style dropdown matrix.
 *   2. Scopes (see scopes.ts) — atomic server-side enforcement primitives
 *      each MCP tool declares it needs. Permissions expand to scopes via
 *      `permissionsToScopes()`.
 *
 * The user never sees scope strings directly. They pick permissions. The
 * server computes the scope set and enforces per-call.
 */

import type { Scope } from "./scopes.js";

// ─── Permission levels ────────────────────────────────────────

/** Per-resource level. Not every resource supports every level. */
export type PermissionLevel = "none" | "read" | "write" | "admin";

// ─── Workspace-scoped resources ───────────────────────────────

/**
 * Permissions a PAT (or grant) carries FOR EACH workspace in its scope.
 * Applied uniformly across all workspaces in `scope.workspaces` (GitHub
 * semantics: one permission set for the whole selection).
 */
export interface WorkspacePermissions {
  /** File CRUD. admin N/A. */
  files: "none" | "read" | "write";

  /** SQL SELECT / DML (INSERT/UPDATE/DELETE against existing tables). */
  sql_data: "none" | "read" | "write";

  /** SQL DDL (CREATE/ALTER/DROP TABLE). Either "none" or "admin". */
  sql_schema: "none" | "admin";

  /** Activity log: read = tail events, write = emit custom events (future). */
  activity_log: "none" | "read" | "write";

  /** File snapshots. admin N/A. */
  snapshots: "none" | "read" | "write";

  /** Task handoff: read = see tasks, write = create/claim/complete, admin = approve/reject HITL-gated tasks. */
  task_handoff: "none" | "read" | "write" | "admin";

  /** Access grants: read = list workspace members (needed for handoff routing), write = invite/revoke others. */
  access_grants: "none" | "read" | "write";

  /** Workspace metadata: read = see name/settings, write = rename, admin = delete. */
  workspace_metadata: "none" | "read" | "write" | "admin";
}

// ─── Account-scoped permissions ──────────────────────────────

/** Actions not tied to any specific workspace. */
export interface AccountPermissions {
  /** Mint new workspaces (was `can_create_workspaces`). */
  create_workspaces: boolean;

  /** Grant cross-tenant access (was `can_share_external_workspaces`). */
  share_external: boolean;
}

// ─── Presets (GitHub-style radio buttons over the matrix) ────

/**
 * Common permission shapes users can pick with a single click before
 * expanding the "Custom" matrix. Preserved across PAT creation + grant UI.
 */
export const WORKSPACE_PRESETS = {
  /** Read-only observation: view files, query SQL, see tasks and logs. */
  read: {
    files: "read",
    sql_data: "read",
    sql_schema: "none",
    activity_log: "read",
    snapshots: "read",
    task_handoff: "read",
    access_grants: "read",
    workspace_metadata: "read",
  } as WorkspacePermissions,

  /** Collaborator: read + write files/data/tasks/snapshots. No schema, no delete, no sharing. */
  write: {
    files: "write",
    sql_data: "write",
    sql_schema: "none",
    activity_log: "write",
    snapshots: "write",
    task_handoff: "write",
    access_grants: "read",
    workspace_metadata: "write",
  } as WorkspacePermissions,

  /** Workspace admin: everything — schema DDL, grant invites, delete, approve HITL tasks. */
  admin: {
    files: "write",
    sql_data: "write",
    sql_schema: "admin",
    activity_log: "write",
    snapshots: "write",
    task_handoff: "admin",
    access_grants: "write",
    workspace_metadata: "admin",
  } as WorkspacePermissions,
} as const;

export type WorkspacePreset = keyof typeof WORKSPACE_PRESETS;

/** Empty-access baseline: everything "none". Use as a starting point for "Custom". */
export const WORKSPACE_NO_ACCESS: WorkspacePermissions = {
  files: "none",
  sql_data: "none",
  sql_schema: "none",
  activity_log: "none",
  snapshots: "none",
  task_handoff: "none",
  access_grants: "none",
  workspace_metadata: "none",
};

/** Account-level defaults for a fresh free-tier user. */
export const ACCOUNT_FREE_TIER: AccountPermissions = {
  create_workspaces: true,
  share_external: true,
};

// ─── Permissions → Scopes conversion ─────────────────────────

/**
 * Expand a WorkspacePermissions object into the atomic scope[] array the
 * server uses for per-tool gating (see TOOL_SCOPES in scopes.ts).
 *
 * Strict 1:1 mapping — each permission key produces ONLY scopes for its own
 * resource family. No silent cross-grants. If a grant needs to read files,
 * the admin grants `files: read` explicitly. Previously `task_handoff: write`
 * silently added `files:write`, which let handoff recipients overwrite
 * arbitrary files in workspaces shared with `files: read`. That escalation
 * is removed. (Exception: `sql_schema: admin` still implies sql:read+write
 * because DDL only makes sense with data access; dropped tables can't be
 * SELECTed.)
 *
 * Callers only use this server-side — never on the wire.
 */
export function permissionsToScopes(p: WorkspacePermissions): Scope[] {
  const scopes: Scope[] = [];

  // Files
  if (p.files === "read" || p.files === "write") scopes.push("files:read");
  if (p.files === "write") scopes.push("files:write");

  // SQL — DDL implies read+write data (still a defensible coupling).
  if (p.sql_data === "read" || p.sql_data === "write") scopes.push("sql:read");
  if (p.sql_data === "write") scopes.push("sql:write");
  if (p.sql_schema === "admin") {
    if (!scopes.includes("sql:read")) scopes.push("sql:read");
    if (!scopes.includes("sql:write")) scopes.push("sql:write");
    scopes.push("sql:ddl");
  }

  // Activity log
  if (p.activity_log === "read" || p.activity_log === "write")
    scopes.push("activity:read");
  if (p.activity_log === "write") scopes.push("activity:write");

  // Snapshots
  if (p.snapshots === "read" || p.snapshots === "write")
    scopes.push("snapshots:read");
  if (p.snapshots === "write") scopes.push("snapshots:write");

  // Tasks (handoff)
  if (
    p.task_handoff === "read" ||
    p.task_handoff === "write" ||
    p.task_handoff === "admin"
  )
    scopes.push("tasks:read");
  if (p.task_handoff === "write" || p.task_handoff === "admin")
    scopes.push("tasks:write");
  if (p.task_handoff === "admin") scopes.push("tasks:admin");

  // Workspace metadata
  if (
    p.workspace_metadata === "read" ||
    p.workspace_metadata === "write" ||
    p.workspace_metadata === "admin"
  )
    scopes.push("metadata:read");
  if (p.workspace_metadata === "write" || p.workspace_metadata === "admin")
    scopes.push("metadata:write");
  if (p.workspace_metadata === "admin") {
    scopes.push("metadata:admin");
    scopes.push("workspace:manage"); // legacy gate for delete-workspace; remove once callers migrate
  }

  // Access grants (invite/revoke other users)
  if (p.access_grants === "write") scopes.push("workspace:invite");

  return scopes;
}

/**
 * Validate requested account_permissions against the user's CAP ceiling.
 * REJECTS on overreach — never silently downgrades. A silent clamp leads
 * to mysterious 403s down the line when the client assumed it had
 * capabilities it actually doesn't. Fail loud, fail closed.
 *
 * Returns the set of keys that exceed the ceiling. Empty = request valid.
 * Callers throw a 403 with the exceeded keys in the error body so the user
 * sees exactly what was asked for vs what's allowed.
 */
export function accountPermissionsExceedingCeiling(
  requested: AccountPermissions,
  ceiling: AccountPermissions,
): Array<keyof AccountPermissions> {
  const over: Array<keyof AccountPermissions> = [];
  if (requested.create_workspaces && !ceiling.create_workspaces)
    over.push("create_workspaces");
  if (requested.share_external && !ceiling.share_external)
    over.push("share_external");
  return over;
}

/**
 * Compare two permission levels. Returns true if `granted` is at least as
 * permissive as `required`. Used for server-side gate checks.
 */
export function hasWorkspacePermission(
  granted: WorkspacePermissions,
  resource: keyof WorkspacePermissions,
  min: PermissionLevel,
): boolean {
  const order: Record<PermissionLevel, number> = {
    none: 0,
    read: 1,
    write: 2,
    admin: 3,
  };
  const g = granted[resource] as PermissionLevel;
  return order[g] >= order[min];
}
