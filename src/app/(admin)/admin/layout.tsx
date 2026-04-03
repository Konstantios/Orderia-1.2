
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { Bell, LogOut, Settings, PanelLeft } from 'lucide-react';
import { Logo } from '@/components/logo';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/admin/dashboard', label: 'Πίνακας Ελέγχου', icon: Icons.dashboard },
  { href: '/admin/orders', label: 'Παραγγελίες', icon: Icons.newOrder },
  { href: '/admin/customers', label: 'Πελάτες', icon: Icons.customers },
  { href: '/admin/warehouse', label: 'Αποθήκη', icon: Icons.warehouse },
  { href: '/admin/reports', label: 'Αναφορές', icon: Icons.reports },
];

function NavLink({ href, icon: Icon, children, pathname }: { href: string; icon: React.ElementType; children: React.ReactNode, pathname: string }) {
    const isActive = pathname === href;
    return (
        <Link
            href={href}
            className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                isActive && "bg-muted text-primary"
            )}
        >
            <Icon className="h-4 w-4" />
            {children}
        </Link>
    );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  return (
      <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
        <div className="hidden border-r bg-muted/40 md:block">
            <div className="flex h-full max-h-screen flex-col gap-2">
                <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
                    <Link href="/" className="flex items-center gap-2 font-semibold">
                        <Logo className="h-8 w-8" />
                        <span className="font-headline text-xl">Orderia</span>
                    </Link>
                </div>
                <div className="flex-1">
                    <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
                        {navItems.map(item => (
                            <NavLink key={item.href} href={item.href} icon={item.icon} pathname={pathname}>
                                {item.label}
                            </NavLink>
                        ))}
                    </nav>
                </div>
                <div className="mt-auto p-4 border-t">
                    <nav className="grid gap-1">
                         <NavLink href="#" icon={Settings} pathname={pathname}>Ρυθμίσεις</NavLink>
                         <NavLink href="/" icon={LogOut} pathname={pathname}>Αποσύνδεση</NavLink>
                    </nav>
                </div>
            </div>
        </div>
        <div className="flex flex-col">
            <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
                <Sheet>
                    <SheetTrigger asChild>
                        <Button
                            variant="outline"
                            size="icon"
                            className="shrink-0 md:hidden"
                        >
                            <PanelLeft className="h-5 w-5" />
                            <span className="sr-only">Toggle navigation menu</span>
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="flex flex-col">
                         <nav className="grid gap-2 text-lg font-medium">
                            <Link
                                href="#"
                                className="flex items-center gap-2 text-lg font-semibold mb-4"
                            >
                                <Logo className="h-8 w-8" />
                                <span className="font-headline text-xl">Orderia</span>
                            </Link>
                            {navItems.map(item => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        "mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground",
                                        pathname === item.href && "bg-muted text-foreground"
                                    )}
                                >
                                    <item.icon className="h-5 w-5" />
                                    {item.label}
                                </Link>
                            ))}
                        </nav>
                        <div className="mt-auto border-t pt-4">
                           <nav className="grid gap-2 text-lg font-medium">
                                <Link
                                    href="#"
                                    className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground"
                                >
                                    <Settings className="h-5 w-5" />
                                    Ρυθμίσεις
                                </Link>
                                <Link
                                    href="/"
                                    className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground"
                                >
                                    <LogOut className="h-5 w-5" />
                                    Αποσύνδεση
                                </Link>
                           </nav>
                        </div>
                    </SheetContent>
                </Sheet>
                <div className="w-full flex-1">
                    {/* Can be used for a search bar in the future */}
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
        </div>
      </div>
  );
}
