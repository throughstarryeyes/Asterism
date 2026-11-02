import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Project } from '../types';
import {
  isSyncDoc, makeDoc, mergeWithRemote, resolveConflicts, StaleError, syncProject,
  type Device, type PendingConflicts, type SyncOutcome, type SyncProvider, type SyncRequest,
} from '../services/sync/engine';
import type { Choice, Conflict } from '../services/sync/merge';
import { fileProvider, folderProvider, httpProvider, type FolderLike } from '../services/sync/providers';
import { answerPairing, openPairing, peerProvider, servePeer, type Channel, type PairingHost } from '../services/sync/peer';
import {
  deleteBase, deleteHandle, deleteLink, driveAllOn, getBase, getDevice, getHandle, loadAllLinks, loadLinks, newLinkId, saveLink, setBase, setDriveAll, setHandle,
  type SyncLink,
} from '../services/sync/syncStore';
import { driveProvider, listDriveProjects, SignInError, type DriveProject } from '../services/sync/googleDrive';
import { forgetGoogleToken, googleSupport, googleToken, type GoogleSupport } from '../services/sync/googleAuth';
import { storageService } from '../services/storage';
import { channelFor, describeAssets, syncAssets, type LocalAssets } from '../services/sync/assets';
import { bytesToBase64 } from '../services/exportFonts';

