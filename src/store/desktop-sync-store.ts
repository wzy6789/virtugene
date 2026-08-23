/**
 * 局域网同步 · 桌面服务端状态：
 * - 开启/停止 HTTP 同步服务（供手机拉取/推送）
 * - 服务运行期间每 15s 刷新导出快照（collectSyncData 结果投喂主进程）
 * - 接收手机推送的导入请求 → 合并写入本机 → 回报结果
 */
import { create } from 'zustand';
import { ipc } from '../lib/ipc-client';
import { collectSyncData, importSyncData } from '../lib/sync';
import { useAuthStore } from './auth-store';
import { useChatStore } from './chat-store';
import { useDiaryStore } from './diary-store';

const DEFAULT_PORT = 46789;
const SNAPSHOT_REFRESH_MS = 15_000;

interface DesktopSyncState {
  running: boolean;
  port: number;
  url: string;
  addresses: string[];
  error: string | null;
  lastImport: string | null;

  start: (port?: number) => Promise<void>;
  stop: () => Promise<void>;
  refresh: () => Promise<void>;
  /** 注册导入监听 + 快照保鲜定时器（App 挂载时调用一次） */
  init: () => () => void;
}

export const useDesktopSyncStore = create<DesktopSyncState>((set, get) => ({
  running: false,
  port: 0,
  url: '',
  addresses: [],
  error: null,
  lastImport: null,

  start: async (port) => {
    set({ error: null });
    try {
      const { userId, username } = useAuthStore.getState();
      const data = await collectSyncData(userId, username);
      await ipc.sync.setExportData(data);
      const r = await ipc.sync.start(port ?? DEFAULT_PORT);
      if (r.ok) {
        set({
          running: true,
          port: r.port ?? DEFAULT_PORT,
          url: r.url ?? '',
          addresses: r.addresses ?? [],
          error: null,
        });
      } else {
        set({ error: r.error ?? '启动失败' });
      }
    } catch (err) {
      set({ error: (err as Error)?.message ?? '启动失败' });
    }
  },

  stop: async () => {
    await ipc.sync.stop();
    set({ running: false, port: 0, url: '', addresses: [], error: null });
  },

  refresh: async () => {
    const s = await ipc.sync.status();
    set({ running: s.running, port: s.port ?? 0, url: s.url ?? '', addresses: s.addresses ?? [] });
  },

  init: () => {
    // 监听手机推送导入请求 → 写入本地 → 回报
    const off = ipc.sync.onImportRequest(async ({ reqId, data }) => {
      try {
        const r = await importSyncData(data);
        if (r.ok) {
          await Promise.all([
            useChatStore.getState().loadCharacters(),
            useDiaryStore.getState().load(),
          ]);
        }
        const summary = r.counts
          ? `角色 ${r.counts.characters ?? 0}、会话 ${r.counts.sessions ?? 0}、消息 ${r.counts.messages ?? 0}、日记 ${r.counts.diaries ?? 0}`
          : '';
        set({ lastImport: `已合并手机数据${summary ? `（${summary}）` : ''}` });
        await ipc.sync.importResult(reqId, r.ok, r.error);
      } catch {
        await ipc.sync.importResult(reqId, false, '导入异常，请重试');
      }
    });

    // 快照保鲜：运行中每 15s 把最新数据投喂给主进程
    const timer = setInterval(async () => {
      if (!get().running) return;
      try {
        const { userId, username } = useAuthStore.getState();
        const data = await collectSyncData(userId, username);
        await ipc.sync.setExportData(data);
      } catch {
        /* 忽略瞬时失败 */
      }
    }, SNAPSHOT_REFRESH_MS);

    return () => {
      off();
      clearInterval(timer);
    };
  },
}));
