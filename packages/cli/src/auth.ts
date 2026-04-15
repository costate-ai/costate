import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';

const AUTH_DIR = join(homedir(), '.costate');
const AUTH_PATH = join(AUTH_DIR, 'auth.json');

export interface AuthSession {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  userId?: string;
}

export async function loadAuthSession(): Promise<AuthSession> {
  try {
    const raw = await readFile(AUTH_PATH, 'utf-8');
    return JSON.parse(raw) as AuthSession;
  } catch {
    return {};
  }
}

export async function saveAuthSession(session: AuthSession): Promise<void> {
  await mkdir(AUTH_DIR, { recursive: true });
  await writeFile(AUTH_PATH, JSON.stringify(session, null, 2) + '\n', 'utf-8');
  await chmod(AUTH_PATH, 0o600);
}

export async function clearAuthSession(): Promise<void> {
  await saveAuthSession({});
}

/**
 * Browser-based login flow:
 * 1. Start local HTTP server on random port
 * 2. Open browser to Cognito hosted UI with callback to local server
 * 3. Receive authorization code
 * 4. Exchange for tokens
 */
export async function browserLogin(cognitoUrl: string, clientId: string): Promise<AuthSession> {
  const port = await findFreePort();
  const redirectUri = `http://localhost:${port}/callback`;
  const state = randomBytes(16).toString('hex');

  const authUrl = `${cognitoUrl}/oauth2/authorize?` +
    `response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}&scope=openid+profile+email`;

  return new Promise<AuthSession>((resolve, reject) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url!, `http://localhost:${port}`);

      if (url.pathname !== '/callback') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const code = url.searchParams.get('code');
      const returnedState = url.searchParams.get('state');

      if (!code || returnedState !== state) {
        res.writeHead(400);
        res.end('Invalid callback');
        reject(new Error('Invalid OAuth callback'));
        server.close();
        return;
      }

      try {
        const tokens = await exchangeCodeForTokens(cognitoUrl, clientId, code, redirectUri);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h2>Login successful!</h2><p>You can close this window.</p></body></html>');
        resolve(tokens);
      } catch (err) {
        res.writeHead(500);
        res.end('Token exchange failed');
        reject(err);
      } finally {
        server.close();
      }
    });

    server.listen(port, '127.0.0.1');

    // Open browser
    openBrowser(authUrl).catch(() => {
      console.log(`\nOpen this URL in your browser:\n${authUrl}\n`);
    });
  });
}

async function exchangeCodeForTokens(
  cognitoUrl: string,
  clientId: string,
  code: string,
  redirectUri: string,
): Promise<AuthSession> {
  const response = await fetch(`${cognitoUrl}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status}`);
  }

  const data = await response.json() as any;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}

async function openBrowser(url: string): Promise<void> {
  const { exec } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execAsync = promisify(exec);

  const platform = process.platform;
  if (platform === 'darwin') {
    await execAsync(`open "${url}"`);
  } else if (platform === 'linux') {
    await execAsync(`xdg-open "${url}"`);
  } else if (platform === 'win32') {
    await execAsync(`start "" "${url}"`);
  }
}

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        const port = addr.port;
        server.close(() => resolve(port));
      } else {
        reject(new Error('Could not find free port'));
      }
    });
  });
}
