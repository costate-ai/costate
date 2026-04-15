import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function getLastCommit(workspacePath: string): Promise<{ hash: string; message: string }> {
  const { stdout } = await execFileAsync('git', ['log', '-1', '--format=%H%n%s'], {
    cwd: workspacePath,
  });
  const [hash, message] = stdout.trim().split('\n');
  return { hash: hash!, message: message! };
}

export async function getCommitCount(workspacePath: string): Promise<number> {
  const { stdout } = await execFileAsync('git', ['rev-list', '--count', 'HEAD'], {
    cwd: workspacePath,
  });
  return parseInt(stdout.trim(), 10);
}

export async function assertCommitExists(workspacePath: string, messageSubstring: string): Promise<boolean> {
  const { stdout } = await execFileAsync('git', ['log', '--oneline', '--all'], {
    cwd: workspacePath,
  });
  return stdout.includes(messageSubstring);
}