interface DirHandle extends FolderLike {
  name: string;
  queryPermission?: (d: { mode: 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (d: { mode: 'readwrite' }) => Promise<PermissionState>;
}

export interface LinkStatus {
  busy: boolean;
  // what happened last, in words.
  message?: string;
  error?: string;
  // the folder needs the writer to allow access again (browsers ask once per visit).
  needsPermission?: boolean;
}

export interface PendingResolution {
  linkId: string;
  label: string;
  conflicts: Conflict[];
}

// the whole library on google drive: one switch, every document (including branching stories and card decks) kept in step
export interface DriveStatus {
  on: boolean;
  busy: boolean;
  message?: string;
  error?: string;
  // documents that changed on both sides and are waiting for the writer to open them and choose
  waiting: number;
}

export type PeerState =
  | { stage: 'idle' }
  | { stage: 'code'; code: string }
  | { stage: 'answer'; answer: string }
  | { stage: 'busy'; message: string }
  | { stage: 'error'; message: string };

export interface SyncApi {
  links: SyncLink[];
  status: Record<string, LinkStatus>;
  pending: PendingResolution | null;
  folderSupported: boolean;
  peer: PeerState;
  // google drive: off until the writer adds it, and only on builds that are set up for it
  google: GoogleSupport;
  drive: DriveStatus;
  turnOnDrive(): Promise<void>;
  turnOffDrive(): void;
  syncDriveNow(): Promise<void>;
  listDrive(): Promise<DriveProject[]>;
  bringIn(found: DriveProject): Promise<void>;
  addFolder(): Promise<void>;
  addServer(url: string, token: string): Promise<void>;
  removeLink(id: string): Promise<void>;
  setAuto(id: string, auto: boolean): void;
  syncNow(id: string): Promise<void>;
  resolve(choices: Record<string, Choice>): Promise<void>;
  cancelResolve(): void;
  exportSyncFile(): Promise<void>;
  mergeSyncFile(file: File): Promise<void>;
  hostPairing(): Promise<void>;
  acceptAnswer(answer: string): Promise<void>;
  joinPairing(code: string): Promise<void>;
  resetPeer(): void;
}

const describeOutcome = (o: SyncOutcome): string => {
  switch (o.status) {
    case 'up-to-date': return 'Already up to date';
    case 'pushed': return 'Sent your changes';
    case 'pulled': return 'Brought in changes from the other side';
    case 'merged': return 'Combined changes from both sides';
    default: return 'Needs your decision';
  }
};

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

const hash = (text: string) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

export function useSync(
  project: Project,
  setProject: (fn: (p: Project) => Project) => void,
  showToast: (m: string, t?: 'info' | 'success' | 'reward') => void,
  files?: LocalAssets,
  addProject?: (p: Project) => void,
  getLibrary?: () => Project[],
): SyncApi {
  const [links, setLinks] = useState<SyncLink[]>(() => loadLinks(project.id));
  const [status, setStatus] = useState<Record<string, LinkStatus>>({});
  const [pending, setPending] = useState<PendingResolution | null>(null);
  const [peer, setPeer] = useState<PeerState>({ stage: 'idle' });
  const [drive, setDrive] = useState<DriveStatus>(() => ({ on: driveAllOn(), busy: false, waiting: 0 }));
  const libraryRef = useRef(getLibrary);
  useEffect(() => { libraryRef.current = getLibrary; }, [getLibrary]);
  const libBusy = useRef(false);

  const filesRef = useRef(files);
  useEffect(() => { filesRef.current = files; }, [files]);
  const projectRef = useRef(project);
  useEffect(() => { projectRef.current = project; }, [project]);
  const pendingRef = useRef<{ req: SyncRequest; data: PendingConflicts; link: SyncLink | null } | null>(null);
  const busyRef = useRef(new Set<string>());
  const hostRef = useRef<PairingHost | null>(null);
  const guestRef = useRef<{ close(): void } | null>(null);
  const device = useMemo<Device>(() => getDevice(), []);

  useEffect(() => { setLinks(loadLinks(project.id)); setPending(null); pendingRef.current = null; }, [project.id]);

  const patchStatus = useCallback((id: string, patch: Partial<LinkStatus>) => setStatus(s => ({ ...s, [id]: { ...s[id], ...patch, busy: patch.busy ?? s[id]?.busy ?? false } })), []);

  // put the outcome into the app, keeping anything typed while the sync was running.
  const apply = useCallback((snapshot: Project, out: SyncOutcome) => {
    if (out.status === 'pulled' || out.status === 'merged') {
      storageService.createVersionSnapshot(snapshot, 'Before sync', 'safety_net', 'Saved automatically before changes from another device were brought in.');
      setProject(current => (current === snapshot ? out.project : mergeWithRemote(snapshot, current, out.project, { keepBoth: true }).merged));
    }
  }, [setProject]);

  const providerFor = useCallback(async (link: SyncLink, interactive: boolean): Promise<SyncProvider> => {
    if (link.kind === 'http' && link.http) return httpProvider(link.http, link.projectId);
    if (link.kind === 'google') return driveProvider(() => googleToken(interactive), link.projectId);
    const handle = (await getHandle(link.id)) as DirHandle | undefined;
    if (!handle) throw new Error('The folder is no longer remembered. Remove this link and add the folder again.');
    let granted = (await handle.queryPermission?.({ mode: 'readwrite' })) === 'granted';
    if (!granted && interactive) granted = (await handle.requestPermission?.({ mode: 'readwrite' })) === 'granted';
    if (!granted) {
      patchStatus(link.id, { needsPermission: true });
      throw new Error('Allow access to the folder to sync.');
    }
    patchStatus(link.id, { needsPermission: false });
    return folderProvider(handle, link.projectId, link.label);
  }, [patchStatus]);

  // fonts and pictures the project uses go to the other side, and the ones it needs come here. a file
  // that cannot move is reported but never undoes the text sync.
  const moveFiles = useCallback(async (synced: Project, provider: SyncProvider): Promise<string> => {
    const local = filesRef.current;
    if (!local || !provider.assets) return '';
    try {
      return describeAssets(await syncAssets(synced, provider.assets, local));
    } catch (e) {
      return `could not move fonts and pictures (${errorText(e)})`;
    }
  }, []);

  const runSync = useCallback(async (link: SyncLink | null, key: string, provider: SyncProvider): Promise<SyncOutcome & { files?: string }> => {
    const snapshot = projectRef.current;
    const base = await getBase(snapshot.id, key);
    const req: SyncRequest = { local: snapshot, provider, base, device };
    const out = await syncProject(req);
    if (out.status === 'conflicts' && out.pending) {
      pendingRef.current = { req, data: out.pending, link };
      setPending({ linkId: key, label: provider.label, conflicts: out.conflicts });
      return out;
    }
    apply(snapshot, out);
    await setBase(snapshot.id, key, out.base);
    return Object.assign(out, { files: await moveFiles(out.project, provider) });
  }, [apply, device, moveFiles]);

  const syncNow = useCallback(async (id: string, interactive = true) => {
    const link = loadLinks(projectRef.current.id).find(l => l.id === id);
    if (!link || busyRef.current.has(id)) return;
    busyRef.current.add(id);
    patchStatus(id, { busy: true, error: undefined, message: 'Syncing…' });
    try {
      const out = await runSync(link, link.id, await providerFor(link, interactive));
      if (out.status !== 'conflicts') {
        const updated = { ...link, lastSyncedAt: new Date().toISOString() };
        saveLink(updated);
        setLinks(loadLinks(updated.projectId));
      }
      patchStatus(id, { busy: false, message: [describeOutcome(out), out.files].filter(Boolean).join('; ') });
    } catch (e) {
      patchStatus(id, { busy: false, error: errorText(e), message: undefined });
    } finally {
      busyRef.current.delete(id);
    }
  }, [patchStatus, providerFor, runSync]);

  const addLink = useCallback(async (link: SyncLink) => {
    saveLink(link);
    setLinks(loadLinks(link.projectId));
    await syncNow(link.id);
  }, [syncNow]);

  const addFolder = useCallback(async () => {
    const pick = (window as unknown as { showDirectoryPicker?: (o: { mode: 'readwrite' }) => Promise<DirHandle> }).showDirectoryPicker;
    if (!pick) throw new Error('This browser cannot open folders. Use a server, another device, or a sync file instead.');
    let handle: DirHandle;
    try { handle = await pick.call(window, { mode: 'readwrite' }); }
    catch (e) { if ((e as { name?: string }).name === 'AbortError') return; throw e; }
    const link: SyncLink = { id: newLinkId(), projectId: projectRef.current.id, kind: 'folder', label: handle.name, auto: true };
    await setHandle(link.id, handle);
    await addLink(link);
  }, [addLink]);

  const addServer = useCallback(async (url: string, token: string) => {
    const clean = url.trim();
    if (!/^https?:\/\//i.test(clean)) throw new Error('The address should start with http:// or https://');
    const link: SyncLink = { id: newLinkId(), projectId: projectRef.current.id, kind: 'http', label: clean.replace(/^https?:\/\//, '').replace(/\/+$/, ''), http: { url: clean, token: token.trim() || undefined }, auto: true };
    await addLink(link);
  }, [addLink]);

  // every document gets a drive link of its own, made the first time it is seen
  const driveLinkFor = (projectId: string): SyncLink => {
    const found = loadLinks(projectId).find(l => l.kind === 'google');
    if (found) return found;
    const link: SyncLink = { id: newLinkId(), projectId, kind: 'google', label: 'Google Drive', auto: false };
    saveLink(link);
    return link;
  };

  // a document that is not open: synced from what is stored, and written back only when the other side had changes.
  // a clash is left for the writer, who decides when they open that document.
  const syncOther = useCallback(async (p: Project, link: SyncLink, interactive: boolean): Promise<'ok' | 'waiting'> => {
    const provider = driveProvider(() => googleToken(interactive), p.id);
    const out = await syncProject({ local: p, provider, base: await getBase(p.id, link.id), device });
    if (out.status === 'conflicts') return 'waiting';
    if (out.status === 'pulled' || out.status === 'merged') {
      storageService.createVersionSnapshot(p, 'Before sync', 'safety_net', 'Saved automatically before changes from another device were brought in.');
      addProject?.(out.project);
    }
    await setBase(p.id, link.id, out.base);
    saveLink({ ...link, lastSyncedAt: new Date().toISOString() });
    return 'ok';
  }, [addProject, device]);

  const syncLibrary = useCallback(async (interactive: boolean) => {
    if (libBusy.current) return;
    libBusy.current = true;
    setDrive(d => ({ ...d, busy: true, error: undefined, message: 'Syncing…' }));
    let waiting = 0;
    let stopped: string | undefined;
    try {
      await googleToken(interactive);
      const open = projectRef.current;
      const list = libraryRef.current?.() ?? [open];
      for (const p of list) {
        const link = driveLinkFor(p.id);
        try {
          if (p.id === open.id) await syncNow(link.id, interactive);
          else if ((await syncOther(p, link, interactive)) === 'waiting') waiting++;
        } catch (e) {
          // one document that fails (say, a clash on a flaky connection) must not stop the rest
          if (e instanceof SignInError) throw e;
          stopped = `“${p.title}”: ${errorText(e)}`;
        }
      }
      setDrive(d => ({ ...d, busy: false, waiting, error: stopped, message: waiting ? `${waiting} document${waiting === 1 ? '' : 's'} changed on both sides. Open ${waiting === 1 ? 'it' : 'each'} and press Sync now to choose.` : stopped ? undefined : 'Everything is up to date' }));
    } catch (e) {
      setDrive(d => ({ ...d, busy: false, error: errorText(e), message: undefined }));
    } finally {
      libBusy.current = false;
    }
  }, [device, syncNow, syncOther]); // eslint-disable-line react-hooks/exhaustive-deps

  const turnOnDrive = useCallback(async () => {
    const support = googleSupport();
    if (!support.ok) throw new Error(support.why);
    await googleToken(true);
    setDriveAll(true);
    setDrive(d => ({ ...d, on: true }));
    await syncLibrary(true);
  }, [syncLibrary]);

  // stops syncing; what is already on drive stays there, and nothing on this device is touched
  const turnOffDrive = useCallback(() => {
    setDriveAll(false);
    forgetGoogleToken();
    for (const l of loadAllLinks().filter(x => x.kind === 'google')) { deleteLink(l.id); void deleteBase(l.projectId, l.id).catch(() => undefined); }
    setLinks(loadLinks(projectRef.current.id));
    setDrive({ on: false, busy: false, waiting: 0 });
  }, []);

  const syncDriveNow = useCallback(() => syncLibrary(true), [syncLibrary]);

  const listDrive = useCallback(() => listDriveProjects(() => googleToken(true)), []);

  // a project from drive that this device does not have yet. it is kept in step from here on.
  const bringIn = useCallback(async (found: DriveProject) => {
    if (!addProject) throw new Error('Could not add the project to this device.');
    const link: SyncLink = { id: newLinkId(), projectId: found.projectId, kind: 'google', label: 'Google Drive', auto: false, lastSyncedAt: new Date().toISOString() };
    saveLink(link);
    await setBase(found.projectId, link.id, { revision: found.doc.revision, project: found.doc.project });
    addProject(found.doc.project);
    showToast(`Brought in “${found.title}” from Google Drive`, 'success');
  }, [addProject, showToast]);

  const removeLink = useCallback(async (id: string) => {
    const link = links.find(l => l.id === id);
    deleteLink(id);
    if (link) await deleteBase(link.projectId, id).catch(() => undefined);
    await deleteHandle(id).catch(() => undefined);
    setLinks(loadLinks(projectRef.current.id));
  }, [links]);

  const setAuto = useCallback((id: string, auto: boolean) => {
    const link = loadLinks(projectRef.current.id).find(l => l.id === id);
    if (!link) return;
    saveLink({ ...link, auto });
    setLinks(loadLinks(link.projectId));
  }, []);

  const resolve = useCallback(async (choices: Record<string, Choice>) => {
    const held = pendingRef.current;
    if (!held) return;
    const key = held.link?.id ?? pending?.linkId ?? 'file';
    try {
      const out = await resolveConflicts(held.req, held.data, choices);
      apply(held.req.local, out);
      await setBase(held.req.local.id, key, out.base);
      const files = await moveFiles(out.project, held.req.provider);
      if (held.link) {
        saveLink({ ...held.link, lastSyncedAt: new Date().toISOString() });
        setLinks(loadLinks(held.link.projectId));
        patchStatus(held.link.id, { message: ['Resolved and synced', files].filter(Boolean).join('; '), error: undefined });
      }
      if (held.req.provider.kind === 'file') downloadWritten(held.req.provider);
      showToast('Sync finished', 'success');
    } catch (e) {
      showToast(errorText(e), 'info');
    } finally {
      pendingRef.current = null;
      setPending(null);
      guestRef.current?.close(); guestRef.current = null;
    }
  }, [apply, moveFiles, patchStatus, pending, showToast]);

  const cancelResolve = useCallback(() => { pendingRef.current = null; setPending(null); guestRef.current?.close(); guestRef.current = null; }, []);

  // ---- a file you carry yourself ----

  const exportSyncFile = useCallback(async () => {
    const doc = makeDoc(projectRef.current, Date.now(), device);
    const local = filesRef.current;
    if (local) {
      const assets: NonNullable<typeof doc.assets> = [];
      for (const meta of await local.wanted(projectRef.current)) {
        const bytes = await local.read(meta.id);
        if (bytes) assets.push({ ...meta, data: bytesToBase64(bytes) });
      }
      if (assets.length) doc.assets = assets;
    }
    storageService.downloadTextFile(`asterism-${projectRef.current.id}.sync.json`, JSON.stringify(doc), 'application/json');
    showToast('Sync file saved. Open it on the other device with "Merge a sync file".', 'success');
  }, [device, showToast]);

  const mergeSyncFile = useCallback(async (file: File) => {
    let parsed: unknown;
    try { parsed = JSON.parse(await file.text()); } catch { throw new Error('That file is not a sync file.'); }
    if (!isSyncDoc(parsed)) throw new Error('That file is not an Asterism sync file.');
    if (parsed.projectId !== projectRef.current.id) throw new Error(`That sync file is for a different project (“${parsed.project.title}”).`);
    const provider = fileProvider(parsed, file.name);
    const out = await runSync(null, 'file', provider);
    if (out.status === 'conflicts') return;
    downloadWritten(provider);
    showToast([describeOutcome(out), out.files].filter(Boolean).join('; '), 'success');
  }, [runSync, showToast]);

  // ---- another device ----

  const resetPeer = useCallback(() => {
    hostRef.current?.close(); hostRef.current = null;
    guestRef.current?.close(); guestRef.current = null;
    setPeer({ stage: 'idle' });
  }, []);

  const hostPairing = useCallback(async () => {
    resetPeer();
    try {
      setPeer({ stage: 'busy', message: 'Making a pairing code…' });
      const host = await openPairing();
      hostRef.current = host;
      setPeer({ stage: 'code', code: host.code });
    } catch (e) { setPeer({ stage: 'error', message: errorText(e) }); }
  }, [resetPeer]);

  // this device answers the other one's requests from whatever the project is right now.
  const serveHost = (channel: Channel) => {
    let served: Project = projectRef.current;
    const source: SyncProvider = {
      kind: 'peer', label: 'this device',
      assets: filesRef.current ? channelFor(filesRef.current, () => projectRef.current) : undefined,
      async read() {
        served = projectRef.current;
        const h = hash(JSON.stringify(served));
        return { doc: makeDoc(served, h, device), etag: String(h) };
      },
      async write(doc, etag) {
        const current = projectRef.current;
        // something was typed here since the other device looked: let it look again.
        if (etag !== String(hash(JSON.stringify(current)))) throw new StaleError();
        const snapshot = current;
        storageService.createVersionSnapshot(snapshot, 'Before sync', 'safety_net', 'Saved automatically before changes from another device were brought in.');
        const merged = mergeWithRemote(served, current, doc.project, { keepBoth: true });
        setProject(cur => (cur === snapshot ? merged.merged : mergeWithRemote(served, cur, merged.merged, { keepBoth: true }).merged));
        const kept = merged.conflicts.filter(c => c.kept).length;
        const open = merged.conflicts.length - kept;
        showToast(merged.conflicts.length ? `Brought in changes from ${doc.device.name}.${kept ? ` ${kept} paragraph${kept === 1 ? ' was' : 's were'} changed on both devices, so both versions were kept. Look for the near-duplicate.` : ''}${open ? ` ${open} other clash${open === 1 ? '' : 'es'} kept your version.` : ''}` : `Brought in changes from ${doc.device.name}`, 'success');
        setPeer({ stage: 'busy', message: 'Done. You can close this.' });
        return String(hash(JSON.stringify(merged.merged)));
      },
    };
    servePeer(channel, source);
  };

  const acceptAnswer = useCallback(async (answer: string) => {
    const host = hostRef.current;
    if (!host) return;
    try {
      setPeer({ stage: 'busy', message: 'Connecting…' });
      const channel = await host.accept(answer);
      serveHost(channel);
      setPeer({ stage: 'busy', message: 'Connected. The other device is syncing with this one. Keep this open until it finishes.' });
    } catch (e) { setPeer({ stage: 'error', message: errorText(e) }); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const joinPairing = useCallback(async (code: string) => {
    resetPeer();
    try {
      setPeer({ stage: 'busy', message: 'Reading the code…' });
      const guest = await answerPairing(code.trim());
      guestRef.current = guest;
      setPeer({ stage: 'answer', answer: guest.answer });
      const channel = await guest.connected;
      setPeer({ stage: 'busy', message: 'Connected. Syncing…' });
      const provider = peerProvider(channel, 'the other device');
      const out = await runSync(null, 'peer', provider);
      setPeer({ stage: 'busy', message: out.status === 'conflicts' ? 'Needs your decision below.' : `${describeOutcome(out)}. You can close this.` });
      // with a decision pending the connection stays open until it is made.
      if (out.status !== 'conflicts') { guest.close(); guestRef.current = null; }
    } catch (e) { setPeer({ stage: 'error', message: errorText(e) }); }
  }, [resetPeer, runSync]);

  // ---- automatic sync: after you stop typing, when you come back to the tab, and now and then ----

  const autoLinks = useMemo(() => links.filter(l => l.auto && l.kind !== 'google'), [links]);
  useEffect(() => {
    if (!autoLinks.length) return;
    const go = () => { for (const l of autoLinks) void syncNow(l.id, false); };
    const idle = setTimeout(go, 20_000);
    const onFocus = () => { if (document.visibilityState === 'visible') go(); };
    document.addEventListener('visibilitychange', onFocus);
    const every = setInterval(go, 120_000);
    return () => { clearTimeout(idle); clearInterval(every); document.removeEventListener('visibilitychange', onFocus); };
  }, [autoLinks, project, syncNow]);

  // the library, when it is on drive: after you stop typing, when you come back, and now and then
  useEffect(() => {
    if (!drive.on) return;
    const go = () => { void syncLibrary(false); };
    const idle = setTimeout(go, 20_000);
    const onFocus = () => { if (document.visibilityState === 'visible') go(); };
    document.addEventListener('visibilitychange', onFocus);
    const every = setInterval(go, 120_000);
    return () => { clearTimeout(idle); clearInterval(every); document.removeEventListener('visibilitychange', onFocus); };
  }, [drive.on, project, syncLibrary]);

  return {
    links, status, pending, peer,
    // Android's web view lists the folder picker, but choosing a folder there crashed the app, so it is left out
    folderSupported: typeof window !== 'undefined' && 'showDirectoryPicker' in window && !/Android/i.test(navigator.userAgent),
    google: googleSupport(), drive, turnOnDrive, turnOffDrive, syncDriveNow, listDrive, bringIn,
    addFolder, addServer, removeLink, setAuto,
    syncNow: id => syncNow(id, true),
    resolve, cancelResolve, exportSyncFile, mergeSyncFile,
    hostPairing, acceptAnswer, joinPairing, resetPeer,
  };
}

function downloadWritten(provider: SyncProvider) {
  const file = provider as SyncProvider & { written?: unknown; carry?: () => unknown };
  const written = file.carry?.() ?? file.written;
  if (written) storageService.downloadTextFile('asterism-merged.sync.json', JSON.stringify(written), 'application/json');
}
