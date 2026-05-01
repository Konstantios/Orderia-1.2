importScripts('https://www.gstatic.com/firebasejs/11.2.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.2.0/firebase-messaging-compat.js');

console.log('[SW] Service Worker script loading (v11.2.0)...');

const firebaseConfig = {
    apiKey: "AIzaSyC2XkuMFUWWZLyeY6z36hQx52dUwYJVVQs",
    authDomain: "studio-7324950597-c1440.firebaseapp.com",
    projectId: "studio-7324950597-c1440",
    storageBucket: "studio-7324950597-c1440.appspot.com",
    messagingSenderId: "757566827736",
    appId: "1:757566827736:web:f2647238783f23494fbbad"
};

try {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
        console.log('[SW] Received background message ', payload);
        // We no longer call showNotification manually here because the Firebase SDK 
        // handles the 'notification' object in the payload automatically, 
        // avoiding duplicate notifications on a single device.
    });
    console.log('[SW] Messaging initialized successfully');
} catch (error) {
    console.error('[SW] Initialization error:', error);
}

// Handle notification clicks for navigation
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification click received', event.notification.data);
    event.notification.close();

    // The data might be nested depending on how FCM sends it
    const data = event.notification.data || {};
    const link = data.link || data.fcm_options?.link || '/notifications';
    const urlToOpen = new URL(link, self.location.origin).href;

    const promiseChain = clients.matchAll({
        type: 'window',
        includeUncontrolled: true
    }).then((windowClients) => {
        // Look for an existing window client
        for (const client of windowClients) {
            if (client.url === urlToOpen && 'focus' in client) {
                return client.focus();
            }
        }
        // If no matching window is open, try to focus any and navigate or open new
        if (windowClients.length > 0) {
            const client = windowClients[0];
            client.focus();
            return client.navigate(urlToOpen);
        } else {
            return clients.openWindow(urlToOpen);
        }
    });

    event.waitUntil(promiseChain);
});

// Minimal fetch handler to satisfy PWA installation criteria
self.addEventListener('fetch', (event) => {
    // This can be empty, but must exist
});
