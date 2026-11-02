import { Loader } from '../Common/Loader';
import React, { useRef, useState } from 'react';
import { X, RefreshCw, Cloud, FolderSync, Server, Smartphone, FileJson, Trash2, AlertTriangle, Check, Copy } from 'lucide-react';
import { useAsterism } from '../../context/AsterismContext';
import type { DriveProject } from '../../services/sync/googleDrive';
import { splitBlocks, type Choice, type Conflict } from '../../services/sync/merge';
import { useDialog } from '../Common/useDialog';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  // opened from home: only the part that brings documents in from Google Drive
  fromHome?: boolean;
}

const card: React.CSSProperties = {
  padding: '14px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-card)',
};
const field: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)',
  backgroundColor: 'var(--bg-paper)', color: 'var(--text-main)', fontSize: '0.85rem', boxSizing: 'border-box',
};
const button: React.CSSProperties = {
  padding: '7px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', fontSize: '0.82rem',
  color: 'var(--text-main)', cursor: 'pointer', backgroundColor: 'var(--bg-paper)',
};
const small: React.CSSProperties = { fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 };

const plain = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const clip = (s: string, n = 220) => (s.length > n ? `${s.slice(0, n)}…` : s);

// what each side says, short enough to compare at a glance.
function preview(c: Conflict, side: 'local' | 'remote'): string {
  const v = side === 'local' ? c.local : c.remote;
  if (v === undefined) return side === 'local' ? 'Deleted on this device' : 'Deleted on the other side';
  if (c.kind === 'text' && typeof v === 'string') {
    const other = (side === 'local' ? c.remote : c.local) as string;
    const mine = splitBlocks(v), theirs = splitBlocks(other ?? '');
    let i = 0;
    while (i < mine.length && i < theirs.length && mine[i] === theirs[i]) i++;
    return clip(plain(mine[i] ?? '') || '(nothing at that point)');
  }
  if (typeof v === 'object' && v !== null) {
    const o = v as Record<string, unknown>;
    return clip(String(o.title ?? o.name ?? JSON.stringify(v)));
  }
  return clip(String(v));
}

const ago = (iso?: string) => {
  if (!iso) return 'not yet';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  return new Date(iso).toLocaleDateString();
};

const Section: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <div style={card}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', fontWeight: 600, fontSize: '0.95rem' }}>
      <span style={{ color: 'var(--accent-gold-text, var(--accent-gold))', display: 'flex' }}>{icon}</span>{title}
    </div>
    {children}
  </div>
);

