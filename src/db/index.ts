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

export class VirtuGeneDB extends Dexie {
  users!: Table<User, string>;
  characters!: Table<Character, string>;

  constructor() {
    super('virtugene');
    this.version(1).stores({
      users: 'id,username',
      characters: 'id,isPreset',
    });
  }
}

export const db = new VirtuGeneDB();
