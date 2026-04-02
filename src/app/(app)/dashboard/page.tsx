import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { Bell, History, Package, ShoppingCart } from 'lucide-react';

const menuItems = [
  {
    title: 'Νέα Παραγγελία',
    description: 'Δημιουργήστε μια νέα εβδομαδιαία παραγγελία',
    href: '/orders/new',
    icon: ShoppingCart,
    color: 'text-accent',
  },
  {
    title: 'Απογραφή Αποθήκης',
    description: 'Ενημερώστε το απόθεμά σας',
    href: '/inventory',
    icon: Package,
    color: 'text-primary',
  },
  {
    title: 'Προτεινόμενη Παραγγελία',
    description: 'Έξυπνες προτάσεις',
    href: '/orders/new?suggested=true',
    icon: ShoppingCart,
    color: 'text-green-400',
  },
  {
    title: 'Ιστορικό Παραγγελιών',
    description: 'Δείτε τις προηγούμενες παραγγελίες σας',
    href: '/orders/history',
    icon: History,
    color: 'text-orange-400',
  },
  {
    title: 'Ειδοποιήσεις',
    description: '7 μη αναγνωσμένα μηνύματα',
    href: '/notifications',
    icon: Bell,
    color: 'text-red-400',
  },
];

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-headline text-3xl font-bold">Καλώς ήρθες, Φούρνος "Η Γεύση"</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {menuItems.map((item) => (
          <Link href={item.href} key={item.title}>
            <Card className="group h-full transform-gpu transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="font-headline text-lg font-medium">{item.title}</CardTitle>
                <item.icon className={`h-6 w-6 ${item.color} transition-transform group-hover:scale-110`} />
              </CardHeader>
              <div className="p-6 pt-0">
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
