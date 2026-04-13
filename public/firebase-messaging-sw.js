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
        const notificationTitle = payload.notification.title || 'Νέα ειδοποίηση';
        const notificationOptions = {
            body: payload.notification.body || '',
            icon: '/favicon.ico'
        };

        if (self.registration) {
            self.registration.showNotification(notificationTitle, notificationOptions);
        }
    });
    console.log('[SW] Messaging initialized successfully');
} catch (error) {
    console.error('[SW] Initialization error:', error);
}

// Minimal fetch handler to satisfy PWA installation criteria
self.addEventListener('fetch', (event) => {
    // This can be empty, but must exist
});
