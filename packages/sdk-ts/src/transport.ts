import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { CostateClientConfig } from './types.js';

/**
 * Create a StreamableHTTPClientTransport configured for a Costate server.
 */
export function createTransport(config: CostateClientConfig): StreamableHTTPClientTransport {
  const mcpUrl = new URL('/mcp', config.url);
  if (config.workspaceId) {
    mcpUrl.searchParams.set('workspace', config.workspaceId);
  }

  const headers: Record<string, string> = {};
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  return new StreamableHTTPClientTransport(mcpUrl, {
    requestInit: {
      headers,
    },
  });
}
