import type {Metadata, Viewport} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { NextAuthSessionProvider } from '@/providers/session-provider';
import { LanguageProvider } from '@/contexts/language-context';
import { QueryProvider } from '@/providers/query-provider';
import { RealtimeProvider } from '@/contexts/realtime-context';
import { PWAInstallPrompt, PWAStatus } from '@/components/pwa-install-prompt';
import { ThemeColorManager } from '@/components/theme-color-manager';

export const metadata: Metadata = {
  title: 'QUẢN LÝ TBYT CDC',
  description: 'Hệ thống quản lý trang thiết bị y tế',
  manifest: '/manifest.json', // Added manifest link
};

export const viewport: Viewport = {
  themeColor: '#447896',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* <head> section is now managed by Next.js metadata */}
      <body className="font-sans antialiased">
        <QueryProvider>
          <RealtimeProvider>
            <LanguageProvider>
            <NextAuthSessionProvider>
                {children}
                <Toaster />
                <PWAInstallPrompt />
                {process.env.NODE_ENV === 'development' && <PWAStatus />}
                <ThemeColorManager />
            </NextAuthSessionProvider>
            </LanguageProvider>
          </RealtimeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
