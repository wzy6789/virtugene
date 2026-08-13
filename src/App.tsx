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
    initSeedCharacters().finally(() => setReady(true));
  }, []);

  // Apply theme class at the root so both auth and chat screens are themed
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

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
      <div className="h-full w-full flex items-center justify-center bg-app">
        <div className="text-4xl animate-pulse">🧬</div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-app text-ink">
      {isLoggedIn ? (
        <MainLayout>
          <ChatPage />
        </MainLayout>
      ) : (
        <AuthPage />
      )}
    </div>
  );
}
