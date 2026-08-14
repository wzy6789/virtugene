import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { app } from 'electron';

const PARSER_FILENAME = 'parser.cjs';

export function parserPath(): string {
  return path.join(app.getPath('userData'), 'parser', PARSER_FILENAME);
}

export function isParserReady(): boolean {
  return fs.existsSync(parserPath());
}

async function loadParser(): Promise<(filePath: string) => Promise<string>> {
  const mod: any = await import(pathToFileURL(parserPath()).href);
  const parse = mod.parseFile ?? mod.default?.parseFile;
  if (typeof parse !== 'function') {
    throw new Error('parser:invalid');
  }
  return parse as (filePath: string) => Promise<string>;
}

export async function parseFile(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case '.txt':
      return fs.readFileSync(filePath, 'utf-8').slice(0, 10000);
    case '.pdf':
    case '.docx': {
      if (!isParserReady()) {
        throw new Error('parser:missing');
      }
      const parse = await loadParser();
      return parse(filePath);
    }
    default:
      throw new Error(`不支持的文件格式: ${ext}`);
  }
}
