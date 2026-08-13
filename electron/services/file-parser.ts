import fs from 'fs';
import path from 'path';

export async function parseFile(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case '.txt':
      return parseTxt(filePath);
    case '.pdf':
      return parsePdf(filePath);
    case '.docx':
      return parseDocx(filePath);
    default:
      throw new Error(`不支持的文件格式: ${ext}`);
  }
}

async function parseTxt(filePath: string): Promise<string> {
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.slice(0, 10000);
}

async function parsePdf(filePath: string): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default;
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.text.slice(0, 10000);
}

async function parseDocx(filePath: string): Promise<string> {
  const mod = await import('mammoth');
  const mammoth = mod.default ?? mod;
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value.slice(0, 10000);
}
