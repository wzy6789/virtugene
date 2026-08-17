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
    lastMessageAt?: number;
  }) => {
    try {
      // 消息提醒在渲染层以「应用内流体云」呈现，不做桌面系统通知
      const content = await generateProactiveMessage(params);
      return { content };
    } catch (err: any) {
      console.error('[proactive:generate]', err);
      return { error: err?.message ?? 'server:error' };
    }
  });
}
