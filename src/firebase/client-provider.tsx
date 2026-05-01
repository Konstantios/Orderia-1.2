'use client';

import React, { useMemo, type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from './index';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

import { NotificationHandler } from '@/components/notifications/notification-handler';

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const firebaseServices = useMemo(() => {
    // Initialize Firebase on the client side, once per component mount.
    return initializeFirebase();
  }, []); // Empty dependency array ensures this runs only once on mount

  React.useEffect(() => {
    if ('serviceWorker' in navigator && typeof window !== 'undefined') {
      const register = () => {
        navigator.serviceWorker.register('/firebase-messaging-sw.js')
          .then(reg => console.log('[PWA] Service Worker registered:', reg.scope))
          .catch(err => console.error('[PWA] Service Worker registration failed:', err));
      };

      if (document.readyState === 'complete') {
        register();
      } else {
        window.addEventListener('load', register);
      }
    }
  }, []);

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
      storage={firebaseServices.storage}
    >
      <NotificationHandler />
      {children}
    </FirebaseProvider>
  );
}