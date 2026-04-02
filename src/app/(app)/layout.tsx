'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { Bell } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Logo } from '@/components/logo';

const navItems = [
  { href: '/dashboard', label: 'Αρχική', icon: Icons.dashboard },
  { href: '/suppliers', label: 'Προμηθευτές', icon: Icons.suppliers },
  { href: '/orders/new', label: 'Παραγγελία', icon: Icons.plus },
  { href: '/inventory', label: 'Αποθήκη', icon: Icons.inventory },
  { href: '/orders/history', label: 'Ιστορικό', icon: Icons.history },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
        <div className="flex flex-1 items-center gap-2">
            <Logo className="h-8 w-8" />
            <span className="font-headline text-xl font-semibold tracking-tight">
              Orderia
            </span>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-full">
            <Bell className="h-5 w-5 text-primary" />
            <span className="sr-only">Εναλλαγή ειδοποιήσεων</span>
          </Button>
          {isClient && (
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
                <DropdownMenuItem>Ρυθμίσεις</DropdownMenuItem>
                <DropdownMenuItem>Υποστήριξη</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link href="/">Αποσύνδεση</Link></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-20 md:px-6 md:pt-6">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-10 border-t bg-background/95 backdrop-blur-sm">
        <div className="grid h-16 grid-cols-5 items-center justify-items-center">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 p-2 text-xs font-medium',
                pathname.startsWith(href) ? 'text-accent' : 'text-muted-foreground'
              )}
            >
              <Icon className="h-6 w-6" />
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
