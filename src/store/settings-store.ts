import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  /** 日记 AI 辅助（润色/续写/提炼对话）总开关 */
  diaryAiEnabled: boolean;
  setDiaryAiEnabled: (enabled: boolean) => void;
  /** 是否允许角色在对话中看到你的日记片段（隐私开关，默认关） */
  diarySharedWithCharacters: boolean;
  setDiarySharedWithCharacters: (enabled: boolean) => void;
  /** 手账隐私锁 PIN（SHA-256 摘要；为空表示未启用） */
  diaryPin: string | null;
  setDiaryPin: (pinHash: string | null) => void;
  /** 每日写日记提醒（系统通知） */
  diaryReminderEnabled: boolean;
  setDiaryReminderEnabled: (enabled: boolean) => void;
  /** 提醒时间 'HH:mm' */
  diaryReminderTime: string;
  setDiaryReminderTime: (time: string) => void;
  /** AI 用量统计（本地累计估算，不入云）：今日 token / 本月 token */
  aiUsage: { todayTokens: number; monthTokens: number; lastDate: string };
  addAiTokens: (tokens: number) => void;
  /** 关闭到托盘（设置面板开关） */
  closeToTrayEnabled: boolean;
  setCloseToTrayEnabled: (enabled: boolean) => void;
  /** 聊天气泡字号（px）：小 12 / 中 14 / 大 16 */
  chatFontSize: number;
  setChatFontSize: (size: number) => void;
  /** 聊天气泡间距：紧凑 0 / 标准 1 / 宽松 2 */
  chatDensity: number;
  setChatDensity: (density: number) => void;
  /** TTS 语音总开关（默认开；关闭后不显示/不触发朗读） */
  ttsEnabled: boolean;
  setTtsEnabled: (enabled: boolean) => void;
  /** 全局语速倍率：0.8 / 1.0 / 1.2 */
  ttsSpeed: number;
  setTtsSpeed: (speed: number) => void;
}

/** 粗略估算 token：中文约 1 字 ≈ 1 token，英文约 4 字符 ≈ 1 token */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const cjk = (text.match(/[\u4e00-\u9fff\u3040-\u30ff]/g) ?? []).length;
  const other = text.length - cjk;
  return Math.ceil(cjk + other / 4);
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      diaryAiEnabled: true,
      setDiaryAiEnabled: (diaryAiEnabled) => set({ diaryAiEnabled }),
      diarySharedWithCharacters: false,
      setDiarySharedWithCharacters: (diarySharedWithCharacters) => set({ diarySharedWithCharacters }),
      diaryPin: null,
      setDiaryPin: (diaryPin) => set({ diaryPin }),
      diaryReminderEnabled: false,
      setDiaryReminderEnabled: (diaryReminderEnabled) => set({ diaryReminderEnabled }),
      diaryReminderTime: '21:00',
      setDiaryReminderTime: (diaryReminderTime) => set({ diaryReminderTime }),
      aiUsage: { todayTokens: 0, monthTokens: 0, lastDate: '' },
      addAiTokens: (tokens) => {
        const now = new Date();
        const today = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
        const month = `${now.getFullYear()}-${now.getMonth() + 1}`;
        const cur = get().aiUsage;
        // 跨天/跨月时重置对应计数
        const lastDate = cur.lastDate || today;
        let todayTokens = cur.todayTokens;
        let monthTokens = cur.monthTokens;
        if (lastDate !== today) todayTokens = 0;
        if (lastDate.slice(0, 7) !== month) monthTokens = 0;
        set({ aiUsage: { todayTokens: todayTokens + Math.max(0, Math.round(tokens)), monthTokens: monthTokens + Math.max(0, Math.round(tokens)), lastDate: today } });
      },
      closeToTrayEnabled: true,
      setCloseToTrayEnabled: (closeToTrayEnabled) => set({ closeToTrayEnabled }),
      chatFontSize: 14,
      setChatFontSize: (chatFontSize) => set({ chatFontSize }),
      chatDensity: 1,
      setChatDensity: (chatDensity) => set({ chatDensity }),
      ttsEnabled: true,
      setTtsEnabled: (ttsEnabled) => set({ ttsEnabled }),
      ttsSpeed: 1.0,
      setTtsSpeed: (ttsSpeed) => set({ ttsSpeed }),
    }),
    { name: 'virtugene-settings' },
  ),
);

/** SHA-256 摘要（用于 PIN 存储，避免明文落盘） */
export async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
