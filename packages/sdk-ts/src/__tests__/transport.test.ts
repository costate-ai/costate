import { describe, it, expect, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Capture the constructor args passed to StreamableHTTPClientTransport
// ---------------------------------------------------------------------------

let capturedUrl: URL | undefined;
let capturedOpts: Record<string, unknown> | undefined;

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: vi.fn().mockImplementation(function (this: Record<string, unknown>, url: URL, opts: Record<string, unknown>) {
    capturedUrl = url;
    capturedOpts = opts;
    this.url = url;
    this.opts = opts;
  }),
}));

// Import AFTER the mock is set up
import { createTransport } from '../transport.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createTransport', () => {
  it('constructs URL with /mcp path', () => {
    createTransport({ url: 'http://localhost:3000' });
    expect(capturedUrl?.toString()).toBe('http://localhost:3000/mcp');
  });

  it('handles URL with trailing slash', () => {
    createTransport({ url: 'http://localhost:3000/' });
    expect(capturedUrl?.toString()).toBe('http://localhost:3000/mcp');
  });

  it('sets Authorization header when apiKey is provided', () => {
    createTransport({ url: 'http://localhost:3000', apiKey: 'cst_test123' });
    const headers = (capturedOpts?.requestInit as { headers: Record<string, string> })?.headers;
    expect(headers?.['Authorization']).toBe('Bearer cst_test123');
  });

  it('does not set x-costate-agent-id header (agentId resolved server-side from token)', () => {
    createTransport({ url: 'http://localhost:3000', apiKey: 'cst_key' });
    const headers = (capturedOpts?.requestInit as { headers: Record<string, string> })?.headers;
    expect(headers?.['x-costate-agent-id']).toBeUndefined();
  });

  it('sends no auth headers when apiKey is not set', () => {
    createTransport({ url: 'http://localhost:3000' });
    const headers = (capturedOpts?.requestInit as { headers: Record<string, string> })?.headers;
    expect(headers?.['Authorization']).toBeUndefined();
  });

  it('appends workspace query param when workspaceId is provided', () => {
    createTransport({ url: 'http://localhost:3000', workspaceId: 'ws_test' });
    expect(capturedUrl?.searchParams.get('workspace')).toBe('ws_test');
  });
});
