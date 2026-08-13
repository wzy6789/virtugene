import { useState, useEffect } from 'react';
import { useThemeStore } from '../../store/theme-store';
import { useAuthStore } from '../../store/auth-store';
import { ipc } from '../../lib/ipc-client';
import { CharacterList } from '../character/CharacterList';
import { CharacterAddModal } from '../character/CharacterAddModal';
import { SettingsPanel } from '../settings/SettingsPanel';

export function Sidebar() {
  const { theme, toggle } = useThemeStore();
  const logout = useAuthStore((s) => s.logout);
  const [collapsed, setCollapsed] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <>
      <aside
        className={`h-full bg-app border-r border-line flex flex-col shrink-0 transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        {/* Logo */}
        <div className="h-14 flex items-center gap-3 px-4 border-b border-line shrink-0">
          <span className="text-2xl shrink-0">🧬</span>
          {!collapsed && (
            <span className="text-base font-bold tracking-wide text-ink">
              Virtu<span className="text-gene-purple">Gene</span>
            </span>
          )}
        </div>

        {/* Character contacts — QQ/WeChat style */}
        <div className="flex-1 overflow-y-auto pt-1">
          <CharacterList collapsed={collapsed} />
        </div>

        {/* Add character button */}
        <div className="px-2 pb-1 shrink-0">
          <button
            onClick={() => setShowAddModal(true)}
            className={`w-full flex items-center gap-3 rounded-xl border border-dashed border-gene-purple/30 text-gene-purple/50 hover:text-gene-purple hover:border-gene-purple/60 hover:bg-gene-purple/5 transition-all ${
              collapsed ? 'justify-center py-2.5 text-lg' : 'px-3 py-2.5'
            }`}
          >
            <span className="shrink-0">{collapsed ? '+' : '🧬'}</span>
            {!collapsed && <span className="text-sm">培育新灵魂</span>}
          </button>
        </div>

        {/* Bottom controls */}
        <div className="border-t border-line p-2 space-y-1 shrink-0">
          <button
            onClick={() => setShowSettings(true)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-surface transition-colors"
          >
            <span className="text-lg shrink-0">⚙️</span>
            {!collapsed && <span>设置</span>}
          </button>

          <button
            onClick={toggle}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-surface transition-colors"
          >
            <span className="text-lg shrink-0">{theme === 'dark' ? '🌙' : '☀️'}</span>
            {!collapsed && <span>{theme === 'dark' ? '暗色模式' : '亮色模式'}</span>}
          </button>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-surface transition-colors"
          >
            <span className="text-lg shrink-0">{collapsed ? '▶' : '◀'}</span>
            {!collapsed && <span>收起侧栏</span>}
          </button>

          <button
            onClick={() => {
              ipc.window.setSize(320, 466);
              localStorage.removeItem('virtugene-auth');
              logout();
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
          >
            <span className="text-lg shrink-0">↩</span>
            {!collapsed && <span>断开灵魂链接</span>}
          </button>
        </div>
      </aside>

      <CharacterAddModal open={showAddModal} onClose={() => setShowAddModal(false)} />
      <SettingsPanel open={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
}
