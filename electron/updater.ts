import { BrowserWindow, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';

function broadcast(channel: string, payload: unknown) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload);
  }
}

/** 手动检查是否进行中（防止并发调用 checkForUpdates 抛错） */
let checking = false;
/** 自动检查的失败要静默（不弹"更新检查失败"横幅），由该标记抑制 error 事件 */
let autoSuppress = false;

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
  autoUpdater.on('error', (err) => {
    // 自动检查的失败静默处理；手动检查失败才弹横幅
    if (autoSuppress) {
      autoSuppress = false;
      return;
    }
    broadcast('update:status', { state: 'error', message: String((err as Error)?.message ?? err) });
  });

  ipcMain.handle('update:check', async () => {
    if (checking) return { checking: true };
    // 手动检查：清除自动检查的静默标记，保证手动失败的错误一定展示
    autoSuppress = false;
    checking = true;
    try {
      const result = await autoUpdater.checkForUpdates();
      return { version: result?.updateInfo.version ?? null };
    } catch (err) {
      const message = String((err as Error)?.message ?? err);
      // 网络/仓库不可达等 → 友好提示（error 事件已广播，这里兜底）
      if (!/Cannot find channel|No published versions|404/i.test(message)) {
        broadcast('update:status', { state: 'error', message: '网络连接异常，请检查网络后重试' });
      }
      return { error: message };
    } finally {
      checking = false;
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

  // 启动后自动检查；失败静默（网络波动不打扰用户），不弹横幅
  setTimeout(() => {
    autoSuppress = true;
    autoUpdater.checkForUpdates().catch(() => {});
    // 若错误事件未触发（仅 promise 拒绝），30s 后清除抑制标记，避免误吞手动检查的错误
    setTimeout(() => { autoSuppress = false; }, 30000);
  }, 3000);
}
