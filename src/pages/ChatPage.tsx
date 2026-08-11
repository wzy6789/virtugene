import { useAuthStore } from '../store/auth-store';

export function ChatPage() {
  const username = useAuthStore((s) => s.username);

  return (
    <div className="h-full flex items-center justify-center dna-bg">
      <div className="text-center space-y-4">
        <div className="text-6xl">🧬</div>
        <h2 className="text-xl font-semibold text-white">你好，{username}</h2>
        <p className="text-gray-500 text-sm max-w-xs mx-auto">
          尚无基因序列，选择左侧角色创建会话吧
        </p>
      </div>
    </div>
  );
}
