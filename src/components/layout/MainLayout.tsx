import { useEffect } from 'react';
import { TitleBar } from './TitleBar';
import { Sidebar } from './Sidebar';
import { UpdateBanner } from './UpdateBanner';
import { NotificationCloud } from '../chat/NotificationCloud';
import { useUpdateStore } from '../../store/update-store';

interface Props {
  children: React.ReactNode;
}

export function MainLayout({ children }: Props) {
  useEffect(() => {
    const off = useUpdateStore.getState().init();
    return off;
  }, []);

  return (
    <div className="relative h-full w-full flex flex-col bg-app overflow-hidden">
      {/* 沉浸光感：氛围光晕 + DNA 点阵底纹（极淡，不抢视线） */}
      <div className="absolute inset-0 aurora pointer-events-none z-0" />
      <div className="absolute inset-0 dna-dots pointer-events-none z-0" />

      <div className="relative z-10 flex flex-col h-full">
        <TitleBar />
        <UpdateBanner />
        <NotificationCloud />
        <div className="flex-1 flex overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-hidden">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
