import React, { useEffect, useState } from 'react';
import { checkForUpdate, installUpdate } from '../../services/updater';

type Update = NonNullable<Awaited<ReturnType<typeof checkForUpdate>>>;

// a quiet note when a newer version is out. nothing is installed until the writer says so.
export const UpdateBanner: React.FC = () => {
  const [update, setUpdate] = useState<Update | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void checkForUpdate().then(u => { if (!cancelled && u) setUpdate(u); });
    return () => { cancelled = true; };
  }, []);

  if (!update || dismissed) return null;

  const install = async () => {
    setBusy(true); setFailed(false);
    try { await installUpdate(update); } catch { setFailed(true); setBusy(false); }
  };

  return (
    <div role="status" style={{ position: 'fixed', bottom: 12, right: 12, zIndex: 4000, maxWidth: 'min(92vw, 340px)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.84rem', backgroundColor: 'var(--bg-paper)', color: 'var(--text-main)', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-lg)' }}>
      <div style={{ marginBottom: 8 }}>
        {failed ? 'The update did not install. Your writing is safe. Try again in a bit.' : `Asterism ${update.version} is ready to install.`}
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={() => setDismissed(true)} disabled={busy}>Later</button>
        <button onClick={install} disabled={busy}>{busy ? 'Installing…' : failed ? 'Retry' : 'Update and restart'}</button>
      </div>
    </div>
  );
};
