import { create } from 'zustand';
import { useAuthStore } from './auth-store';
import { useChatStore } from './chat-store';
import { messageRepo } from '../db/message-repo';
import { emotionRepo } from '../db/emotion-repo';
import { ipc } from '../lib/ipc-client';
import type { EmotionSnapshot } from '../db/index';

interface EmotionState {
  isPanelOpen: boolean;
  isAnalyzing: boolean;
  analysisError: string | null;
  currentSnapshot: EmotionSnapshot | null;
  previousSnapshot: EmotionSnapshot | null;
  snapshots: EmotionSnapshot[];

  togglePanel: () => void;
  closePanel: () => void;
  analyzeCurrentSession: (characterId: string, sessionId: string, characterName: string) => Promise<void>;
  loadSessionSnapshots: (sessionId: string) => Promise<void>;
  clearCurrent: () => void;
}

export const useEmotionStore = create<EmotionState>((set, get) => ({
  isPanelOpen: false,
  isAnalyzing: false,
  analysisError: null,
  currentSnapshot: null,
  previousSnapshot: null,
  snapshots: [],

  togglePanel: () => set((s) => ({ isPanelOpen: !s.isPanelOpen })),

  closePanel: () => set({ isPanelOpen: false }),

  analyzeCurrentSession: async (characterId, sessionId, characterName) => {
    const apiKey = useAuthStore.getState().apiKey;
    if (!apiKey) {
      set({ analysisError: '基因序列验证失败，请检查 API Key' });
      return;
    }

    const msgs = await messageRepo.getBySession(sessionId);
    if (msgs.length === 0) {
      set({ analysisError: '发送一些消息后即可分析情绪' });
      return;
    }

    set({ isAnalyzing: true, analysisError: null });

    const history = msgs.slice(-30).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const result = await ipc.emotion.analyze({ apiKey, history, characterName });

    if (result.error) {
      const errorMap: Record<string, string> = {
        'auth:invalid_key': '基因序列验证失败，请检查 API Key',
        'billing:insufficient': 'DeepSeek 账户余额不足，请前往平台充值',
        'rate:limited': '请求过于频繁，请稍后重试',
        'server:error': '基因链接中断，请重试',
      };
      set({ isAnalyzing: false, analysisError: errorMap[result.error] ?? '基因链接中断，请重试' });
      return;
    }

    if (result.dimensions) {
      const snapshot: EmotionSnapshot = {
        id: crypto.randomUUID(),
        characterId,
        sessionId,
        dimensions: result.dimensions,
        dominantEmotion: result.dominantEmotion ?? '未知',
        summary: result.summary ?? '',
        messageCount: msgs.length,
        createdAt: Date.now(),
      };

      await emotionRepo.create(snapshot);

      // If the user switched characters/sessions while the analysis was in flight,
      // don't overwrite the new session's (possibly empty) emotion view.
      if (useChatStore.getState().currentSessionId !== sessionId) {
        set({ isAnalyzing: false });
        return;
      }

      // Reload snapshots
      const snapshots = await emotionRepo.getBySession(sessionId);
      const current = snapshots[0] ?? null;
      const previous = snapshots.length > 1 ? snapshots[1] : null;

      set({
        isAnalyzing: false,
        analysisError: null,
        currentSnapshot: current,
        previousSnapshot: previous,
        snapshots,
      });
    } else {
      set({ isAnalyzing: false, analysisError: '基因链接中断，请重试' });
    }
  },

  loadSessionSnapshots: async (sessionId) => {
    const snapshots = await emotionRepo.getBySession(sessionId);
    const current = snapshots[0] ?? null;
    const previous = snapshots.length > 1 ? snapshots[1] : null;
    set({ snapshots, currentSnapshot: current, previousSnapshot: previous, analysisError: null });
  },

  clearCurrent: () => set({ currentSnapshot: null, previousSnapshot: null, snapshots: [], analysisError: null }),
}));
