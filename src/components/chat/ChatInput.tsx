import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';

export interface ChatInputHandle {
  focus: () => void;
}

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export const ChatInput = forwardRef<ChatInputHandle, Props>(function ChatInput({ onSend, disabled }, ref) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }));

  // Auto-focus on mount
  useEffect(() => {
    // Small delay to ensure DOM is fully settled
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, []);

  // Re-focus after sending
  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.focus();
    }
  }, [text, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };

  return (
    <div className="border-t border-line p-4">
      <div className="flex items-end gap-3 max-w-3xl mx-auto">
        <textarea
          ref={inputRef}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none bg-surface border border-line-strong rounded-xl px-4 py-3 text-sm text-ink placeholder-gray-500 focus:outline-none focus:border-gene-purple transition-colors disabled:opacity-40"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          className="shrink-0 w-10 h-10 rounded-xl bg-gene-purple text-white flex items-center justify-center hover:bg-[#5B4BD4] transition-colors disabled:opacity-30"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
});