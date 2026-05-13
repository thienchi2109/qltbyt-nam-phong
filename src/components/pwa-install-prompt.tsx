'use client';

import { useEffect, useReducer, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface SerwistWindow extends Window {
  serwist?: {
    register: () => Promise<ServiceWorkerRegistration>;
  };
}

interface StandaloneNavigator extends Navigator {
  standalone?: boolean;
}

interface PWAInstallPromptState {
  isDismissed: boolean;
  isInstalled: boolean;
  isMounted: boolean;
  showInstallPrompt: boolean;
}

type PWAInstallPromptAction =
  | { type: "app-installed" }
  | { type: "dismiss" }
  | { type: "mounted"; isDismissed: boolean; isInstalled: boolean }
  | { type: "prompt-available" }
  | { type: "prompt-consumed" }

const initialInstallPromptState: PWAInstallPromptState = {
  isDismissed: false,
  isInstalled: false,
  isMounted: false,
  showInstallPrompt: false,
}

function pwaInstallPromptReducer(
  state: PWAInstallPromptState,
  action: PWAInstallPromptAction,
): PWAInstallPromptState {
  switch (action.type) {
    case "app-installed":
      return { ...state, isInstalled: true, showInstallPrompt: false }
    case "dismiss":
      return { ...state, isDismissed: true, showInstallPrompt: false }
    case "mounted":
      return {
        ...state,
        isDismissed: action.isDismissed,
        isInstalled: action.isInstalled,
        isMounted: true,
      }
    case "prompt-available":
      return { ...state, showInstallPrompt: true }
    case "prompt-consumed":
      return { ...state, showInstallPrompt: false }
  }
}

function isAppInstalled() {
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }

  return (window.navigator as StandaloneNavigator).standalone === true;
}

export function PWAInstallPrompt() {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [state, dispatch] = useReducer(pwaInstallPromptReducer, initialInstallPromptState);

  useEffect(() => {
    dispatch({
      type: "mounted",
      isDismissed: sessionStorage.getItem('pwa-install-dismissed') === 'true',
      isInstalled: isAppInstalled(),
    });

    // In production, register manually because Serwist auto-registration is disabled in config.
    // In development, unregister any stale SW and clear caches to avoid old precache behavior.
    const manageSW = async () => {
      if (!('serviceWorker' in navigator)) return;

      if (process.env.NODE_ENV === 'production') {
        try {
          const serwistWindow = window as SerwistWindow;
          const registration = serwistWindow.serwist
            ? await serwistWindow.serwist.register()
            : await navigator.serviceWorker.register('/sw.js');
          console.log('Service Worker registered:', registration);
        } catch (error) {
          console.error('Service Worker registration failed:', error);
        }
      } else {
        // In development, unregister any existing SW to avoid precache 404s with Next dev assets
        try {
          const [regs, cacheNames] = await Promise.all([
            navigator.serviceWorker.getRegistrations(),
            caches.keys(),
          ]);
          await Promise.all([
            ...regs.map(r => r.unregister()),
            ...cacheNames.map(name => caches.delete(name)),
          ]);
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
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      dispatch({ type: "prompt-available" });
    };

    // Listen for appinstalled event
    const handleAppInstalled = () => {
      deferredPromptRef.current = null;
      dispatch({ type: "app-installed" });
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPromptRef.current) return;

    await deferredPromptRef.current.prompt();
    const { outcome } = await deferredPromptRef.current.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    
    deferredPromptRef.current = null;
    dispatch({ type: "prompt-consumed" });
  };

  const handleDismiss = () => {
    // Hide for this session
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('pwa-install-dismissed', 'true');
    }
    dispatch({ type: "dismiss" });
  };

  // Don't show if not mounted, already installed or dismissed
  if (!state.isMounted || state.isInstalled || state.isDismissed || !state.showInstallPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h3 className="font-medium text-sm mb-1">Cài đặt ứng dụng</h3>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-3">
            Cài đặt ứng dụng Quản lý TBYT để sử dụng offline và truy cập nhanh hơn.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleInstallClick} className="flex items-center gap-1">
              <Download className="size-3" />
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
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}

// PWA Status component để debug
export function PWAStatus() {
  const [state, dispatch] = useReducer(
    (
      current: {
        installPromptAvailable: boolean;
        isMounted: boolean;
        isOnline: boolean;
        swStatus: string;
      },
      next: Partial<{
        installPromptAvailable: boolean;
        isMounted: boolean;
        isOnline: boolean;
        swStatus: string;
      }>,
    ) => ({ ...current, ...next }),
    {
      installPromptAvailable: false,
      isMounted: false,
      isOnline: true,
      swStatus: 'checking...',
    },
  );

  useEffect(() => {
    dispatch({ isMounted: true });

    // Check service worker status
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => {
        dispatch({ swStatus: 'active' });
      }).catch(() => {
        dispatch({ swStatus: 'failed' });
      });
    } else {
      dispatch({ swStatus: 'not supported' });
    }

    // Check online status
    const handleOnline = () => dispatch({ isOnline: true });
    const handleOffline = () => dispatch({ isOnline: false });

    dispatch({ isOnline: navigator.onLine });
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check install prompt
    const handleBeforeInstallPrompt = () => {
      dispatch({ installPromptAvailable: true });
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Only show in development and after mounting
  if (process.env.NODE_ENV !== 'development' || !state.isMounted) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 bg-black/80 text-white text-xs p-2 rounded z-50">
      <div>SW: {state.swStatus}</div>
      <div>Online: {state.isOnline ? 'yes' : 'no'}</div>
      <div>Install: {state.installPromptAvailable ? 'available' : 'not available'}</div>
      <div>HTTPS: {typeof window !== 'undefined' ? (window.location.protocol === 'https:' ? 'yes' : 'no') : 'unknown'}</div>
    </div>
  );
} 
