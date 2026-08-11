import { useEffect } from 'react';
import { useAuthStore } from './store/auth-store';
import { useThemeStore } from './store/theme-store';
import { AuthPage } from './pages/AuthPage';
import { ChatPage } from './pages/ChatPage';
import { MainLayout } from './components/layout/MainLayout';
import { initSeedCharacters } from './lib/seed-init';

export default function App() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    initSeedCharacters();
  }, []);

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
