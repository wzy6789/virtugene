import { TitleBar } from './TitleBar';
import { Sidebar } from './Sidebar';

interface Props {
  children: React.ReactNode;
}

export function MainLayout({ children }: Props) {
  return (
    <div className="h-full w-full flex flex-col bg-[#0F0F1A]">
      <TitleBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
