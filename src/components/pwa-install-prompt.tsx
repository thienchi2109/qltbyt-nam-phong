'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    
    // Check if app is already installed
    const checkIfInstalled = () => {
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
        return;
      }
      
      // Check for iOS Safari standalone mode
      if ((window.navigator as any).standalone === true) {
        setIsInstalled(true);
        return;
      }
    };

    checkIfInstalled();

    // Register service worker (production only); in dev, ensure no stale SW remains
    const manageSW = async () => {
      if (!('serviceWorker' in navigator)) return;

      if (process.env.NODE_ENV === 'production') {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js');
          console.log('Service Worker registered:', registration);
        } catch (error) {
          console.error('Service Worker registration failed:', error);
        }
      } else {
        // In development, unregister any existing SW to avoid precache 404s with Next dev assets
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.unregister()));
          // Also clear outdated caches that may have been created by a prod SW
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
          console.log('Service Worker unregistered and caches cleared for development');
        } catch (err) {
          console.warn('SW cleanup in development failed:', err);
        }
      }
    };

    manageSW();

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallPrompt(true);
    };

    // Listen for appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    // Hide for this session
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('pwa-install-dismissed', 'true');
    }
  };

  // Don't show if not mounted, already installed or dismissed
  if (!isMounted || isInstalled || !showInstallPrompt || (typeof window !== 'undefined' && sessionStorage.getItem('pwa-install-dismissed'))) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h3 className="font-medium text-sm mb-1">Cài đặt ứng dụng</h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
            Cài đặt ứng dụng Quản lý TBYT để sử dụng offline và truy cập nhanh hơn.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleInstallClick} className="flex items-center gap-1">
              <Download className="w-3 h-3" />
              Cài đặt
            </Button>
            <Button size="sm" variant="outline" onClick={handleDismiss}>
              Để sau
            </Button>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDismiss}
          className="p-1 h-auto"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// PWA Status component để debug
export function PWAStatus() {
  const [swStatus, setSWStatus] = useState<string>('checking...');
  const [isOnline, setIsOnline] = useState(true);
  const [installPromptAvailable, setInstallPromptAvailable] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    
    // Check service worker status
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => {
        setSWStatus('active');
      }).catch(() => {
        setSWStatus('failed');
      });
    } else {
      setSWStatus('not supported');
    }

    // Check online status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    setIsOnline(navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check install prompt
    const handleBeforeInstallPrompt = () => {
      setInstallPromptAvailable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Only show in development and after mounting
  if (process.env.NODE_ENV !== 'development' || !isMounted) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 bg-black/80 text-white text-xs p-2 rounded z-50">
      <div>SW: {swStatus}</div>
      <div>Online: {isOnline ? 'yes' : 'no'}</div>
      <div>Install: {installPromptAvailable ? 'available' : 'not available'}</div>
      <div>HTTPS: {typeof window !== 'undefined' ? (window.location.protocol === 'https:' ? 'yes' : 'no') : 'unknown'}</div>
    </div>
  );
} 