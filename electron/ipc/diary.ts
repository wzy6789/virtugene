import { BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'fs';
import { diaryAssist } from '../services/diary-assistant';
import { buildDocx } from '../services/docx-export';

export function registerDiaryIPC() {
  ipcMain.handle('diary:assist', async (_event, params) => {
    try {
      return await diaryAssist(params);
    } catch (err: any) {
      const code = err?.message ?? 'server:error';
      return { error: code };
    }
  });

  ipcMain.handle('diary:exportTxt', async (_event, { entries }: { entries: { title: string; date: string; content: string }[] }) => {
    const text = entries
      .map((e) => `${e.title}\n${e.date}\n\n${e.content}`)
      .join('\n\n' + '─'.repeat(24) + '\n\n');
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '导出日记为 TXT',
      defaultPath: `VirtuGene-日记-${new Date().toISOString().slice(0, 10)}.txt`,
      filters: [{ name: '文本文件', extensions: ['txt'] }],
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    fs.writeFileSync(filePath, text, 'utf8');
    return { ok: true, filePath };
  });

  ipcMain.handle('diary:exportDocx', async (_event, { entries }: { entries: { title: string; date: string; content: string }[] }) => {
    const buf = buildDocx(entries);
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '导出日记为 Word',
      defaultPath: `VirtuGene-日记-${new Date().toISOString().slice(0, 10)}.docx`,
      filters: [{ name: 'Word 文档', extensions: ['docx'] }],
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    fs.writeFileSync(filePath, buf);
    return { ok: true, filePath };
  });

  ipcMain.handle('diary:exportPdf', async (_event, { html }: { html: string }) => {
    const win = new BrowserWindow({ show: false, width: 800, height: 1000, webPreferences: { sandbox: true } });
    try {
      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
      const pdf = await win.webContents.printToPDF({
        pageSize: 'A4',
        printBackground: true,
        margins: { top: 0.6, bottom: 0.6, left: 0.6, right: 0.6 },
      });
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: '导出日记为 PDF',
        defaultPath: `VirtuGene-日记-${new Date().toISOString().slice(0, 10)}.pdf`,
        filters: [{ name: 'PDF 文档', extensions: ['pdf'] }],
      });
      if (canceled || !filePath) return { ok: false, canceled: true };
      fs.writeFileSync(filePath, pdf);
      return { ok: true, filePath };
    } finally {
      win.destroy();
    }
  });

  // 完整备份：全部日记（含回收站）导出为 JSON，可再导入恢复
  ipcMain.handle('diary:exportJson', async (_event, { diaries }: { diaries: unknown[] }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '备份全部日记',
      defaultPath: `VirtuGene-日记备份-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON 备份', extensions: ['json'] }],
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    const payload = { app: 'VirtuGene', kind: 'diary-backup', exportedAt: new Date().toISOString(), diaries };
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
    return { ok: true, filePath };
  });

  // 导入恢复：选择 JSON 备份文件，读回 diary 列表（由渲染端按日期去重写入）
  ipcMain.handle('diary:importJson', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: '选择日记备份文件',
      filters: [{ name: 'JSON 备份', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (canceled || filePaths.length === 0) return { canceled: true };
    try {
      const raw = fs.readFileSync(filePaths[0], 'utf8');
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : (parsed?.diaries ?? []);
      return { ok: true, diaries: list };
    } catch {
      return { ok: false, error: '文件解析失败，请确认是 VirtuGene 的日记备份' };
    }
  });

  // 完整导出：全部日记为 Markdown（时间线式）
  ipcMain.handle('diary:exportMarkdown', async (_event, { diaries }: { diaries: { date: string; title: string; content: string; mood?: number; tags?: string[] }[] }) => {
    const lines: string[] = ['# VirtuGene 我的手账', '', `> 导出时间：${new Date().toLocaleString('zh-CN')}`, ''];
    for (const d of [...diaries].sort((a, b) => a.date.localeCompare(b.date))) {
      lines.push(`## ${d.date}${d.title ? ' · ' + d.title : ''}`, '');
      if (d.tags && d.tags.length > 0) lines.push(`> 标签：${d.tags.map((t) => '#' + t).join(' ')}`, '');
      lines.push(d.content, '', '---', '');
    }
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '导出全部日记为 Markdown',
      defaultPath: `VirtuGene-日记全量-${new Date().toISOString().slice(0, 10)}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    return { ok: true, filePath };
  });
}
