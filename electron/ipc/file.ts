import { ipcMain } from 'electron';
import { parseFile } from '../services/file-parser';

export function registerFileIPC() {
  ipcMain.handle('file:parse', async (_event, { filePath }: { filePath: string }) => {
    try {
      const text = await parseFile(filePath);
      return { text };
    } catch (err: any) {
      console.error('[file:parse]', err);
      return { error: err?.message ?? 'server:error' };
    }
  });
}
