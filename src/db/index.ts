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

export class VirtuGeneDB extends Dexie {
  users!: Table<User, string>;

  constructor() {
    super('virtugene');
    this.version(1).stores({
      users: 'id,username',
    });
  }
}

export const db = new VirtuGeneDB();
