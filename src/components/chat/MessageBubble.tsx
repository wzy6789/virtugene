import type { Message } from '../../db/index';
import { Avatar } from '../ui/Avatar';

interface Props {
  message: Message;
  avatar: string;
}

export function MessageBubble({ message, avatar }: Props) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex items-start gap-2 mb-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <Avatar avatar={avatar} size="sm" />
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
