import { beforeEach, describe, expect, it, vi } from 'vitest';
import { challengeFor, forgetRefresh, REFRESH_KEY, renewToken, signInOnDesktop, type Loopback } from '../googleDesktop';
import { SignInError } from '../googleDrive';

const cfg = { clientId: 'id.apps.googleusercontent.com', clientSecret: 'secret' };

// a fake google token endpoint that records what it was asked
function fakeGoogle(reply: (body: URLSearchParams) => { status?: number; json: object }) {
  const asked: URLSearchParams[] = [];
  const f = (async (_url: string, init: RequestInit) => {
    const body = new URLSearchParams(String(init.body));
    asked.push(body);
    const r = reply(body);
    return new Response(JSON.stringify(r.json), { status: r.status ?? 200 });
  }) as unknown as typeof fetch;
  return { f, asked };
}

// the writer comes back through the browser with the state the app made
const comesBack = (override: Partial<Loopback> = {}) => async (template: string): Promise<Loopback> => {
  const state = /state=([^&]+)/.exec(template)![1];
  return { code: 'the-code', state, redirect: 'http://127.0.0.1:4567', ...override };
};

describe('desktop google sign-in', () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => { data.set(k, v); },
      removeItem: (k: string) => { data.delete(k); },
    });
    forgetRefresh();
  });

  it('trades the code for a token and remembers the sign-in', async () => {
    const g = fakeGoogle(() => ({ json: { access_token: 'acc', refresh_token: 'ref', expires_in: 3600 } }));
    const got = await signInOnDesktop(cfg, { listen: comesBack(), fetch: g.f, now: () => 1000 });
    expect(got).toEqual({ token: 'acc', until: 1000 + 3600_000 });
    expect(localStorage.getItem(REFRESH_KEY)).toBe('ref');
    const sent = g.asked[0];
    expect(sent.get('grant_type')).toBe('authorization_code');
    expect(sent.get('code')).toBe('the-code');
    expect(sent.get('redirect_uri')).toBe('http://127.0.0.1:4567');
    expect(sent.get('client_secret')).toBe('secret');
  });

  it('proves the code belongs to this sign-in with the pkce verifier', async () => {
    let challenge = '';
    const g = fakeGoogle(() => ({ json: { access_token: 'acc' } }));
    await signInOnDesktop(cfg, {
      listen: async t => { challenge = /code_challenge=([^&]+)/.exec(t)![1]; return comesBack()(t); },
      fetch: g.f,
    });
    expect(await challengeFor(g.asked[0].get('code_verifier')!)).toBe(challenge);
  });

  it('asks only for the app\'s own files and leaves the return address to the app', async () => {
    let url = '';
    await signInOnDesktop(cfg, { listen: async t => { url = t; return comesBack()(t); }, fetch: fakeGoogle(() => ({ json: { access_token: 'a' } })).f });
    expect(url).toContain('scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive.file+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive.appdata');
    expect(url).not.toMatch(/auth%2Fdrive(&|\+|$)/);
    expect(url).toContain('code_challenge_method=S256');
    expect(url.endsWith('redirect_uri={redirect}')).toBe(true);
  });

  it('refuses a return that is not from this sign-in', async () => {
    const g = fakeGoogle(() => ({ json: { access_token: 'acc' } }));
    await expect(signInOnDesktop(cfg, { listen: comesBack({ state: 'someone-else' }), fetch: g.f })).rejects.toBeInstanceOf(SignInError);
    expect(g.asked).toHaveLength(0);
  });

  it('reports a sign-in the writer cancelled', async () => {
    await expect(signInOnDesktop(cfg, { listen: async () => { throw new Error('access_denied'); } })).rejects.toBeInstanceOf(SignInError);
  });

  it('renews quietly from the remembered sign-in', async () => {
    localStorage.setItem(REFRESH_KEY, 'ref');
    const g = fakeGoogle(() => ({ json: { access_token: 'fresh', expires_in: 100 } }));
    expect(await renewToken(cfg, { fetch: g.f, now: () => 0 })).toEqual({ token: 'fresh', until: 100_000 });
    expect(g.asked[0].get('grant_type')).toBe('refresh_token');
    expect(g.asked[0].get('refresh_token')).toBe('ref');
  });

  it('has nothing to renew before the first sign-in', async () => {
    expect(await renewToken(cfg, { fetch: fakeGoogle(() => ({ json: {} })).f })).toBeNull();
  });

  it('forgets a sign-in google took back, but keeps it when only offline', async () => {
    localStorage.setItem(REFRESH_KEY, 'ref');
    const offline = (async () => { throw new TypeError('network'); }) as unknown as typeof fetch;
    expect(await renewToken(cfg, { fetch: offline })).toBeNull();
    expect(localStorage.getItem(REFRESH_KEY)).toBe('ref');
    const revoked = fakeGoogle(() => ({ status: 400, json: { error: 'invalid_grant' } }));
    expect(await renewToken(cfg, { fetch: revoked.f })).toBeNull();
    expect(localStorage.getItem(REFRESH_KEY)).toBeNull();
  });
});
