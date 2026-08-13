import { create } from 'zustand';
import { stateRepo } from '../db/state-repo';
import { useAuthStore } from './auth-store';

interface CharacterStateState {
  characterId: string | null;
  affinity: number;
  mood: number;
  load: (characterId: string) => Promise<void>;
  /** 调整好感度/心情；若目标角色正是当前展示的角色，则同步更新 store */
  bump: (characterId: string, dAffinity: number, dMood: number) => Promise<void>;
  clear: () => void;
}

export const useCharacterStateStore = create<CharacterStateState>((set, get) => ({
  characterId: null,
  affinity: 60,
  mood: 70,

  load: async (characterId) => {
    const userId = useAuthStore.getState().userId ?? '';
    const state = await stateRepo.getOrCreate(characterId, userId);
    set({ characterId, affinity: state.affinity, mood: state.mood });
  },

  bump: async (characterId, dAffinity, dMood) => {
    const userId = useAuthStore.getState().userId ?? '';
    const state = await stateRepo.adjust(characterId, userId, dAffinity, dMood);
    if (get().characterId === characterId) {
      set({ affinity: state.affinity, mood: state.mood });
    }
  },

  clear: () => set({ characterId: null, affinity: 60, mood: 70 }),
}));
