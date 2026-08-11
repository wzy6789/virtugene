import { useState } from 'react';
import { ipc } from '../../lib/ipc-client';
import { hashPassword } from '../../lib/crypto';
import { userRepo } from '../../db/user-repo';
import { decryptApiKey } from '../../lib/crypto';
import { useAuthStore } from '../../store/auth-store';

interface Props {
  onSwitch: () => void;
}

export function LoginCard({ onSwitch }: Props) {
  const login = useAuthStore((s) => s.login);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('请填写用户名和密码');
      return;
    }

    setLoading(true);
    try {
      const user = await userRepo.findByUsername(username.trim());
      if (!user) {
        setError('用户名不存在，请先播种你的基因序列');
        return;
      }

      const { hash } = await hashPassword(password);
      if (hash !== user.passwordHash) {
        setError('密码错误，基因序列不匹配');
        return;
      }

      const key = await decryptApiKey(
        user.apiKeyIv,
        user.apiKeyCiphertext,
        password,
        Uint8Array.from(atob(user.passwordSalt), (c) => c.charCodeAt(0))
      );

      login(user.id, user.username, key);
    } catch {
      setError('唤醒数字灵魂失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-8 w-full max-w-md space-y-5">
      <div className="text-center">
        <div className="text-4xl mb-2">🧬</div>
        <h2 className="text-2xl font-bold text-white">唤醒数字灵魂</h2>
        <p className="text-sm text-gray-400 mt-1">登录以继续你的基因探索</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="用户名"
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-gene-purple transition-colors"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="密码"
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-gene-purple transition-colors"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 rounded-xl bg-gene-purple text-white font-medium hover:bg-[#5B4BD4] transition-colors disabled:opacity-50"
      >
        {loading ? '正在唤醒数字灵魂...' : '唤醒'}
      </button>

      <p className="text-center text-sm text-gray-400">
        尚无基因序列？{' '}
        <button type="button" onClick={onSwitch} className="text-life-cyan hover:underline">
          播种你的基因序列
        </button>
      </p>
    </form>
  );
}
