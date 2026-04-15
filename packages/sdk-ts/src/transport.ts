import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CostateClientConfig } from "./types.js";

/**
 * Create a StreamableHTTPClientTransport for the Costate service.
 *
 * Auth: Bearer token in the Authorization header.
 * Workspace scoping: resolved per-call via the tool args (not URL). See
 * CostateClient.callTool for the auto-injection behavior.
 */
export function createTransport(
  config: CostateClientConfig,
): StreamableHTTPClientTransport {
  const mcpUrl = new URL("/mcp", config.url);

  const headers: Record<string, string> = {};
  if (config.token) {
    headers["Authorization"] = `Bearer ${config.token}`;
  }

  return new StreamableHTTPClientTransport(mcpUrl, {
    requestInit: {
      headers,
    },
  });
}
