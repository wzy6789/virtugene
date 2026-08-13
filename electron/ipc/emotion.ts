import { ipcMain } from 'electron';
import { analyzeEmotion } from '../services/emotion-analyzer';

export function registerEmotionIPC() {
  ipcMain.handle('emotion:analyze', async (_event, params) => {
    try {
      return await analyzeEmotion(params);
    } catch (err: any) {
      const code = err?.message ?? 'server:error';
      return { error: code };
    }
  });
}
