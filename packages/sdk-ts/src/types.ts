/**
 * Configuration for connecting to a Costate server.
 */
export interface CostateClientConfig {
  /** Server URL (e.g. "http://localhost:3000") */
  url: string;
  /** API key for authentication (cst_... token). Identifies the agent — agentId is resolved from the token server-side. */
  apiKey?: string;
  /** Workspace ID to connect to. Appended as ?workspace= to the MCP endpoint URL. */
  workspaceId?: string;
}
