import React, { useEffect, useState } from 'react';
import { Check, Copy, Radio, X } from 'lucide-react';
import { useAsterism } from '../../context/AsterismContext';
import { DialogFrame } from '../Common/DialogFrame';
import { Loader } from '../Common/Loader';
import { canRunRelay, canShareOverInternet, guestAddress, relayStatus, startRelay, startTunnel, stopRelay, type RelayInfo } from '../../services/desktopRelay';

// writing together, live. one person hosts from their own computer; the others join with the host's address and a password.

const card: React.CSSProperties = { padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: 10 };
const field: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-paper)', color: 'var(--text-main)', fontSize: '0.85rem', boxSizing: 'border-box' };
const button: React.CSSProperties = { padding: '7px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', fontSize: '0.82rem', color: 'var(--text-main)', cursor: 'pointer', backgroundColor: 'var(--bg-paper)' };
const primary: React.CSSProperties = { ...button, backgroundColor: 'var(--accent-gold-bg)', border: '1px solid var(--accent-gold)', color: 'var(--accent-gold-text, var(--accent-gold))', fontWeight: 600 };
const small: React.CSSProperties = { fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 };
const label: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.78rem', color: 'var(--text-secondary)' };

const PREFS = 'asterism_live_prefs';
interface Prefs { name: string; relay: string; hostKey: string; address: string; joinAddress: string }
const loadPrefs = (): Prefs => {
  try { return { name: '', relay: 'ws://localhost:8788', hostKey: '', address: '', joinAddress: '', ...(JSON.parse(localStorage.getItem(PREFS) ?? '{}') as Partial<Prefs>) }; }
  catch { return { name: '', relay: 'ws://localhost:8788', hostKey: '', address: '', joinAddress: '' }; }
};
const savePrefs = (p: Prefs) => { try { localStorage.setItem(PREFS, JSON.stringify(p)); } catch { /* they just are not remembered */ } };

