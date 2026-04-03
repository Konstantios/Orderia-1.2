'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { Bell, LogOut, Settings } from 'lucide-react';
import { Logo } from '@/components/logo';
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
} from '@/components/ui/sidebar';

const navItems = [
  { href: '/admin/dashboard', label: 'Πίνακας Ελέγχου', icon: Icons.dashboard },
  { href: '/admin/orders', label: 'Παραγγελίες', icon: Icons.newOrder },
  { href: '/admin/customers', label: 'Πελάτες', icon: Icons.customers },
  { href: '/admin/warehouse', label: 'Αποθήκη', icon: Icons.warehouse },
  { href: '/admin/reports', label: 'Αναφορές', icon: Icons.reports },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <SidebarProvider>
        <Sidebar collapsible="icon" className="border-r bg-muted/40">
            <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
                <Link href="/" className="flex items-center gap-2 font-semibold">
                    <Logo className="h-8 w-8" />
                    <span className="font-headline text-xl">Orderia</span>
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
                        <SidebarMenuButton asChild tooltip="Ρυθμίσεις">
                            <Link href="#">
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
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
        <SidebarInset>
            <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
                <SidebarTrigger className="shrink-0"/>
                <div className="w-full flex-1">
                     {/* Search bar can go here */}
                </div>
                <Button variant="ghost" size="icon" className="rounded-full">
                    <Bell className="h-5 w-5" />
                </Button>
                <Avatar>
                    <AvatarImage src="https://picsum.photos/seed/admin/100/100" data-ai-hint="company manager" />
                    <AvatarFallback>AD</AvatarFallback>
                </Avatar>
            </header>
            <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
                {children}
            </main>
        </SidebarInset>
    </SidebarProvider>
  );
}
