import { useAuthStore } from './store/auth-store';
import { useThemeStore } from './store/theme-store';
import { AuthPage } from './pages/AuthPage';

export default function App() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const theme = useThemeStore((s) => s.theme);

  return (
    <div className={theme}>
      <div className="h-full w-full dna-bg bg-[#0F0F1A] text-white dark:bg-[#0F0F1A]">
        {isLoggedIn ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4">
              <div className="text-6xl">🧬</div>
              <h1 className="text-3xl font-bold text-gene-purple">VirtuGene</h1>
              <p className="text-gray-400">性格基因已就绪</p>
              <p className="text-sm text-gray-500">Phase 1 — 登录成功，聊天界面将在 Phase 3 实现</p>
            </div>
          </div>
        ) : (
          <AuthPage />
        )}
      </div>
    </div>
  );
}
