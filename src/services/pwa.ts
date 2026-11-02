// lets the app be installed and opened offline, and asks the browser not to clear its storage when space runs low.
// both are best effort: a browser that says no just leaves things as they were.

export function setUpInstall(): void {
  // the desktop app carries its own files, so it needs no offline copy
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || '__TAURI_INTERNALS__' in window) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(e => console.warn('Could not set up offline use', e));
  });
}

export function keepStorage(): void {
  try { void navigator.storage?.persist?.(); } catch { /* not offered here */ }
}
