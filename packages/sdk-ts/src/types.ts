/**
 * Configuration for connecting to the Costate coordination service.
 */
export interface CostateClientConfig {
  /** Service URL, e.g. "https://api.costate.ai". */
  url: string;
  /**
   * Bearer token for authentication. Either a Costate PAT (`cst_...`) or
   * a Cognito JWT. The server identifies the agent from the token.
   */
  token?: string;
  /**
   * Default workspace ID. Auto-injected as `workspace` into scoped tool calls
   * (read/write/sql/etc.). Not injected into management tools
   * (workspace/access/handoff) whose `workspace_id` is an operation target.
   */
  workspaceId?: string;
}
