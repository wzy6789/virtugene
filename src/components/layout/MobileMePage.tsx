import { useEffect, useState } from 'react';
import { useAuthStore, DEFAULT_USER_AVATAR } from '../../store/auth-store';
import { useThemeStore } from '../../store/theme-store';
import { useChatStore } from '../../store/chat-store';
import { useCharacterStateStore } from '../../store/character-state-store';
import { useEmotionStore } from '../../store/emotion-store';
import { resetDiaryUnlock } from '../../lib/diary-unlock';
import { ipc } from '../../lib/ipc-client';
import { Avatar } from '../ui/Avatar';
import { Modal } from '../ui/Modal';
import { SettingsPanel } from '../settings/SettingsPanel';
import { SyncSection } from '../settings/SyncSection';

/** 手机端「我的」页：微信「我」式 —— 用户卡 + 功能列表 + 同步 + 退出 */
export function MobileMePage() {
  const username = useAuthStore((s) => s.username);
  const avatar = useAuthStore((s) => s.avatar);
  const logout = useAuthStore((s) => s.logout);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const [showSettings, setShowSettings] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [version, setVersion] = useState('');

  useEffect(() => {
    ipc.app.getVersion().then(setVersion).catch(() => {});
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('virtugene-auth');
    useChatStore.getState().reset();
    useCharacterStateStore.getState().clear();
    useEmotionStore.getState().clearCurrent();
    resetDiaryUnlock();
    logout();
  };

  const rowCls =
    'w-full flex items-center gap-3 px-4 py-3.5 text-sm text-ink transition-colors active:bg-surface';

  return (
    <div className="h-full flex flex-col overflow-y-auto pb-6">
      {/* 用户卡 */}
      <div className="flex items-center gap-3.5 px-5 pt-8 pb-6">
        <Avatar avatar={avatar ?? DEFAULT_USER_AVATAR} size="lg" className="ring-2 ring-gene-purple/30" />
        <div className="min-w-0">
          <p className="text-lg font-semibold text-ink truncate">{username ?? '数字灵魂'}</p>
          <p className="text-xs text-gray-500 mt-0.5">Unlock Your Digital Soul.</p>
        </div>
      </div>

      {/* 功能列表 */}
      <div className="mx-4 rounded-2xl bg-surface border border-line overflow-hidden divide-y divide-line">
        <button className={rowCls} onClick={() => setShowSettings(true)}>
          <span className="text-lg">🧬</span>
          <span className="flex-1 text-left">完整设置（API Key / 账号）</span>
          <span className="text-gray-400 text-xs">›</span>
        </button>
        <button className={rowCls} onClick={toggleTheme}>
          <span className="text-lg">{theme === 'dark' ? '🌙' : '☀️'}</span>
          <span className="flex-1 text-left">深色模式</span>
          <span className="text-xs text-life-cyan">{theme === 'dark' ? '已开启' : '已关闭'}</span>
        </button>
        <div className={rowCls}>
          <span className="text-lg">📦</span>
          <span className="flex-1 text-left">版本</span>
          <span className="text-xs text-gray-400">{version ? `v${version}` : ''}</span>
        </div>
      </div>

      {/* 局域网同步 */}
      <div className="mx-4 mt-5">
        <SyncSection />
      </div>

      {/* 退出登录 */}
      <div className="mx-4 mt-5">
        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full py-3.5 rounded-2xl bg-red-500/10 text-red-400 text-sm active:bg-red-500/20 transition-colors"
        >
          断开灵魂链接
        </button>
      </div>

      <SettingsPanel open={showSettings} onClose={() => setShowSettings(false)} />

      {/* 断开灵魂链接二次确认 */}
      <Modal open={showLogoutConfirm} onClose={() => setShowLogoutConfirm(false)} width="max-w-sm" closeOnBackdrop={false}>
        <div className="p-6">
          <p className="text-sm text-sub mb-2">断开灵魂链接？</p>
          <p className="text-xs text-gray-500 mb-6">断开后将返回登录页，本地数据（角色、对话、记忆）都会保留，下次登录继续。</p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowLogoutConfirm(false)}
              className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:bg-surface transition-colors"
            >
              取消
            </button>
            <button
              onClick={() => {
                setShowLogoutConfirm(false);
                handleLogout();
              }}
              className="px-4 py-2 rounded-lg text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
            >
              确认断开
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
