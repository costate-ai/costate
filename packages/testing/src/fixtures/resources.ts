export const sampleResources = {
  'config/settings': JSON.stringify(
    { theme: 'dark', language: 'en', notifications: true },
    null,
    2,
  ),
  'tasks/task-001': JSON.stringify(
    { title: 'Implement feature X', status: 'in-progress', assignee: 'agent-1' },
    null,
    2,
  ),
  'notes/meeting': 'Meeting notes from today:\n- Discussed roadmap\n- Assigned tasks\n- Next meeting Thursday',
  'data/users': JSON.stringify(
    [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ],
    null,
    2,
  ),
};
