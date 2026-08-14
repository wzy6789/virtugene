import { create } from 'zustand';
import { db, type Character, type Session, type Message } from '../db/index';
import { characterRepo } from '../db/character-repo';
import { sessionRepo } from '../db/session-repo';
import { messageRepo } from '../db/message-repo';
import { memoryRepo } from '../db/memory-repo';
import { emotionRepo } from '../db/emotion-repo';
import { stateRepo } from '../db/state-repo';
import { useAuthStore } from './auth-store';
import { useCharacterStateStore } from './character-state-store';
import { deriveProactivity } from '../lib/personality';
import { ipc } from '../lib/ipc-client';

interface CharPreview {
  content: string;
  createdAt: number;
}

interface ChatState {
  selectedCharacterId: string | null;
  currentSessionId: string | null;
  characters: Character[];
  messages: Message[];
  charPreviews: Record<string, CharPreview | null>;
  unreadByCharacter: Record<string, number>;

  loadCharacters: () => Promise<void>;
  selectCharacter: (id: string) => Promise<void>;
  addMessage: (msg: Message) => void;
  addProactiveMessage: (characterId: string, content: string) => Promise<void>;
  refreshPreviews: () => Promise<void>;
  fetchUnreadCounts: () => Promise<void>;
  createCharacter: (data: Omit<Character, 'id' | 'createdAt' | 'proactivity'>) => Promise<Character>;
  updateCharacter: (id: string, updates: Partial<Character>) => Promise<void>;
  deleteCharacterWithSessions: (id: string) => Promise<void>;
  deleteCharacter: (id: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  triggerProactive: () => Promise<void>;
  reset: () => void;
}

async function getOrCreateSession(characterId: string, userId: string): Promise<Session> {
  const sessions = await sessionRepo.getByCharacter(characterId, userId);
  if (sessions.length > 0) return sessions[0];

  const now = Date.now();
  const session: Session = {
    id: crypto.randomUUID(),
    characterId,
    userId,
    title: '新对话',
    createdAt: now,
    updatedAt: now,
    unreadCount: 0,
  };
  await sessionRepo.create(session);
  return session;
}

async function getLastMessage(characterId: string, userId: string): Promise<CharPreview | null> {
  const sessions = await sessionRepo.getByCharacter(characterId, userId);
  if (sessions.length === 0) return null;
  const msgs = await messageRepo.getBySession(sessions[0].id);
  if (msgs.length === 0) return null;
  const last = msgs[msgs.length - 1];
  return { content: last.content, createdAt: last.createdAt };
}

function proactivityOf(c: Character): number {
  return c.proactivity ?? deriveProactivity(c.tags, c.systemPrompt);
}

/** 按 proactivity² 加权随机选择角色，主动倾向越强越容易被选中 */
function weightedPick(chars: Character[]): Character {
  const weights = chars.map((c) => {
    const p = proactivityOf(c);
    return p * p;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < chars.length; i++) {
    r -= weights[i];
    if (r <= 0) return chars[i];
  }
  return chars[chars.length - 1];
}

export const useChatStore = create<ChatState>((set, get) => ({
  selectedCharacterId: null,
  currentSessionId: null,
  characters: [],
  messages: [],
  charPreviews: {},
  unreadByCharacter: {},

  loadCharacters: async () => {
    const userId = useAuthStore.getState().userId ?? '';
    const all = await characterRepo.getAll();
    // Sidebar shows only presets + own custom characters. Others' published
    // characters are discoverable/clonable in the gene pool, not pushed here.
    const visible = all.filter(
      (c) => c.isPreset || c.createdBy === userId,
    );
    const previews: Record<string, CharPreview | null> = {};
    const unreadCounts: Record<string, number> = {};
    for (const c of visible) {
      previews[c.id] = await getLastMessage(c.id, userId);
      unreadCounts[c.id] = await sessionRepo.getUnreadByCharacter(c.id, userId);
    }
    set({ characters: visible, charPreviews: previews, unreadByCharacter: unreadCounts });
    if (visible.length > 0 && !get().selectedCharacterId) {
      get().selectCharacter(visible[0].id);
    }
  },

  selectCharacter: async (id) => {
    const userId = useAuthStore.getState().userId ?? '';
    const session = await getOrCreateSession(id, userId);
    const msgs = await messageRepo.getBySession(session.id);
    // Clear unread for this character (user's own sessions only)
    const sessions = await sessionRepo.getByCharacter(id, userId);
    for (const s of sessions) {
      await sessionRepo.clearUnread(s.id);
    }
    const { unreadByCharacter } = get();
    unreadByCharacter[id] = 0;
    set({ selectedCharacterId: id, currentSessionId: session.id, messages: msgs, unreadByCharacter: { ...unreadByCharacter } });
  },

  addMessage: (msg) => {
    // 用户主动发言会拉近关系、提振角色心情
    if (msg.role === 'user') {
      const { selectedCharacterId } = get();
      if (selectedCharacterId) {
        void useCharacterStateStore.getState().bump(selectedCharacterId, 1, 2);
      }
    }
    set((s) => ({
      messages: [...s.messages, msg],
      charPreviews: {
        ...s.charPreviews,
        [s.selectedCharacterId!]: { content: msg.content, createdAt: msg.createdAt },
      },
    }));
  },

  addProactiveMessage: async (characterId, content) => {
    const userId = useAuthStore.getState().userId ?? '';
    const session = await getOrCreateSession(characterId, userId);
    const msg: Message = {
      id: crypto.randomUUID(),
      sessionId: session.id,
      role: 'assistant',
      content,
      createdAt: Date.now(),
      isProactive: true,
    };
    await messageRepo.create(msg);
    await sessionRepo.incrementUnread(session.id);
    await sessionRepo.touch(session.id);

    const { selectedCharacterId, unreadByCharacter } = get();
    // If this character is currently selected, add to message list
    if (selectedCharacterId === characterId) {
      set((s) => ({
        messages: [...s.messages, msg],
        charPreviews: {
          ...s.charPreviews,
          [characterId]: { content, createdAt: msg.createdAt },
        },
      }));
    } else {
      // Just update preview and unread count
      const count = (unreadByCharacter[characterId] ?? 0) + 1;
      set({
        charPreviews: {
          ...get().charPreviews,
          [characterId]: { content, createdAt: msg.createdAt },
        },
        unreadByCharacter: { ...unreadByCharacter, [characterId]: count },
      });
    }
  },

  fetchUnreadCounts: async () => {
    const { characters } = get();
    const userId = useAuthStore.getState().userId ?? '';
    const counts: Record<string, number> = {};
    for (const c of characters) {
      counts[c.id] = await sessionRepo.getUnreadByCharacter(c.id, userId);
    }
    set({ unreadByCharacter: counts });
  },

  triggerProactive: async () => {
    const { characters } = get();
    const apiKey = useAuthStore.getState().apiKey;
    const userId = useAuthStore.getState().userId ?? '';
    if (!apiKey || characters.length === 0) return;

    // 只有主动倾向足够强的角色才会主动发消息（冰冷角色不会）
    const eligible = characters.filter((c) => proactivityOf(c) >= 0.15);
    if (eligible.length === 0) return;

    // 按 proactivity² 加权选择目标角色；50% 偏向当前选中角色
    const selectedId = get().selectedCharacterId;
    let targetChar: Character;
    if (selectedId && Math.random() < 0.5) {
      targetChar = eligible.find((c) => c.id === selectedId) ?? weightedPick(eligible);
    } else {
      targetChar = weightedPick(eligible);
    }

    try {
      // Get recent messages for context
      const session = await getOrCreateSession(targetChar.id, userId);
      const msgs = await messageRepo.getBySession(session.id);

      // 上一条主动消息未被回应 → 好感度/心情下滑
      const last = msgs[msgs.length - 1];
      if (last && last.isProactive) {
        await useCharacterStateStore.getState().bump(targetChar.id, -3, -5);
      }

      // 读取最新关系状态，注入主动消息语气
      const state = await stateRepo.getOrCreate(targetChar.id, userId);

      const lastMessages = msgs.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const result = await ipc.proactive.generate({
        apiKey,
        systemPrompt: targetChar.systemPrompt,
        characterName: targetChar.name,
        lastMessages,
        affinity: state.affinity,
        mood: state.mood,
      });

      if (result.content) {
        await get().addProactiveMessage(targetChar.id, result.content);
        console.log(`[proactive] ${targetChar.name} sent a proactive message`);
      } else if (result.error) {
        console.warn('[proactive] generate error:', result.error);
      }
    } catch (err) {
      console.warn('[proactive] unexpected error:', err);
    }
  },

  refreshPreviews: async () => {
    const { characters } = get();
    const userId = useAuthStore.getState().userId ?? '';
    const previews: Record<string, CharPreview | null> = {};
    for (const c of characters) {
      previews[c.id] = await getLastMessage(c.id, userId);
    }
    set({ charPreviews: previews });
  },

  createCharacter: async (data) => {
    const now = Date.now();
    const userId = useAuthStore.getState().userId ?? '';
    const character: Character = {
      ...data,
      id: crypto.randomUUID(),
      published: (data as any).published ?? false,
      createdBy: userId,
      proactivity: deriveProactivity(data.tags ?? [], data.systemPrompt ?? ''),
      createdAt: now,
    };
    await characterRepo.create(character);
    await get().loadCharacters();
    get().selectCharacter(character.id);
    return character;
  },

  updateCharacter: async (id, updates) => {
    const userId = useAuthStore.getState().userId ?? '';
    const char = await characterRepo.getById(id);
    if (!char || char.isPreset || char.createdBy !== userId) return;
    const nextUpdates: Partial<Character> = { ...updates };
    if (updates.systemPrompt !== undefined || updates.tags !== undefined) {
      nextUpdates.proactivity = deriveProactivity(
        updates.tags ?? char.tags,
        updates.systemPrompt ?? char.systemPrompt,
      );
    }
    await characterRepo.update(id, nextUpdates);
    await get().loadCharacters();
  },

  deleteCharacter: async (id) => {
    const userId = useAuthStore.getState().userId ?? '';
    const char = await characterRepo.getById(id);
    if (!char || char.isPreset || char.createdBy !== userId) return;
    await get().deleteCharacterWithSessions(id);
  },

  deleteCharacterWithSessions: async (id) => {
    const userId = useAuthStore.getState().userId ?? '';
    const sessions = await sessionRepo.getByCharacter(id, userId);
    for (const s of sessions) {
      await emotionRepo.deleteBySession(s.id);
      await sessionRepo.deleteById(s.id);
    }
    await characterRepo.deleteById(id);
    await memoryRepo.clearForCharacter(id, userId);
    await stateRepo.deleteByCharacter(id, userId);

    const { selectedCharacterId } = get();
    const all = await characterRepo.getAll();
    const visible = all.filter(
      (c) => c.isPreset || c.createdBy === userId,
    );
    const previews: Record<string, CharPreview | null> = {};
    for (const c of visible) {
      previews[c.id] = await getLastMessage(c.id, userId);
    }
    set({ characters: visible, charPreviews: previews });

    if (selectedCharacterId === id) {
      if (visible.length > 0) {
        get().selectCharacter(visible[0].id);
      } else {
        set({ selectedCharacterId: null, currentSessionId: null, messages: [] });
      }
    }
  },

  deleteAccount: async () => {
    const userId = useAuthStore.getState().userId ?? '';

    // Delete this user's sessions along with their messages + emotion snapshots
    const sessions = await db.sessions.where('userId').equals(userId).toArray();
    for (const s of sessions) {
      await emotionRepo.deleteBySession(s.id);
      await sessionRepo.deleteById(s.id);
    }

    // Delete this user's memories, relationship state, and custom characters
    await db.memories.where('userId').equals(userId).delete();
    const states = await db.characterStates.toArray();
    for (const st of states) {
      if (st.userId === userId) {
        await db.characterStates.delete([st.characterId, st.userId]);
      }
    }
    await db.characters.where('createdBy').equals(userId).delete();
    await db.users.delete(userId);

    set({
      selectedCharacterId: null,
      currentSessionId: null,
      characters: [],
      messages: [],
      charPreviews: {},
      unreadByCharacter: {},
    });
  },

  reset: () => {
    set({
      selectedCharacterId: null,
      currentSessionId: null,
      characters: [],
      messages: [],
      charPreviews: {},
      unreadByCharacter: {},
    });
  },
}));