export const SyncModal: React.FC<Props> = ({ isOpen, onClose, fromHome }) => {
  const { sync, project, allProjects } = useAsterism();
  const [problem, setProblem] = useState('');
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [answer, setAnswer] = useState('');
  const [code, setCode] = useState('');
  const [drive, setDrive] = useState<DriveProject[] | null>(null);
  const [driveBusy, setDriveBusy] = useState(false);
  const [mode, setMode] = useState<'none' | 'host' | 'join'>('none');
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const dialogRef = useDialog<HTMLDivElement>(isOpen, onClose, true);

  if (!isOpen) return null;

  const attempt = async (fn: () => Promise<void>) => {
    setProblem('');
    try { await fn(); } catch (e) { setProblem(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Sync" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div
        className="glass-panel animate-fade-in"
        style={{ width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: 'var(--bg-paper)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-paper)', padding: '28px', color: 'var(--text-main)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <RefreshCw size={22} style={{ color: 'var(--accent-gold-text, var(--accent-gold))' }} />
            <h2 style={{ fontSize: '1.3rem', fontFamily: 'var(--font-display)', margin: 0 }}>{fromHome ? 'Google Drive' : <>Sync “{project.title}”</>}</h2>
          </div>
          <button aria-label="Close" onClick={onClose} style={{ color: 'var(--text-secondary)', padding: '6px' }}><X size={20} /></button>
        </div>

        <p style={{ ...small, marginBottom: '16px' }}>
          Optional. Your writing stays on this device first. Different changes are combined; if both sides changed the same thing, you choose. A restore point is saved first.
        </p>

        {problem && (
          <div style={{ ...card, borderColor: '#c0392b', marginBottom: '12px', display: 'flex', gap: '8px', ...small, color: 'var(--text-main)' }}>
            <AlertTriangle size={16} style={{ color: '#c0392b', flexShrink: 0, marginTop: 2 }} /><span>{problem}</span>
          </div>
        )}

        {sync.pending && (
          <div style={{ ...card, borderColor: 'var(--accent-gold)', marginBottom: '16px' }}>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>{sync.pending.conflicts.length} thing{sync.pending.conflicts.length === 1 ? '' : 's'} changed on both sides</div>
            <p style={{ ...small, marginBottom: '10px' }}>Nothing sent yet. Pick which version to keep for each. Combined changes are kept either way.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {sync.pending.conflicts.map(c => {
                const picked = choices[c.key] ?? 'local';
                return (
                  <div key={c.key}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>{c.label}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      {(['local', 'remote'] as const).map(side => (
                        <button
                          key={side}
                          onClick={() => setChoices(x => ({ ...x, [c.key]: side }))}
                          style={{ ...button, textAlign: 'left', borderColor: picked === side ? 'var(--accent-gold)' : 'var(--border-subtle)', borderWidth: picked === side ? 2 : 1, display: 'block' }}
                        >
                          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)' }}>{side === 'local' ? 'This device' : 'The other side'}</div>
                          <div style={{ fontSize: '0.82rem', marginTop: 2 }}>{preview(c, side)}</div>
                        </button>
                      ))}
                    </div>
                    {c.kind === 'text' && (
                      <button
                        onClick={() => setChoices(x => ({ ...x, [c.key]: 'both' }))}
                        style={{ ...button, marginTop: '8px', width: '100%', textAlign: 'left', borderColor: picked === 'both' ? 'var(--accent-gold)' : 'var(--border-subtle)', borderWidth: picked === 'both' ? 2 : 1 }}
                      >
                        <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)' }}>Keep both</div>
                        <div style={{ fontSize: '0.82rem', marginTop: 2 }}>Nothing is lost. The other side’s paragraph is followed by yours, and you can tidy it afterwards.</div>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <button style={{ ...button, backgroundColor: 'var(--accent-gold-text, var(--accent-gold))', color: '#1a1408', fontWeight: 600 }} onClick={() => { void sync.resolve(choices); setChoices({}); }}>Finish sync</button>
              <button style={button} onClick={() => { sync.cancelResolve(); setChoices({}); }}>Not now</button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {!fromHome && sync.links.some(l => l.kind !== 'google') && (
            <Section icon={<Check size={18} />} title="Linked places">
              {sync.links.filter(l => l.kind !== 'google').map(link => {
                const st = sync.status[link.id];
                return (
                  <div key={link.id} style={{ padding: '8px 0', borderTop: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '0.88rem' }}>{link.kind === 'folder' ? 'Folder' : link.kind === 'google' ? 'Google Drive' : 'Server'}{link.kind === 'google' ? '' : `: ${link.label}`}</strong>
                      <span style={{ ...small, marginLeft: 'auto' }}>last synced {ago(link.lastSyncedAt)}</span>
                    </div>
                    {(st?.message || st?.error) && (
                      <div style={{ ...small, color: st.error ? '#c0392b' : 'var(--text-secondary)' }}>{st.error ?? st.message}</div>
                    )}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap' }}>
                      <button style={button} disabled={st?.busy} onClick={() => void sync.syncNow(link.id)}>{st?.needsPermission ? 'Allow and sync' : st?.busy ? <><Loader inline /> Syncing…</> : 'Sync now'}</button>
                      <label style={{ ...small, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input type="checkbox" checked={link.auto} onChange={e => sync.setAuto(link.id, e.target.checked)} /> Sync automatically
                      </label>
                      <button style={{ ...button, marginLeft: 'auto' }} title="Stop syncing with this place (nothing is deleted)" onClick={() => void sync.removeLink(link.id)}><Trash2 size={13} /></button>
                    </div>
                  </div>
                );
              })}
            </Section>
          )}

          <Section icon={<Cloud size={18} />} title="Google Drive">
            <p style={small}>Keeps your whole library in a folder called Asterism in your Google Drive, so every document, branching story and card deck follows you between devices and you can see (and back up) the files yourself. Asterism can only open the files it made; it never reads the rest of your Drive. Each document you write also gets a copy as a Google Doc in a folder called Asterism documents, to read and share (changes made in Google Docs do not come back). Nothing is sent until you turn it on, and themes and sounds stay on each device.</p>
            {sync.google.ok ? (
              <>
                {sync.drive.on && (sync.drive.message || sync.drive.error) && (
                  <div style={{ ...small, marginTop: 8, color: sync.drive.error ? '#c0392b' : 'var(--text-secondary)' }}>{sync.drive.error ?? sync.drive.message}</div>
                )}
                <div style={{ display: 'flex', gap: '8px', marginTop: 8, flexWrap: 'wrap' }}>
                  {!sync.drive.on ? (
                    <button style={button} onClick={() => void attempt(sync.turnOnDrive)}>Turn on Google Drive sync</button>
                  ) : (
                    <>
                      <button style={button} disabled={sync.drive.busy} onClick={() => void attempt(sync.syncDriveNow)}>{sync.drive.busy ? <><Loader inline /> Syncing…</> : 'Sync everything now'}</button>
                      <button style={button} title="Stops syncing. What is already on Google Drive stays there, and nothing on this device is changed." onClick={sync.turnOffDrive}>Turn off</button>
                    </>
                  )}
                  <button style={button} disabled={driveBusy} onClick={() => void attempt(async () => {
                    setDriveBusy(true);
                    try { setDrive(await sync.listDrive()); } finally { setDriveBusy(false); }
                  })}>{driveBusy ? <><Loader inline /> Looking…</> : 'Documents on Google Drive'}</button>
                </div>
              </>
            ) : <p style={{ ...small, marginTop: 6 }}>{sync.google.why}</p>}
            {drive && (
              <div style={{ display: 'grid', gap: '6px', marginTop: 10 }}>
                {drive.length === 0 && <div style={small}>Nothing on Google Drive yet.</div>}
                {drive.map(d => {
                  const here = allProjects.some(p => p.id === d.projectId);
                  return (
                    <div key={d.projectId} style={{ display: 'flex', alignItems: 'center', gap: 8, ...small }}>
                      <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{d.title}</span>
                      <span>saved by {d.device}, {ago(d.savedAt)}</span>
                      {here
                        ? <span style={{ marginLeft: 'auto' }}>already here</span>
                        : <button style={{ ...button, marginLeft: 'auto' }} onClick={() => void attempt(() => sync.bringIn(d))}>Bring in</button>}
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {!fromHome && (
          <Section icon={<FolderSync size={18} />} title="A folder">
            <p style={small}>Pick a folder that Dropbox, OneDrive, Google Drive, iCloud Drive or Syncthing already syncs. Asterism keeps one file in it. No account, no server.</p>
            {sync.folderSupported
              ? <button style={{ ...button, marginTop: 8 }} onClick={() => void attempt(sync.addFolder)}>Choose a folder…</button>
              : <p style={{ ...small, marginTop: 6 }}>This browser can’t open folders (Chrome, Edge and Opera can). Use a server, another device or a sync file.</p>}
          </Section>
          )}

          {!fromHome && (
          <Section icon={<Server size={18} />} title="A server">
            <p style={small}>Your own server or, one day, a hosted one. It only needs the small API in <code>server/sync-server.mjs</code>. Use https for anything beyond your own network.</p>
            <div style={{ display: 'grid', gap: '6px', marginTop: 8 }}>
              <input style={field} placeholder="https://sync.example.com" value={url} onChange={e => setUrl(e.target.value)} />
              <input style={field} placeholder="Access token (if the server needs one)" type="password" value={token} onChange={e => setToken(e.target.value)} />
              <div><button style={button} disabled={!url.trim()} onClick={() => void attempt(async () => { await sync.addServer(url, token); setUrl(''); setToken(''); })}>Connect</button></div>
              <p style={small}>The token is kept on this device only.</p>
            </div>
          </Section>
          )}

          {!fromHome && (
          <Section icon={<Smartphone size={18} />} title="Another device, directly">
            <p style={small}>No server. One device makes a code, the other answers it. Works best on the same Wi-Fi; keep both open until done.</p>
            {mode === 'none' && sync.peer.stage === 'idle' && (
              <div style={{ display: 'flex', gap: '8px', marginTop: 8 }}>
                <button style={button} onClick={() => { setMode('host'); void sync.hostPairing(); }}>Make a code</button>
                <button style={button} onClick={() => setMode('join')}>I have a code</button>
              </div>
            )}
            {mode === 'host' && (
              <div style={{ display: 'grid', gap: '6px', marginTop: 8 }}>
                {sync.peer.stage === 'code' && (
                  <>
                    <div style={small}>1. Copy this code to the other device.</div>
                    <textarea readOnly style={{ ...field, height: 70, fontFamily: 'monospace' }} value={sync.peer.code} onFocus={e => e.currentTarget.select()} />
                    <div><button style={button} onClick={() => void navigator.clipboard?.writeText((sync.peer as { code: string }).code)}><Copy size={12} /> Copy</button></div>
                    <div style={small}>2. Paste the answer it gives you.</div>
                    <textarea style={{ ...field, height: 70, fontFamily: 'monospace' }} value={answer} onChange={e => setAnswer(e.target.value)} />
                    <div><button style={button} disabled={!answer.trim()} onClick={() => void sync.acceptAnswer(answer)}>Connect</button></div>
                  </>
                )}
              </div>
            )}
            {mode === 'join' && (
              <div style={{ display: 'grid', gap: '6px', marginTop: 8 }}>
                {sync.peer.stage !== 'answer' && sync.peer.stage !== 'busy' && (
                  <>
                    <div style={small}>Paste the code from the other device.</div>
                    <textarea style={{ ...field, height: 70, fontFamily: 'monospace' }} value={code} onChange={e => setCode(e.target.value)} />
                    <div><button style={button} disabled={!code.trim()} onClick={() => void sync.joinPairing(code)}>Continue</button></div>
                  </>
                )}
                {sync.peer.stage === 'answer' && (
                  <>
                    <div style={small}>Copy this answer back to the first device and press Connect there.</div>
                    <textarea readOnly style={{ ...field, height: 70, fontFamily: 'monospace' }} value={sync.peer.answer} onFocus={e => e.currentTarget.select()} />
                    <div><button style={button} onClick={() => void navigator.clipboard?.writeText((sync.peer as { answer: string }).answer)}><Copy size={12} /> Copy</button></div>
                  </>
                )}
              </div>
            )}
            {sync.peer.stage === 'busy' && <div style={{ ...small, marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}><Loader inline />{sync.peer.message}</div>}
            {sync.peer.stage === 'error' && <div style={{ ...small, marginTop: 8, color: '#c0392b' }}>{sync.peer.message}</div>}
            {(mode !== 'none' || sync.peer.stage !== 'idle') && (
              <div style={{ marginTop: 8 }}><button style={button} onClick={() => { sync.resetPeer(); setMode('none'); setAnswer(''); setCode(''); }}>Start over</button></div>
            )}
          </Section>
          )}

          {!fromHome && (
          <Section icon={<FileJson size={18} />} title="A sync file">
            <p style={small}>The most universal way: save a file, carry it over (USB, email, AirDrop), and merge it on the other device. Carry the merged file back.</p>
            <div style={{ display: 'flex', gap: '8px', marginTop: 8 }}>
              <button style={button} onClick={sync.exportSyncFile}>Save a sync file</button>
              <button style={button} onClick={() => fileRef.current?.click()}>Merge a sync file…</button>
              <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={e => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void attempt(() => sync.mergeSyncFile(f));
              }} />
            </div>
          </Section>
          )}
        </div>

        {!fromHome && <p style={{ ...small, marginTop: 14 }}>
          A folder, server or direct sync carries your manuscript, Story Bible, plot threads, timeline, fonts, themes and sounds. Google Drive carries the writing only. Soundscapes and cursors stay on this device.
        </p>}
      </div>
    </div>
  );
};
