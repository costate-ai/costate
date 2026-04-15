/**
 * @costate-ai/shared — protocol schemas for the Costate coordination service.
 *
 * Exports:
 *   - PAT creation schemas (pat-schemas): CreatePatInput, PatScope, etc.
 *   - Authorization scope system (scopes): Scope, Role, GrantScope, TOOL_SCOPES, etc.
 *   - Error classes at `@costate-ai/shared/errors`.
 */

export * from "./pat-schemas.js";
export * from "./permissions.js";
export * from "./scopes.js";
