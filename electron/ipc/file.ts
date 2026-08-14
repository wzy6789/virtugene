import { ipcMain, net } from 'electron';
import fs from 'fs';
import path from 'path';
import { parseFile, parserPath, isParserReady } from '../services/file-parser';

const PARSER_DOWNLOAD_URL =
  'https://github.com/wzy6789/virtugene/releases/latest/download/parser.cjs';

function downloadParser(targetPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = net.request({ url: PARSER_DOWNLOAD_URL, redirect: 'follow' });
    const chunks: Buffer[] = [];

    request.on('response', (response) => {
      if (response.statusCode >= 400) {
        reject(new Error(`下载失败: HTTP ${response.statusCode}`));
        return;
      }
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      response.on('end', () => {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, Buffer.concat(chunks));
        resolve();
      });
      response.on('error', reject);
    });

    request.on('error', reject);
    request.end();
  });
}

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

  ipcMain.handle('file:parserReady', async () => {
    return { ready: isParserReady() };
  });

  ipcMain.handle('file:downloadParser', async () => {
    if (isParserReady()) {
      return { ok: true };
    }
    try {
      await downloadParser(parserPath());
      return { ok: true };
    } catch (err: any) {
      console.error('[file:downloadParser]', err);
      return { error: err?.message ?? 'server:error' };
    }
  });
}
