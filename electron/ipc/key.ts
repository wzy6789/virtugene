import { ipcMain } from 'electron';
import { validateApiKey } from '../services/deepseek';

export function registerKeyIPC() {
  ipcMain.handle('key:validate', async (_event, { apiKey }: { apiKey: string }) => {
    try {
      const result = await validateApiKey(apiKey);
      return result;
    } catch (err) {
      return { valid: false, error: '基因链接中断，请重试' };
    }
  });
}
