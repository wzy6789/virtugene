import { useState } from 'react';
import { useChatStore } from '../../store/chat-store';
import { useAuthStore } from '../../store/auth-store';
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
  const characters = useChatStore((s) => s.characters);
  const selectedCharacterId = useChatStore((s) => s.selectedCharacterId);
  const selectCharacter = useChatStore((s) => s.selectCharacter);
  const userId = useAuthStore((s) => s.userId) ?? '';

  const preFiltered = (() => {
    switch (filter) {
      case 'preset':
        return characters.filter((c) => c.isPreset);
      case 'shared':
        return characters.filter((c) => c.published && !c.isPreset && c.createdBy !== userId);
      case 'mine':
        return characters.filter((c) => c.createdBy === userId && !c.isPreset);
      default:
        return characters;
    }
  })();

  const filtered = preFiltered.filter(
    (c) =>
      c.name.includes(query) ||
      c.tags.some((t) => t.includes(query)) ||
      c.systemPrompt.includes(query),
  );

  const handleSelect = (character: Character) => {
    selectCharacter(character.id);
    onSelect(character);
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
