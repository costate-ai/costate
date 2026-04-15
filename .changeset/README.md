# Changesets

This directory is used by [changesets](https://github.com/changesets/changesets) to manage versioning and changelogs for published packages.

## Published packages

- `@costate-ai/shared` — types, adapters, constants
- `@costate-ai/sdk` — TypeScript SDK
- `@costate-ai/mcp` — MCP tool schemas

## Usage

```bash
pnpm changeset        # create a new changeset
pnpm changeset:version  # bump versions based on changesets
pnpm changeset:publish  # publish to npm
```
