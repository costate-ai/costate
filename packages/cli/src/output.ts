import chalk from 'chalk';
import Table from 'cli-table3';
import ora from 'ora';
import { getAgentColor } from './agent-colors.js';

/** Colorize an agent name consistently. */
export function colorAgent(agentId: string): string {
  const color = getAgentColor(agentId);
  const chalkColor = color.chalk as keyof typeof chalk;
  const fn = chalk[chalkColor] as (s: string) => string;
  return fn(agentId);
}

/** Create a styled table for CLI output. */
export function createTable(options: { head: string[]; colWidths?: number[] }): Table.Table {
  return new Table({
    head: options.head.map((h) => chalk.bold(h)),
    colWidths: options.colWidths,
    style: { head: [], border: ['gray'] },
  });
}

/** Create a spinner. */
export function spinner(text: string) {
  return ora({ text, color: 'blue' });
}

/** Print a success message. */
export function success(message: string): void {
  console.log(chalk.green('✓') + ' ' + message);
}

/** Print a warning message. */
export function warn(message: string): void {
  console.log(chalk.yellow('!') + ' ' + message);
}

/** Print an error message. */
export function error(message: string): void {
  console.error(chalk.red('✗') + ' ' + message);
}

/** Format a relative timestamp. */
export function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
