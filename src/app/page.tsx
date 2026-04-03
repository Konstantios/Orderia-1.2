'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Logo } from '@/components/logo';
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Search } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [searchAfm, setSearchAfm] = useState('');
  const [foundBusiness, setFoundBusiness] = useState<{ name: string; afm: string } | null>(null);
  
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (email === 'admin@frozenfoods.gr' && password === 'fr1') {
      router.push('/admin/dashboard');
    } else if (email === 'user@igevsi.gr' && password === 'g1') {
      router.push('/dashboard');
    } else {
      toast({
        variant: 'destructive',
        title: 'Λάθος Στοιχεία Σύνδεσης',
        description: 'Ο συνδυασμός email και κωδικού δεν είναι σωστός.',
      });
    }
  };

  const handleSearchBusiness = () => {
    if (searchAfm === '111') {
      setFoundBusiness({ name: 'Frozen Foods', afm: '111' });
    } else if (searchAfm === '222') {
      setFoundBusiness({ name: 'Φούρνος "Η Γεύση"', afm: '222' });
    } else {
      setFoundBusiness(null);
      toast({
        variant: 'destructive',
        title: 'Δεν βρέθηκε επιχείρηση',
        description: 'Παρακαλώ ελέγξτε το ΑΦΜ που εισάγατε.',
      });
    }
  };

  const handleSendRequest = () => {
    toast({
      title: 'Το Αίτημα Στάλθηκε!',
      description: `Θα ειδοποιηθείτε μόλις ο διαχειριστής της "${foundBusiness?.name}" το εγκρίνει.`
    });
    setFoundBusiness(null);
    setSearchAfm('');
    setIsRequestDialogOpen(false);
  };

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
          <CardTitle>Σύνδεση</CardTitle>
          <CardDescription>Συμπληρώστε τα στοιχεία σας για να συνδεθείτε.</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="user@example.com"/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Κωδικός</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="remember-me" />
              <Label htmlFor="remember-me">Να με θυμάσαι</Label>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-lg h-12">
              Σύνδεση
            </Button>
             <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
                <DialogTrigger asChild>
                     <Button variant="link" className="text-muted-foreground">Δεν έχετε λογαριασμό; Στείλτε αίτημα</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Αναζήτηση Επιχείρησης</DialogTitle>
                        <DialogDescription>
                            Βρείτε την επιχείρησή σας με το ΑΦΜ για να στείλετε αίτημα συμμετοχής.
                        </DialogDescription>
                    </DialogHeader>
                    {!foundBusiness ? (
                         <div className="flex w-full items-center space-x-2 pt-4">
                            <Input 
                                type="text" 
                                placeholder="ΑΦΜ Επιχείρησης" 
                                value={searchAfm}
                                onChange={(e) => setSearchAfm(e.target.value)}
                            />
                            <Button type="button" size="icon" onClick={handleSearchBusiness}>
                                <Search className="h-4 w-4" />
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4 pt-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>{foundBusiness.name}</CardTitle>
                                    <CardDescription>ΑΦΜ: {foundBusiness.afm}</CardDescription>
                                </CardHeader>
                            </Card>
                             <Button type="button" className="w-full" onClick={handleSendRequest}>
                                Αποστολή Αιτήματος Συμμετοχής
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
