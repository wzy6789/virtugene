import { useEffect, useRef } from 'react';
import { useChatStore } from '../../store/chat-store';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { messageRepo } from '../../db/message-repo';
import { sessionRepo } from '../../db/session-repo';
import type { Message } from '../../db/index';

export function ChatWindow() {
  const messages = useChatStore((s) => s.messages);
  const currentSessionId = useChatStore((s) => s.currentSessionId);
  const selectedCharacterId = useChatStore((s) => s.selectedCharacterId);
  const createSession = useChatStore((s) => s.createSession);
  const addMessage = useChatStore((s) => s.addMessage);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (text: string) => {
    let sessionId = currentSessionId;
    if (!sessionId && selectedCharacterId) {
      sessionId = await createSession(selectedCharacterId);
    }
    if (!sessionId) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      sessionId,
      role: 'user',
      content: text,
      createdAt: Date.now(),
    };
    await messageRepo.create(userMsg);
    addMessage(userMsg);
    await sessionRepo.touch(sessionId);

    // Placeholder AI response (Phase 4 will add real streaming)
    const aiMsg: Message = {
      id: crypto.randomUUID(),
      sessionId,
      role: 'assistant',
      content: '（流式对话将在 Phase 4 接入 DeepSeek API 后生效）',
      createdAt: Date.now(),
    };
    await messageRepo.create(aiMsg);
    addMessage(aiMsg);
    await sessionRepo.touch(sessionId);
  };

  if (!currentSessionId) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-gray-500 text-sm">选择左侧角色，创建会话开始对话</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-gray-500 text-sm">尚无基因序列，发送第一条消息吧</p>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}
        <div ref={bottomRef} />
      </div>

      <ChatInput onSend={handleSend} />
    </div>
  );
}
