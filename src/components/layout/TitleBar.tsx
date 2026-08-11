import { useState } from 'react';
import { ipc } from '../../lib/ipc-client';

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  const handleMaximize = () => {
    ipc.window.maximize();
    setIsMaximized(!isMaximized);
  };

  return (
    <header className="drag-region h-9 flex items-center justify-between bg-[#0F0F1A] border-b border-white/5 select-none shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 pl-4">
        <span className="text-xl">🧬</span>
        <span className="text-sm font-semibold tracking-wide text-white">
          Virtu<span className="text-gene-purple">Gene</span>
        </span>
      </div>

      {/* Window controls */}
      <div className="flex h-full no-drag">
        <button
          onClick={() => ipc.window.minimize()}
          className="w-11 h-full flex items-center justify-center text-gray-400 hover:bg-white/10 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12"><rect y="5" width="12" height="1.5" fill="currentColor" /></svg>
        </button>
        <button
          onClick={handleMaximize}
          className="w-11 h-full flex items-center justify-center text-gray-400 hover:bg-white/10 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12"><rect x="1" y="1" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
        </button>
        <button
          onClick={() => ipc.window.close()}
          className="w-11 h-full flex items-center justify-center text-gray-400 hover:bg-red-500/80 hover:text-white transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.5" /></svg>
        </button>
      </div>
    </header>
  );
}
