import { useEffect } from 'react';
import { useChatStore } from '../../store/chat-store';

interface Props {
  collapsed: boolean;
}

export function CharacterList({ collapsed }: Props) {
  const characters = useChatStore((s) => s.characters);
  const selectedId = useChatStore((s) => s.selectedCharacterId);
  const loadCharacters = useChatStore((s) => s.loadCharacters);
  const selectCharacter = useChatStore((s) => s.selectCharacter);

  useEffect(() => {
    loadCharacters();
  }, [loadCharacters]);

  if (collapsed) {
    return (
      <div className="space-y-0.5 px-2">
        {characters.map((char) => (
          <button
            key={char.id}
            onClick={() => selectCharacter(char.id)}
            className={`w-full flex items-center justify-center py-2.5 rounded-xl transition-colors ${
              selectedId === char.id ? 'bg-gene-purple/20' : 'hover:bg-white/5'
            }`}
          >
            <span className="text-xl">{char.avatar}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="px-3 pb-2">
      {characters.map((char, i) => (
        <div key={char.id}>
          {i > 0 && <div className="border-t border-white/[0.04] mx-1" />}
          <button
            onClick={() => selectCharacter(char.id)}
            className={`w-full flex items-center gap-3 px-2 py-2.5 rounded-xl text-left transition-colors group ${
              selectedId === char.id ? 'bg-gene-purple/20' : 'hover:bg-white/5'
            }`}
          >
            <span className="text-xl shrink-0">{char.avatar}</span>
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
          </button>
        </div>
      ))}
    </div>
  );
}
