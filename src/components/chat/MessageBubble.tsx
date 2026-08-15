import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Message } from '../../db/index';
import { Avatar } from '../ui/Avatar';
import { ipc } from '../../lib/ipc-client';

interface Props {
  message: Message;
  avatar: string;
  animate?: boolean;
  onQuote?: (message: Message) => void;
  onDelete?: (message: Message) => void;
}

export function MessageBubble({ message, avatar, animate, onQuote, onDelete }: Props) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!menu) return;
    const handler = () => setMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [menu]);

  const handleCopy = async () => {
    if (copied) return;
    await ipc.clipboard.writeText(message.content);
    setCopied(true);
    setMenu(null);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  return (
    <div className={`group flex items-start gap-2 mb-4 ${isUser ? 'flex-row-reverse' : 'flex-row'} ${
      animate ? 'animate-message-in' : ''
    }`}>
      <Avatar avatar={avatar} size="sm" />
      <div className="relative max-w-[75%]">
        <div
          onContextMenu={handleContextMenu}
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
            isUser
              ? 'bg-gene-purple text-white rounded-br-md'
              : 'bg-msgai text-msgaitxt rounded-bl-md border-l-2 border-life-cyan'
          }`}
        >
          {message.replyToContent && (
            <div
              className={`text-xs mb-1.5 line-clamp-1 border-l-2 pl-2 ${
                isUser ? 'border-white/40 text-white/70' : 'border-gray-300 text-gray-500'
              }`}
            >
              {message.replyToContent}
            </div>
          )}
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

      {/* Context menu — rendered via portal so position:fixed is relative to the viewport,
          not the virtualized row's transform container */}
      {menu &&
        createPortal(
          <div
            className="fixed z-[60] min-w-[120px] py-1.5 glass-card rounded-xl shadow-2xl"
            style={{ left: menu.x + 4, top: menu.y + 4 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleCopy}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-sub hover:bg-surface transition-colors"
            >
              📋 复制
            </button>
            <button
              onClick={() => {
                onQuote?.(message);
                setMenu(null);
              }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-sub hover:bg-surface transition-colors"
            >
              💬 引用
            </button>
            <button
              onClick={() => {
                onDelete?.(message);
                setMenu(null);
              }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
            >
              🗑️ 删除
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}
