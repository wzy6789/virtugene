import { useEffect, useState } from 'react';
import { useChatStore } from '../../store/chat-store';
import { useAuthStore } from '../../store/auth-store';
import { characterRepo } from '../../db/character-repo';
import type { Character } from '../../db/index';

interface GenePoolTabProps {
  onSelect: (character: Character) => void;
}

type FilterTab = 'all' | 'preset' | 'shared' | 'mine';

const FILTERS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'preset', label: '预设基因' },
  { key: 'shared', label: '共享基因' },
  { key: 'mine', label: '我的' },
];

function getBadge(char: Character, userId: string) {
  if (char.isPreset) {
    return { text: '预设基因', className: 'bg-gene-purple/20 text-gene-purple' };
  }
  if (char.published && char.createdBy !== userId) {
    return { text: '共享基因', className: 'bg-amber-500/20 text-amber-400' };
  }
  return { text: '自定义基因', className: 'bg-life-cyan/10 text-life-cyan' };
}

export function GenePoolTab({ onSelect }: GenePoolTabProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterTab>('all');
  const [poolCharacters, setPoolCharacters] = useState<Character[]>([]);
  const selectedCharacterId = useChatStore((s) => s.selectedCharacterId);
  const selectCharacter = useChatStore((s) => s.selectCharacter);
  const createCharacter = useChatStore((s) => s.createCharacter);
  const userId = useAuthStore((s) => s.userId) ?? '';

  // The gene pool is independent of the sidebar: it also surfaces others'
  // published characters (which are hidden from the left sidebar).
  useEffect(() => {
    let alive = true;
    characterRepo.getAll().then((all) => {
      if (alive) setPoolCharacters(all);
    });
    return () => {
      alive = false;
    };
  }, []);

  const poolBase = poolCharacters.filter(
    (c) => c.isPreset || c.published || c.createdBy === userId,
  );

  const preFiltered = (() => {
    switch (filter) {
      case 'preset':
        return poolBase.filter((c) => c.isPreset);
      case 'shared':
        return poolBase.filter((c) => c.published && !c.isPreset && c.createdBy !== userId);
      case 'mine':
        return poolBase.filter((c) => c.createdBy === userId && !c.isPreset);
      default:
        return poolBase;
    }
  })();

  const filtered = preFiltered.filter(
    (c) =>
      c.name.includes(query) ||
      c.tags.some((t) => t.includes(query)) ||
      c.systemPrompt.includes(query),
  );

  const handleSelect = async (character: Character) => {
    const isShared = character.published && !character.isPreset && character.createdBy !== userId;
    if (isShared) {
      // Clone a shared gene into a private copy owned by the current user.
      const clone = await createCharacter({
        name: character.name,
        avatar: character.avatar,
        systemPrompt: character.systemPrompt,
        tags: character.tags,
        isPreset: false,
        isCustom: true,
        published: false,
        createdBy: userId,
      });
      onSelect(clone);
    } else {
      await selectCharacter(character.id);
      onSelect(character);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
          viewBox="0 0 16 16"
          fill="none"
        >
          <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.2" />
          <path d="M11 11L14.5 14.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索基因序列..."
          className="w-full pl-10 pr-4 py-3 bg-surface border border-line-strong rounded-xl text-sm text-ink placeholder-gray-500 focus:outline-none focus:border-gene-purple/50 transition-colors"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
              filter === f.key
                ? 'bg-gene-purple/20 text-gene-purple'
                : 'text-gray-500 hover:text-sub hover:bg-surface'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
          <span className="text-4xl mb-3">🧬</span>
          <span className="text-sm">未找到匹配的基因序列</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 max-h-[45vh] overflow-y-auto pr-1">
          {filtered.map((char) => {
            const isSelected = char.id === selectedCharacterId;
            const isShared = char.published && !char.isPreset && char.createdBy !== userId;
            const badge = getBadge(char, userId);
            return (
              <button
                key={char.id}
                onClick={() => handleSelect(char)}
                className={`relative text-left p-4 rounded-xl border transition-all hover:bg-surface ${
                  isSelected
                    ? 'border-gene-purple bg-gene-purple/10'
                    : 'border-line'
                }`}
              >
                {isSelected && (
                  <span className="absolute top-2 right-2 text-gene-purple text-xs">✓</span>
                )}
                <div className="flex items-start gap-3">
                  {char.avatar.startsWith('data:') ? (
                    <img src={char.avatar} alt={char.name} className="w-9 h-9 rounded-lg object-cover shrink-0" />
                  ) : (
                    <span className="text-3xl shrink-0">{char.avatar}</span>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-ink truncate">{char.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${badge.className}`}>
                        {badge.text}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {char.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-surface text-gray-400"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    {isShared && (
                      <span className="inline-block mt-2 text-[10px] text-life-cyan">
                        ⧉ 点击克隆到我的基因
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
