import { ipcMain } from 'electron';
import { extractMemories } from '../services/memory-consolidator';

export function registerMemoryIPC() {
  ipcMain.handle('memory:extract', async (_event, params) => {
    try {
      return await extractMemories(params);
    } catch (err: any) {
      const code = err?.message ?? 'server:error';
      return { error: code };
    }
  });
}
