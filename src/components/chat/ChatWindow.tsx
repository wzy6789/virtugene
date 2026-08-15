import { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useChatStore } from '../../store/chat-store';
import { useAuthStore, DEFAULT_USER_AVATAR } from '../../store/auth-store';
import { useEmotionStore } from '../../store/emotion-store';
import { MessageBubble } from './MessageBubble';
import { Avatar } from '../ui/Avatar';
import { ChatInput } from './ChatInput';
import type { ChatInputHandle } from './ChatInput';
import { BalanceBanner, type ChatError } from './BalanceBanner';
import { messageRepo } from '../../db/message-repo';
import { sessionRepo } from '../../db/session-repo';
import { memoryRepo } from '../../db/memory-repo';
import { stateRepo } from '../../db/state-repo';
import { ipc } from '../../lib/ipc-client';
import type { Message, MemoryItem } from '../../db/index';

const FIVE_MINUTES = 5 * 60 * 1000;

function formatTimeLabel(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  if (msgDay.getTime() === today.getTime()) return time;
  if (msgDay.getTime() === yesterday.getTime()) return `昨天 ${time}`;
  if (now.getTime() - ts < 7 * 86400000) {
    const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    return `${days[d.getDay()]} ${time}`;
  }
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${time}`;
}

interface ChatWindowProps {
  emotionToggle?: React.ReactNode;
}

export function ChatWindow({ emotionToggle }: ChatWindowProps) {
  const messages = useChatStore((s) => s.messages);
  const currentSessionId = useChatStore((s) => s.currentSessionId);
  const selectedCharacterId = useChatStore((s) => s.selectedCharacterId);
  const characters = useChatStore((s) => s.characters);
  const addMessage = useChatStore((s) => s.addMessage);
  const deleteMessage = useChatStore((s) => s.deleteMessage);
  const apiKey = useAuthStore((s) => s.apiKey);
  const userId = useAuthStore((s) => s.userId) ?? '';
  const userAvatar = useAuthStore((s) => s.avatar) ?? DEFAULT_USER_AVATAR;
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<ChatInputHandle>(null);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<ChatError>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  const character = characters.find((c) => c.id === selectedCharacterId);

  // Clear the reply banner when switching conversations
  useEffect(() => {
    setReplyingTo(null);
  }, [currentSessionId]);

  // Focus the input when switching characters so the user can type immediately
  useEffect(() => {
    inputRef.current?.focus();
  }, [selectedCharacterId]);

  // Re-focus after sending finishes so the user can keep typing without clicking
  useEffect(() => {
    if (!sending) inputRef.current?.focus();
  }, [sending]);

  const rows = useMemo(() => {
    const result: { key: string; divider: string | null; message: Message; avatar: string }[] = [];
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const prev = messages[i - 1];
      const showDivider = !prev || msg.createdAt - prev.createdAt > FIVE_MINUTES;
      result.push({
        key: msg.id,
        divider: showDivider ? formatTimeLabel(msg.createdAt) : null,
        message: msg,
        avatar: msg.role === 'user' ? userAvatar : character?.avatar ?? '🧬',
      });
    }
    return result;
  }, [messages, userAvatar, character]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 72,
    overscan: 8,
    getItemKey: (index) => rows[index].key,
  });

  // Keep pinned to the bottom on new messages / session switch
  useEffect(() => {
    if (rows.length === 0) return;
    const el = scrollRef.current;
    if (!el) return;
    const scrollToBottom = () => {
      el.scrollTop = el.scrollHeight;
    };
    scrollToBottom();
    const raf = requestAnimationFrame(scrollToBottom);
    return () => cancelAnimationFrame(raf);
  }, [rows.length]);

  const handleSend = async (text: string) => {
    const sessionId = currentSessionId;
    if (!sessionId || !character || !apiKey) return;

    setError(null);

    const replyTarget = replyingTo;
    const apiMessage = replyTarget
      ? `（你在引用这条消息：「${replyTarget.content}」）\n${text}`
      : text;

    // Save user message
    const userMsg: Message = {
      id: crypto.randomUUID(),
      sessionId,
      role: 'user',
      content: text,
      createdAt: Date.now(),
      isProactive: false,
      ...(replyTarget ? { replyToId: replyTarget.id, replyToContent: replyTarget.content } : {}),
    };
    await messageRepo.create(userMsg);
    addMessage(userMsg);
    await sessionRepo.touch(sessionId);
    setReplyingTo(null);

    // Build history from last messages
    const allMsgs = useChatStore.getState().messages;
    const history = allMsgs.slice(-20).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Inject character memories into system prompt
    const memories = await memoryRepo.getByCharacter(character.id, userId);
    const memoryContext = memories.length > 0
      ? '\n\n[关于用户的长期记忆]\n' + memories.map((m) => `- ${m.content}`).join('\n')
      : '';

    // Inject relationship state (affinity/mood) so it shapes the reply tone
    const state = await stateRepo.getOrCreate(character.id, userId);
    const relationshipContext =
      `\n\n[当前关系状态]\n用户与你的好感度：${Math.round(state.affinity)}/100，你此刻的心情：${Math.round(state.mood)}/100。` +
      '让这两个数值自然影响你的语气：好感度越高越亲近温和，越低越疏离防备；心情越高越轻快，越低越低落或易烦。不要直接说出这些数字。';

    const enrichedPrompt = character.systemPrompt + memoryContext + relationshipContext;

    // Call DeepSeek
    const startedAt = Date.now();
    setSending(true);
    try {
      const result = await ipc.chat.send({
        apiKey,
        systemPrompt: enrichedPrompt,
        message: apiMessage,
        history,
      });

      // 保证「对方正在输入…」至少展示约 0.7s，避免秒回一闪而过
      const elapsed = Date.now() - startedAt;
      if (elapsed < 700) {
        await new Promise((r) => setTimeout(r, 700 - elapsed));
      }

      if (result.error) {
        setError(result.error as ChatError);
        // 402 doesn't block sending, other errors are transient
      } else if (result.content) {
        // Split multi-message responses on "---"
        const parts = result.content.split('---').map((p: string) => p.trim()).filter((p: string) => p.length > 0);
        for (let i = 0; i < parts.length; i++) {
          const aiMsg: Message = {
            id: crypto.randomUUID(),
            sessionId,
            role: 'assistant',
            content: parts[i],
            createdAt: Date.now() + i, // ensure unique timestamps for ordering
            isProactive: false,
          };
          await messageRepo.create(aiMsg);
          addMessage(aiMsg);
        }
        await sessionRepo.touch(sessionId);

        // Trigger memory consolidation every ~10 user messages
        const userMsgCount = allMsgs.filter((m) => m.role === 'user').length + 1; // +1 for the just-sent message
        if (userMsgCount > 0 && userMsgCount % 10 === 0) {
          consolidateMemories(sessionId, character.id);
        }

        // Trigger relationship settlement every 3 user messages
        const settledCount = allMsgs.filter((m) => m.role === 'user').length;
        if (settledCount > 0 && settledCount % 3 === 0) {
          void useEmotionStore.getState().settle(character.id, sessionId, character.name);
        }
      }
    } catch {
      setError('server:error');
    } finally {
      setSending(false);
    }
  };

  // Fire-and-forget memory consolidation
  const consolidateMemories = async (sessionId: string, characterId: string) => {
    if (!apiKey) return;
    try {
      const msgs = await messageRepo.getBySession(sessionId);
      // Only consolidate if there are enough messages
      if (msgs.length < 20) return;
      const history = msgs.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const result = await ipc.memory.extract({ apiKey, history });
      if (result.memories && result.memories.length > 0) {
        const now = Date.now();
        const items: MemoryItem[] = result.memories.map((content: string) => ({
          id: crypto.randomUUID(),
          characterId,
          userId,
          content,
          type: 'auto' as const,
          createdAt: now,
        }));
        await memoryRepo.createMany(items);
      }
    } catch {
      // Silently fail — memory consolidation is best-effort
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="h-12 flex items-center px-4 border-b border-line shrink-0">
        {character && (
          <div className="flex items-center gap-2">
            {character.avatar.startsWith('data:') ? (
              <img src={character.avatar} alt={character.name} className="w-7 h-7 rounded-lg object-cover" />
            ) : (
              <span className="text-lg">{character.avatar}</span>
            )}
            <span className="text-sm font-medium text-ink">{character.name}</span>
          </div>
        )}
        <div className="flex-1" />
        {emotionToggle}
      </div>

      {/* Messages — click anywhere to focus input, like WeChat */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3" onClick={() => inputRef.current?.focus()}>
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-xs text-gray-600">发送消息开始对话</p>
          </div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
            {virtualizer.getVirtualItems().map((vi) => {
              const row = rows[vi.index];
              return (
                <div
                  key={row.key}
                  data-index={vi.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${vi.start}px)`,
                  }}
                >
                  {row.divider && (
                    <div className="flex justify-center my-3">
                      <span className="text-xs text-gray-500 bg-panel px-3 py-0.5 rounded-full">
                        {row.divider}
                      </span>
                    </div>
                  )}
                  <MessageBubble
                    message={row.message}
                    avatar={row.avatar}
                    animate={Date.now() - row.message.createdAt < 800}
                    onQuote={setReplyingTo}
                    onDelete={(m) => void deleteMessage(m.id)}
                  />
                </div>
              );
            })}
          </div>
        )}
        {sending && (
          <div className="flex items-start gap-2 mb-4 animate-message-in">
            <Avatar avatar={character?.avatar ?? '🧬'} size="sm" />
            <div className="bg-msgai text-gray-400 text-sm px-4 py-3 rounded-2xl rounded-bl-md border-l-2 border-life-cyan flex items-center gap-1.5">
              <span>对方正在输入</span>
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}
      </div>

      <BalanceBanner error={error} />

      {/* Reply banner */}
      {replyingTo && (
        <div className="flex items-center gap-2 px-4 py-2 border-t border-line bg-panel">
          <span className="text-xs text-life-cyan">引用</span>
          <span className="text-xs text-gray-500 flex-1 truncate">{replyingTo.content}</span>
          <button
            onClick={() => setReplyingTo(null)}
            className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-ink hover:bg-surface transition-colors"
            title="取消引用"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <ChatInput ref={inputRef} onSend={handleSend} disabled={sending} />
    </div>
  );
}
