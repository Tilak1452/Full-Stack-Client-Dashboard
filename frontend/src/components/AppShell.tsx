"use client";

import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLandingPage = pathname === '/';
  const isAuthPage = pathname.startsWith('/auth');
  const showSidebar = !isLandingPage && !isAuthPage;

  return (
    <div className={showSidebar ? 'h-screen flex overflow-hidden' : 'min-h-screen w-full'}>
      {showSidebar && <Sidebar />}
      <div className={showSidebar ? 'flex-1 flex flex-col overflow-hidden' : 'w-full'}>
        {children}
      </div>
    </div>
  );
}
