import { create } from 'zustand';

export type ActiveView = 'chat' | 'diary';

interface UIState {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
}

/** 主内容区视图切换（聊天 / 日记） */
export const useUIStore = create<UIState>((set) => ({
  activeView: 'chat',
  setActiveView: (activeView) => set({ activeView }),
}));
