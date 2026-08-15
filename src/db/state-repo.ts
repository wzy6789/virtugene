import { db, type CharacterState, type RelationMilestone } from './index';
import { getRelationLevel } from '../lib/affinity';

const DEFAULT_AFFINITY = 0;
const DEFAULT_MOOD = 70;

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export const stateRepo = {
  async get(characterId: string, userId: string): Promise<CharacterState | undefined> {
    return db.characterStates.get([characterId, userId]);
  },

  async getAllByUser(userId: string): Promise<CharacterState[]> {
    return db.characterStates.where('userId').equals(userId).toArray();
  },

  async getOrCreate(characterId: string, userId: string): Promise<CharacterState> {
    const existing = await db.characterStates.get([characterId, userId]);
    if (existing) return existing;
    const state: CharacterState = {
      characterId,
      userId,
      affinity: DEFAULT_AFFINITY,
      mood: DEFAULT_MOOD,
      milestones: [],
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

  /** 好感度结算：应用 delta 与心情，检测等级升级并追加里程碑 */
  async settle(
    characterId: string,
    userId: string,
    dAffinity: number,
    moodValue: number,
  ): Promise<{ state: CharacterState; upgraded: { level: string; prevLevel: string } | null }> {
    const state = await stateRepo.getOrCreate(characterId, userId);
    const oldLevel = getRelationLevel(state.affinity);
    const newAffinity = clamp(state.affinity + dAffinity);
    const newLevel = getRelationLevel(newAffinity);

    let milestones = state.milestones ?? [];
    let upgraded: { level: string; prevLevel: string } | null = null;
    if (newLevel.index > oldLevel.index) {
      const m: RelationMilestone = { level: newLevel.level.name, reachedAt: Date.now() };
      milestones = [...milestones, m];
      upgraded = { level: newLevel.level.name, prevLevel: oldLevel.level.name };
    }

    const next: CharacterState = {
      ...state,
      affinity: newAffinity,
      mood: clamp(moodValue),
      milestones,
      updatedAt: Date.now(),
    };
    await db.characterStates.put(next);
    return { state: next, upgraded };
  },

  async deleteByCharacter(characterId: string, userId: string): Promise<void> {
    await db.characterStates.delete([characterId, userId]);
  },
};
