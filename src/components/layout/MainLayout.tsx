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
    <div className="relative h-full w-full flex flex-col bg-app">
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
  );
}
