import { ipcMain, BrowserWindow } from 'electron';
import http from 'http';
import os from 'os';

/**
 * 局域网同步服务端（桌面端）：
 * 手机端通过 HTTP 直连电脑，互传角色 / 会话 / 消息 / 记忆 / 日记。
 * - GET  /sync/export  → 返回当前设备全量业务数据快照
 * - POST /sync/import  → 接收手机推送的数据，转发渲染进程合并写入
 * 带 CORS 头，允许局域网内手机 WebView 访问。
 *
 * 数据格式见 src/lib/sync.ts（collectSyncData / importSyncData）。
 */

let server: http.Server | null = null;
let serverPort = 0;
/** 导出快照由渲染进程投喂（collectSyncData 结果），主进程不直接读 IndexedDB */
let exportDataProvider: (() => Promise<unknown>) | null = null;
/** 等待中的导入请求：reqId → 渲染进程回报的 Promise */
const pendingImports = new Map<string, { resolve: (r: { ok: boolean; error?: string }) => void; timer: NodeJS.Timeout }>();

function cors(res: http.ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  cors(res);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

/** 本机局域网 IPv4 列表（界面展示手机该连哪个地址） */
function localAddresses(): string[] {
  const out: string[] = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) out.push(net.address);
    }
  }
  return out;
}

function startServer(port: number): Promise<{ ok: boolean; port?: number; url?: string; addresses?: string[]; error?: string }> {
  return new Promise((resolve) => {
    if (server) {
      server.close();
      server = null;
    }
    const srv = http.createServer(async (req, res) => {
      cors(res);
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const url = (req.url ?? '').split('?')[0];

      // 导出快照：GET /sync/export
      if (req.method === 'GET' && url === '/sync/export') {
        try {
          const data = exportDataProvider ? await exportDataProvider() : null;
          if (!data) {
            sendJson(res, 503, { ok: false, error: '桌面端数据尚未就绪，请稍后重试' });
            return;
          }
          sendJson(res, 200, { app: 'VirtuGene', kind: 'sync-export', data });
        } catch (err) {
          sendJson(res, 500, { ok: false, error: String((err as Error)?.message ?? err) });
        }
        return;
      }

      // 导入合并：POST /sync/import（body: { data } 或直接 SyncExportData）
      if (req.method === 'POST' && url === '/sync/import') {
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const raw = Buffer.concat(chunks).toString('utf8');
          const parsed = JSON.parse(raw || '{}');
          const data = parsed && typeof parsed === 'object' && 'data' in parsed ? parsed.data : parsed;
          if (!data) {
            sendJson(res, 400, { ok: false, error: '请求体为空或格式不正确' });
            return;
          }
          const reqId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

          const result = await new Promise<{ ok: boolean; error?: string }>((resolveResult) => {
            const timer = setTimeout(() => {
              pendingImports.delete(reqId);
              resolveResult({ ok: false, error: '导入超时' });
            }, 30_000);
            pendingImports.set(reqId, { resolve: resolveResult, timer });
            // 通知渲染进程处理
            for (const win of BrowserWindow.getAllWindows()) {
              win.webContents.send('sync:import-request', { reqId, data });
            }
          });
          sendJson(res, result.ok ? 200 : 500, result);
        } catch (err) {
          sendJson(res, 500, { ok: false, error: String((err as Error)?.message ?? err) });
        }
        return;
      }

      sendJson(res, 404, { ok: false, error: 'Not Found' });
    });

    srv.on('error', (err) => {
      resolve({ ok: false, error: String((err as Error)?.message ?? err) });
    });

    srv.listen(port, '0.0.0.0', () => {
      server = srv;
      serverPort = port;
      resolve({ ok: true, port, url: `http://${localAddresses()[0] ?? '127.0.0.1'}:${port}`, addresses: localAddresses() });
    });
  });
}

export function registerSyncIPC() {
  ipcMain.handle('sync:start', async (_e, { port }: { port?: number }) => startServer(port ?? 46789));

  ipcMain.handle('sync:stop', async () => {
    if (server) {
      server.close();
      server = null;
      serverPort = 0;
    }
    return { ok: true };
  });

  ipcMain.handle('sync:status', async () => ({
    running: !!server,
    port: serverPort,
    url: server ? `http://${localAddresses()[0] ?? '127.0.0.1'}:${serverPort}` : '',
    addresses: localAddresses(),
  }));

  // 渲染进程投喂导出快照（collectSyncData 结果，随数据变化刷新）
  ipcMain.handle('sync:setExportData', async (_e, { data }: { data: unknown }) => {
    exportDataProvider = () => Promise.resolve(data);
    return { ok: true };
  });

  // 渲染进程回报导入结果（reqId → 结果），主进程据此回复手机端 HTTP 请求
  ipcMain.handle('sync:importResult', async (_e, { reqId, ok, error }: { reqId: string; ok: boolean; error?: string }) => {
    const pending = pendingImports.get(reqId);
    if (pending) {
      clearTimeout(pending.timer);
      pendingImports.delete(reqId);
      pending.resolve({ ok, error });
    }
    return { ok: true };
  });
}
