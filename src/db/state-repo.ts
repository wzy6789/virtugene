import { db, type CharacterState } from './index';

const DEFAULT_AFFINITY = 60;
const DEFAULT_MOOD = 70;

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export const stateRepo = {
  async get(characterId: string, userId: string): Promise<CharacterState | undefined> {
    return db.characterStates.get([characterId, userId]);
  },

  async getOrCreate(characterId: string, userId: string): Promise<CharacterState> {
    const existing = await db.characterStates.get([characterId, userId]);
    if (existing) return existing;
    const state: CharacterState = {
      characterId,
      userId,
      affinity: DEFAULT_AFFINITY,
      mood: DEFAULT_MOOD,
      updatedAt: Date.now(),
    };
    await db.characterStates.put(state);
    return state;
  },

  async adjust(characterId: string, userId: string, dAffinity: number, dMood: number): Promise<CharacterState> {
    const state = await stateRepo.getOrCreate(characterId, userId);
    const next: CharacterState = {
      ...state,
      affinity: clamp(state.affinity + dAffinity),
      mood: clamp(state.mood + dMood),
      updatedAt: Date.now(),
    };
    await db.characterStates.put(next);
    return next;
  },

  async deleteByCharacter(characterId: string, userId: string): Promise<void> {
    await db.characterStates.delete([characterId, userId]);
  },
};
