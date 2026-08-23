import { useEffect, useState } from 'react';
import { ChatPage } from '../../pages/ChatPage';
import { DiaryPage } from '../../pages/DiaryPage';
import { MobileCharacterPage } from '../character/MobileCharacterPage';
import { MobileMePage } from './MobileMePage';
import { NotificationCloud } from '../chat/NotificationCloud';
import { useUIStore } from '../../store/ui-store';

type MobileTab = 'chat' | 'characters' | 'diary' | 'me';

const TABS: { key: MobileTab; icon: string; label: string }[] = [
  { key: 'chat', icon: '💬', label: '聊天' },
  { key: 'characters', icon: '🧬', label: '角色' },
  { key: 'diary', icon: '📓', label: '手账' },
  { key: 'me', icon: '👤', label: '我的' },
];

/**
 * 手机端外壳：微信式底部四栏导航（聊天 / 角色 / 手账 / 我的）。
 * 聊天与手账与 App 的 activeView 联动（DiaryPage 内部可切回聊天）。
 */
export function MobileLayout() {
  const [tab, setTabState] = useState<MobileTab>('chat');
  const activeView = useUIStore((s) => s.activeView);

  // 外部 activeView 变化（如手账内点「返回聊天」）→ 同步底部 tab
  useEffect(() => {
    setTabState(activeView === 'diary' ? 'diary' : 'chat');
  }, [activeView]);

  const setTab = (t: MobileTab) => {
    setTabState(t);
    if (t === 'chat') useUIStore.getState().setActiveView('chat');
    if (t === 'diary') useUIStore.getState().setActiveView('diary');
  };

  const navBtn = (t: MobileTab) =>
    `flex-1 h-14 flex flex-col items-center justify-center gap-0.5 text-[11px] transition-colors active:bg-surface ${
      tab === t ? 'text-gene-purple' : 'text-gray-500'
    }`;

  return (
    <div className="relative h-full w-full flex flex-col bg-app overflow-hidden">
      {/* 沉浸光感：氛围光晕 + DNA 点阵底纹 */}
      <div className="absolute inset-0 aurora pointer-events-none z-0" />
      <div className="absolute inset-0 dna-dots pointer-events-none z-0" />

      <div className="relative z-10 flex flex-col h-full">
        <NotificationCloud />

        {/* 内容区 */}
        <main className="flex-1 overflow-hidden">
          {tab === 'chat' && <ChatPage />}
          {tab === 'characters' && <MobileCharacterPage onSelect={() => setTab('chat')} />}
          {tab === 'diary' && <DiaryPage />}
          {tab === 'me' && <MobileMePage />}
        </main>

        {/* 底部导航（含手势安全区） */}
        <nav className="shrink-0 flex items-stretch border-t border-line bg-glass/85 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
          {TABS.map((t) => (
            <button key={t.key} className={navBtn(t.key)} onClick={() => setTab(t.key)}>
              <span className="text-lg leading-none">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
