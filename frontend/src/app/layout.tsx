import type { Metadata } from 'next';
import { Outfit, DM_Sans } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import Providers from './providers';

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' });

export const metadata: Metadata = {
  title: 'FinSight AI Agent SaaS',
  description: 'Financial Research AI Agent SaaS application',
};

import { AuthProvider } from '@/lib/auth-context';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${outfit.variable} ${dmSans.variable}`}>
      <body className="h-screen flex overflow-hidden">
        <AuthProvider>
          <Providers>
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
              {children}
            </div>
          </Providers>
        </AuthProvider>
      </body>
    </html>
  );
}
