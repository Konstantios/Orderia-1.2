'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Logo } from '@/components/logo';
import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [role, setRole] = useState<'store' | 'supplier'>('store');
  
  // State for store login
  const [storeName, setStoreName] = useState('η γεύση');
  const [storeAfm, setStoreAfm] = useState('222');
  const [storePassword, setStorePassword] = useState('g1');

  // State for supplier login
  const [supplierEmail, setSupplierEmail] = useState('admin@frozenfoods.gr');
  const [supplierPassword, setSupplierPassword] = useState('fr1');


  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (role === 'store') {
      if (storeName === 'η γεύση' && storeAfm === '222' && storePassword === 'g1') {
        router.push('/dashboard');
      } else {
        toast({
          variant: 'destructive',
          title: 'Λάθος Στοιχεία Σύνδεσης',
          description: 'Παρακαλώ ελέγξτε τα στοιχεία για το κατάστημα.',
        });
      }
    } else if (role === 'supplier') {
      if (supplierEmail === 'admin@frozenfoods.gr' && supplierPassword === 'fr1') {
        router.push('/admin/dashboard');
      } else {
        toast({
          variant: 'destructive',
          title: 'Λάθος Στοιχεία Σύνδεσης',
          description: 'Παρακαλώ ελέγξτε τα στοιχεία για τον προμηθευτή.',
        });
      }
    }
  };

  const StoreForm = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="store-name">Όνομα Καταστήματος</Label>
        <Input id="store-name" value={storeName} onChange={(e) => setStoreName(e.target.value)} required placeholder="π.χ. Η Γεύση" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="store-afm">ΑΦΜ</Label>
        <Input id="store-afm" value={storeAfm} onChange={(e) => setStoreAfm(e.target.value)} required placeholder="π.χ. 222" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="store-password">Κωδικός</Label>
        <Input id="store-password" type="password" value={storePassword} onChange={(e) => setStorePassword(e.target.value)} required />
      </div>
    </div>
  );
  
  const SupplierForm = (
     <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="supplier-email">Email</Label>
            <Input id="supplier-email" type="email" value={supplierEmail} onChange={(e) => setSupplierEmail(e.target.value)} required placeholder="π.χ. user@company.com"/>
          </div>
          <div className="space-y-2">
            <Label htmlFor="supplier-password">Κωδικός</Label>
            <Input id="supplier-password" type="password" value={supplierPassword} onChange={(e) => setSupplierPassword(e.target.value)} required />
          </div>
      </div>
  );

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center justify-center space-y-4">
        <Logo />
        <h1 className="font-headline text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
          Καλώς ήρθατε στην Orderia
        </h1>
        <p className="text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
          Ο ευφυής βοηθός παραγγελιών σας
        </p>
      </div>
      <Card className="mt-8 w-full max-w-sm border-2 border-primary/20 bg-card/80 shadow-lg shadow-primary/10">
        <CardHeader>
            <Tabs defaultValue="store" onValueChange={(value) => setRole(value as 'store' | 'supplier')} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="store">Κατάστημα</TabsTrigger>
                    <TabsTrigger value="supplier">Προμηθευτής</TabsTrigger>
                </TabsList>
            </Tabs>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {role === 'store' ? StoreForm : SupplierForm}
            <div className="flex items-center space-x-2">
              <Checkbox id="remember-me" />
              <Label htmlFor="remember-me">Να με θυμάσαι</Label>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-lg h-12">
              Σύνδεση
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
