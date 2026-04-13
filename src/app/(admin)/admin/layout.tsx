'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { Bell, LogOut, Settings, RefreshCw } from 'lucide-react';
import { Logo } from '@/components/logo';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, limit } from 'firebase/firestore';
import type { Wholesaler } from '@/lib/types';
import { useEffect } from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarTrigger,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
  useSidebar,
} from '@/components/ui/sidebar';

// Βοηθητικό component για το αυτόματο κλείσιμο του sidebar στο κινητό μετά από πλοήγηση
function MobileSidebarCloser() {
  const pathname = usePathname();
  const { setOpenMobile, isMobile } = useSidebar();

  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [pathname, isMobile, setOpenMobile]);

  return null;
}

const navItems = [
  { href: '/admin/dashboard', label: 'Πίνακας Ελέγχου', icon: Icons.dashboard },
  { href: '/admin/orders', label: 'Παραγγελίες', icon: Icons.newOrder },
  { href: '/admin/orders/history', label: 'Ιστορικό', icon: Icons.history },
  { href: '/admin/customers', label: 'Πελάτες', icon: Icons.customers },
  { href: '/admin/products', label: 'Προϊόντα', icon: Icons.inventory },
  { href: '/admin/warehouse', label: 'Αποθήκη', icon: Icons.warehouse },
  { href: '/admin/reports', label: 'Αναφορές', icon: Icons.reports },
  { href: '/admin/team', label: 'Ομάδα', icon: Icons.team },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, firestore } = useFirebase();

  const [scrollContainerRef] = useState(() => ({ current: null as HTMLElement | null }));

  const wholesalerQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'wholesalers'), where('adminUids', 'array-contains', user.uid), limit(1));
  }, [user, firestore]);
  const { data: wholesalers } = useCollection<Wholesaler>(wholesalerQuery);
  const wholesaler = wholesalers?.[0];

  return (
    <SidebarProvider className="h-[100dvh] overflow-hidden">
        <MobileSidebarCloser />
        <Sidebar collapsible="icon" className="border-r bg-muted/40 h-full">
            <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
                <Link href="/" className="flex items-center gap-2 font-semibold">
                    <Logo className="h-8 w-8" />
                    <span className="font-headline text-xl group-data-[state=collapsed]:hidden">Orderia</span>
                </Link>
            </div>
            <SidebarContent className="flex-1">
                <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
                    <SidebarMenu>
                        {navItems.map(item => (
                            <SidebarMenuItem key={item.href}>
                                <SidebarMenuButton
                                    asChild
                                    isActive={pathname === item.href}
                                    tooltip={item.label}
                                >
                                    <Link href={item.href}>
                                        <item.icon />
                                        <span>{item.label}</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </nav>
            </SidebarContent>
            <SidebarFooter className="mt-auto border-t p-4">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild tooltip="Ρυθμίσεις" isActive={pathname === '/admin/account'}>
                            <Link href="/admin/account">
                                <Settings />
                                <span>Ρυθμίσεις</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild tooltip="Αποσύνδεση">
                            <Link href="/">
                                <LogOut />
                                <span>Αποσύνδεση</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton 
                            tooltip="Ανανέωση Εφαρμογής" 
                            onClick={() => window.location.reload()}
                            className="text-primary hover:text-primary"
                        >
                            <RefreshCw />
                            <span className="font-bold">Ανανέωση Εφαρμογής</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
        <SidebarInset className="flex flex-col h-full overflow-hidden">
            <header className="flex h-14 shrink-0 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
                <SidebarTrigger className="shrink-0"/>
                <div className="w-full flex-1">
                     {wholesaler && (
                        <span className="font-headline text-lg font-semibold text-foreground">
                            {wholesaler.companyName}
                        </span>
                     )}
                </div>
                <Button variant="ghost" size="icon" className="rounded-full">
                    <Bell className="h-5 w-5" />
                </Button>
                <Avatar>
                    <AvatarImage src={wholesaler?.logoUrl || "https://picsum.photos/seed/admin/100/100"} data-ai-hint="company manager" />
                    <AvatarFallback>{wholesaler?.companyName?.substring(0, 2).toUpperCase() || 'AD'}</AvatarFallback>
                </Avatar>
            </header>
            <main 
                ref={scrollContainerRef as any}
                className="flex-1 overflow-y-auto p-4 lg:gap-6 lg:p-6"
            >
                <PullToRefresh rootRef={scrollContainerRef as any}>
                    {children}
                </PullToRefresh>
            </main>
        </SidebarInset>
    </SidebarProvider>
  );
}
