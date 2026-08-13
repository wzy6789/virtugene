import { ipcMain } from 'electron';
import { sendMessage } from '../services/deepseek';

export function registerChatIPC() {
  ipcMain.handle('chat:send', async (_event, params) => {
    try {
      return await sendMessage(params);
    } catch (err: any) {
      const code = err?.message ?? 'server:error';
      return { error: code };
    }
  });
}
