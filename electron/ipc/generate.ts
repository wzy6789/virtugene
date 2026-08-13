import { ipcMain } from 'electron';
import { generateCharacterPrompt } from '../services/character-generator';
import { duckDuckGoSearch } from '../services/web-search';

export function registerGenerateIPC() {
  ipcMain.handle('character:generate', async (event, params: {
    apiKey: string;
    characterName: string;
    description: string;
    enableWebSearch: boolean;
    documentContext?: string;
  }) => {
    const send = (step: string, message: string) => {
      try { event.sender.send('character:generate:progress', { step, message }); } catch {}
    };

    try {
      let webContext: string | undefined;

      if (params.enableWebSearch) {
        send('search', '正在扫描基因库检索相关资料...');
        webContext = await duckDuckGoSearch(params.characterName);
      }

      send('generate', '正在合成数字灵魂序列...');
      const result = await generateCharacterPrompt({
        apiKey: params.apiKey,
        characterName: params.characterName,
        description: params.description,
        webContext,
        documentContext: params.documentContext,
      });

      return { content: result.content };
    } catch (err: any) {
      console.error('[character:generate]', err);
      const knownCodes = ['auth:invalid_key', 'billing:insufficient', 'rate:limited', 'server:error'];
      const code = knownCodes.includes(err?.message) ? err.message : 'server:error';
      return { error: code };
    }
  });
}
