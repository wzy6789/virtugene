import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from './store/auth-store';
import { useThemeStore } from './store/theme-store';
import { ipc } from './lib/ipc-client';
import { AuthPage } from './pages/AuthPage';
import { ChatPage } from './pages/ChatPage';
import { MainLayout } from './components/layout/MainLayout';
import { SplashScreen } from './components/splash/SplashScreen';
import { UpdateNotesModal } from './components/update/UpdateNotesModal';
import { OnboardingGuide } from './components/onboarding/OnboardingGuide';
import { getChangelog, LAST_SEEN_VERSION_KEY } from './lib/changelog';
import { initSeedCharacters } from './lib/seed-init';

export default function App() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const theme = useThemeStore((s) => s.theme);
  const didResize = useRef(false);
  const [ready, setReady] = useState(false);
  const [updateNotes, setUpdateNotes] = useState<{ version: string; notes: string[] } | null>(null);

  useEffect(() => {
    initSeedCharacters().finally(() => setReady(true));
  }, []);

  // Show the update announcement once per version change
  useEffect(() => {
    if (!ready) return;
    ipc.app.getVersion().then((v) => {
      if (!v) return;
      const entry = getChangelog(v);
      if (!entry) return;
      if (localStorage.getItem(LAST_SEEN_VERSION_KEY) !== v) {
        setUpdateNotes({ version: v, notes: entry.notes });
      }
    });
  }, [ready]);

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

  const handleCloseUpdateNotes = () => {
    if (updateNotes) {
      localStorage.setItem(LAST_SEEN_VERSION_KEY, updateNotes.version);
    }
    setUpdateNotes(null);
  };

  if (!ready) {
    return <SplashScreen />;
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
      <UpdateNotesModal
        open={!!updateNotes}
        onClose={handleCloseUpdateNotes}
        version={updateNotes?.version ?? ''}
        notes={updateNotes?.notes ?? []}
      />
      {isLoggedIn && <OnboardingGuide />}
    </div>
  );
}
