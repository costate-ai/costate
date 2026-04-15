import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CostateClient } from '../client.js';

// ---------------------------------------------------------------------------
// Mock the MCP Client and transport so we never hit a real server
// ---------------------------------------------------------------------------

const mockCallTool = vi.fn();
const mockConnect = vi.fn();
const mockClose = vi.fn();

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.callTool = mockCallTool;
    this.connect = mockConnect;
    this.close = mockClose;
  }),
}));

vi.mock('../transport.js', () => ({
  createTransport: vi.fn().mockReturnValue({}),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a successful MCP tool result */
function okResult(data: unknown) {
  return {
    isError: false,
    content: [{ type: 'text', text: JSON.stringify(data) }],
  };
}

/** Build an error MCP tool result */
function errResult(code: string, message: string, extra?: Record<string, unknown>) {
  return {
    isError: true,
    content: [{ type: 'text', text: JSON.stringify({ error: code, message, ...extra }) }],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CostateClient', () => {
  let client: CostateClient;

  beforeEach(async () => {
    vi.clearAllMocks();
    client = new CostateClient({ url: 'http://localhost:3000' });
    await client.connect();
  });

  // -------------------------------------------------------------------------
  // Connection lifecycle
  // -------------------------------------------------------------------------

  describe('connection lifecycle', () => {
    it('throws if a tool method is called before connect()', async () => {
      const unconnected = new CostateClient({ url: 'http://localhost:3000' });
      await expect(unconnected.read('foo')).rejects.toThrow('Call connect() first');
    });

    it('close() sets client to null and allows reconnect', async () => {
      await client.close();
      await expect(client.read('foo')).rejects.toThrow('Call connect() first');
      // Reconnecting should work
      await client.connect();
      mockCallTool.mockResolvedValueOnce(okResult({ content: 'hi' }));
      await expect(client.read('foo')).resolves.toEqual({ content: 'hi' });
    });

    it('close() on an already-closed client is a no-op', async () => {
      await client.close();
      await expect(client.close()).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Resource operations
  // -------------------------------------------------------------------------

  describe('read', () => {
    it('calls costate_read with file arg', async () => {
      const data = { content: 'hello world' };
      mockCallTool.mockResolvedValueOnce(okResult(data));
      const result = await client.read('config/settings');
      expect(mockCallTool).toHaveBeenCalledWith({ name: 'costate_read', arguments: { file: 'config/settings' } });
      expect(result).toEqual(data);
    });
  });

  describe('write', () => {
    it('calls costate_write with file and content', async () => {
      const data = { sha: 'abc123' };
      mockCallTool.mockResolvedValueOnce(okResult(data));
      const result = await client.write('config/settings', '{"theme":"dark"}');
      expect(mockCallTool).toHaveBeenCalledWith({
        name: 'costate_write',
        arguments: { file: 'config/settings', content: '{"theme":"dark"}' },
      });
      expect(result).toEqual(data);
    });
  });

  describe('edit', () => {
    it('calls costate_edit with file, old_string, new_string', async () => {
      const data = { sha: 'def456' };
      mockCallTool.mockResolvedValueOnce(okResult(data));
      const result = await client.edit('readme.md', 'old text', 'new text');
      expect(mockCallTool).toHaveBeenCalledWith({
        name: 'costate_edit',
        arguments: { file: 'readme.md', old_string: 'old text', new_string: 'new text' },
      });
      expect(result).toEqual(data);
    });
  });

  describe('delete', () => {
    it('calls costate_delete with file', async () => {
      const data = { deleted: true };
      mockCallTool.mockResolvedValueOnce(okResult(data));
      const result = await client.delete('old-file.txt');
      expect(mockCallTool).toHaveBeenCalledWith({ name: 'costate_delete', arguments: { file: 'old-file.txt' } });
      expect(result).toEqual(data);
    });
  });

  describe('glob', () => {
    it('calls costate_search with glob param', async () => {
      const data = { files: ['a.ts', 'b.ts'], count: 2 };
      mockCallTool.mockResolvedValueOnce(okResult(data));
      const result = await client.glob('**/*.ts');
      expect(mockCallTool).toHaveBeenCalledWith({ name: 'costate_search', arguments: { glob: '**/*.ts' } });
      expect(result).toEqual(data);
    });
  });

  describe('grep', () => {
    it('calls costate_search with content param', async () => {
      const data = { results: [], count: 0 };
      mockCallTool.mockResolvedValueOnce(okResult(data));
      await client.grep('TODO');
      expect(mockCallTool).toHaveBeenCalledWith({ name: 'costate_search', arguments: { content: 'TODO' } });
    });

    it('passes optional glob and maxResults', async () => {
      const data = { results: [], count: 0 };
      mockCallTool.mockResolvedValueOnce(okResult(data));
      await client.grep('TODO', { glob: '*.ts', maxResults: 10 });
      expect(mockCallTool).toHaveBeenCalledWith({
        name: 'costate_search',
        arguments: { content: 'TODO', glob: '*.ts', maxResults: 10 },
      });
    });
  });

  // -------------------------------------------------------------------------
  // Query operations
  // -------------------------------------------------------------------------

  describe('diff', () => {
    it('calls costate_git with operation diff', async () => {
      const data = { diff: '+added line' };
      mockCallTool.mockResolvedValueOnce(okResult(data));
      await client.diff();
      expect(mockCallTool).toHaveBeenCalledWith({ name: 'costate_git', arguments: { operation: 'diff' } });
    });

    it('passes from, to, file options', async () => {
      const data = { diff: '' };
      mockCallTool.mockResolvedValueOnce(okResult(data));
      await client.diff({ from: 'abc', to: 'def', file: 'file.txt' });
      expect(mockCallTool).toHaveBeenCalledWith({
        name: 'costate_git',
        arguments: { operation: 'diff', from: 'abc', to: 'def', file: 'file.txt' },
      });
    });
  });

  describe('log', () => {
    it('calls costate_git with operation log', async () => {
      const data = { entries: [] };
      mockCallTool.mockResolvedValueOnce(okResult(data));
      await client.log();
      expect(mockCallTool).toHaveBeenCalledWith({ name: 'costate_git', arguments: { operation: 'log' } });
    });

    it('passes limit and file options', async () => {
      const data = { entries: [] };
      mockCallTool.mockResolvedValueOnce(okResult(data));
      await client.log({ limit: 10, file: 'file.txt' });
      expect(mockCallTool).toHaveBeenCalledWith({
        name: 'costate_git',
        arguments: { operation: 'log', limit: 10, file: 'file.txt' },
      });
    });
  });

  // -------------------------------------------------------------------------
  // Compute
  // -------------------------------------------------------------------------

  describe('bash', () => {
    it('calls costate_bash with command', async () => {
      const data = { stdout: 'hello', stderr: '', exitCode: 0 };
      mockCallTool.mockResolvedValueOnce(okResult(data));
      const result = await client.bash('echo hello');
      expect(mockCallTool).toHaveBeenCalledWith({ name: 'costate_bash', arguments: { command: 'echo hello' } });
      expect(result).toEqual(data);
    });

    it('passes optional timeout', async () => {
      const data = { stdout: '', stderr: '', exitCode: 0 };
      mockCallTool.mockResolvedValueOnce(okResult(data));
      await client.bash('sleep 1', { timeout: 60 });
      expect(mockCallTool).toHaveBeenCalledWith({
        name: 'costate_bash',
        arguments: { command: 'sleep 1', timeout: 60 },
      });
    });
  });

  // -------------------------------------------------------------------------
  // Coordination
  // -------------------------------------------------------------------------

  describe('watch', () => {
    it('strips undefined cursor from args', async () => {
      const data = { events: [], cursor: 'cur1' };
      mockCallTool.mockResolvedValueOnce(okResult(data));
      await client.watch();
      // cursor is undefined, should be stripped
      expect(mockCallTool).toHaveBeenCalledWith({ name: 'costate_watch', arguments: {} });
    });

    it('passes cursor and limit when provided', async () => {
      const data = { events: [], cursor: 'cur2' };
      mockCallTool.mockResolvedValueOnce(okResult(data));
      await client.watch('cur1', { limit: 50 });
      expect(mockCallTool).toHaveBeenCalledWith({
        name: 'costate_watch',
        arguments: { cursor: 'cur1', limit: 50 },
      });
    });
  });

  // -------------------------------------------------------------------------
  // Status
  // -------------------------------------------------------------------------

  describe('status', () => {
    it('calls costate_status with empty args', async () => {
      const data = { resourceCount: 5, totalSize: 1024 };
      mockCallTool.mockResolvedValueOnce(okResult(data));
      const result = await client.status();
      expect(mockCallTool).toHaveBeenCalledWith({ name: 'costate_status', arguments: {} });
      expect(result).toEqual(data);
    });
  });

  describe('agents', () => {
    it('calls costate_agents with empty args', async () => {
      const data = { agents: [{ id: 'agent-1', locks: 2 }] };
      mockCallTool.mockResolvedValueOnce(okResult(data));
      const result = await client.agents();
      expect(mockCallTool).toHaveBeenCalledWith({ name: 'costate_agents', arguments: {} });
      expect(result).toEqual(data);
    });
  });

  // -------------------------------------------------------------------------
  // Error propagation
  // -------------------------------------------------------------------------

  describe('error propagation', () => {
    it('throws parsed error when MCP result has isError: true', async () => {
      mockCallTool.mockResolvedValueOnce(errResult('RESOURCE_NOT_FOUND', 'Resource not found: foo'));
      await expect(client.read('foo')).rejects.toThrow('Resource not found: foo');
    });
  });
});
