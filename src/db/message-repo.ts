import { db, type Message } from './index';

export const messageRepo = {
  async getBySession(sessionId: string): Promise<Message[]> {
    return db.messages
      .where('sessionId')
      .equals(sessionId)
      .sortBy('createdAt');
  },

  async create(message: Message): Promise<string> {
    return db.messages.add(message);
  },

  async deleteBySession(sessionId: string): Promise<void> {
    await db.messages.where('sessionId').equals(sessionId).delete();
  },
};
