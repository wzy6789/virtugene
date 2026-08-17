import { ipcMain } from 'electron';
import { consolidateContext } from '../services/context-consolidator';
import { summarizeContext } from '../services/context-summarizer';

export function registerContextIPC() {
  ipcMain.handle('context:settle', async (_event, params) => {
    try {
      return await consolidateContext(params);
    } catch (err: any) {
      const code = err?.message ?? 'server:error';
      return { error: code };
    }
  });

  ipcMain.handle('context:summarize', async (_event, params) => {
    try {
      return await summarizeContext(params);
    } catch (err: any) {
      const code = err?.message ?? 'server:error';
      return { error: code };
    }
  });
}
