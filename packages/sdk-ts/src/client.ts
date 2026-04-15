import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type {
  ReadOutput,
  WriteOutput,
  EditOutput,
  DeleteOutput,
  SearchGlobOutput,
  SearchGrepOutput,
  SearchFTSOutput,
  GitDiffOutput,
  GitLogOutput,
  BashOutput,
  WatchOutput,
  StatusOutput,
  AgentsOutput,
  SqlOutput,
  UploadOutput,
} from '@costate-ai/mcp';
import type { CostateClientConfig } from './types.js';
import { createTransport } from './transport.js';
import { parseMcpError } from './errors.js';

/**
 * Costate TypeScript SDK client.
 *
 * Wraps the MCP Streamable HTTP protocol with typed methods for all 16 tools.
 *
 * @example
 * ```ts
 * const client = new CostateClient({ url: 'http://localhost:3000' });
 * await client.connect();
 *
 * await client.write('config/settings', JSON.stringify({ theme: 'dark' }));
 * const result = await client.read('config/settings');
 * console.log(result.content);
 *
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

  /** Connect to the Costate server. Must be called before any tool methods. */
  async connect(): Promise<void> {
    const transport = createTransport(this.config);
    this.transport = transport;
    this.client = new Client({ name: 'costate-sdk', version: '0.1.0' });
    await this.client.connect(transport);
  }

  /** The MCP session ID assigned by the server after connect(). */
  get sessionId(): string | undefined {
    return this.transport?.sessionId;
  }

  /** Close the connection and clean up the session. */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.transport = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Resource operations
  // ---------------------------------------------------------------------------

  /** Read a file's content. Pass `options.at` with a commit hash to read a historical version. */
  async read(file: string, options?: { at?: string }): Promise<ReadOutput> {
    return this.callTool<ReadOutput>('costate_read', { file, ...options });
  }

  /** Write (create or overwrite) a file. Max 10MB. Pass options.version for optimistic concurrency. */
  async write(file: string, content: string, options?: { version?: string }): Promise<WriteOutput> {
    return this.callTool<WriteOutput>('costate_write', { file, content, ...options });
  }

  /** Edit a file by replacing an exact string match. old_string must be unique. Pass options.version for optimistic concurrency. */
  async edit(file: string, oldString: string, newString: string, options?: { version?: string }): Promise<EditOutput> {
    return this.callTool<EditOutput>('costate_edit', { file, old_string: oldString, new_string: newString, ...options });
  }

  /** Delete a file. Pass options.version for optimistic concurrency. */
  async delete(file: string, options?: { version?: string }): Promise<DeleteOutput> {
    return this.callTool<DeleteOutput>('costate_delete', { file, ...options });
  }

  /** List files matching a glob pattern. */
  async glob(pattern: string): Promise<SearchGlobOutput> {
    return this.callTool<SearchGlobOutput>('costate_search', { glob: pattern });
  }

  /** Search file contents with regex. */
  async grep(pattern: string, options?: { glob?: string; maxResults?: number }): Promise<SearchGrepOutput> {
    return this.callTool<SearchGrepOutput>('costate_search', { content: pattern, ...options });
  }

  /** Full-text search with relevance ranking. Supports OR, "exact phrase", -exclude. */
  async search(query: string, options?: { glob?: string; maxResults?: number }): Promise<SearchFTSOutput> {
    return this.callTool<SearchFTSOutput>('costate_search', { query, ...options });
  }

  /** Upload a binary document and convert to searchable markdown. Requires markitdown CLI. */
  async upload(file: string, data: string, options?: { format?: string }): Promise<UploadOutput> {
    return this.callTool<UploadOutput>('costate_upload', { file, data, ...options });
  }

  // ---------------------------------------------------------------------------
  // Query operations
  // ---------------------------------------------------------------------------

  /** Get diff between commits or for a file. */
  async diff(options?: { from?: string; to?: string; file?: string }): Promise<GitDiffOutput> {
    return this.callTool<GitDiffOutput>('costate_git', { operation: 'diff', ...options });
  }

  /** Get commit history. Default limit 50, max 200. */
  async log(options?: { limit?: number; file?: string }): Promise<GitLogOutput> {
    return this.callTool<GitLogOutput>('costate_git', { operation: 'log', ...options });
  }

  // ---------------------------------------------------------------------------
  // Compute
  // ---------------------------------------------------------------------------

  /** Execute a shell command in the sandbox. Default timeout 30s, max 120s. */
  async bash(command: string, options?: { timeout?: number }): Promise<BashOutput> {
    return this.callTool<BashOutput>('costate_bash', { command, ...options });
  }

  // ---------------------------------------------------------------------------
  // Coordination
  // ---------------------------------------------------------------------------

  /** Poll for changes since a cursor. Max 100 events per poll. */
  async watch(cursor?: string, options?: { limit?: number }): Promise<WatchOutput> {
    return this.callTool<WatchOutput>('costate_watch', { cursor, ...options });
  }

  // ---------------------------------------------------------------------------
  // Status
  // ---------------------------------------------------------------------------

  /** Get workspace status (file count, database tables, commits, locks, active agents). */
  async status(): Promise<StatusOutput> {
    return this.callTool<StatusOutput>('costate_status', {});
  }

  /** List active agents with lock count and recent activity. */
  async agents(): Promise<AgentsOutput> {
    return this.callTool<AgentsOutput>('costate_agents', {});
  }

  /** Execute a SQL query against the workspace database. */
  async sql(query: string): Promise<SqlOutput> {
    return this.callTool<SqlOutput>('costate_sql', { query });
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private async callTool<T>(name: string, args: Record<string, unknown>): Promise<T> {
    if (!this.client) {
      throw new Error('CostateClient not connected. Call connect() first.');
    }

    // Strip undefined values from args
    const cleanArgs: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(args)) {
      if (value !== undefined) {
        cleanArgs[key] = value;
      }
    }

    // Inject workspace_id from config when not explicitly provided
    if (this.config.workspaceId && !cleanArgs['workspace_id']) {
      cleanArgs['workspace_id'] = this.config.workspaceId;
    }

    const result = await this.client.callTool({ name, arguments: cleanArgs });

    const content = result.content as Array<{ type: string; text: string }>;

    if (result.isError) {
      throw parseMcpError(content);
    }

    return JSON.parse(content[0].text) as T;
  }
}
