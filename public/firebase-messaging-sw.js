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

    // The URL to navigate to is usually passed in the fcm_options.link 
    // which the SDK handles, but we can also handle it here for maximum compatibility.
    const urlToOpen = new URL('/orders/new', self.location.origin).href;

    const promiseChain = clients.matchAll({
        type: 'window',
        includeUncontrolled: true
    }).then((windowClients) => {
        let matchingClient = null;

        for (let i = 0; i < windowClients.length; i++) {
            const windowClient = windowClients[i];
            if (windowClient.url === urlToOpen) {
                matchingClient = windowClient;
                break;
            }
        }

        if (matchingClient) {
            return matchingClient.focus();
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
