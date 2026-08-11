import { useState } from 'react';
import { LoginCard } from '../components/auth/LoginCard';
import { RegisterCard } from '../components/auth/RegisterCard';

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  return (
    <div className="h-full w-full flex items-center justify-center">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-gene-purple/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-life-cyan/5 rounded-full blur-3xl" />
        {/* DNA helix decorative lines */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.03]" viewBox="0 0 1200 800">
          <path d="M 0 400 Q 150 200 300 400 T 600 400 T 900 400 T 1200 400" fill="none" stroke="#6C5CE7" strokeWidth="2" />
          <path d="M 0 380 Q 150 580 300 380 T 600 380 T 900 380 T 1200 380" fill="none" stroke="#00CEC9" strokeWidth="2" />
          <path d="M 0 420 Q 150 220 300 420 T 600 420 T 900 420 T 1200 420" fill="none" stroke="#00CEC9" strokeWidth="2" />
        </svg>
      </div>

      <div className="relative z-10">
        {mode === 'login' ? (
          <LoginCard onSwitch={() => setMode('register')} />
        ) : (
          <RegisterCard onSwitch={() => setMode('login')} />
        )}
      </div>
    </div>
  );
}
