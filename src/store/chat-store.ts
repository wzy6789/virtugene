import { create } from 'zustand';
import type { Character, Session, Message } from '../db/index';
import { characterRepo } from '../db/character-repo';
import { sessionRepo } from '../db/session-repo';
import { messageRepo } from '../db/message-repo';

interface ChatState {
  selectedCharacterId: string | null;
  currentSessionId: string | null;
  characters: Character[];
  sessions: Session[];
  messages: Message[];

  loadCharacters: () => Promise<void>;
  selectCharacter: (id: string) => Promise<void>;
  createSession: (characterId: string) => Promise<string>;
  selectSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  renameSession: (id: string, title: string) => Promise<void>;
  addMessage: (msg: Message) => void;
  setMessages: (msgs: Message[]) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  selectedCharacterId: null,
  currentSessionId: null,
  characters: [],
  sessions: [],
  messages: [],

  loadCharacters: async () => {
    const characters = await characterRepo.getAll();
    set({ characters });
    if (characters.length > 0 && !get().selectedCharacterId) {
      set({ selectedCharacterId: characters[0].id });
    }
  },

  selectCharacter: async (id) => {
    set({ selectedCharacterId: id, currentSessionId: null, messages: [] });
    const sessions = await sessionRepo.getByCharacter(id);
    set({ sessions });

    // Auto-select most recent session or create one
    if (sessions.length > 0) {
      const msgs = await messageRepo.getBySession(sessions[0].id);
      set({ currentSessionId: sessions[0].id, messages: msgs });
    }
  },

  createSession: async (characterId) => {
    const id = crypto.randomUUID();
    const now = Date.now();
    const session: Session = {
      id,
      characterId,
      title: '新对话',
      createdAt: now,
      updatedAt: now,
    };
    await sessionRepo.create(session);
    const sessions = await sessionRepo.getByCharacter(characterId);
    set({ sessions, currentSessionId: id, messages: [] });
    return id;
  },

  selectSession: async (id) => {
    set({ currentSessionId: id });
    const msgs = await messageRepo.getBySession(id);
    set({ messages: msgs });
  },

  deleteSession: async (id) => {
    await sessionRepo.deleteById(id);
    const { selectedCharacterId, currentSessionId } = get();
    if (currentSessionId === id) {
      set({ currentSessionId: null, messages: [] });
    }
    if (selectedCharacterId) {
      const sessions = await sessionRepo.getByCharacter(selectedCharacterId);
      set({ sessions });
    }
  },

  renameSession: async (id, title) => {
    await sessionRepo.updateTitle(id, title);
    const { selectedCharacterId } = get();
    if (selectedCharacterId) {
      const sessions = await sessionRepo.getByCharacter(selectedCharacterId);
      set({ sessions });
    }
  },

  addMessage: (msg) => {
    set((s) => ({ messages: [...s.messages, msg] }));
  },

  setMessages: (msgs) => {
    set({ messages: msgs });
  },
}));
