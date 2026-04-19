import type { Metadata } from 'next';
import { Outfit, DM_Sans, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import AppShell from '@/components/AppShell';
import { TopBar } from '@/components/TopBar';
import Providers from './providers';

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', weight: ['400', '700', '800'] });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono', weight: ['400', '500', '700'] });

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
    <html lang="en" className={`${outfit.variable} ${dmSans.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,300,0,0"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#131318] text-[#e4e1e9]">
        <AuthProvider>
          <Providers>
            <AppShell>
              {children}
            </AppShell>
          </Providers>
        </AuthProvider>
      </body>
    </html>
  );
}
