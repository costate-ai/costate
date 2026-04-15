import chalk from 'chalk';
import { CostateClient } from '@costate-ai/sdk';
import { loadConfig } from '../config.js';
import { createTable, colorAgent, timeAgo, spinner, error as printError } from '../output.js';

export async function runStatus(): Promise<void> {
  const config = await loadConfig();
  const url = config.serverUrl || 'http://localhost:3000';

  const spin = spinner('Connecting to server...');
  spin.start();

  const client = new CostateClient({ url, apiKey: config.apiKey });

  try {
    await client.connect();
    spin.text = 'Fetching workspace status...';

    const [status, agentsResult] = await Promise.all([
      client.status(),
      client.agents(),
    ]);

    spin.stop();

    // Workspace overview
    console.log();
    console.log(chalk.bold('Workspace Status'));
    console.log();

    const statusTable = createTable({ head: ['Metric', 'Value'] });
    statusTable.push(
      ['Workspace ID', chalk.cyan(status.id)],
      ['Files', String(status.fileCount)],
      ['Total Size', formatBytes(status.totalSize)],
      ['Commits', String(status.commitCount)],
      ['Last Activity', status.lastActivity ? timeAgo(status.lastActivity) : chalk.dim('none')],
    );
    console.log(statusTable.toString());

    // Agents
    if (agentsResult.agents.length > 0) {
      console.log();
      console.log(chalk.bold('Active Agents'));
      console.log();

      const agentsTable = createTable({ head: ['Agent', 'Last Seen', 'Recent Actions'] });
      for (const agent of agentsResult.agents) {
        agentsTable.push([
          colorAgent(agent.agentId),
          timeAgo(agent.lastSeen),
          String(agent.recentActions),
        ]);
      }
      console.log(agentsTable.toString());
    }

    console.log();
    await client.close();
  } catch (err) {
    spin.stop();
    printError(`Failed to connect: ${(err as Error).message}`);
    process.exit(1);
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
