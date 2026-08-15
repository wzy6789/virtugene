import { ipcMain } from 'electron';
import { generateCharacterPrompt, type CharacterFields, type GenerateCharacterResult } from '../services/character-generator';
import { duckDuckGoSearch } from '../services/web-search';

export function registerGenerateIPC() {
  ipcMain.handle('character:generate', async (event, params: {
    apiKey: string;
    characterName: string;
    fields: CharacterFields;
    enableWebSearch: boolean;
    documentContext?: string;
    count?: number;
  }): Promise<{ candidates?: GenerateCharacterResult[]; error?: string }> => {
    const send = (step: string, message: string, progress: number) => {
      try { event.sender.send('character:generate:progress', { step, message, progress }); } catch {}
    };

    const count = Math.max(1, Math.min(3, params.count ?? 1));

    try {
      let webContext: string | undefined;

      if (params.enableWebSearch) {
        send('search', '正在扫描基因库检索相关资料...', 0.08);
        webContext = await duckDuckGoSearch(params.characterName);
      }

      const base = params.enableWebSearch ? 0.16 : 0.05;

      if (count === 1) {
        send('generate', '正在合成数字灵魂序列...', base);
        const result = await generateCharacterPrompt({
          apiKey: params.apiKey,
          characterName: params.characterName,
          fields: params.fields,
          webContext,
          documentContext: params.documentContext,
        });
        send('generate', '基因序列合成完成', 1);
        return { candidates: [result] };
      }

      send('generate', `正在合成候选基因序列 (0/${count})...`, base);
      let done = 0;
      const candidates = await Promise.all(
        Array.from({ length: count }, async () => {
          const result = await generateCharacterPrompt({
            apiKey: params.apiKey,
            characterName: params.characterName,
            fields: params.fields,
            webContext,
            documentContext: params.documentContext,
          });
          done += 1;
          send('generate', `已合成候选基因序列 (${done}/${count})...`, base + (1 - base) * (done / count));
          return result;
        }),
      );

      return { candidates };
    } catch (err: any) {
      console.error('[character:generate]', err);
      const knownCodes = ['auth:invalid_key', 'billing:insufficient', 'rate:limited', 'server:error'];
      const code = knownCodes.includes(err?.message) ? err.message : 'server:error';
      return { error: code };
    }
  });
}
