import fs from 'node:fs';
import path from 'node:path';

// Files written by global setup / the auth setup project. e2e/.auth/ is gitignored.
export const AUTH_DIR = path.join(__dirname, '.auth');
export const CREDENTIALS_FILE = path.join(AUTH_DIR, 'user.json');
export const STORAGE_STATE = path.join(AUTH_DIR, 'state.json');

export type E2EUser = { id: string; email: string; password: string };

export function readTestUser(): E2EUser {
  return JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8')) as E2EUser;
}
