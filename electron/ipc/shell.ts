import { ipcMain, shell } from 'electron';

export function registerShellIPC() {
  ipcMain.handle('shell:open', async (_event, { url }: { url: string }) => {
    await shell.openExternal(url);
    return true;
  });
}
