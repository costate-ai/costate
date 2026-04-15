/**
 * Zod schemas for PAT creation and cross-tenant grants.
 *
 * v0.2.0 breaking change: account-level capability flags
 * (`can_create_workspaces`, `can_share_external_workspaces`) are NO LONGER
 * part of the create-PAT request. They are SERVER-DETERMINED from the
 * user's USER#<sub>/CAP record in DDB. The frontend's job is to let the
 * user pick a permission matrix for the PAT; the server stamps the PAT
 * with (chosen perms validated against the user's capability ceiling —
 * REJECTS on overreach, never silently clamps).
 *
 * This file is imported by:
 *   - Auth Lambda HTTP handler (POST /pats)
 *   - Worker (defense-in-depth on workspace create)
 *   - Frontend (react-hook-form + zodResolver)
 */

import { z } from "zod";

export const WORKSPACE_ID_RE = /^ws_[a-f0-9]{16}$/;

/**
 * Workspace scope — which workspaces the PAT can touch.
 *   - all          → translates to allowed_workspaces = null
 *   - selected     → allowed_workspaces = [...] (≥ 1 ID)
 *   - invited_only → allowed_workspaces = [] (guest tier; only GRANTs work)
 *
 * Wire format keeps the explicit `mode` discriminator to avoid the `[]`
 * vs "deny all" ambiguity that bit us pre-0.2.0.
 */
export const PatScopeInput = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("all") }),
  z.object({
    mode: z.literal("selected"),
    workspaces: z
      .array(z.string().regex(WORKSPACE_ID_RE))
      .min(1, "Select at least one workspace")
      .max(200),
  }),
  z.object({ mode: z.literal("invited_only") }),
]);

export type PatScope = z.infer<typeof PatScopeInput>;

/**
 * Workspace-scoped permissions (applied uniformly to every workspace in scope).
 * Mirrors the WorkspacePermissions TypeScript interface in permissions.ts —
 * kept as separate Zod schema because Zod owns the wire validation layer.
 */
export const WorkspacePermissionsInput = z.object({
  files: z.enum(["none", "read", "write"]),
  sql_data: z.enum(["none", "read", "write"]),
  sql_schema: z.enum(["none", "admin"]),
  activity_log: z.enum(["none", "read", "write"]),
  snapshots: z.enum(["none", "read", "write"]),
  task_handoff: z.enum(["none", "read", "write", "admin"]),
  access_grants: z.enum(["none", "read", "write"]),
  workspace_metadata: z.enum(["none", "read", "write", "admin"]),
});

/** Account-level asks. Server VALIDATES against USER CAP — rejects on overreach. */
export const AccountPermissionsInput = z.object({
  create_workspaces: z.boolean(),
  share_external: z.boolean(),
  mint_pats: z.boolean(),
});

export const CreatePatInput = z.object({
  name: z.string().min(1).max(100),
  agent_id: z.string().min(1),
  scope: PatScopeInput,
  permissions: WorkspacePermissionsInput,
  account_permissions: AccountPermissionsInput,
  expires_at: z.string().datetime().optional(),
});

export type CreatePat = z.infer<typeof CreatePatInput>;

/**
 * Cross-tenant grant input. Invitee gets the same workspace permission
 * matrix as a PAT would — reuses WorkspacePermissionsInput so the UI
 * component is shared. No account_permissions here: account-level caps
 * are per-user, not per-grant.
 */
export const CreateGrantInput = z.object({
  workspace_id: z.string().regex(WORKSPACE_ID_RE),
  invitee: z.object({
    user_id: z.string().min(1),
    agent_id: z.string().min(1),
  }),
  permissions: WorkspacePermissionsInput,
});

export type CreateGrant = z.infer<typeof CreateGrantInput>;

/** Translate the wire-format scope to the legacy DDB array. */
export function scopeToAllowedWorkspaces(scope: PatScope): string[] | null {
  switch (scope.mode) {
    case "all":
      return null;
    case "selected":
      return scope.workspaces;
    case "invited_only":
      return [];
  }
}

/** Reverse — used by the frontend to render the UI from a stored PAT. */
export function allowedWorkspacesToScope(
  allowed: string[] | null | undefined,
): PatScope {
  if (allowed == null) return { mode: "all" };
  if (allowed.length === 0) return { mode: "invited_only" };
  return { mode: "selected", workspaces: allowed };
}