export const CollaborationModal: React.FC = () => {
  const { project, allProjects, live, liveSessions, liveApi, openProject, isCollabModalOpen, setIsCollabModalOpen, showToast } = useAsterism();
  const [prefs, setPrefs] = useState<Prefs>(() => { const p = loadPrefs(); return { ...p, name: p.name || project.author || '' }; });
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [copied, setCopied] = useState('');
  // the relay the desktop app runs on this computer, when it is running
  const desktop = canRunRelay();
  const [relay, setRelay] = useState<RelayInfo | null>(null);
  useEffect(() => {
    if (!desktop || !isCollabModalOpen) return;
    relayStatus().then(setRelay).catch(() => setRelay(null));
  }, [desktop, isCollabModalOpen]);

  if (!isCollabModalOpen) return null;
  const close = () => setIsCollabModalOpen(false);
  const set = (k: keyof Prefs, v: string) => setPrefs(p => { const next = { ...p, [k]: v }; savePrefs(next); return next; });

  const run = async (work: () => Promise<void>) => {
    setBusy(true); setProblem('');
    try { await work(); } catch (e) { setProblem(e instanceof Error ? e.message : 'That did not work.'); } finally { setBusy(false); }
  };

  const copy = async (what: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(what); window.setTimeout(() => setCopied(''), 1800); } catch { showToast('Could not copy. Select the text and copy it.', 'info'); }
  };

  const others = liveSessions.filter(x => x.projectId !== project.id);
  const titleOf = (id: string) => allProjects.find(p => p.id === id)?.title ?? 'A document';
  const hosting = live.mode === 'hosting';
  const joined = live.mode === 'joined' || live.mode === 'ended';
  const roleText = (r: 'writer' | 'reader') => (r === 'reader' ? 'a reader' : 'a writer');

  return (
    <DialogFrame label="Write together" onClose={close} onClick={close}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="glass-panel animate-fade-in" onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', backgroundColor: 'var(--bg-paper)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-paper)', padding: 24, color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 8 }}><Radio size={18} /> Write together</h3>
          <button aria-label="Close" onClick={close} style={{ color: 'var(--text-secondary)', display: 'flex', padding: 4 }}><X size={18} /></button>
        </div>

        {problem && <div role="alert" style={{ ...small, color: '#c0392b' }}>{problem}</div>}

        {live.mode === 'none' && (
          <>
            {liveSessions.length === 0 && <p style={small}>Everyone types in the same chapters at once and sees each other’s cursors. Your theme, tools and story bible stay yours. Nothing goes through anything of ours.</p>}

            <div style={card}>
              <strong style={{ fontSize: '0.9rem' }}>Host “{project.title}”</strong>
              <label style={label}>Your name<input style={field} value={prefs.name} onChange={e => set('name', e.target.value)} /></label>
              {desktop ? (
                relay ? (
                  <>
                    <div style={small}>The relay is running on this computer.</div>
                    {relay.lan && <div style={small}>On your network, guests type <code>{relay.lan}</code></div>}
                    {relay.tunnel
                      ? <div style={small}>Over the internet (your own tunnel), guests type <code>{relay.tunnel}</code></div>
                      : canShareOverInternet() && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div><button style={button} disabled={busy} onClick={() => run(async () => setRelay({ ...relay, tunnel: await startTunnel() }))}>{busy ? <><Loader inline /> Opening…</> : 'Share over the internet'}</button></div>
                          <div style={small}>For guests who are not on your network. Uses your own copy of cloudflared if it is installed.</div>
                        </div>
                      )}
                    <div><button style={button} onClick={() => run(async () => { await stopRelay(); setRelay(null); })}>Stop relay</button></div>
                  </>
                ) : (
                  <>
                    <div style={small}>Hosting runs a small relay on this computer. It only passes along scrambled text, and nothing leaves your computer until someone joins.</div>
                    <div><button style={button} disabled={busy} onClick={() => run(async () => setRelay(await startRelay()))}>{busy ? <><Loader inline /> Starting…</> : 'Start relay'}</button></div>
                  </>
                )
              ) : (
                <>
                  <label style={label}>Relay on this computer<input style={field} value={prefs.relay} onChange={e => set('relay', e.target.value)} placeholder="ws://localhost:8788" /></label>
                  <label style={label}>Host key<input style={field} type="password" value={prefs.hostKey} onChange={e => set('hostKey', e.target.value)} placeholder="printed when the relay starts" autoComplete="off" /></label>
                  <label style={label}>Address your guests will type<input style={field} value={prefs.address} onChange={e => set('address', e.target.value)} placeholder="for example 192.168.1.20:8788, or your tunnel address" /></label>
                  <p style={small}>A web page can’t start programs, so start the relay on this computer first. The desktop app has a button for it.</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <code>node server/session-relay.mjs</code>
                    <button style={button} onClick={() => copy('cmd', 'node server/session-relay.mjs')}>{copied === 'cmd' ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}</button>
                  </div>
                  <p style={small}>It prints the host key. For people outside your home network, point your own tunnel at it.</p>
                </>
              )}
              <div><button style={primary} disabled={busy} onClick={() => run(async () => {
                // in the desktop app the relay is started here if it was not already, and its key and address are filled in
                if (desktop) {
                  const info = relay ?? await startRelay();
                  setRelay(info);
                  await liveApi.startHosting({ relay: `ws://127.0.0.1:${info.port}`, hostKey: info.host_key, address: guestAddress(info), name: prefs.name });
                } else {
                  await liveApi.startHosting({ relay: prefs.relay, hostKey: prefs.hostKey, address: prefs.address, name: prefs.name });
                }
              })}>{busy ? <><Loader inline /> Starting…</> : 'Start session'}</button></div>
            </div>

          </>
        )}

        {hosting && (
          <>
            <div style={card}>
              <strong style={{ fontSize: '0.9rem' }}>You are hosting “{project.title}”</strong>
              <div style={small}>Here now: {live.people.length ? live.people.join(', ') : 'just you'}</div>
              <div style={small}>Chapters can’t be added, moved or removed while you write together. Everything else works as usual.</div>
            </div>

            <div style={card}>
              <strong style={{ fontSize: '0.9rem' }}>Invite someone</strong>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button style={button} onClick={() => liveApi.invite('writer')}>Invite a writer</button>
                <button style={button} onClick={() => liveApi.invite('reader')}>Invite a reader</button>
              </div>
              {live.invites.length === 0 && <p style={small}>A writer can type. A reader sees everything live but can’t change the text. Each invite works once and runs out after 15 minutes.</p>}
              {live.invites.map(inv => (
                <div key={inv.password} style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
                  <div style={small}>For {roleText(inv.role)} {inv.used ? '(joined)' : '(waiting)'}</div>
                  {!inv.used && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={small}>Address</span><code>{live.address || 'the one you gave'}</code>
                        <span style={small}>Password</span><code>{inv.password}</code>
                      </div>
                      <div><button style={button} onClick={() => copy(inv.password, `Address: ${live.address}\nPassword: ${inv.password}`)}>{copied === inv.password ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy both</>}</button></div>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div><button style={button} onClick={() => liveApi.end()}>End session</button></div>
          </>
        )}

        {joined && (
          <div style={card}>
            <strong style={{ fontSize: '0.9rem' }}>{live.mode === 'ended' ? 'The session has ended' : live.role === 'reader' ? 'Reading along' : 'Writing together'}</strong>
            {live.connection === 'reconnecting' && <div style={{ ...small, color: '#b9770e' }}>Connection lost. Trying to get back in. You can keep writing, and your changes will join in when it returns.</div>}
            {live.message && <div style={small}>{live.message}</div>}
            {live.mode === 'joined' && <div style={small}>Here now: {live.people.join(', ')}</div>}
            <div style={small}>Your copy of the document is in your library and is saved as you go.</div>
            <div><button style={button} onClick={() => { liveApi.end(); close(); }}>{live.mode === 'ended' ? 'Close' : 'Leave session'}</button></div>
          </div>
        )}

        {/* joining is always possible: it makes a new document, so it never clashes with this one */}
            <div style={card}>
              <strong style={{ fontSize: '0.9rem' }}>{live.mode === 'none' && liveSessions.length === 0 ? 'Join a session' : 'Join another session'}</strong>
              <label style={label}>Your name<input style={field} value={prefs.name} onChange={e => set('name', e.target.value)} /></label>
              <label style={label}>Host’s address<input style={field} value={prefs.joinAddress} onChange={e => set('joinAddress', e.target.value)} placeholder="what the host gave you" /></label>
              <label style={label}>Password<input style={field} value={password} onChange={e => setPassword(e.target.value)} placeholder="four words, like amber-otter-brick-lane" autoComplete="off" /></label>
              <p style={small}>A copy of the document is added to your library the first time. It stays there when the session ends, and joining again later brings that same copy up to date.</p>
              <div><button style={primary} disabled={busy || !password.trim()} onClick={() => run(async () => { await liveApi.join({ address: prefs.joinAddress, password, name: prefs.name }); setPassword(''); close(); })}>{busy ? <><Loader inline /> Joining…</> : 'Join'}</button></div>
            </div>

        {others.length > 0 && (
          <div style={card}>
            <strong style={{ fontSize: '0.9rem' }}>Your other sessions</strong>
            <p style={small}>These keep going while another document is open. What arrives is saved in each document.</p>
            {others.map(o => (
              <div key={o.projectId} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{titleOf(o.projectId)}</div>
                  <div style={small}>
                    {o.mode === 'hosting' ? 'You are hosting' : o.mode === 'ended' ? 'Ended' : o.role === 'reader' ? 'Reading along' : 'Writing together'}
                    {o.connection === 'reconnecting' ? ' · reconnecting' : ''}
                    {o.people.length ? ` · ${o.people.join(', ')}` : ''}
                  </div>
                </div>
                <button style={button} onClick={() => { openProject(o.projectId); close(); }}>Open</button>
                <button style={button} onClick={() => liveApi.end(o.projectId)}>{o.mode === 'hosting' ? 'End' : 'Leave'}</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </DialogFrame>
  );
};
