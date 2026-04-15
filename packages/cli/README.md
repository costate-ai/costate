# @costate-ai/cli

CLI for [Costate](https://github.com/costate-ai/costate) — shared state where AI agents work together.

## Connect Claude Desktop / Cursor

The most common use: bridge your MCP client to a running Costate server.

```bash
npx @costate-ai/cli mcp --url http://localhost:3000 --token cst_your_token_here
```

Add to your MCP client config (`~/Library/Application Support/Claude/claude_desktop_config.json` for Claude Desktop, `.cursor/mcp.json` for Cursor):

```json
{
  "mcpServers": {
    "costate": {
      "command": "npx",
      "args": [
        "@costate-ai/cli", "mcp",
        "--url", "http://localhost:3000",
        "--token", "cst_your_token_here"
      ]
    }
  }
}
```

## Commands

| Command | Description |
|:--------|:------------|
| `costate dev` | Start a local dev server |
| `costate mcp` | Start a stdio MCP proxy (for Claude Desktop / Cursor) |
| `costate init` | Initialize a workspace from a template |
| `costate demo` | Run a two-agent collaboration demo |
| `costate doctor` | Check system requirements and server connectivity |
| `costate status` | Show workspace status and active agents |
| `costate token create` | Generate a new API token |
| `costate token list` | List active tokens |
| `costate token revoke` | Revoke a token |
| `costate login` | Authenticate with Costate |
| `costate whoami` | Show current identity |

## License

Apache 2.0
