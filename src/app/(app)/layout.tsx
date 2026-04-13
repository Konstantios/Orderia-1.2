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
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useState, useEffect } from 'react';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';

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
  const [scrollContainerRef] = useState(() => ({ current: null as HTMLDivElement | null }));

  useEffect(() => {
    if (user && firestore) {
      const getStoreName = async () => {
        const storesRef = collection(firestore, 'stores');
        const qStoreManager = query(storesRef, where("managerUids", "array-contains", user.uid));
        const qStoreOwner = query(storesRef, where("ownerId", "==", user.uid));

        const [storeManagerSnap, storeOwnerSnap] = await Promise.all([
          getDocs(qStoreManager),
          getDocs(qStoreOwner)
        ]);

        if (!storeOwnerSnap.empty) {
            setStoreName(storeOwnerSnap.docs[0].data().businessName || 'Το Κατάστημά μου');
        } else if (!storeManagerSnap.empty) {
            setStoreName(storeManagerSnap.docs[0].data().businessName || 'Το Κατάστημά μου');
        }
      };
      getStoreName();
    }
  }, [user, firestore]);

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
          <Button variant="ghost" size="icon" className="rounded-full">
            <Bell className="h-5 w-5 text-primary" />
            <span className="sr-only">Εναλλαγή ειδοποιήσεων</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-9 w-9 border-2 border-primary/50">
                  <AvatarImage src="https://picsum.photos/seed/avatar/100/100" alt="Avatar" data-ai-hint="bakery owner" />
                  <AvatarFallback>FG</AvatarFallback>
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
          <div className="pb-[calc(2rem+env(safe-area-inset-bottom))]">
            {children}
          </div>
        </PullToRefresh>
      </main>

      <nav className="z-20 shrink-0 border-t bg-background/98 backdrop-blur-md pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <div className="grid h-16 grid-cols-5 items-center justify-items-center">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 p-2 text-[10px] font-bold transition-colors',
                pathname === href || (href !== '/' && pathname.startsWith(href)) ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon className={cn(
                "h-6 w-6 transition-transform",
                (pathname === href || (href !== '/' && pathname.startsWith(href))) && "scale-110"
              )} />
              <span className="leading-none">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
