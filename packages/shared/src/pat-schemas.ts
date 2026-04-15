/**
 * Zod schemas for PAT creation. Shared by the Auth Lambda HTTP handler,
 * the worker (defense-in-depth on `costate_workspace.create`), and the
 * frontend (react-hook-form + zodResolver).
 *
 * Mental model is GitHub fine-grained PATs: workspace access (scope) is
 * orthogonal to permissions (can_create_*), with one rule binding them —
 * "create new" only makes sense when scope is unbounded ("all").
 */

import { z } from "zod";

export const WORKSPACE_ID_RE = /^ws_[a-f0-9]{16}$/;

/**
 * Workspace scope is a discriminated union on `mode`:
 *   - all          → translates to allowed_workspaces = null
 *   - selected     → allowed_workspaces = [...] (≥ 1 ID)
 *   - invited_only → allowed_workspaces = [] (guest tier; only GRANTs work)
 *
 * The DDB layer stores the legacy `string[] | null` shape via
 * `scopeToAllowedWorkspaces`. The wire format keeps the explicit `mode`
 * to avoid the `[]` vs "deny all" ambiguity that bit us before.
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

export const CreatePatInput = z
  .object({
    name: z.string().min(1).max(100),
    agent_id: z.string().min(1),
    scope: PatScopeInput,
    can_create_workspaces: z.boolean().default(false),
    can_share_external_workspaces: z.boolean().default(false),
    expires_at: z.string().datetime().optional(),
  })
  .refine(
    (data) => !data.can_create_workspaces || data.scope.mode === "all",
    {
      message: "can_create_workspaces requires scope.mode = 'all'",
      path: ["can_create_workspaces"],
    },
  );

export type CreatePat = z.infer<typeof CreatePatInput>;

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
