import type { ToolDefinition } from './types.js';
import { ReadInput } from '../schemas/read.js';
import { WriteInput } from '../schemas/write.js';
import { EditInput } from '../schemas/edit.js';
import { DeleteInput } from '../schemas/delete.js';
import { SearchInput } from '../schemas/search.js';
import { GitInput } from '../schemas/git.js';
import { BashInput } from '../schemas/bash.js';
import { WatchInput } from '../schemas/watch.js';
import { StatusInput } from '../schemas/status.js';
import { SqlInput } from '../schemas/sql.js';
import { AutomationInput } from '../schemas/automation.js';
import { AgentsInput } from '../schemas/agents.js';
import { AccessInput } from '../schemas/access.js';
import { TaskInput } from '../schemas/task.js';
import { MessageInput } from '../schemas/message.js';

export const toolDefinitions: ToolDefinition[] = [
  {
    name: 'costate_read',
    description: 'Read a file. Returns content, size, and version hash.',
    inputSchema: ReadInput,
  },
  {
    name: 'costate_write',
    description: 'Write a file. Git-versioned. Returns version hash for conflict detection.',
    inputSchema: WriteInput,
  },
  {
    name: 'costate_edit',
    description: 'Edit a file by replacing old_string with new_string. Returns new version.',
    inputSchema: EditInput,
  },
  {
    name: 'costate_delete',
    description: 'Delete a file.',
    inputSchema: DeleteInput,
  },
  {
    name: 'costate_search',
    description: 'Search workspace. Use "glob" alone to list files by pattern. Add "content" to search file contents with regex.',
    inputSchema: SearchInput,
  },
  {
    name: 'costate_git',
    description: 'Git history. operation: "diff" shows changes between commits, "log" shows commit history.',
    inputSchema: GitInput,
  },
  {
    name: 'costate_bash',
    description: 'Execute a shell command in sandbox. 30s timeout.',
    inputSchema: BashInput,
  },
  {
    name: 'costate_watch',
    description: 'Watch for changes. Poll mode: pass "cursor" to get events since last poll. Blocking mode: pass "timeout" to wait until a file matching "pattern" changes.',
    inputSchema: WatchInput,
  },
  {
    name: 'costate_status',
    description: 'Workspace overview: files, tables, commits, active agents.',
    inputSchema: StatusInput,
  },
  {
    name: 'costate_sql',
    description: 'Execute SQL. SELECT, INSERT, UPDATE, DELETE, CREATE/DROP TABLE.',
    inputSchema: SqlInput,
  },
  {
    name: 'costate_automation',
    description: 'Manage automations. type: "webhook" fires on file change, "trigger" fires on JSON field change. Operations: create, list, delete.',
    inputSchema: AutomationInput,
  },
  {
    name: 'costate_agents',
    description: 'List agents in this workspace with roles and online status.',
    inputSchema: AgentsInput,
  },
  {
    name: 'costate_access',
    description: 'Manage workspace access. Operations: grant, revoke, list.',
    inputSchema: AccessInput,
  },
  {
    name: 'costate_task',
    description: 'Manage tasks. Atomic claim prevents double-work. Operations: create, list, claim, complete, update, delete.',
    inputSchema: TaskInput,
  },
  {
    name: 'costate_message',
    description: 'Agent-to-agent messaging. Operations: send, list, read.',
    inputSchema: MessageInput,
  },
];

export type { ToolDefinition } from './types.js';
