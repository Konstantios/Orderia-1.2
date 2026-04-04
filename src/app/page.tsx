'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Logo } from '@/components/logo';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Search, Building, UserPlus, ArrowLeft } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [dialogView, setDialogView] = useState<'initial' | 'join' | 'register'>('initial');
  
  // State for joining
  const [searchAfm, setSearchAfm] = useState('');
  const [foundBusiness, setFoundBusiness] = useState<{ name: string; afm: string } | null>(null);

  // Reset dialog state on close
  useEffect(() => {
    if (!isRequestDialogOpen) {
        // Use a timeout to avoid seeing the state change before the dialog closes
        setTimeout(() => {
            setDialogView('initial');
            setSearchAfm('');
            setFoundBusiness(null);
        }, 200);
    }
  }, [isRequestDialogOpen]);

  
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
  
  const handleRegisterBusiness = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const businessName = formData.get('businessName');

    toast({
        title: 'Η Επιχείρηση Καταχωρήθηκε!',
        description: `Ο λογαριασμός για την επιχείρηση "${businessName}" δημιουργήθηκε. Μπορείτε πλέον να συνδεθείτε.`
    });
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
                     <Button variant="link" className="text-muted-foreground">Δεν έχετε λογαριασμό; Κάντε εγγραφή</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                    {dialogView !== 'initial' && (
                        <Button variant="ghost" size="sm" className="absolute left-4 top-4 text-muted-foreground z-10" onClick={() => setDialogView('initial')}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Πίσω
                        </Button>
                    )}

                    {dialogView === 'initial' && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Εγγραφή ή Συμμετοχή</DialogTitle>
                                <DialogDescription>Δημιουργήστε ένα νέο λογαριασμό ή συνδεθείτε σε μια υπάρχουσα επιχείρηση.</DialogDescription>
                            </DialogHeader>
                            <div className="grid grid-cols-1 gap-4 pt-4">
                               <Card onClick={() => setDialogView('register')} className="cursor-pointer hover:bg-muted/50 hover:border-primary transition-colors">
                                   <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                                       <Building className="h-10 w-10 text-primary" />
                                       <div>
                                           <CardTitle>Εγγραφή Νέας Επιχείρησης</CardTitle>
                                           <CardDescription>Για ιδιοκτήτες που καταχωρούν την επιχείρησή τους για πρώτη φορά.</CardDescription>
                                       </div>
                                   </CardHeader>
                               </Card>
                               <Card onClick={() => setDialogView('join')} className="cursor-pointer hover:bg-muted/50 hover:border-accent transition-colors">
                                   <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                                       <UserPlus className="h-10 w-10 text-accent" />
                                       <div>
                                           <CardTitle>Αίτημα Συμμετοχής</CardTitle>
                                           <CardDescription>Αν η επιχείρησή σας είναι ήδη στην πλατφόρμα και θέλετε πρόσβαση.</CardDescription>
                                       </div>
                                   </CardHeader>
                               </Card>
                            </div>
                        </>
                    )}
                    
                    {dialogView === 'join' && (
                        <>
                             <DialogHeader className="pt-8 sm:pt-0">
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
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearchBusiness()}
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
                                     <div className="space-y-2">
                                        <Label htmlFor="joinerName">Το Ονοματεπώνυμό σας</Label>
                                        <Input id="joinerName" name="joinerName" required defaultValue="Γιώργος Παπαδάκης"/>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="joinerEmail">Το Email σας</Label>
                                        <Input id="joinerEmail" name="joinerEmail" type="email" required defaultValue="g.papadakis@email.com" />
                                    </div>
                                    <Button type="button" className="w-full" onClick={handleSendRequest}>
                                        Αποστολή Αιτήματος Συμμετοχής
                                    </Button>
                                </div>
                            )}
                        </>
                    )}

                    {dialogView === 'register' && (
                        <>
                             <DialogHeader className="pt-8 sm:pt-0">
                                <DialogTitle>Εγγραφή Νέας Επιχείρησης</DialogTitle>
                                <DialogDescription>
                                   Συμπληρώστε τα παρακάτω στοιχεία για να ξεκινήσετε.
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleRegisterBusiness} className="space-y-4 pt-4">
                                <div className="space-y-2">
                                    <Label>Τύπος Επιχείρησης</Label>
                                    <RadioGroup name="businessType" defaultValue="store" className="flex gap-4">
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="store" id="r-store" />
                                            <Label htmlFor="r-store">Κατάστημα</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="supplier" id="r-supplier" />
                                            <Label htmlFor="r-supplier">Προμηθευτής</Label>
                                        </div>
                                    </RadioGroup>
                                </div>
                                 <div className="space-y-2">
                                     <Label htmlFor="businessName">Επωνυμία Επιχείρησης</Label>
                                     <Input id="businessName" name="businessName" required/>
                                 </div>
                                  <div className="space-y-2">
                                     <Label htmlFor="vat">ΑΦΜ</Label>
                                     <Input id="vat" name="vat" required/>
                                 </div>
                                 <div className="space-y-2">
                                     <Label htmlFor="adminName">Το Ονοματεπώνυμό σας</Label>
                                     <Input id="adminName" name="adminName" required/>
                                 </div>
                                 <div className="space-y-2">
                                     <Label htmlFor="adminEmail">Το Email σας</Label>
                                     <Input id="adminEmail" name="adminEmail" type="email" required/>
                                 </div>
                                 <div className="space-y-2">
                                     <Label htmlFor="adminPassword">Κωδικός Πρόσβασης</Label>
                                     <Input id="adminPassword" name="adminPassword" type="password" required/>
                                 </div>
                                <DialogFooter className="pt-4">
                                     <Button type="submit" className="w-full">Ολοκλήρωση Εγγραφής</Button>
                                </DialogFooter>
                            </form>
                        </>
                    )}
                </DialogContent>
            </Dialog>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
