import { db, type MemoryItem } from './index';

const MAX_MEMORIES_PER_CHAR = 30;

export const memoryRepo = {
  async getByCharacter(characterId: string): Promise<MemoryItem[]> {
    return db.memories
      .where('characterId')
      .equals(characterId)
      .sortBy('createdAt');
  },

  async create(memory: MemoryItem): Promise<string> {
    return db.memories.add(memory);
  },

  async createMany(memories: MemoryItem[]): Promise<string[]> {
    // Trim oldest if exceeding limit
    for (const m of memories) {
      const existing = await db.memories
        .where('characterId')
        .equals(m.characterId)
        .count();
      if (existing >= MAX_MEMORIES_PER_CHAR) {
        const oldest = await db.memories
          .where('characterId')
          .equals(m.characterId)
          .sortBy('createdAt');
        // Delete oldest entries to make room
        const toDelete = oldest.slice(0, existing - MAX_MEMORIES_PER_CHAR + 1);
        for (const d of toDelete) {
          await db.memories.delete(d.id);
        }
      }
    }
    const ids: string[] = [];
    for (const m of memories) {
      ids.push(await db.memories.add(m));
    }
    return ids;
  },

  async deleteOld(characterId: string, beforeTs: number): Promise<void> {
    const old = await db.memories
      .where('characterId')
      .equals(characterId)
      .and((m) => m.createdAt < beforeTs)
      .toArray();
    for (const m of old) {
      await db.memories.delete(m.id);
    }
  },

  async clearForCharacter(characterId: string): Promise<void> {
    await db.memories.where('characterId').equals(characterId).delete();
  },

  async countByCharacter(characterId: string): Promise<number> {
    return db.memories.where('characterId').equals(characterId).count();
  },
};
