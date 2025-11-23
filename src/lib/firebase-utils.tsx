/**
 * Firebase utilities with dynamic import for Firebase libraries
 * This ensures Firebase is only loaded when actually needed for push notifications
 *
 * NOTE: Currently push notifications are not used in the main application.
 * This file is prepared for future push notification implementation.
 */

import * as React from "react"

// Type definitions for Firebase (to avoid importing the full library)
export interface FirebaseConfig {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
  measurementId?: string
}

export interface NotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  data?: Record<string, any>
}

export interface FirebaseComponents {
  initializeApp: any
  getApp: any
  getApps: any
  getMessaging: any
  getToken: any
  onMessage: any
  isSupported: any
}

/**
 * Dynamically import Firebase libraries only when needed
 * This reduces initial bundle size by ~2.8MB
 */
export async function loadFirebaseLibraries(): Promise<FirebaseComponents> {
  try {
    // Dynamic import - only loads when this function is called
    const [firebaseApp, firebaseMessaging] = await Promise.all([
      import('firebase/app'),
      import('firebase/messaging')
    ])

    return {
      initializeApp: firebaseApp.initializeApp,
      getApp: firebaseApp.getApp,
      getApps: firebaseApp.getApps,
      getMessaging: firebaseMessaging.getMessaging,
      getToken: firebaseMessaging.getToken,
      onMessage: firebaseMessaging.onMessage,
      isSupported: firebaseMessaging.isSupported,
    }
  } catch (error) {
    console.error('Failed to load Firebase libraries:', error)
    throw new Error('Không thể tải thư viện Firebase. Vui lòng thử lại.')
  }
}

/**
 * Initialize Firebase with dynamic loading
 */
export async function initializeFirebase(config: FirebaseConfig): Promise<any> {
  const { initializeApp, getApp, getApps } = await loadFirebaseLibraries()

  let firebaseApp: any

  if (!getApps().length) {
    firebaseApp = initializeApp(config)
  } else {
    firebaseApp = getApp()
  }

  return firebaseApp
}

/**
 * Initialize Firebase Messaging with dynamic loading
 */
export async function initializeFirebaseMessaging(config: FirebaseConfig): Promise<any> {
  const { getMessaging, isSupported } = await loadFirebaseLibraries()

  if (await isSupported()) {
    const firebaseApp = await initializeFirebase(config)
    return getMessaging(firebaseApp)
  }

  console.warn('Firebase Messaging is not supported in this browser.')
  return null
}

/**
 * Request notification permission and get FCM token
 */
export async function requestNotificationPermissionAndGetToken(
  config: FirebaseConfig,
  vapidKey: string
): Promise<string | null> {
  try {
    const { getToken } = await loadFirebaseLibraries()
    const messaging = await initializeFirebaseMessaging(config)

    if (!messaging) return null

    const permission = await Notification.requestPermission()

    if (permission === 'granted') {
      console.log('Notification permission granted.')

      const currentToken = await getToken(messaging, { vapidKey })

      if (currentToken) {
        console.log('FCM Token:', currentToken)
        return currentToken
      } else {
        console.log('No registration token available. Request permission to generate one.')
        return null
      }
    } else {
      console.log('Unable to get permission to notify.')
      return null
    }
  } catch (error) {
    console.error('An error occurred while either requesting permission or retrieving token. ', error)
    return null
  }
}

/**
 * Handle incoming messages when the app is in the foreground
 */
export async function onForegroundMessage(
  config: FirebaseConfig,
  callback: (payload: any) => void
): Promise<void> {
  try {
    const { onMessage } = await loadFirebaseLibraries()
    const messaging = await initializeFirebaseMessaging(config)

    if (messaging) {
      onMessage(messaging, (payload) => {
        console.log('Message received in foreground. ', payload)
        callback(payload)
      })
    }
  } catch (error) {
    console.error('Failed to setup foreground message listener:', error)
  }
}

/**
 * Send FCM token to server
 */
export async function sendTokenToServer(
  token: string,
  userId: string,
  apiEndpoint: string = '/api/save-fcm-token'
): Promise<boolean> {
  try {
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, userId }),
    })

    if (response.ok) {
      console.log('Token sent to server successfully.')
      return true
    } else {
      console.error('Failed to send token to server.')
      return false
    }
  } catch (error) {
    console.error('Error sending token to server:', error)
    return false
  }
}

/**
 * Firebase loading component to show while Firebase is being loaded
 */
export function FirebaseLoadingFallback() {
  return (
    <div className="flex items-center justify-center p-4">
      <div className="text-center space-y-2">
        <img src="/Logo master.png" alt="Loading" className="w-10 h-10 object-contain mx-auto animate-pulse" />
        <p className="text-xs text-muted-foreground">Đang tải thông báo...</p>
      </div>
    </div>
  )
}

/**
 * Error fallback component for Firebase loading failures
 */
export function FirebaseErrorFallback({
  error,
  onRetry
}: {
  error: Error
  onRetry?: () => void
}) {
  return (
    <div className="flex items-center justify-center p-4">
      <div className="text-center space-y-2">
        <div className="w-6 h-6 rounded-full bg-destructive/20 flex items-center justify-center mx-auto">
          <span className="text-destructive text-xs">!</span>
        </div>
        <div>
          <p className="text-xs font-medium text-destructive">Lỗi thông báo</p>
          <p className="text-xs text-muted-foreground">{error.message}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-xs text-primary hover:underline"
          >
            Thử lại
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Check if push notifications are supported
 */
export function isPushNotificationSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
}

/**
 * Check if notifications are enabled
 */
export function areNotificationsEnabled(): boolean {
  return (
    isPushNotificationSupported() &&
    Notification.permission === 'granted'
  )
}

/**
 * Default Firebase configuration (placeholder)
 * Replace with actual configuration when implementing push notifications
 */
export const DEFAULT_FIREBASE_CONFIG: FirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? ''
}

export const DEFAULT_FIREBASE_VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? ''

/**
 * Check if Firebase configuration is valid
 */
export function isFirebaseConfigValid(config: FirebaseConfig): boolean {
  return (
    Boolean(config.apiKey) &&
    Boolean(config.projectId) &&
    Boolean(config.appId)
  )
}
