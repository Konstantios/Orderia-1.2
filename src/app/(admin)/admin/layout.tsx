'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
  useSidebar,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { Bell, LogOut, Settings, PanelLeft } from 'lucide-react';
import { Logo } from '@/components/logo';

const navItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: Icons.dashboard },
  { href: '/admin/orders', label: 'Orders', icon: Icons.newOrder },
  { href: '/admin/customers', label: 'Customers', icon: Icons.customers },
  { href: '/admin/warehouse', label: 'Warehouse', icon: Icons.warehouse },
  { href: '/admin/reports', label: 'Reports', icon: Icons.reports },
];

function AdminHeader() {
    const { toggleSidebar } = useSidebar();
    return (
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
          <Button size="icon" variant="outline" className="sm:hidden" onClick={toggleSidebar}>
            <PanelLeft className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
          <div className="flex-1">
             <h1 className="font-headline text-2xl font-semibold">Wholesaler Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" className="rounded-full">
                <Bell className="h-5 w-5" />
            </Button>
            <Avatar>
                <AvatarImage src="https://picsum.photos/seed/admin/100/100" data-ai-hint="company manager" />
                <AvatarFallback>AD</AvatarFallback>
            </Avatar>
          </div>
        </header>
    )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full flex-col">
        <Sidebar>
            <SidebarHeader>
                <div className="flex items-center gap-2">
                    <Logo className="h-10 w-10" />
                    <span className="font-headline text-xl font-semibold">Orderia</span>
                </div>
            </SidebarHeader>
            <SidebarContent className="p-2">
                <SidebarMenu>
                    {navItems.map(item => (
                        <SidebarMenuItem key={item.href}>
                            <Link href={item.href}>
                                <SidebarMenuButton isActive={pathname.startsWith(item.href)}>
                                    <item.icon />
                                    <span>{item.label}</span>
                                </SidebarMenuButton>
                            </Link>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarContent>
            <SidebarFooter className="border-t">
                 <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton>
                            <Settings />
                            <span>Settings</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <Link href="/">
                            <SidebarMenuButton>
                                <LogOut />
                                <span>Logout</span>
                            </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                 </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
        <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14">
            <AdminHeader />
            <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
                {children}
            </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
