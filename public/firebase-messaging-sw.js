// Import the Firebase app and messaging modules
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// IMPORTANT: Replace with your project's Firebase actual configuration
const firebaseConfig = {
  apiKey: "YOUR_API_KEY", // TODO: Replace with actual config
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com", // TODO: Replace with actual config
  projectId: "YOUR_PROJECT_ID", // TODO: Replace with actual config
  storageBucket: "YOUR_PROJECT_ID.appspot.com", // TODO: Replace with actual config
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID", // TODO: Replace with actual config
  appId: "YOUR_APP_ID", // TODO: Replace with actual config
  // measurementId: "G-YOUR_MEASUREMENT_ID" // Optional
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const messaging = firebase.messaging();

// Optional: Background Message Handler
// If you want to customize a notification that is displayed when your app is in the background,
// listen for the 'backgroundMessage' event.
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  // Customize notification here
  const notificationTitle = payload.notification?.title || 'Thông báo mới';
  const notificationOptions = {
    body: payload.notification?.body || 'Bạn có tin nhắn mới.',
    icon: payload.notification?.icon || '/icons/icon-192x192.png', // Default icon
    data: payload.data // This will be available when the notification is clicked
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Optional: Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click Received.', event.notification.data);
  event.notification.close();

  const urlToOpen = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : '/'; // Default URL to open

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a tab open with the target URL
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        // If client is already open and has the same URL, focus it.
        // You might need to adjust the URL comparison logic if it includes query params or hashes.
        if (client.url === self.location.origin + urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If no such client is found, open a new tab/window.
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

console.log('[firebase-messaging-sw.js] Service Worker initialized.');
