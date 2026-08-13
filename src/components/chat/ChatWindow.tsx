import { Fragment, useEffect, useRef, useState } from 'react';
import { useChatStore } from '../../store/chat-store';
import { useAuthStore } from '../../store/auth-store';
import { MessageBubble } from './MessageBubble';
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
  const apiKey = useAuthStore((s) => s.apiKey);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<ChatInputHandle>(null);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<ChatError>(null);

  const character = characters.find((c) => c.id === selectedCharacterId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (text: string) => {
    const sessionId = currentSessionId;
    if (!sessionId || !character || !apiKey) return;

    setError(null);

    // Save user message
    const userMsg: Message = {
      id: crypto.randomUUID(),
      sessionId,
      role: 'user',
      content: text,
      createdAt: Date.now(),
      isProactive: false,
    };
    await messageRepo.create(userMsg);
    addMessage(userMsg);
    await sessionRepo.touch(sessionId);

    // Build history from last messages
    const allMsgs = useChatStore.getState().messages;
    const history = allMsgs.slice(-20).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Inject character memories into system prompt
    const memories = await memoryRepo.getByCharacter(character.id);
    const memoryContext = memories.length > 0
      ? '\n\n[关于用户的长期记忆]\n' + memories.map((m) => `- ${m.content}`).join('\n')
      : '';

    // Inject relationship state (affinity/mood) so it shapes the reply tone
    const state = await stateRepo.getOrCreate(character.id);
    const relationshipContext =
      `\n\n[当前关系状态]\n用户与你的好感度：${Math.round(state.affinity)}/100，你此刻的心情：${Math.round(state.mood)}/100。` +
      '让这两个数值自然影响你的语气：好感度越高越亲近温和，越低越疏离防备；心情越高越轻快，越低越低落或易烦。不要直接说出这些数字。';

    const enrichedPrompt = character.systemPrompt + memoryContext + relationshipContext;

    // Call DeepSeek
    setSending(true);
    try {
      const result = await ipc.chat.send({
        apiKey,
        systemPrompt: enrichedPrompt,
        message: text,
        history,
      });

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
      <div className="flex-1 overflow-y-auto px-4 py-3" onClick={() => inputRef.current?.focus()}>
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-xs text-gray-600">发送消息开始对话</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const prev = messages[i - 1];
            const showDivider = !prev || (msg.createdAt - prev.createdAt) > FIVE_MINUTES;
            return (
              <Fragment key={msg.id}>
                {showDivider && (
                  <div className="flex justify-center my-3">
                    <span className="text-xs text-gray-500 bg-panel px-3 py-0.5 rounded-full">
                      {formatTimeLabel(msg.createdAt)}
                    </span>
                  </div>
                )}
                <MessageBubble message={msg} />
              </Fragment>
            );
          })
        )}
        {sending && (
          <div className="flex justify-start mb-4">
            <div className="bg-msgai text-gray-400 text-sm px-4 py-3 rounded-2xl rounded-bl-md border-l-2 border-life-cyan">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <BalanceBanner error={error} />
      <ChatInput ref={inputRef} onSend={handleSend} disabled={sending} />
    </div>
  );
}
