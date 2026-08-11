import { useAuthStore } from '../../store/auth-store';

interface Props {
  collapsed: boolean;
}

export function CharacterList({ collapsed }: Props) {
  const logout = useAuthStore((s) => s.logout);

  // Static preset list for Phase 2 — will be replaced with DB-backed list in Phase 3
  const characters = [
    { id: 'preset-linshuang', name: '林霜', avatar: '🧬', tags: ['理性', '毒舌', '极客'] },
    { id: 'preset-aili', name: '艾莉', avatar: '🌌', tags: ['开朗', '好奇', '浪漫'] },
    { id: 'preset-socrates', name: '苏格拉底', avatar: '🐱', tags: ['哲思', '慵懒', '幽默'] },
  ];

  return (
    <div className="space-y-1 px-2">
      {characters.map((char) => (
        <button
          key={char.id}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-white/5 transition-colors group"
        >
          <span className="text-xl shrink-0">{char.avatar}</span>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{char.name}</p>
              <div className="flex gap-1 mt-0.5">
                {char.tags.map((tag) => (
                  <span key={tag} className="text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
