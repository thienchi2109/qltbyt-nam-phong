// Import the Firebase app and messaging modules
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// Fetch Firebase config at runtime to avoid hard-coded secrets in the repo
const messagingPromise = (async () => {
  try {
    const res = await fetch('/api/firebase/config');
    if (!res.ok) {
      throw new Error(`Failed to load Firebase config: ${res.status}`);
    }
    const firebaseConfig = await res.json();
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    return firebase.messaging();
  } catch (err) {
    console.error('[firebase-messaging-sw.js] Unable to initialize Firebase Messaging', err);
    return null;
  }
})();

// Optional: Background Message Handler
// If you want to customize a notification that is displayed when your app is in the background,
// listen for the 'backgroundMessage' event.
messagingPromise.then((messaging) => {
  if (!messaging) return;

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
