/**
 * 局域网同步状态管理（手机端纯客户端版）。
 *
 * 手机端不提供同步服务，仅作为 HTTP 客户端直连桌面端：
 * - 「拉取」：GET  http://<桌面IP>:<端口>/sync/export  → 合并进本机 IndexedDB
 * - 「推送」：POST http://<桌面IP>:<端口>/sync/import  → 桌面端合并
 *
 * 桌面端只需实现这两个 HTTP 端点（含 CORS 头），协议见 MOBILE.md。
 */
import { create } from 'zustand';
import { collectSyncData, importSyncData } from '../lib/sync';
import { useAuthStore } from './auth-store';
import { useChatStore } from './chat-store';
import { useDiaryStore } from './diary-store';

interface SyncState {
  clientStatus: string | null;
  clientBusy: boolean;
  pullFromDesktop: (host: string, port: number) => Promise<void>;
  pushToDesktop: (host: string, port: number) => Promise<void>;
}

export const useSyncStore = create<SyncState>((set) => ({
  clientStatus: null,
  clientBusy: false,

  pullFromDesktop: async (host, port) => {
    set({ clientBusy: true, clientStatus: '正在从桌面端拉取基因序列…' });
    try {
      const res = await fetch(`http://${host}:${port}/sync/export`, {
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      const r = await importSyncData(payload);
      if (!r.ok) throw new Error(r.error ?? '导入失败');
      await Promise.all([
        useChatStore.getState().loadCharacters(),
        useDiaryStore.getState().load(),
      ]);
      const c = r.counts;
      set({
        clientStatus: `拉取完成：角色 ${c?.characters ?? 0}、会话 ${c?.sessions ?? 0}、消息 ${c?.messages ?? 0}、日记 ${c?.diaries ?? 0}`,
        clientBusy: false,
      });
    } catch (err) {
      set({
        clientStatus: '拉取失败：' + ((err as Error)?.message ?? '无法连接，请确认桌面端已开启同步服务且两台设备在同一局域网'),
        clientBusy: false,
      });
    }
  },

  pushToDesktop: async (host, port) => {
    set({ clientBusy: true, clientStatus: '正在推送本机数据到桌面端…' });
    try {
      const { userId, username } = useAuthStore.getState();
      const data = await collectSyncData(userId, username);
      const res = await fetch(`http://${host}:${port}/sync/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
        signal: AbortSignal.timeout(30_000),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error ?? `HTTP ${res.status}`);
      set({ clientStatus: '推送完成：桌面端已合并本次数据', clientBusy: false });
    } catch (err) {
      set({
        clientStatus: '推送失败：' + ((err as Error)?.message ?? '无法连接，请确认桌面端已开启同步服务'),
        clientBusy: false,
      });
    }
  },
}));
