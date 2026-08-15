import { useEffect, useState, useRef, useMemo } from 'react';
import { useChatStore } from '../../store/chat-store';
import { useAuthStore } from '../../store/auth-store';
import { useCharacterStateStore } from '../../store/character-state-store';
import { getRelationLevel } from '../../lib/affinity';
import { CharacterAddModal } from './CharacterAddModal';
import { Modal } from '../ui/Modal';
import type { Character } from '../../db/index';

interface Props {
  collapsed: boolean;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  if (diff < 604800000) {
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    return `周${days[d.getDay()]}`;
  }
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

const LEVEL_TAG_CLASS: Record<string, string> = {
  初识: 'bg-gray-500/10 text-gray-400',
  熟悉: 'bg-life-cyan/10 text-life-cyan',
  亲近: 'bg-gene-purple/15 text-gene-purple',
  挚友: 'bg-amber-500/15 text-amber-500',
  知己: 'bg-pink-500/15 text-pink-400',
};

export function CharacterList({ collapsed }: Props) {
  const characters = useChatStore((s) => s.characters);
  const selectedId = useChatStore((s) => s.selectedCharacterId);
  const loadCharacters = useChatStore((s) => s.loadCharacters);
  const selectCharacter = useChatStore((s) => s.selectCharacter);
  const deleteCharacter = useChatStore((s) => s.deleteCharacter);
  const togglePin = useChatStore((s) => s.togglePin);
  const charPreviews = useChatStore((s) => s.charPreviews);
  const unreadByCharacter = useChatStore((s) => s.unreadByCharacter);
  const userId = useAuthStore((s) => s.userId) ?? '';
  const affinityByCharacter = useCharacterStateStore((s) => s.affinityByCharacter);
  const loadAllStates = useCharacterStateStore((s) => s.loadAll);

  const isOwnChar = (char: Character) => !char.isPreset && char.createdBy === userId;

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; char: Character } | null>(null);
  const [editCharacter, setEditCharacter] = useState<Character | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Character | null>(null);
  const [search, setSearch] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  // 先置顶，再按最近消息时间降序（发消息的角色自动上浮）
  const sorted = useMemo(() => {
    const kw = search.trim().toLowerCase();
    const filtered = kw
      ? characters.filter((c) => c.name.toLowerCase().includes(kw))
      : characters;
    return [...filtered].sort((a, b) => {
      const aPin = a.pinned ? 1 : 0;
      const bPin = b.pinned ? 1 : 0;
      if (aPin !== bPin) return bPin - aPin;
      const aTime = charPreviews[a.id]?.createdAt ?? a.createdAt;
      const bTime = charPreviews[b.id]?.createdAt ?? b.createdAt;
      return bTime - aTime;
    });
  }, [characters, charPreviews, search]);

  const pinnedChars = sorted.filter((c) => c.pinned);
  const normalChars = sorted.filter((c) => !c.pinned);

  const renderCharRow = (char: Character, showDivider: boolean) => {
    const preview = charPreviews[char.id];
    const unread = unreadByCharacter[char.id] ?? 0;
    const level = getRelationLevel(affinityByCharacter[char.id] ?? 0);
    return (
      <div key={char.id}>
        {showDivider && <div className="border-t border-line mx-3" />}
        <button
          onClick={() => selectCharacter(char.id)}
          onContextMenu={(e) => handleContextMenu(e, char)}
          className={`relative w-full flex items-center gap-3 px-3 py-3 text-left transition-colors ${
            selectedId === char.id
              ? 'bg-gene-purple/10'
              : char.pinned
                ? 'bg-amber-400/[0.06] hover:bg-amber-400/10'
                : 'hover:bg-surface'
          }`}
        >
          {char.avatar.startsWith('data:') ? (
            <img src={char.avatar} alt={char.name} className="w-8 h-8 rounded-lg object-cover shrink-0" />
          ) : (
            <span className="text-2xl shrink-0">{char.avatar}</span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <p className={`text-sm truncate ${selectedId === char.id ? 'text-ink font-medium' : 'text-sub'}`}>
                  {char.name}
                </p>
                {char.pinned && (
                  <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-500 shrink-0 leading-none">
                    顶
                  </span>
                )}
                <span
                  className={`text-[9px] px-1 py-0.5 rounded shrink-0 leading-none ${
                    LEVEL_TAG_CLASS[level.level.name] ?? 'bg-gray-500/10 text-gray-400'
                  }`}
                >
                  {level.level.name}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {preview && (
                  <span className="text-[10px] text-gray-600">
                    {formatTime(preview.createdAt)}
                  </span>
                )}
                {unread > 0 && (
                  <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 leading-none">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </div>
            </div>
            <p className="text-[11px] text-gray-500 truncate mt-0.5">
              {preview ? preview.content.slice(0, 30) : '点击开始对话'}
            </p>
          </div>
        </button>
      </div>
    );
  };

  useEffect(() => {
    loadCharacters();
    loadAllStates();
  }, [loadCharacters, loadAllStates]);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [contextMenu]);

  const handleContextMenu = (e: React.MouseEvent, char: Character) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, char });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteCharacter(deleteTarget.id);
    setDeleteTarget(null);
  };

