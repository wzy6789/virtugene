import type { Message } from '../../db/index';

interface Props {
  message: Message;
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
          isUser
            ? 'bg-gene-purple text-white rounded-br-md'
            : 'bg-msgai text-msgaitxt rounded-bl-md border-l-2 border-life-cyan'
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}
