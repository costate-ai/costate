import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { DEFAULT_SERVICE_URL, loadConfig } from "../config.js";

/**
 * stdio ↔ HTTP bridge so MCP clients (Claude Desktop, Cursor, Claude Code)
 * can talk to the Costate service over their stdio transport. Options take
 * precedence over env vars, which take precedence over persisted config.
 */
export async function runMcpProxy(options: {
  url?: string;
  token?: string;
  workspace?: string;
}): Promise<void> {
  const config = await loadConfig();
  const serverUrl =
    options.url || process.env["COSTATE_URL"] || config.url || DEFAULT_SERVICE_URL;
  const token = options.token || process.env["COSTATE_TOKEN"] || config.token;
  const workspaceId =
    options.workspace || process.env["COSTATE_WORKSPACE"] || config.workspaceId;

  if (!token) {
    process.stderr.write(
      "Error: Token required. Run `costate login` to authenticate, or pass --token / COSTATE_TOKEN.\n",
    );
    process.exit(1);
  }

  // If the URL already ends with /mcp, use as-is. Otherwise append /mcp.
  const mcpUrl = serverUrl.endsWith("/mcp")
    ? new URL(serverUrl)
    : new URL("/mcp", serverUrl);

  const stdio = new StdioServerTransport();
  const http = new StreamableHTTPClientTransport(mcpUrl, {
    requestInit: {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(workspaceId ? { "x-costate-workspace": workspaceId } : {}),
      },
    },
  });

  stdio.onmessage = (msg) => {
    http.send(msg).catch((err) => {
      process.stderr.write(`HTTP send error: ${err}\n`);
    });
  };

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

  process.on("SIGINT", () => {
    http.close().catch(() => {});
    stdio.close().catch(() => {});
  });
  process.on("SIGTERM", () => {
    http.close().catch(() => {});
    stdio.close().catch(() => {});
  });

  await http.start();
  await stdio.start();

  process.stderr.write(`Costate MCP bridge started → ${serverUrl}\n`);
}