  if (collapsed) {
    return (
      <div className="space-y-0.5 px-2">
        {sorted.map((char) => {
          const unread = unreadByCharacter[char.id] ?? 0;
          return (
            <button
              key={char.id}
              onClick={() => selectCharacter(char.id)}
              onContextMenu={(e) => handleContextMenu(e, char)}
              className={`w-full flex items-center justify-center py-2.5 rounded-xl transition-colors relative ${
                selectedId === char.id ? 'bg-gene-purple/20' : 'hover:bg-surface'
              }`}
            >
              {char.avatar.startsWith('data:') ? (
                <img src={char.avatar} alt={char.name} className="w-7 h-7 rounded-lg object-cover" />
              ) : (
                <span className="text-xl">{char.avatar}</span>
              )}
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 leading-none">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <>
      <div>
        {/* Search */}
        <div className="px-3 pt-2 pb-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-gray-400 shrink-0">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索基因"
              className="flex-1 bg-transparent text-sm text-ink placeholder:text-gray-500 outline-none min-w-0"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="text-gray-400 hover:text-ink transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {sorted.length === 0 && (
          <p className="px-4 py-8 text-center text-xs text-gray-500">未找到匹配的基因序列</p>
        )}

        {pinnedChars.length > 0 && (
          <div className="px-4 pt-1 pb-1">
            <p className="text-[10px] text-gray-500">置顶</p>
          </div>
        )}
        {pinnedChars.map((char, i) => renderCharRow(char, i > 0))}

        {pinnedChars.length > 0 && normalChars.length > 0 && (
          <div className="border-t border-line mx-3 my-1" />
        )}
        {normalChars.map((char, i) => renderCharRow(char, i > 0))}
      </div>

      {/* Context menu popover */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed z-[60] min-w-[140px] py-1.5 glass-card rounded-xl shadow-2xl"
          style={{ left: contextMenu.x + 4, top: contextMenu.y + 4 }}
        >
          {isOwnChar(contextMenu.char) ? (
            <>
              <button
                onClick={() => {
                  void togglePin(contextMenu.char.id);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-sub hover:bg-surface transition-colors"
              >
                {contextMenu.char.pinned ? '📌 取消置顶' : '📌 置顶'}
              </button>
              <button
                onClick={() => {
                  setEditCharacter(contextMenu.char);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-sub hover:bg-surface transition-colors"
              >
                ✏️ 编辑基因
              </button>
              <button
                onClick={() => {
                  setDeleteTarget(contextMenu.char);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                🗑️ 抹除序列
              </button>
            </>
          ) : contextMenu.char.isPreset ? (
            <div className="px-4 py-2 text-xs text-gray-600">预设基因不可编辑</div>
          ) : (
            <div className="px-4 py-2 text-xs text-gray-600">共享基因 — 仅可使用</div>
          )}
        </div>
      )}

      {/* Edit modal */}
      {editCharacter && (
        <CharacterAddModal
          open={true}
          onClose={() => setEditCharacter(null)}
          editCharacter={editCharacter}
        />
      )}

      {/* Delete confirm modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <div className="p-6">
          <p className="text-sm text-sub mb-2">
            这段基因序列将被永久抹除，关联的所有对话记录也会被清除。
          </p>
          <p className="text-xs text-gray-500 mb-6">确认抹除？</p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:bg-surface transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 rounded-lg text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
            >
              确认抹除
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
