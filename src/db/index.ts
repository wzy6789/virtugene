import Dexie, { type Table } from 'dexie';

export interface User {
  id: string;
  username: string;
  avatar?: string;
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
  published: boolean;
  createdBy: string;
  createdAt: number;
  /** 主动倾向 0-1，决定该角色是否会主动发消息及频率 */
  proactivity: number;
}

export interface CharacterState {
  characterId: string;
  userId: string;
  affinity: number;
  mood: number;
  updatedAt: number;
}

export interface Session {
  id: string;
  characterId: string;
  userId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  unreadCount: number;
}

export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  isProactive: boolean;
}

export interface MemoryItem {
  id: string;
  characterId: string;
  userId: string;
  content: string;
  type: 'auto' | 'summary';
  createdAt: number;
}

export interface EmotionDimensions {
  valence: number;
  arousal: number;
  intimacy: number;
  engagement: number;
  expressiveness: number;
  stability: number;
}

export interface EmotionSnapshot {
  id: string;
  characterId: string;
  sessionId: string;
  dimensions: EmotionDimensions;
  dominantEmotion: string;
  summary: string;
  messageCount: number;
  createdAt: number;
}

export class VirtuGeneDB extends Dexie {
  users!: Table<User, string>;
  characters!: Table<Character, string>;
  sessions!: Table<Session, string>;
  messages!: Table<Message, string>;
  memories!: Table<MemoryItem, string>;
  emotionSnapshots!: Table<EmotionSnapshot, string>;
  characterStates!: Table<CharacterState, [string, string]>;

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
    this.version(3).stores({
      users: 'id,username',
      characters: 'id,isPreset,published,createdBy',
      sessions: 'id,characterId,updatedAt',
      messages: 'id,sessionId,createdAt',
    }).upgrade(async (tx) => {
      await tx.table('characters').toCollection().modify((char) => {
        char.published = char.published ?? false;
        char.createdBy = char.createdBy ?? '';
      });
    });
    this.version(4).stores({
      users: 'id,username',
      characters: 'id,isPreset,published,createdBy',
      sessions: 'id,characterId,updatedAt',
      messages: 'id,sessionId,createdAt',
    }).upgrade(async (tx) => {
      await tx.table('sessions').toCollection().modify((s) => {
        s.unreadCount = s.unreadCount ?? 0;
      });
      await tx.table('messages').toCollection().modify((m) => {
        m.isProactive = m.isProactive ?? false;
      });
    });
    this.version(5).stores({
      users: 'id,username',
      characters: 'id,isPreset,published,createdBy',
      sessions: 'id,characterId,updatedAt',
      messages: 'id,sessionId,createdAt',
      memories: 'id,characterId,createdAt',
    });
    this.version(6).stores({
      users: 'id,username',
      characters: 'id,isPreset,published,createdBy',
      sessions: 'id,characterId,updatedAt',
      messages: 'id,sessionId,createdAt',
      memories: 'id,characterId,createdAt',
      emotionSnapshots: 'id,sessionId,characterId,createdAt',
    });
    this.version(7).stores({
      users: 'id,username',
      characters: 'id,isPreset,published,createdBy',
      sessions: 'id,characterId,updatedAt',
      messages: 'id,sessionId,createdAt',
      memories: 'id,characterId,createdAt',
      emotionSnapshots: 'id,sessionId,characterId,createdAt',
      characterStates: 'characterId',
    }).upgrade(async (tx) => {
      await tx.table('characters').toCollection().modify((char) => {
        char.proactivity = char.proactivity ?? 0.5;
      });
    });
    this.version(8).stores({
      users: 'id,username',
      characters: 'id,isPreset,published,createdBy',
      sessions: 'id,characterId,userId,updatedAt',
      messages: 'id,sessionId,createdAt',
      memories: 'id,characterId,userId,createdAt',
      emotionSnapshots: 'id,sessionId,characterId,createdAt',
      characterStates: 'characterId',
    }).upgrade(async (tx) => {
      // Pre-multi-user data has no userId and cannot be attributed to any account.
      // Clear conversation-scoped data once; users and characters are preserved.
      await tx.table('sessions').clear();
      await tx.table('messages').clear();
      await tx.table('memories').clear();
      await tx.table('emotionSnapshots').clear();
      await tx.table('characterStates').clear();
    });
    this.version(9).stores({
      users: 'id,username',
      characters: 'id,isPreset,published,createdBy',
      sessions: 'id,characterId,userId,updatedAt',
      messages: 'id,sessionId,createdAt',
      memories: 'id,characterId,userId,createdAt',
      emotionSnapshots: 'id,sessionId,characterId,createdAt',
      characterStates: '[characterId+userId]',
    });
  }
}

export const db = new VirtuGeneDB();
