import { useState, useEffect } from 'react';
import { useThemeStore } from '../../store/theme-store';
import { CharacterList } from '../character/CharacterList';

export function Sidebar() {
  const { theme, toggle } = useThemeStore();
  const [collapsed, setCollapsed] = useState(false);

  // Apply theme class to document
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <aside
      className={`h-full bg-[#0F0F1A] border-r border-white/5 flex flex-col shrink-0 transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Logo area */}
      <div className="h-14 flex items-center gap-3 px-4 border-b border-white/5 shrink-0">
        <span className="text-2xl shrink-0">🧬</span>
        {!collapsed && (
          <span className="text-base font-bold tracking-wide text-white">
            Virtu<span className="text-gene-purple">Gene</span>
          </span>
        )}
      </div>

      {/* Character list */}
      <div className="flex-1 overflow-y-auto py-2">
        {!collapsed && (
          <p className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
            数字灵魂
          </p>
        )}
        <CharacterList collapsed={collapsed} />
      </div>

      {/* Bottom controls */}
      <div className="border-t border-white/5 p-2 space-y-1 shrink-0">
        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-white/5 transition-colors"
          title={theme === 'dark' ? '切换亮色模式' : '切换暗色模式'}
        >
          <span className="text-lg shrink-0">{theme === 'dark' ? '🌙' : '☀️'}</span>
          {!collapsed && <span>{theme === 'dark' ? '暗色模式' : '亮色模式'}</span>}
        </button>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-white/5 transition-colors"
        >
          <span className="text-lg shrink-0">{collapsed ? '▶' : '◀'}</span>
          {!collapsed && <span>收起侧栏</span>}
        </button>
      </div>
    </aside>
  );
}
