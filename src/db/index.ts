import Dexie, { type Table } from 'dexie';

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  passwordSalt: string;
  apiKeyIv: string;
  apiKeyCiphertext: string;
  createdAt: number;
}

export interface Character {
  id: string;
  name: string;
  avatar: string;
  systemPrompt: string;
  tags: string[];
  isPreset: boolean;
  isCustom: boolean;
  createdAt: number;
}

export interface Session {
  id: string;
  characterId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
}

export class VirtuGeneDB extends Dexie {
  users!: Table<User, string>;
  characters!: Table<Character, string>;
  sessions!: Table<Session, string>;
  messages!: Table<Message, string>;

  constructor() {
    super('virtugene');
    this.version(1).stores({
      users: 'id,username',
      characters: 'id,isPreset',
    });
    this.version(2).stores({
      users: 'id,username',
      characters: 'id,isPreset',
      sessions: 'id,characterId,updatedAt',
      messages: 'id,sessionId,createdAt',
    });
  }
}

export const db = new VirtuGeneDB();
