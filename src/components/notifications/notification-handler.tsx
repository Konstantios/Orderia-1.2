'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onMessage } from 'firebase/messaging';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';

export function NotificationHandler() {
    const router = useRouter();
    const { firebaseApp, user } = useFirebase();
    const { toast } = useToast();

    useEffect(() => {
        if (typeof window === 'undefined') return;

        // 1. Handle messages from Service Worker (Background notification clicks)
        const handleServiceWorkerMessage = (event: MessageEvent) => {
            if (event.data && event.data.type === 'NAVIGATE') {
                console.log('[NotificationHandler] Received NAVIGATE from SW:', event.data.url);
                router.push(event.data.url);
            }
        };

        navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);

        // 2. Handle foreground messages
        let unsubscribeMessaging: (() => void) | undefined;
        
        const setupForegroundMessaging = async () => {
            try {
                // We need to import getMessaging here to avoid SSR issues if not handled by useFirebase
                const { getMessaging, isSupported } = await import('firebase/messaging');
                const supported = await isSupported();
                if (!supported) return;

                const messaging = getMessaging(firebaseApp);
                unsubscribeMessaging = onMessage(messaging, (payload) => {
                    console.log('[NotificationHandler] Foreground message received:', payload);
                    
                    const title = payload.notification?.title || 'Νέα ειδοποίηση';
                    const body = payload.notification?.body || '';
                    const link = payload.data?.link || '/notifications';

                    toast({
                        title: title,
                        description: body,
                        action: (
                            <button 
                                onClick={() => router.push(link)}
                                className="bg-primary text-primary-foreground px-3 py-1 rounded-md text-sm font-medium"
                            >
                                Προβολή
                            </button>
                        ),
                    });
                });
            } catch (error) {
                console.error('[NotificationHandler] Error setting up messaging:', error);
            }
        };

        if (user) {
            setupForegroundMessaging();
        }

        return () => {
            navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
            if (unsubscribeMessaging) unsubscribeMessaging();
        };
    }, [firebaseApp, user, router, toast]);

    return null;
}
