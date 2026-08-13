import { useEffect, useState, useRef } from 'react';
import { useChatStore } from '../../store/chat-store';
import { useAuthStore } from '../../store/auth-store';
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

export function CharacterList({ collapsed }: Props) {
  const characters = useChatStore((s) => s.characters);
  const selectedId = useChatStore((s) => s.selectedCharacterId);
  const loadCharacters = useChatStore((s) => s.loadCharacters);
  const selectCharacter = useChatStore((s) => s.selectCharacter);
  const deleteCharacter = useChatStore((s) => s.deleteCharacter);
  const charPreviews = useChatStore((s) => s.charPreviews);
  const unreadByCharacter = useChatStore((s) => s.unreadByCharacter);
  const userId = useAuthStore((s) => s.userId) ?? '';

  const isOwnChar = (char: Character) => !char.isPreset && char.createdBy === userId;

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; char: Character } | null>(null);
  const [editCharacter, setEditCharacter] = useState<Character | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Character | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadCharacters();
  }, [loadCharacters]);

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
        {characters.map((char) => {
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
        {characters.map((char, i) => {
          const preview = charPreviews[char.id];
          const unread = unreadByCharacter[char.id] ?? 0;
          return (
            <div key={char.id}>
              {i > 0 && <div className="border-t border-line mx-3" />}
              <button
                onClick={() => selectCharacter(char.id)}
                onContextMenu={(e) => handleContextMenu(e, char)}
                className={`w-full flex items-center gap-3 px-3 py-3 text-left transition-colors ${
                  selectedId === char.id ? 'bg-gene-purple/10' : 'hover:bg-surface'
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
                      {char.isPreset ? (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-gene-purple/20 text-gene-purple shrink-0 leading-none">
                          预
                        </span>
                      ) : char.published && char.createdBy !== userId ? (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 shrink-0 leading-none">
                          享
                        </span>
                      ) : (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-life-cyan/10 text-life-cyan shrink-0 leading-none">
                          自
                        </span>
                      )}
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
        })}
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
