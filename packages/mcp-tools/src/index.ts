/**
 * @costate-ai/mcp — Zod schemas for all Costate MCP tool inputs, plus tool
 * catalog metadata. Extracted from the reference implementation (cdk worker).
 *
 * v0.1 is Descriptive, not Normative — schemas document what api.costate.ai
 * currently accepts. Breaking changes expected until v1.0. See docs/SPEC.md.
 */

import { z } from "zod";

const WORKSPACE_ID_RE = /^ws_[a-f0-9]{16}$/;

// ─── URI normalization ─────────────────────────────────────

/**
 * Normalize a file URI so costate behaves as a markdown-native coordination
 * layer without silently mangling explicit extensions.
 *
 * Rules:
 *   - Trailing `/` → folder intent, preserved as-is.
 *   - Basename already contains any dot → preserved (respects `foo.json`,
 *     `.gitignore`, `v1.2.3`, `foo.bar.baz`).
 *   - Otherwise → append `.md`.
 *
 * Applied bidirectionally to every tool schema that takes a URI (read, write,
 * edit, delete, snapshot) so an agent writing `notes` and later reading `notes`
 * transparently hits the canonical `notes.md`. Known tradeoff: `Dockerfile`,
 * `Makefile`, `Jenkinsfile` become `Dockerfile.md` etc. — revisit if this
 * surfaces as a real bug.
 */
export function normalizeUri(uri: string): string {
  if (uri.endsWith("/")) return uri;
  const basename = uri.split("/").pop() ?? "";
  if (basename.includes(".")) return uri;
  return `${uri}.md`;
}

const uriField = z.string().transform(normalizeUri);

// ─── Shared parameters ─────────────────────────────────────

/**
 * `workspace` parameter: required for PAT auth (per-call resolution),
 * optional for JWT auth (resolved at token exchange).
 */
const wsParam = z
  .string()
  .optional()
  .describe("Workspace ID. Required for PAT auth; omit for JWT auth.");

// ─── Discovery ─────────────────────────────────────────────

export const ListWorkspacesInput = z.object({});
export type ListWorkspacesInput = z.infer<typeof ListWorkspacesInput>;

// ─── File operations ───────────────────────────────────────

export const ReadInput = z.object({
  workspace: wsParam,
  uri: uriField.describe("File path relative to workspace root"),
});
export type ReadInput = z.infer<typeof ReadInput>;

export const WriteInput = z.object({
  workspace: wsParam,
  uri: uriField,
  content: z.string(),
  expectedVersion: z.string().optional(),
});
export type WriteInput = z.infer<typeof WriteInput>;

export const EditInput = z.object({
  workspace: wsParam,
  uri: uriField,
  old_string: z.string(),
  new_string: z.string(),
  expectedVersion: z.string().optional(),
});
export type EditInput = z.infer<typeof EditInput>;

export const DeleteInput = z.object({
  workspace: wsParam,
  uri: uriField,
  expectedVersion: z.string().optional(),
});
export type DeleteInput = z.infer<typeof DeleteInput>;

/**
 * Create an empty folder in the workspace. URI must end with `/` to make
 * folder intent explicit and avoid accidental collision with file writes.
 */
export const MkdirInput = z.object({
  workspace: wsParam,
  uri: z
    .string()
    .min(1)
    .refine((u) => u.endsWith("/"), {
      message: "Folder URI must end with '/' (e.g., 'notes/')",
    }),
});
export type MkdirInput = z.infer<typeof MkdirInput>;

export const ListInput = z.object({
  workspace: wsParam,
  pattern: z.string().optional().describe("Glob pattern (e.g., '**/*.md')"),
});
export type ListInput = z.infer<typeof ListInput>;

export const SearchInput = z.object({
  workspace: wsParam,
  pattern: z.string(),
  glob: z.string().optional(),
});
export type SearchInput = z.infer<typeof SearchInput>;

// ─── SQL ───────────────────────────────────────────────────

export const SqlInput = z.object({
  workspace: wsParam,
  sql: z.string(),
  params: z.array(z.unknown()).optional(),
});
export type SqlInput = z.infer<typeof SqlInput>;

// ─── History / monitoring ──────────────────────────────────

export const LogInput = z.object({
  workspace: wsParam,
  limit: z.number().optional(),
  cursor: z.string().optional(),
  file: z.string().optional(),
  agent: z.string().optional(),
  event_type: z.string().optional(),
  event_type_prefix: z.string().optional(),
});
export type LogInput = z.infer<typeof LogInput>;

