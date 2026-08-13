import { ipcMain } from 'electron';
import { generateProactiveMessage } from '../services/proactive-chat';

export function registerProactiveIPC() {
  ipcMain.handle('proactive:generate', async (_event, params: {
    apiKey: string;
    systemPrompt: string;
    characterName: string;
    lastMessages: { role: string; content: string }[];
    affinity?: number;
    mood?: number;
  }) => {
    try {
      const content = await generateProactiveMessage(params);
      return { content };
    } catch (err: any) {
      console.error('[proactive:generate]', err);
      return { error: err?.message ?? 'server:error' };
    }
  });
}
