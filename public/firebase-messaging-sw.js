// Import the Firebase app and messaging modules
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// IMPORTANT: Replace with your project's Firebase actual configuration
const firebaseConfig = {
  apiKey: "AIzaSyB2TmeaNGl6IPmb82AUpyvglVk5e6bGdNc",
  authDomain: "qltbyt-nam-phong.firebaseapp.com",
  projectId: "qltbyt-nam-phong",
  storageBucket: "qltbyt-nam-phong.firebasestorage.app",
  messagingSenderId: "362851817132",
  appId: "1:362851817132:web:48bc8b55d25160c023b109"
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
