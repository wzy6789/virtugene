import { db, type Session } from './index';

export const sessionRepo = {
  async getByCharacter(characterId: string): Promise<Session[]> {
    return db.sessions
      .where('characterId')
      .equals(characterId)
      .reverse()
      .sortBy('updatedAt');
  },

  async getById(id: string): Promise<Session | undefined> {
    return db.sessions.get(id);
  },

  async create(session: Session): Promise<string> {
    return db.sessions.add(session);
  },

  async updateTitle(id: string, title: string): Promise<number> {
    return db.sessions.update(id, { title, updatedAt: Date.now() });
  },

  async touch(id: string): Promise<number> {
    return db.sessions.update(id, { updatedAt: Date.now() });
  },

  async deleteById(id: string): Promise<void> {
    await db.sessions.delete(id);
    await db.messages.where('sessionId').equals(id).delete();
  },
};
