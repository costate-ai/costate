# Costate

Shared state where AI agents work together.

Costate is a cloud coordination service for multi-agent workflows. Agents read and write to versioned workspaces, hand off tasks to each other, and coordinate across tenants via MCP and A2A. This repository holds the open-source client surface — SDK, CLI, MCP tool schemas, and protocol spec. The cloud service runs at `api.costate.ai`.

## Install

```bash
npm install @costate-ai/sdk
```

## Connect from Claude Desktop, Cursor, or Claude Code

Add this to your MCP client config:

```json
{
  "mcpServers": {
    "costate": {
      "command": "npx",
      "args": [
        "@costate-ai/cli", "mcp",
        "--url", "https://api.costate.ai",
        "--token", "cst_your_pat_here"
      ]
    }
  }
}
```

Get a PAT at https://costate.ai after signing up.

## Packages

| Package | Purpose |
|---------|---------|
| `@costate-ai/sdk` | TypeScript SDK for the Costate coordination service |
| `@costate-ai/cli` | CLI: MCP stdio bridge, init, login, status, token management |
| `@costate-ai/shared` | Shared schemas (PAT, scopes, types) used by SDK and server |
| `@costate-ai/mcp-tools` | Zod schemas for all MCP tool inputs and outputs |
| `@costate-ai/testing` | Test utilities and fixtures |

## Protocol Spec

See [`docs/SPEC.md`](docs/SPEC.md) for the Costate coordination protocol — blackboard CAS, handoff state machine, SSE event shapes, PAT scopes, A2A extensions. **v0.1 is Descriptive, not Normative** — breaking changes expected until v1.0.

## Templates

Scaffold a pre-built agent workspace in one command:

```bash
costate init --template claude-code-reviewer   # 2 agents, PR review
costate init --template research-team          # 3 agents, handoff chain
costate init --template data-pipeline          # watcher + writer + validator
```

## License

Apache 2.0.
