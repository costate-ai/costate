// MCP test client — placeholder for Phase 5 (apps/server integration tests)
// Will use the MCP SDK's in-process transport for testing

export interface TestMcpClient {
  callTool(name: string, params: Record<string, unknown>): Promise<unknown>;
  close(): Promise<void>;
}

// Implementation added when apps/server is built
export async function createTestMcpClient(_serverUrl: string): Promise<TestMcpClient> {
  throw new Error('Not implemented — use after apps/server is built');
}
