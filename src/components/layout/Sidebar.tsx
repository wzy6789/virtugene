import { useState, useEffect } from 'react';
import { useThemeStore } from '../../store/theme-store';
import { useAuthStore, DEFAULT_USER_AVATAR } from '../../store/auth-store';
import { useChatStore } from '../../store/chat-store';
import { useCharacterStateStore } from '../../store/character-state-store';
import { useEmotionStore } from '../../store/emotion-store';
import { ipc } from '../../lib/ipc-client';
import { CharacterList } from '../character/CharacterList';
import { CharacterAddModal } from '../character/CharacterAddModal';
import { SettingsPanel } from '../settings/SettingsPanel';
import { UserProfileModal } from '../settings/UserProfileModal';
import { Avatar } from '../ui/Avatar';
import { Modal } from '../ui/Modal';
import { useResizable } from '../../hooks/useResizable';

/** 收起时仅剩左侧工具条的宽度 */
const SIDEBAR_COLLAPSED = 48;
/** 默认宽度借鉴微信/QQ 联系人面板的比例（略宽） */
const SIDEBAR_DEFAULT = 280;
const SIDEBAR_MIN = 220;
const SIDEBAR_MAX = 360;
const SIDEBAR_SNAP = 140;

/** 工具条按钮统一样式 */
const RAIL_BTN =
  'w-9 h-9 flex items-center justify-center rounded-lg text-lg text-gray-400 hover:bg-surface hover:text-ink transition-colors shrink-0';

export function Sidebar() {
  const { theme, toggle } = useThemeStore();
  const logout = useAuthStore((s) => s.logout);
  const avatar = useAuthStore((s) => s.avatar) ?? DEFAULT_USER_AVATAR;
  const { width, setWidth, isDragging, startDrag } = useResizable({
    initial: SIDEBAR_DEFAULT,
    min: SIDEBAR_COLLAPSED,
    max: SIDEBAR_MAX,
    snap: (w) => (w < SIDEBAR_SNAP ? SIDEBAR_COLLAPSED : Math.max(SIDEBAR_MIN, w)),
  });
  const collapsed = width < SIDEBAR_SNAP;
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const handleLogout = () => {
    ipc.window.setSize(320, 466);
    localStorage.removeItem('virtugene-auth');
    useChatStore.getState().reset();
    useCharacterStateStore.getState().clear();
    useEmotionStore.getState().clearCurrent();
    logout();
  };

  return (
    <>
      <aside
        className={`relative h-full bg-app border-r border-line flex shrink-0 ${
          isDragging ? '' : 'transition-[width] duration-300 ease-in-out'
        }`}
        style={{ width }}
      >
        {/* 右下角拉伸把手：滚动条贴右缘，拉伸改为小把手（微信式互不干扰） */}
        <div
          onMouseDown={startDrag}
          title="拖拽调整侧栏宽度"
          className="absolute bottom-0 right-0 w-4 h-8 flex items-center justify-center cursor-col-resize hover:bg-gene-purple/20 transition-colors z-10"
        >
          <div className="flex flex-col gap-[3px] items-center">
            <span className="w-[3px] h-[3px] rounded-full bg-gray-400" />
            <span className="w-[3px] h-[3px] rounded-full bg-gray-400" />
            <span className="w-[3px] h-[3px] rounded-full bg-gray-400" />
          </div>
        </div>

        {/* 左侧工具条 —— 电脑版微信/QQ 风格（工具统一放在上方） */}
        <div className="w-12 shrink-0 border-r border-line flex flex-col items-center py-2 gap-1">
          <span className="text-xl mt-1 mb-2" title="VirtuGene">🧬</span>

          <button onClick={() => setShowProfile(true)} title="个人资料" className={RAIL_BTN}>
            <Avatar avatar={avatar} size="sm" className="w-7 h-7 text-base" />
          </button>
          <button onClick={() => setShowSettings(true)} title="设置" className={RAIL_BTN}>
            ⚙️
          </button>
          <button onClick={toggle} title="切换主题" className={RAIL_BTN}>
            {theme === 'dark' ? '🌙' : '☀️'}
          </button>
          <button
            onClick={() => setWidth(collapsed ? SIDEBAR_DEFAULT : SIDEBAR_COLLAPSED)}
            title={collapsed ? '展开侧栏' : '收起侧栏'}
            className={RAIL_BTN}
          >
            {collapsed ? '▶' : '◀'}
          </button>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            title="断开灵魂链接"
            className={`${RAIL_BTN} hover:bg-red-500/10 hover:text-red-400`}
          >
            ↩
          </button>

          <div className="flex-1" />
        </div>

        {/* 联系人面板（可调宽） */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="h-14 flex items-center px-4 border-b border-line shrink-0">
            <span className="text-base font-bold tracking-wide text-ink">
              Virtu<span className="text-gene-purple">Gene</span>
            </span>
          </div>

          {/* 基因实验室入口 —— 放在「搜索基因」上方 */}
          <div className="px-3 pt-2 pb-1 shrink-0">
            <button
              onClick={() => setShowAddModal(true)}
              className="w-full flex items-center gap-3 rounded-xl border border-dashed border-life-cyan/40 text-life-cyan hover:bg-life-cyan/10 hover:border-life-cyan/70 transition-all px-3 py-2"
            >
              <span className="shrink-0">🧬</span>
              <span className="text-sm font-medium">基因实验室</span>
            </button>
          </div>

          {/* 联系人列表：原生滚动条完全贴右缘（8px 加宽，微信式），
              拉伸由右下角小把手负责，两者互不干扰 */}
          <div className="flex-1 overflow-hidden pt-1">
            <div className="h-full overflow-y-auto contacts-scroll">
              <CharacterList collapsed={collapsed} />
            </div>
          </div>
        </div>
      </aside>

      <CharacterAddModal open={showAddModal} onClose={() => setShowAddModal(false)} />
      <SettingsPanel open={showSettings} onClose={() => setShowSettings(false)} />
      <UserProfileModal open={showProfile} onClose={() => setShowProfile(false)} />

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
    </>
  );
}
