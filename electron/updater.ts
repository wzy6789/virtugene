import { BrowserWindow, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';

function broadcast(channel: string, payload: unknown) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload);
  }
}

export function registerUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () =>
    broadcast('update:status', { state: 'checking' }),
  );
  autoUpdater.on('update-available', (info) =>
    broadcast('update:status', { state: 'available', version: info.version }),
  );
  autoUpdater.on('update-not-available', (info) =>
    broadcast('update:status', { state: 'not-available', version: info.version }),
  );
  autoUpdater.on('download-progress', (p) =>
    broadcast('update:status', { state: 'downloading', percent: Math.round(p.percent) }),
  );
  autoUpdater.on('update-downloaded', (info) =>
    broadcast('update:status', { state: 'downloaded', version: info.version }),
  );
  autoUpdater.on('error', (err) =>
    broadcast('update:status', { state: 'error', message: String((err as Error)?.message ?? err) }),
  );

  ipcMain.handle('update:check', async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      return { version: result?.updateInfo.version ?? null };
    } catch (err) {
      return { error: String((err as Error)?.message ?? err) };
    }
  });

  ipcMain.handle('update:download', async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { ok: true };
    } catch (err) {
      return { error: String((err as Error)?.message ?? err) };
    }
  });

  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall();
    return { ok: true };
  });

  // Auto-check shortly after launch; errors (e.g. offline) are non-fatal.
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 3000);
}
