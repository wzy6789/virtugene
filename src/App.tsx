import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from './store/auth-store';
import { useThemeStore } from './store/theme-store';
import { ipc } from './lib/ipc-client';
import { AuthPage } from './pages/AuthPage';
import { ChatPage } from './pages/ChatPage';
import { MainLayout } from './components/layout/MainLayout';
import { initSeedCharacters } from './lib/seed-init';

export default function App() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const theme = useThemeStore((s) => s.theme);
  const didResize = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initSeedCharacters().then(() => setReady(true));
  }, []);

  useEffect(() => {
    if (isLoggedIn && !didResize.current) {
      ipc.window.setSize(1200, 800);
      didResize.current = true;
    }
    if (!isLoggedIn) {
      ipc.window.setSize(320, 466);
      didResize.current = false;
    }
  }, [isLoggedIn]);

  if (!ready) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-[#0F0F1A]">
        <div className="text-4xl animate-pulse">🧬</div>
      </div>
    );
  }

  return (
    <div className={`${theme} h-full w-full`}>
      <div className="h-full w-full bg-[#0F0F1A] text-white dark:bg-[#0F0F1A]">
        {isLoggedIn ? (
          <MainLayout>
            <ChatPage />
          </MainLayout>
        ) : (
          <AuthPage />
        )}
      </div>
    </div>
  );
}
