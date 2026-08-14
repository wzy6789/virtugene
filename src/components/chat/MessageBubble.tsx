import { useState } from 'react';
import type { Message } from '../../db/index';
import { Avatar } from '../ui/Avatar';
import { ipc } from '../../lib/ipc-client';

interface Props {
  message: Message;
  avatar: string;
}

export function MessageBubble({ message, avatar }: Props) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (copied) return;
    await ipc.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={`group flex items-start gap-2 mb-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <Avatar avatar={avatar} size="sm" />
      <div className="relative max-w-[75%]">
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
            isUser
              ? 'bg-gene-purple text-white rounded-br-md'
              : 'bg-msgai text-msgaitxt rounded-bl-md border-l-2 border-life-cyan'
          }`}
        >
          {message.content}
        </div>
        <button
          onClick={handleCopy}
          title={copied ? '已复制' : '复制'}
          className={`absolute top-1.5 ${
            isUser ? 'right-full mr-1.5' : 'left-full ml-1.5'
          } flex items-center justify-center w-6 h-6 rounded-md bg-panel border border-line text-gray-400 hover:text-ink transition-all opacity-0 group-hover:opacity-100 ${
            copied ? 'opacity-100 !text-life-cyan' : ''
          }`}
        >
          {copied ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
