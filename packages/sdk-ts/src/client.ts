import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type {
  ReadInput,
  WriteInput,
  EditInput,
  DeleteInput,
  MkdirInput,
  ListInput,
  SearchInput,
  SqlInput,
  LogInput,
  WatchInput,
  StatusInput,
  SnapshotInput,
  SnapshotsInput,
  ListWorkspacesInput,
  WorkspaceInput,
  AccessInput,
  HandoffInput,
  ToolOutput,
} from "@costate-ai/mcp";
import type { CostateClientConfig } from "./types.js";
import { createTransport } from "./transport.js";
import { parseMcpError } from "./errors.js";

/**
 * Costate TypeScript SDK client.
 *
 * Wraps the MCP Streamable HTTP protocol with typed methods for all 16 Costate
 * tools. v0.1 returns outputs as `unknown` (cast at call site); typed outputs
 * land when docs/SPEC.md stabilizes.
 *
 * @example
 * ```ts
 * const client = new CostateClient({
 *   url: "https://api.costate.ai",
 *   token: "cst_your_pat_here",
 *   workspaceId: "ws_xxx",
 * });
 * await client.connect();
 * await client.write({ uri: "config/settings", content: "{\"theme\":\"dark\"}" });
 * const result = await client.read({ uri: "config/settings" });
 * await client.close();
 * ```
 */
export class CostateClient {
  private client: Client | null = null;
  private transport: StreamableHTTPClientTransport | null = null;
  private config: CostateClientConfig;

  constructor(config: CostateClientConfig) {
    this.config = config;
  }

  /** Connect to Costate. Must be called before any tool methods. */
  async connect(): Promise<void> {
    const transport = createTransport(this.config);
    this.transport = transport;
    this.client = new Client({ name: "costate-sdk", version: "0.1.0" });
    await this.client.connect(transport);
  }

  /** MCP session ID assigned by the server after connect(). */
  get sessionId(): string | undefined {
    return this.transport?.sessionId;
  }

  /** Close the connection. */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.transport = null;
    }
  }

  // ─── Discovery ─────────────────────────────────────────

  /** List workspaces this agent can access (member + cross-tenant grants). */
  async listWorkspaces(args: ListWorkspacesInput = {}): Promise<ToolOutput> {
    return this.callTool("costate_list_workspaces", args);
  }

  // ─── File operations ───────────────────────────────────

  /** Read a file. */
  async read(args: Omit<ReadInput, "workspace">): Promise<ToolOutput> {
    return this.callTool("costate_read", args);
  }

  /** Write (create or overwrite) a file. `expectedVersion` enables OCC. */
  async write(args: Omit<WriteInput, "workspace">): Promise<ToolOutput> {
    return this.callTool("costate_write", args);
  }

  /** Edit a file by replacing an exact string. */
  async edit(args: Omit<EditInput, "workspace">): Promise<ToolOutput> {
    return this.callTool("costate_edit", args);
  }

  /** Delete a file or folder. Folder URIs must end with `/` for recursive delete. */
  async delete(args: Omit<DeleteInput, "workspace">): Promise<ToolOutput> {
    return this.callTool("costate_delete", args);
  }

  /** Create an empty folder. URI must end with `/`. */
  async mkdir(args: Omit<MkdirInput, "workspace">): Promise<ToolOutput> {
    return this.callTool("costate_mkdir", args);
  }

  /** List files matching a glob pattern. */
  async list(args: Omit<ListInput, "workspace"> = {}): Promise<ToolOutput> {
    return this.callTool("costate_list", args);
  }

  /** Search file contents with a regex pattern (optionally scoped by glob). */
  async search(args: Omit<SearchInput, "workspace">): Promise<ToolOutput> {
    return this.callTool("costate_search", args);
  }

  // ─── SQL ───────────────────────────────────────────────

  /** Execute SQL against the workspace's SQLite database. */
  async sql(args: Omit<SqlInput, "workspace">): Promise<ToolOutput> {
    return this.callTool("costate_sql", args);
  }

  // ─── History / monitoring ──────────────────────────────

  /** Get recent activity events for the workspace. */
  async log(args: Omit<LogInput, "workspace"> = {}): Promise<ToolOutput> {
    return this.callTool("costate_log", args);
  }

  /** Poll for new activity events since a cursor. */
  async watch(args: Omit<WatchInput, "workspace"> = {}): Promise<ToolOutput> {
    return this.callTool("costate_watch", args);
  }

  /** Get workspace metadata, file count, agent list, SQLite table schemas. */
  async status(args: Omit<StatusInput, "workspace"> = {}): Promise<ToolOutput> {
    return this.callTool("costate_status", args);
  }

  // ─── Snapshots ─────────────────────────────────────────

  /** Create a snapshot of a file. */
  async snapshot(args: Omit<SnapshotInput, "workspace">): Promise<ToolOutput> {
    return this.callTool("costate_snapshot", args);
  }

  /** List snapshots for a file. */
  async snapshots(
    args: Omit<SnapshotsInput, "workspace">,
  ): Promise<ToolOutput> {
    return this.callTool("costate_snapshots", args);
  }

  // ─── Workspace lifecycle ───────────────────────────────

  /**
   * Manage workspaces (agent-authored): create | delete | update | list.
   * `workspace_id` here identifies the TARGET workspace for the operation,
   * independent of the PAT's scoped workspace. Not auto-injected.
   */
  async workspace(args: WorkspaceInput): Promise<ToolOutput> {
    return this.callToolNoInject("costate_workspace", args);
  }

  // ─── Cross-tenant access ───────────────────────────────

  /**
   * Grant / revoke / revoke_self cross-tenant workspace access.
   * `workspace_id` is the target, not auto-injected.
   */
  async access(args: AccessInput): Promise<ToolOutput> {
    return this.callToolNoInject("costate_access", args);
  }

  // ─── Task handoff (A2A-compatible) ─────────────────────

  /**
   * Coordinate tasks between agents. Actions: create (default), claim,
   * complete, fail, cancel, approve, reject, get, list.
   */
  async handoff(args: HandoffInput): Promise<ToolOutput> {
    return this.callToolNoInject("costate_handoff", args);
  }

  // ─── Internal ──────────────────────────────────────────

  /**
   * Inject the SDK's configured workspaceId into the `workspace` field
   * when not already set. Used for tools that are scoped to a single
   * workspace via per-call resolution.
   */
  private async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<ToolOutput> {
    const clean = stripUndefined(args);
    if (this.config.workspaceId && clean.workspace === undefined) {
      clean.workspace = this.config.workspaceId;
    }
    return this.rawCall(name, clean);
  }

  /**
   * For tools whose workspace_id field is a TARGET, not a scope — no
   * auto-injection. Caller must be explicit.
   */
  private async callToolNoInject(
    name: string,
    args: Record<string, unknown>,
  ): Promise<ToolOutput> {
    return this.rawCall(name, stripUndefined(args));
  }

  private async rawCall(
    name: string,
    args: Record<string, unknown>,
  ): Promise<ToolOutput> {
    if (!this.client) {
      throw new Error("CostateClient not connected. Call connect() first.");
    }
    const result = await this.client.callTool({ name, arguments: args });
    const content = result.content as Array<{ type: string; text: string }>;
    if (result.isError) {
      throw parseMcpError(content);
    }
    return JSON.parse(content[0].text) as ToolOutput;
  }
}

function stripUndefined(
  args: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}
