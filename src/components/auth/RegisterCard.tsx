import { useState } from 'react';
import { ipc } from '../../lib/ipc-client';
import { hashPassword, encryptApiKey } from '../../lib/crypto';
import { userRepo } from '../../db/user-repo';
import type { User } from '../../db/index';
import { useAuthStore } from '../../store/auth-store';

interface Props {
  onSwitch: () => void;
}

export function RegisterCard({ onSwitch }: Props) {
  const login = useAuthStore((s) => s.login);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'validating' | 'creating'>('form');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password || !confirmPassword || !apiKey.trim()) {
      setError('请填写所有字段，基因序列不能有缺失');
      return;
    }

    if (username.trim().length < 2) {
      setError('用户名至少需要 2 个字符');
      return;
    }

    if (password.length < 6) {
      setError('密码至少需要 6 位基因编码');
      return;
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不匹配');
      return;
    }

    // Check if username already exists
    const existing = await userRepo.findByUsername(username.trim());
    if (existing) {
      setError('该用户名已被注册，请选择其他基因标识');
      return;
    }

    // Step 1: Validate API Key first
    setStep('validating');
    setLoading(true);
    try {
      const result = await ipc.key.validate(apiKey.trim());
      if (!result.valid) {
        setError(result.error ?? '基因序列验证失败，请检查 API Key');
        setStep('form');
        setLoading(false);
        return;
      }
    } catch {
      setError('基因链接中断，请重试');
      setStep('form');
      setLoading(false);
      return;
    }

    // Step 2: Create user with encrypted key
    setStep('creating');
    try {
      const { hash, salt } = await hashPassword(password);
      const saltBytes = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0));
      const { iv, ciphertext } = await encryptApiKey(apiKey.trim(), password, saltBytes);

      const user: User = {
        id: crypto.randomUUID(),
        username: username.trim(),
        passwordHash: hash,
        passwordSalt: salt,
        apiKeyIv: iv,
        apiKeyCiphertext: ciphertext,
        createdAt: Date.now(),
      };

      await userRepo.create(user);
      login(user.id, user.username, apiKey.trim());
    } catch {
      setError('播种基因序列失败，请重试');
      setStep('form');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-8 w-full max-w-md space-y-4">
      <div className="text-center">
        <div className="text-4xl mb-2">🌱</div>
        <h2 className="text-2xl font-bold text-white">注册你的基因</h2>
        <p className="text-sm text-gray-400 mt-1">创建账号并绑定 DeepSeek API Key</p>
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
          autoComplete="username"
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-gene-purple transition-colors"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="密码（至少 6 位）"
          autoComplete="new-password"
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-gene-purple transition-colors"
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="确认密码"
          autoComplete="new-password"
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-gene-purple transition-colors"
        />
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="DeepSeek API Key (sk-...)"
            autoComplete="off"
            className="w-full px-4 py-3 pr-12 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-life-cyan transition-colors"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-sm"
          >
            {showKey ? '隐藏' : '显示'}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 rounded-xl bg-life-cyan text-[#0F0F1A] font-bold hover:bg-[#00B8B3] transition-colors disabled:opacity-50"
      >
        {step === 'validating' && '正在验证基因序列...'}
        {step === 'creating' && '正在播种基因序列...'}
        {step === 'form' && '播种'}
      </button>

      <p className="text-center text-sm text-gray-400">
        已有基因序列？{' '}
        <button type="button" onClick={onSwitch} className="text-gene-purple hover:underline">
          唤醒数字灵魂
        </button>
      </p>
    </form>
  );
}
