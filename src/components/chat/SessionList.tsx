import { useState } from 'react';
import { useChatStore } from '../../store/chat-store';

interface Props {
  collapsed: boolean;
}

export function SessionList({ collapsed }: Props) {
  const sessions = useChatStore((s) => s.sessions);
  const currentSessionId = useChatStore((s) => s.currentSessionId);
  const selectedCharacterId = useChatStore((s) => s.selectedCharacterId);
  const selectSession = useChatStore((s) => s.selectSession);
  const createSession = useChatStore((s) => s.createSession);
  const deleteSession = useChatStore((s) => s.deleteSession);
  const renameSession = useChatStore((s) => s.renameSession);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const handleNew = async () => {
    if (selectedCharacterId) {
      await createSession(selectedCharacterId);
    }
  };

  const handleRename = async (id: string) => {
    if (editTitle.trim()) {
      await renameSession(id, editTitle.trim());
    }
    setEditingId(null);
  };

  if (collapsed) return null;

  return (
    <div className="px-3 pb-2">
      <div className="flex items-center justify-between px-2 py-1">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">对话</p>
        <button
          onClick={handleNew}
          disabled={!selectedCharacterId}
          className="text-gray-500 hover:text-white disabled:opacity-30 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {sessions.length === 0 ? (
        <p className="text-[11px] text-gray-600 px-2 py-1">暂无对话</p>
      ) : (
        <div className="space-y-0.5">
          {sessions.map((s) => (
            <div key={s.id} className="group relative">
              {editingId === s.id ? (
                <input
                  autoFocus
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={() => handleRename(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(s.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="w-full px-2 py-1.5 rounded text-xs bg-white/10 text-white border border-gene-purple/50 focus:outline-none"
                />
              ) : (
                <button
                  onClick={() => selectSession(s.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs transition-colors ${
                    currentSessionId === s.id
                      ? 'bg-gene-purple/20 text-white'
                      : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                  }`}
                  onDoubleClick={() => {
                    setEditingId(s.id);
                    setEditTitle(s.title);
                  }}
                >
                  <span className="truncate flex-1">{s.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('这段基因序列将被永久抹除')) {
                        deleteSession(s.id);
                      }
                    }}
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all"
                  >
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M1 1L11 11M11 1L1 11" />
                    </svg>
                  </button>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
