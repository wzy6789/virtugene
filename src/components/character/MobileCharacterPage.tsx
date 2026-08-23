import { useEffect, useState } from 'react';
import { useChatStore } from '../../store/chat-store';
import { CharacterAddModal } from './CharacterAddModal';

interface Props {
  /** 选择角色后回调（切回聊天 tab） */
  onSelect: () => void;
}

/**
 * 手机端角色列表页（微信「通讯录」式）：
 * 顶部为「基因实验室」入口，下方为角色列表，点击角色直接进入聊天。
 */
export function MobileCharacterPage({ onSelect }: Props) {
  const characters = useChatStore((s) => s.characters);
  const selectedCharacterId = useChatStore((s) => s.selectedCharacterId);
  const selectCharacter = useChatStore((s) => s.selectCharacter);
  const unreadByCharacter = useChatStore((s) => s.unreadByCharacter);
  const loadCharacters = useChatStore((s) => s.loadCharacters);
  const fetchUnreadCounts = useChatStore((s) => s.fetchUnreadCounts);
  const [showLab, setShowLab] = useState(false);

  useEffect(() => {
    void loadCharacters();
    void fetchUnreadCounts();
  }, [loadCharacters, fetchUnreadCounts]);

  const handleSelect = async (id: string) => {
    await selectCharacter(id);
    onSelect();
  };

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="h-12 flex items-center gap-2 px-4 border-b border-line shrink-0">
        <span className="text-base font-bold bg-gradient-to-r from-gene-purple to-life-cyan bg-clip-text text-transparent">
          我的角色
        </span>
        <div className="flex-1" />
        <button
          onClick={() => setShowLab(true)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs text-life-cyan border border-life-cyan/40 bg-life-cyan/10 active:bg-life-cyan/20 transition-colors"
        >
          🧬 基因实验室
        </button>
      </div>

      {/* 角色列表 */}
      <div className="flex-1 overflow-y-auto py-1">
        {characters.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-500 px-8 text-center">
            <span className="text-4xl">🧬</span>
            <p className="text-sm">还没有角色，去基因实验室孵化一个数字灵魂吧</p>
            <button
              onClick={() => setShowLab(true)}
              className="mt-1 px-4 py-2 rounded-full text-sm bg-gene-purple text-white shadow-[0_2px_12px_rgba(108,92,231,0.35)]"
            >
              打开基因实验室
            </button>
          </div>
        ) : (
          characters.map((c) => {
            const isSelected = c.id === selectedCharacterId;
            const unread = unreadByCharacter[c.id] ?? 0;
            return (
              <button
                key={c.id}
                onClick={() => void handleSelect(c.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors active:bg-surface ${
                  isSelected ? 'bg-gene-purple/8' : ''
                }`}
              >
                {c.avatar.startsWith('data:') ? (
                  <img src={c.avatar} alt={c.name} className="w-11 h-11 rounded-xl object-cover shrink-0" />
                ) : (
                  <span className="w-11 h-11 rounded-xl bg-surface flex items-center justify-center text-2xl shrink-0">
                    {c.avatar}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink truncate">{c.name}</span>
                    {c.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-surface text-gray-400 shrink-0">
                        {tag}
                      </span>
                    ))}
                  </div>
                  {c.signature ? (
                    <p className="text-xs text-gray-500 truncate mt-0.5">{c.signature}</p>
                  ) : (
                    <p className="text-xs text-gray-500 truncate mt-0.5">{c.systemPrompt.slice(0, 40)}</p>
                  )}
                </div>
                {unread > 0 && (
                  <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] flex items-center justify-center">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
                {isSelected && unread === 0 && (
                  <span className="shrink-0 text-xs text-gene-purple">✓</span>
                )}
              </button>
            );
          })
        )}
      </div>

      <CharacterAddModal
        open={showLab}
        onClose={() => setShowLab(false)}
        onSelected={() => {
          setShowLab(false);
          onSelect();
        }}
      />
    </div>
  );
}
