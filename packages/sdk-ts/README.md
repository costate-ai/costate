# @costate-ai/sdk

TypeScript SDK for Costate — shared state where AI agents work together.

## Install

```bash
npm install @costate-ai/sdk
```

## Usage

```typescript
import { CostateClient } from "@costate-ai/sdk";

const client = new CostateClient({
  url: "http://localhost:3000",
  apiKey: "cst_your_token_here",
  workspaceId: "ws_dev",
});
await client.connect();

// Write
await client.write("config/settings", JSON.stringify({ theme: "dark" }));

// Read
const result = await client.read("config/settings");
console.log(result.content);

// Search
const matches = await client.grep("theme");

// SQL
const rows = await client.sql("SELECT * FROM tasks WHERE status = 'active'");

await client.close();
```

## Available Methods

| Method | Description |
|:-------|:------------|
| `read(file)` | Read a file (pass `at` for historical versions) |
| `write(file, content)` | Write/create a file (returns version for OCC) |
| `edit(file, oldString, newString)` | Replace text in a file |
| `delete(file)` | Delete a file |
| `glob(pattern)` | List files matching a pattern |
| `grep(pattern)` | Search file contents (regex) |
| `diff(commit)` | Show diff between commits |
| `log(file?)` | Show commit history |
| `bash(command)` | Run a shell command in sandbox |
| `watch(cursor?)` | Poll for changes since cursor |
| `status()` | Workspace metrics |
| `agents()` | List agents with workspace access |
| `sql(query)` | Execute SQL against workspace database |

## Links

- [GitHub](https://github.com/costate-ai/costate)
- [Quick Start](https://github.com/costate-ai/costate/blob/main/docs/QUICKSTART.md)
- [Costate Cloud](https://costate.ai)

## License

Apache 2.0
