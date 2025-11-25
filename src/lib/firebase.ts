import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

// Public Firebase config pulled from env (never include private keys here)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? ''
};

const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

let firebaseApp: FirebaseApp;

if (!getApps().length) {
  firebaseApp = initializeApp(firebaseConfig);
} else {
  firebaseApp = getApp();
}

const initializeFirebaseMessaging = async () => {
  if (await isSupported()) {
    return getMessaging(firebaseApp);
  }
  console.warn('Firebase Messaging is not supported in this browser.');
  return null;
};


// Function to request permission and get token
export const requestNotificationPermissionAndGetToken = async () => {
  const messaging = await initializeFirebaseMessaging();
  if (!messaging) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Notification permission granted.');
      if (!vapidKey) {
        console.error('Missing NEXT_PUBLIC_FIREBASE_VAPID_KEY.');
        return null;
      }
      // Get token. You need to pass your VAPID key to getToken()
      // The VAPID key is generated in your Firebase project settings -> Cloud Messaging -> Web configuration
      // It should be a long string of random characters
      const currentToken = await getToken(messaging, {
        vapidKey
      });
      if (currentToken) {
        console.log('FCM Token:', currentToken);
        // TODO: Send this token to your server and associate it with the current user
        // sendTokenToServer(currentToken);
        return currentToken;
      } else {
        console.log('No registration token available. Request permission to generate one.');
        return null;
      }
    } else {
      console.log('Unable to get permission to notify.');
      return null;
    }
  } catch (error) {
    console.error('An error occurred while either requesting permission or retrieving token. ', error);
    return null;
  }
};

// Function to handle incoming messages when the app is in the foreground
export const onForegroundMessage = async (callback: (payload: any) => void) => {
  const messaging = await initializeFirebaseMessaging();
  if (messaging) {
    onMessage(messaging, (payload) => {
      console.log('Message received in foreground. ', payload);
      // Typically, you would display a toast notification or update UI here
      // instead of a browser notification, as the user is already in the app.
      callback(payload);
    });
  }
};

// Example function to simulate sending token to server
// You'll need to implement this properly with your backend API
/*
const sendTokenToServer = async (token: string) => {
  try {
    // Assume you have an API endpoint to save the token
    const response = await fetch('/api/save-fcm-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, userId: 'CURRENT_USER_ID' }), // Send user ID if available
    });
    if (response.ok) {
      console.log('Token sent to server successfully.');
    } else {
      console.error('Failed to send token to server.');
    }
  } catch (error) {
    console.error('Error sending token to server:', error);
  }
};
*/

export { firebaseApp };
