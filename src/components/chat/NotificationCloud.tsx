import { useEffect } from 'react';
import { useNotificationStore } from '../../store/notification-store';
import { useChatStore } from '../../store/chat-store';

/** 每条流体云的停留时长（ms），到期自动消失 */
const DISMISS_MS = 4500;

/**
 * 应用内流体云消息提醒：悬停在界面顶部（标题栏下方），
 * 毛玻璃云朵样式，点击跳转到对应角色的会话。
 * 触发场景：① 角色主动发消息而用户没在看 TA；② 用户切走会话后，AI 的回复才到达。
 */
export function NotificationCloud() {
  const items = useNotificationStore((s) => s.items);
  const dismiss = useNotificationStore((s) => s.dismiss);

  // 每条到期自动消失
  useEffect(() => {
    if (items.length === 0) return;
    const timers = items.map((item) => setTimeout(() => dismiss(item.id), DISMISS_MS));
    return () => timers.forEach(clearTimeout);
  }, [items, dismiss]);

  if (items.length === 0) return null;

  return (
    <div className="absolute top-12 left-1/2 -translate-x-1/2 z-[70] w-full max-w-sm px-4 flex flex-col items-center gap-2 pointer-events-none">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => {
            void useChatStore.getState().selectCharacter(item.characterId);
            dismiss(item.id);
          }}
          className="animate-cloud-in pointer-events-auto w-full glass-card rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xl border-life-cyan/20 hover:border-life-cyan/60 transition-colors text-left"
        >
          {item.avatar.startsWith('data:') ? (
            <img src={item.avatar} alt={item.characterName} className="w-8 h-8 rounded-full object-cover shrink-0" />
          ) : (
            <span className="text-xl shrink-0">{item.avatar}</span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs text-ink font-medium">{item.characterName}</p>
            <p className="text-xs text-gray-500 truncate">{item.preview}</p>
          </div>
          <span className="text-life-cyan text-xs shrink-0">查看</span>
        </button>
      ))}
    </div>
  );
}
