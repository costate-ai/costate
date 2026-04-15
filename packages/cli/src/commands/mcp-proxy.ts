import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export async function runMcpProxy(options: { url?: string; token?: string }): Promise<void> {
  const serverUrl = options.url || process.env['COSTATE_URL'] || 'http://localhost:3000';
  const token = options.token || process.env['COSTATE_API_KEY'];

  if (!token) {
    process.stderr.write(
      'Error: Token required. Create one with:\n' +
      '  curl -X POST http://localhost:3000/auth/tokens \\\n' +
      '    -H "Content-Type: application/json" \\\n' +
      '    -H "x-costate-user-id: local-user" \\\n' +
      '    -d \'{"agentId": "claude-desktop"}\'\n\n' +
      'Then pass it via --token or COSTATE_API_KEY env var.\n',
    );
    process.exit(1);
  }

  // If the URL already ends with /mcp, use as-is. Otherwise append /mcp.
  const mcpUrl = serverUrl.endsWith('/mcp')
    ? new URL(serverUrl)
    : new URL('/mcp', serverUrl);

  const stdio = new StdioServerTransport();
  const http = new StreamableHTTPClientTransport(mcpUrl, {
    requestInit: {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    },
  });

  // Wire: stdio → HTTP
  stdio.onmessage = (msg) => {
    http.send(msg).catch((err) => {
      process.stderr.write(`HTTP send error: ${err}\n`);
    });
  };

  // Wire: HTTP → stdio
  http.onmessage = (msg) => {
    stdio.send(msg).catch((err) => {
      process.stderr.write(`stdio send error: ${err}\n`);
    });
  };

  stdio.onerror = (err) => {
    process.stderr.write(`stdio error: ${err}\n`);
  };

  http.onerror = (err) => {
    process.stderr.write(`HTTP error: ${err}\n`);
  };

  stdio.onclose = () => {
    http.close().catch(() => {});
    process.exit(0);
  };

  http.onclose = () => {
    stdio.close().catch(() => {});
    process.exit(0);
  };

  // Handle process signals
  process.on('SIGINT', () => {
    http.close().catch(() => {});
    stdio.close().catch(() => {});
  });
  process.on('SIGTERM', () => {
    http.close().catch(() => {});
    stdio.close().catch(() => {});
  });

  await http.start();
  await stdio.start();

  process.stderr.write(`Costate MCP proxy started → ${serverUrl}\n`);
}
