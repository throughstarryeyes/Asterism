import { inDesktopApp } from './saveFile';

const onAndroid = () => /android/i.test(navigator.userAgent);

/** Returns the new version string if an update is available, otherwise null. Desktop app only. */
export async function checkForUpdate() {
  if (!inDesktopApp() || onAndroid()) return null;
  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    return await check();
  } catch (err) {
    console.warn('update check failed', err);
    return null;
  }
}

/** Downloads, installs, and restarts into the new version. */
export async function installUpdate(update: NonNullable<Awaited<ReturnType<typeof checkForUpdate>>>) {
  await update.downloadAndInstall();
  const { relaunch } = await import('@tauri-apps/plugin-process');
  await relaunch();
}
