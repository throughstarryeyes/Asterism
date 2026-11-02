import { DRIVE_SCOPE, hasDriveScope, MISSING_SCOPE, SignInError } from './googleDrive';
import { inDesktopApp } from '../saveFile';
import { forgetRefresh, renewToken, signInOnDesktop, tauriListen, type DesktopConfig } from './googleDesktop';

// signing in to google for drive sync. nothing here runs, and google's script is not even loaded, until the writer turns the sync on.
// the app only asks to see the files it made itself (drive.file), plus its old hidden folder (drive.appdata) so earlier projects can be copied across.

// every copy of the app that is built needs its own google project; a fork puts its own id in VITE_GOOGLE_CLIENT_ID
export const googleClientId = (): string => (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ?? '';

// the desktop app signs in with a second client from the same project (type "Desktop app"), which comes with a secret.
// google does not treat that secret as private for installed apps, so it is fine in the build.
const env = (name: string): string => ((import.meta.env as Record<string, string | undefined>)[name] ?? '').trim();
const desktopConfig = (): DesktopConfig => ({ clientId: env('VITE_GOOGLE_DESKTOP_CLIENT_ID'), clientSecret: env('VITE_GOOGLE_DESKTOP_CLIENT_SECRET') });

export type GoogleSupport = { ok: true } | { ok: false; why: string };

export function googleSupport(): GoogleSupport {
  if (inDesktopApp()) {
    const cfg = desktopConfig();
    return cfg.clientId && cfg.clientSecret ? { ok: true } : { ok: false, why: 'This copy of Asterism is not set up for Google Drive.' };
  }
  if (!googleClientId()) return { ok: false, why: 'This copy of Asterism is not set up for Google Drive.' };
  return { ok: true };
}

interface TokenResponse { access_token?: string; expires_in?: number; error?: string; scope?: string }
interface TokenClient { requestAccessToken(overrides?: { prompt?: string }): void }
interface GoogleIdentity {
  accounts: { oauth2: { initTokenClient(c: {
    client_id: string; scope: string;
    callback: (r: TokenResponse) => void;
    error_callback?: (e: { type?: string }) => void;
  }): TokenClient } };
}

const SCRIPT = 'https://accounts.google.com/gsi/client';
let loading: Promise<GoogleIdentity> | null = null;

function loadScript(): Promise<GoogleIdentity> {
  const ready = (window as unknown as { google?: GoogleIdentity }).google?.accounts?.oauth2;
  if (ready) return Promise.resolve((window as unknown as { google: GoogleIdentity }).google);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const tag = document.createElement('script');
      tag.src = SCRIPT;
      tag.async = true;
      tag.onload = () => resolve((window as unknown as { google: GoogleIdentity }).google);
      tag.onerror = () => { loading = null; tag.remove(); reject(new Error('Could not reach Google. Check your connection and try again.')); };
      document.head.appendChild(tag);
    });
  }
  return loading;
}

let held: { token: string; until: number } | null = null;

// a token that works now. quietly renews one that ran out when it can; with `interactive` it may open google's sign in window.
export async function googleToken(interactive: boolean): Promise<string> {
  const support = googleSupport();
  if (!support.ok) throw new Error(support.why);
  if (held && held.until > Date.now() + 60_000) return held.token;
  if (inDesktopApp()) {
    const quiet = await renewToken(desktopConfig());
    if (quiet) { held = quiet; return quiet.token; }
    if (!interactive) throw new SignInError();
    held = await signInOnDesktop(desktopConfig(), { listen: tauriListen });
    return held.token;
  }
  const google = await loadScript();
  return new Promise<string>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: googleClientId(),
      scope: DRIVE_SCOPE,
      callback: r => {
        if (r.access_token && !hasDriveScope(r.scope)) reject(new SignInError(MISSING_SCOPE));
        else if (r.access_token) {
          held = { token: r.access_token, until: Date.now() + (r.expires_in ?? 3600) * 1000 };
          resolve(r.access_token);
        } else reject(new SignInError());
      },
      error_callback: () => reject(new SignInError()),
    });
    // 'none' renews without showing anything; it fails if google needs the writer to say yes again
    client.requestAccessToken({ prompt: interactive ? 'select_account' : 'none' });
  });
}

// signing out: the remembered desktop sign-in goes too
export const forgetGoogleToken = () => { held = null; forgetRefresh(); };
