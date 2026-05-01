'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { Bell, RefreshCw } from 'lucide-react';
import { Logo } from '@/components/logo';
import { useFirebase, initializeFirebase } from '@/firebase';
import { collection, query, where, getDocs, onSnapshot, orderBy, limit, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getToken, onMessage } from 'firebase/messaging';
import { useState, useEffect, useRef } from 'react';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { useToast } from '@/hooks/use-toast';

const navItems = [
  { href: '/dashboard', label: 'Αρχική', icon: Icons.dashboard },
  { href: '/suppliers', label: 'Προμηθευτές', icon: Icons.suppliers },
  { href: '/orders/new', label: 'Παραγγελία', icon: Icons.plus },
  { href: '/inventory', label: 'Αποθήκη', icon: Icons.inventory },
  { href: '/orders/history', label: 'Ιστορικό', icon: Icons.history },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, firestore } = useFirebase();
  const [storeName, setStoreName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [indexErrorLink, setIndexErrorLink] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [scrollContainerRef] = useState(() => ({ current: null as HTMLDivElement | null }));
  const { toast } = useToast();
  const lastNotifId = useRef<string | null>(null);

  useEffect(() => {
    if (user && firestore) {
      const getStoreData = async () => {
        const storesRef = collection(firestore, 'stores');
        const qStoreManager = query(storesRef, where("managerUids", "array-contains", user.uid));
        const qStoreOwner = query(storesRef, where("ownerId", "==", user.uid));

        const [storeManagerSnap, storeOwnerSnap] = await Promise.all([
          getDocs(qStoreManager),
          getDocs(qStoreOwner)
        ]);

        let data = null;
        if (!storeOwnerSnap.empty) {
            data = storeOwnerSnap.docs[0].data();
        } else if (!storeManagerSnap.empty) {
            data = storeManagerSnap.docs[0].data();
        }

        if (data) {
            setStoreName(data.businessName || 'Το Κατάστημά μου');
            setLogoUrl(data.logoUrl || '');
        }
      };
      getStoreData();
    }
  }, [user, firestore]);

  // Real-time notifications listener
  useEffect(() => {
    if (!user || !firestore) return;

    const notifQuery = query(
      collection(firestore, 'notifications'),
      where('recipientUid', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(notifQuery, (snapshot) => {
      console.log("[DEBUG] Notification snapshot received. Docs:", snapshot.docs.length);
      const docs = snapshot.docs;
      const unread = docs.filter(d => !d.data().read).length;
      setUnreadCount(unread);

      // Show toast for the newest notification if it's new
      if (docs.length > 0) {
        const newest = docs[0];
        const data = newest.data();
        if (lastNotifId.current !== newest.id && !data.read) {
          lastNotifId.current = newest.id;
          
          // Only show toast if it was created recently (to avoid toast storm on first load)
          let createdAt: Date;
          try {
            if (data.createdAt && typeof data.createdAt.toDate === 'function') {
                createdAt = data.createdAt.toDate();
            } else if (data.date) {
                createdAt = new Date(data.date);
            } else {
                createdAt = new Date();
            }
          } catch (e) {
            createdAt = new Date();
          }
          if (new Date().getTime() - createdAt.getTime() < 60000) {
            toast({
              title: data.title,
              description: data.description,
              action: (
                <Link href="/notifications" className="bg-primary text-primary-foreground px-3 py-1 rounded-md text-sm font-medium">
                  Προβολή
                </Link>
              ),
            });
          }
        }
      }
    }, (error: any) => {
        console.error('[CRITICAL DEBUG] Notification listener error:', error.code, error.message);
        const message = error.message || '';
        const linkMatch = message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
        if (linkMatch) {
            setIndexErrorLink(linkMatch[0]);
        }
    });

    return () => unsubscribe();
  }, [user, firestore, toast]);

  // Handle FCM Token Registration
  useEffect(() => {
    if (!user || !firestore || typeof window === 'undefined') return;

    const setupMessaging = async () => {
        try {
            const { messaging } = initializeFirebase();
            if (!messaging) return;

            // Request permission
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                console.log('[DEBUG] Notification permission denied');
                return;
            }

            // Register service worker manually to avoid registration timeout
            const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

            // Get token
            const token = await getToken(messaging, {
                vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
                serviceWorkerRegistration: registration
            });

            if (token) {
                console.log('[DEBUG] FCM Token generated:', token);
                // Save token to Firestore
                await setDoc(doc(firestore, 'fcmTokens', token), {
                    token,
                    userId: user.uid,
                    updatedAt: serverTimestamp()
                }, { merge: true });
            }
        } catch (error) {
            console.error('[DEBUG] Error setting up messaging:', error);
        }
    };

    setupMessaging();

    // Listen for foreground messages
    const { messaging } = initializeFirebase();
    if (messaging) {
        const unsubscribe = onMessage(messaging, (payload) => {
            console.log('[DEBUG] Foreground message received:', payload);
            toast({
                title: payload.notification?.title || 'Νέα ειδοποίηση',
                description: payload.notification?.body || '',
            });
        });
        return () => unsubscribe();
    }
  }, [user, firestore, toast]);

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-background">
      <header className="z-20 flex h-16 shrink-0 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
        <div className="flex flex-1 items-center gap-2">
            <Logo className="h-8 w-8" />
            <span className="font-headline text-xl font-semibold tracking-tight flex items-baseline">
              Orderia
              {storeName ? <span className="text-muted-foreground font-normal text-sm ml-2 hidden sm:inline-block">({storeName})</span> : null}
            </span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/notifications">
            <Button variant="ghost" size="icon" className="rounded-full relative">
              <Bell className="h-5 w-5 text-primary" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-background animate-pulse" />
              )}
              <span className="sr-only">Εναλλαγή ειδοποιήσεων</span>
            </Button>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-9 w-9 border-2 border-primary/50">
                  <AvatarImage src={logoUrl || "https://picsum.photos/seed/avatar/100/100"} alt="Logo" className="object-cover" />
                  <AvatarFallback>{storeName?.substring(0, 2).toUpperCase() || 'ST'}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Ο Λογαριασμός μου</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><Link href="/account">Τα Στοιχεία μου</Link></DropdownMenuItem>
              <DropdownMenuItem>Ρυθμίσεις</DropdownMenuItem>
              <DropdownMenuItem>Υποστήριξη</DropdownMenuItem>
              <DropdownMenuItem asChild><Link href="/">Αποσύνδεση</Link></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => window.location.reload()}
                className="text-primary font-bold flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Ανανέωση Εφαρμογής
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:px-6 md:pt-6"
      >
        <PullToRefresh rootRef={scrollContainerRef}>
          <div className="pb-24 sm:pb-8">
            {indexErrorLink && (
                <Card className="mb-4 border-red-500 bg-red-500/10 mx-1">
                    <CardHeader className="p-3 pb-2">
                        <div className="flex items-center gap-2 text-red-600">
                            <Bell className="h-4 w-4" />
                            <CardTitle className="text-xs font-bold uppercase tracking-tight">Database Index Missing</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                        <p className="text-[11px] text-red-600/90 mb-3 leading-tight font-medium">
                            Οι ειδοποιήσεις δεν μπορούν να φορτώσουν. Παρακαλούμε πατήστε το παρακάτω κουμπί για να το διορθώσετε.
                        </p>
                        <Button 
                            className="w-full h-9 bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
                            onClick={() => window.open(indexErrorLink, '_blank')}
                        >
                            Δημιουργία Index
                        </Button>
                    </CardContent>
                </Card>
            )}
            {children}
          </div>
        </PullToRefresh>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 shrink-0 border-t bg-background/98 backdrop-blur-md pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <div className="grid h-16 grid-cols-5 items-center justify-items-center">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = activeTab === href || (activeTab === null && (pathname === href || (href !== '/' && pathname.startsWith(href))));
            return (
              <Link
                key={label}
                href={href}
                onClick={() => setActiveTab(href)}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 p-2 text-[10px] font-bold transition-colors w-full h-full',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <Icon className={cn(
                  "h-6 w-6 transition-transform",
                  isActive && "scale-110"
                )} />
                <span className="leading-none">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
