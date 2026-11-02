import { DRIVE_SCOPE, hasDriveScope, MISSING_SCOPE, SignInError } from './googleDrive';

// google sign-in for the desktop app: the writer's own browser opens google's page, google sends them back to a one-time
// address on this computer, and the code that arrives is traded for a token. a "remember me" token is kept so later
// syncs sign in quietly. the same hidden drive folder is the only thing asked for.

const AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';
export const REFRESH_KEY = 'asterism_google_refresh';

export interface DesktopConfig { clientId: string; clientSecret: string }
export interface Loopback { code: string; state: string; redirect: string }
export interface Granted { token: string; until: number }

export interface DesktopDeps {
  // opens the sign-in page and waits for google to send the writer back
  listen(urlTemplate: string): Promise<Loopback>;
  fetch?: typeof fetch;
  now?: () => number;
}

const b64url = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const randomString = (n: number): string => b64url(crypto.getRandomValues(new Uint8Array(n)));

export const challengeFor = async (verifier: string): Promise<string> =>
  b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));

const readRefresh = (): string | null => { try { return localStorage.getItem(REFRESH_KEY); } catch { return null; } };
const keepRefresh = (token: string | null): void => {
  try { if (token) localStorage.setItem(REFRESH_KEY, token); else localStorage.removeItem(REFRESH_KEY); } catch { /* it will ask again next time */ }
};
export const forgetRefresh = () => keepRefresh(null);

interface TokenReply { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; scope?: string }

async function ask(f: typeof fetch, body: Record<string, string>): Promise<TokenReply> {
  const res = await f(TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body).toString() });
  let json: TokenReply = {};
  try { json = await res.json() as TokenReply; } catch { /* handled below */ }
  if (!res.ok && !json.error) json.error = `status ${res.status}`;
  return json;
}

// a token from the remembered sign-in, or null when there is none or google no longer honors it
export async function renewToken(cfg: DesktopConfig, deps: Pick<DesktopDeps, 'fetch' | 'now'> = {}): Promise<Granted | null> {
  const refresh = readRefresh();
  if (!refresh) return null;
  const f = deps.fetch ?? fetch;
  let reply: TokenReply;
  try {
    reply = await ask(f, { client_id: cfg.clientId, client_secret: cfg.clientSecret, grant_type: 'refresh_token', refresh_token: refresh });
  } catch {
    return null; // offline: keep the remembered sign-in for next time
  }
  if (reply.access_token) {
    // a sign-in remembered from before the app moved out of the hidden folder cannot see the new one: ask again
    if (!hasDriveScope(reply.scope)) { forgetRefresh(); return null; }
    return { token: reply.access_token, until: (deps.now ?? Date.now)() + (reply.expires_in ?? 3600) * 1000 };
  }
  if (reply.error === 'invalid_grant') forgetRefresh(); // taken back in the google account, or expired
  return null;
}

// the full sign-in, with the writer in the loop
export async function signInOnDesktop(cfg: DesktopConfig, deps: DesktopDeps): Promise<Granted> {
  const verifier = randomString(48);
  const state = randomString(16);
  const query = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: 'code',
    scope: DRIVE_SCOPE,
    code_challenge: await challengeFor(verifier),
    code_challenge_method: 'S256',
    state,
    access_type: 'offline',
    prompt: 'select_account consent', // consent makes google hand back a remember-me token every time
  }).toString();
  // the return address is filled in by the app once it knows which port it got
  const template = `${AUTH}?${query}&redirect_uri={redirect}`;

  let back: Loopback;
  try { back = await deps.listen(template); } catch { throw new SignInError(); }
  // anything that did not start from this sign-in is dropped
  if (back.state !== state || !back.code) throw new SignInError();

  const reply = await ask(deps.fetch ?? fetch, {
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: 'authorization_code',
    code: back.code,
    code_verifier: verifier,
    redirect_uri: back.redirect,
  });
  if (!reply.access_token) throw new SignInError();
  if (!hasDriveScope(reply.scope)) throw new SignInError(MISSING_SCOPE);
  if (reply.refresh_token) keepRefresh(reply.refresh_token);
  return { token: reply.access_token, until: (deps.now ?? Date.now)() + (reply.expires_in ?? 3600) * 1000 };
}

// the real thing: the app's own small helper (see src-tauri/src/oauth.rs) does the opening and listening
export const tauriListen = async (urlTemplate: string): Promise<Loopback> => {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<Loopback>('oauth_loopback', { urlTemplate });
};