export const WatchInput = z.object({
  workspace: wsParam,
  cursor: z.string().optional(),
  pattern: z.string().optional(),
});
export type WatchInput = z.infer<typeof WatchInput>;

export const StatusInput = z.object({
  workspace: wsParam,
});
export type StatusInput = z.infer<typeof StatusInput>;

// ─── Snapshots ─────────────────────────────────────────────

export const SnapshotInput = z.object({
  workspace: wsParam,
  uri: uriField,
  message: z.string().optional(),
});
export type SnapshotInput = z.infer<typeof SnapshotInput>;

export const SnapshotsInput = z.object({
  workspace: wsParam,
  uri: uriField,
});
export type SnapshotsInput = z.infer<typeof SnapshotsInput>;

// ─── Workspace lifecycle (agent-authored) ──────────────────

export const WorkspaceInput = z.object({
  operation: z
    .enum(["create", "delete", "update", "list"])
    .describe("create | delete | update | list"),
  name: z
    .string()
    .min(1)
    .max(200)
    .optional()
    .describe("Workspace name (required for create and update)"),
  workspace_id: z
    .string()
    .regex(WORKSPACE_ID_RE)
    .optional()
    .describe("Workspace ID (required for delete and update)"),
  idempotency_key: z
    .string()
    .min(1)
    .max(128)
    .optional()
    .describe(
      "Optional. Same key + same agent returns the cached result of the first create. TTL 30 min.",
    ),
});
export type WorkspaceInput = z.infer<typeof WorkspaceInput>;

// ─── Cross-tenant access (Google-Docs-style sharing) ───────

/**
 * Fine-grained grant permissions. Same shape as the PAT permission matrix
 * in @costate-ai/shared — reused here so the share UI and PAT UI use one
 * component. Either `role` (legacy shorthand) or `permissions` (v0.1.4+)
 * can be provided on grant; `permissions` wins when both present.
 */
export const GrantPermissionsInput = z.object({
  files: z.enum(["none", "read", "write"]),
  sql_data: z.enum(["none", "read", "write"]),
  sql_schema: z.enum(["none", "admin"]),
  activity_log: z.enum(["none", "read", "write"]),
  snapshots: z.enum(["none", "read", "write"]),
  task_handoff: z.enum(["none", "read", "write", "admin"]),
  access_grants: z.enum(["none", "read", "write"]),
  workspace_metadata: z.enum(["none", "read", "write", "admin"]),
});

export const AccessInput = z.object({
  operation: z
    .enum(["grant", "revoke", "revoke_self"])
    .describe("grant | revoke | revoke_self"),
  workspace_id: z.string().regex(WORKSPACE_ID_RE).describe("Target workspace"),
  invitee: z
    .object({
      user_id: z.string().min(1),
      agent_id: z.string().min(1),
    })
    .optional()
    .describe(
      "Required for grant. (cognito_sub, agent_ulid) obtained out-of-band.",
    ),
  permissions: GrantPermissionsInput.optional().describe(
    "Fine-grained permission matrix — required for grant. Use WORKSPACE_PRESETS.{read|write|admin} from @costate-ai/shared for common shapes.",
  ),
  grantee: z
    .object({
      user_id: z.string().min(1),
      agent_id: z.string().min(1),
    })
    .optional()
    .describe("Required for revoke. Identifies whose access to remove."),
});
export type AccessInput = z.infer<typeof AccessInput>;

// ─── Task handoff (A2A-compatible) ─────────────────────────

