// saving a file: a normal download in the browser, the system's Save dialog in the desktop app (which has no downloads folder to drop into)

export const inDesktopApp = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export async function saveBlob(fileName: string, blob: Blob): Promise<void> {
  if (inDesktopApp()) {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeFile } = await import('@tauri-apps/plugin-fs');
      const path = await save({ defaultPath: fileName });
      if (!path) return;
      await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
    } catch (e) {
      console.error('Could not save the file', e);
      window.alert(`Could not save ${fileName}. ${e instanceof Error ? e.message : ''}`.trim());
    }
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