export const HandoffInput = z.object({
  workspace: z.string().describe("Workspace ID"),
  action: z
    .enum([
      "create",
      "claim",
      "complete",
      "fail",
      "cancel",
      "approve",
      "reject",
      "get",
      "list",
    ])
    .optional()
    .describe("Action to perform (default: create)"),
  task: z
    .string()
    .max(8192)
    .optional()
    .describe("Task description (required for create, max 8KB)"),
  to_agent: z
    .string()
    .optional()
    .describe("Target agent ID, or '*' for any claimant (default: '*')"),
  payload_ref: z
    .string()
    .regex(/^costate:\/\//)
    .optional()
    .describe("costate:// URI referencing input data"),
  needs_approval: z
    .boolean()
    .optional()
    .describe("If true, task pauses at requires_approval state"),
  deadline: z
    .number()
    .optional()
    .describe("Epoch seconds; task expires into failed state"),
  approval_deadline: z
    .number()
    .optional()
    .describe("Epoch seconds; approval timeout (default: +24h)"),
  idempotency_key: z
    .string()
    .optional()
    .describe("Prevents duplicate task creation on retry"),
  task_id: z
    .string()
    .optional()
    .describe("Task ID (required for claim/complete/fail/cancel/get)"),
  result_ref: z
    .string()
    .regex(/^costate:\/\//)
    .optional()
    .describe("costate:// URI for completion output"),
  reason: z.string().optional().describe("Reason for fail/cancel/reject"),
  status: z
    .enum([
      "submitted",
      "requires_approval",
      "working",
      "completed",
      "failed",
      "cancelled",
      "rejected",
    ])
    .optional()
    .describe("Filter by status (list only)"),
  cursor: z.string().optional().describe("Pagination cursor"),
  limit: z.number().optional().describe("Page size (1-200, default 50)"),
});
export type HandoffInput = z.infer<typeof HandoffInput>;

// ─── Generic output type ───────────────────────────────────
//
// v0.1: output types are `unknown`. SDK callers cast to domain types.
// Future: typed outputs based on cdk handler return shapes.

export type ToolOutput = unknown;

// ─── Tool catalog metadata ─────────────────────────────────

export interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodTypeAny;
}

export const toolDefinitions: ToolDefinition[] = [
  {
    name: "costate_list_workspaces",
    title: "List workspaces",
    description:
      "List all workspaces this agent can access (member + cross-tenant grants).",
    inputSchema: ListWorkspacesInput,
  },
  {
    name: "costate_read",
    title: "Read a file",
    description: "Read the content of a file in the workspace.",
    inputSchema: ReadInput,
  },
  {
    name: "costate_write",
    title: "Write a file",
    description: "Create or overwrite a file. Use expectedVersion for OCC.",
    inputSchema: WriteInput,
  },
  {
    name: "costate_edit",
    title: "Edit a file",
    description: "Replace old_string with new_string in a file.",
    inputSchema: EditInput,
  },
  {
    name: "costate_delete",
    title: "Delete a file",
    description: "Remove a file from the workspace.",
    inputSchema: DeleteInput,
  },
  {
    name: "costate_list",
    title: "List files",
    description:
      "List all files matching an optional glob pattern. Response includes " +
      "`files` (file URIs only, for backward compat) and `entries` " +
      "(`{uri, isDir}[]` — files AND folders).",
    inputSchema: ListInput,
  },
  {
    name: "costate_mkdir",
    title: "Create a folder",
    description:
      "Create an empty folder in the workspace. URI must end with '/'. " +
      "Files can also be created in nested paths directly (parent folders " +
      "are created automatically on write); use mkdir only to create an " +
      "empty folder explicitly.",
    inputSchema: MkdirInput,
  },
  {
    name: "costate_search",
    title: "Search files",
    description: "Grep for a regex pattern across files.",
    inputSchema: SearchInput,
  },
  {
    name: "costate_sql",
    title: "Execute SQL",
    description:
      "Run SQL against the workspace's SQLite database. Supports DDL, DML, FTS5.",
    inputSchema: SqlInput,
  },
  {
    name: "costate_log",
    title: "Activity log",
    description: "Get recent activity events for the workspace.",
    inputSchema: LogInput,
  },
  {
    name: "costate_watch",
    title: "Watch for changes",
    description: "Poll for new activity events since a cursor.",
    inputSchema: WatchInput,
  },
  {
    name: "costate_status",
    title: "Workspace status",
    description:
      "Get workspace metadata, file count, agent list, and SQLite table schemas.",
    inputSchema: StatusInput,
  },
  {
    name: "costate_snapshot",
    title: "Create snapshot",
    description: "Manually create a snapshot of a file.",
    inputSchema: SnapshotInput,
  },
  {
    name: "costate_snapshots",
    title: "List snapshots",
    description: "List all snapshots for a file.",
    inputSchema: SnapshotsInput,
  },
  {
    name: "costate_workspace",
    title: "Manage workspaces",
    description:
      "Create, rename, delete, or list workspaces. Discriminated by `operation`.",
    inputSchema: WorkspaceInput,
  },
  {
    name: "costate_access",
    title: "Grant or revoke cross-tenant access",
    description:
      "Manage cross-tenant workspace access. Grant takes effect immediately.",
    inputSchema: AccessInput,
  },
  {
    name: "costate_handoff",
    title: "Coordinate tasks between agents",
    description:
      "Create, claim, complete, or manage task handoffs between agents.",
    inputSchema: HandoffInput,
  },
];
