'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Logo } from '@/components/logo';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Search, Building, UserPlus, ArrowLeft, Loader2 } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { initiateEmailSignUp, initiateEmailSignIn, useFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, doc, writeBatch, getDocs, query, where, updateDoc, getDoc, arrayUnion, addDoc, limit } from 'firebase/firestore';
import { createUserWithEmailAndPassword, updateProfile, type User } from 'firebase/auth';
import { wholesalerStock } from '@/lib/data';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { auth, firestore } = useFirebase();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [dialogView, setDialogView] = useState<'initial' | 'join' | 'register'>('initial');
  
  // State for joining
  const [searchAfm, setSearchAfm] = useState('');
  const [foundBusiness, setFoundBusiness] = useState<{ name: string; afm: string; id: string; type: 'store' | 'wholesaler' } | null>(null);

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
    if (!email || !password) {
        toast({
            variant: 'destructive',
            title: 'Ελλιπή Στοιχεία',
            description: 'Παρακαλώ συμπληρώστε το email και τον κωδικό σας.',
        });
        return;
    }
    setIsLoggingIn(true);

    const onSuccess = async (user: User) => {
        setIsLoggingIn(true); // Keep loading state
        if (!firestore) {
            setIsLoggingIn(false);
            return;
        }
        
        try {
            const wholesalersRef = collection(firestore, 'wholesalers');
            const storesRef = collection(firestore, 'stores');
    
            const wholesalerQuery = query(wholesalersRef, 
                where("adminUids", "array-contains", user.uid)
            );
            const wholesalerOwnerQuery = query(wholesalersRef, 
                where("ownerId", "==", user.uid)
            );
            
            const storeQuery = query(storesRef, 
                where("managerUids", "array-contains", user.uid)
            );
            const storeOwnerQuery = query(storesRef, 
                where("ownerId", "==", user.uid)
            );
    
            const [wholesalerSnap, wholesalerOwnerSnap] = await Promise.all([
                getDocs(wholesalerQuery),
                getDocs(wholesalerOwnerQuery)
            ]);
    
            if (!wholesalerSnap.empty || !wholesalerOwnerSnap.empty) {
                router.push('/admin/dashboard');
                return; // No need to set isLoggingIn to false as we are navigating away
            }
    
            const [storeSnap, storeOwnerSnap] = await Promise.all([
                getDocs(storeQuery),
                getDocs(storeOwnerQuery)
            ]);
    
            if (!storeSnap.empty || !storeOwnerSnap.empty) {
                router.push('/dashboard');
                return;
            }
    
            toast({
                variant: "destructive",
                title: "Δεν βρέθηκε επιχείρηση",
                description: "Ο λογαριασμός σας δεν είναι συνδεδεμένος με κάποια επιχείρηση. Το αίτημά σας μπορεί να εκκρεμεί."
            });
            auth.signOut();
            setIsLoggingIn(false);
    
        } catch (error) {
            console.error("Error during post-login check:", error);
            toast({ variant: "destructive", title: "Σφάλμα", description: "Δεν ήταν δυνατή η επαλήθευση του ρόλου σας." });
            setIsLoggingIn(false);
        }
    };
    
    initiateEmailSignIn(auth, email, password, onSuccess, () => setIsLoggingIn(false));
  };

  const handleSearchBusiness = async () => {
    if (!firestore) return;
    if (!searchAfm.trim()) {
        toast({ variant: 'destructive', title: 'Εισάγετε ΑΦΜ' });
        return;
    }

    try {
        const storesRef = collection(firestore, 'stores');
        const wholesalersRef = collection(firestore, 'wholesalers');

        const storeQuery = query(storesRef, where("taxId", "==", searchAfm), limit(1));
        const wholesalerQuery = query(wholesalersRef, where("taxId", "==", searchAfm), limit(1));

        const [storeSnapshot, wholesalerSnapshot] = await Promise.all([
            getDocs(storeQuery),
            getDocs(wholesalerQuery)
        ]);

        if (!storeSnapshot.empty) {
            const doc = storeSnapshot.docs[0];
            setFoundBusiness({ id: doc.id, name: doc.data().businessName, afm: doc.data().taxId, type: 'store' });
        } else if (!wholesalerSnapshot.empty) {
            const doc = wholesalerSnapshot.docs[0];
            setFoundBusiness({ id: doc.id, name: doc.data().companyName, afm: doc.data().taxId, type: 'wholesaler' });
        } else {
            setFoundBusiness(null);
            toast({
                variant: 'destructive',
                title: 'Δεν βρέθηκε επιχείρηση',
                description: 'Παρακαλώ ελέγξτε το ΑΦΜ που εισάγατε.',
            });
        }
    } catch (error) {
        console.error("Error searching for business:", error);
        toast({ variant: 'destructive', title: 'Σφάλμα', description: 'Προέκυψε σφάλμα κατά την αναζήτηση.' });
    }
  };

  const handleSendRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !foundBusiness || !auth) return;

    const formData = new FormData(e.target as HTMLFormElement);
    const requesterName = formData.get('joinerName') as string;
    const requesterEmail = formData.get('joinerEmail') as string;
    const password = formData.get('joinerPassword') as string;

    if (!requesterName || !requesterEmail || !password) {
        toast({ variant: 'destructive', title: 'Ελλιπή Στοιχεία', description: 'Παρακαλώ συμπληρώστε όλα τα πεδία.' });
        return;
    }
    if (password.length < 6) {
        toast({ variant: 'destructive', title: 'Αδύναμος Κωδικός', description: 'Ο κωδικός πρόσβασης πρέπει να έχει τουλάχιστον 6 χαρακτήρες.' });
        return;
    }

    const onUserCreated = (user: User) => {
        if (!firestore || !foundBusiness) return;
        
        const joinRequestsRef = collection(firestore, 'joinRequests');
        const newRequest = {
            requesterUid: user.uid,
            businessId: foundBusiness.id,
            businessName: foundBusiness.name,
            businessType: foundBusiness.type,
            requesterName,
            requesterEmail,
            status: 'pending',
            createdAt: new Date().toISOString(),
        };

        addDocumentNonBlocking(joinRequestsRef, newRequest).then(() => {
            auth.signOut();
            toast({
              title: 'Το Αίτημα Στάλθηκε!',
              description: `Η επιχείρηση θα ειδοποιηθεί. Μπορείτε να συνδεθείτε μετά την έγκριση.`
            });
            setIsRequestDialogOpen(false);
        });
    }

    createUserWithEmailAndPassword(auth, requesterEmail, password)
      .then((userCredential) => {
          updateProfile(userCredential.user, { displayName: requesterName })
            .then(() => {
                onUserCreated(userCredential.user);
            });
      })
      .catch((error) => {
          let description = 'Προέκυψε ένα απρόσμενο σφάλμα.';
          if (error.code === 'auth/email-already-in-use') {
              description = 'Αυτό το email χρησιμοποιείται ήδη. Αν έχετε ήδη λογαριασμό, συνδεθείτε κανονικά.'
          } else if (error.code === 'auth/invalid-email') {
              description = 'Η διεύθυνση email δεν είναι έγκυρη.';
          }
          toast({ variant: 'destructive', title: 'Σφάλμα Δημιουργίας Αιτήματος', description });
      });
};
  
  const handleRegisterBusiness = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !auth) return;

    const formData = new FormData(e.target as HTMLFormElement);
    const businessType = formData.get('businessType') as string;
    const businessName = formData.get('businessName') as string;
    const taxId = formData.get('vat') as string;
    const ownerName = formData.get('adminName') as string;
    const email = formData.get('adminEmail') as string;
    const password = formData.get('adminPassword') as string;

    if (!email || !password) {
        toast({ variant: 'destructive', title: 'Ελλιπή Στοιχεία', description: 'Το email και ο κωδικός είναι υποχρεωτικά.' });
        return;
    }
    if (password.length < 6) {
        toast({
            variant: 'destructive',
            title: 'Αδύναμος Κωδικός',
            description: 'Ο κωδικός πρόσβασης πρέπει να έχει τουλάχιστον 6 χαρακτήρες.',
        });
        return;
    }
    if (!businessName || !taxId || !ownerName) {
         toast({ variant: 'destructive', title: 'Ελλιπή Στοιχεία', description: 'Για νέα επιχείρηση, συμπληρώστε όλα τα πεδία.' });
         return;
    }

    const onCreateSuccess = async (user: User) => {
        if (!firestore) return;

        const collectionPath = businessType === 'store' ? 'stores' : 'wholesalers';
        const colRef = collection(firestore, collectionPath);
        
        let newDocData: any;

        if (businessType === 'store') {
             newDocData = {
                businessName: businessName,
                taxId: taxId,
                ownerName: ownerName,
                email: email,
                phone: '',
                address: '',
                ownerId: user.uid,
                managerUids: [user.uid],
            };
        } else { // supplier
            const supplierCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            newDocData = {
                companyName: businessName,
                taxId: taxId,
                ownerName: ownerName,
                email: email,
                ownerId: user.uid,
                adminUids: [user.uid],
                phone: '',
                address: '',
                supplierCode: supplierCode,
                productCategories: [],
                serviceArea: '',
                description: '',
                orderAcceptanceHours: '',
                logoUrl: ''
            };
        }

        try {
            const newDocRef = await addDoc(colRef, newDocData);

            // If it's the dummy supplier, seed its data.
            if (newDocRef && businessType === 'supplier' && email === 'admin@frozenfoods.gr') {
                const wholesalerId = newDocRef.id;
                
                const warehousesRef = collection(firestore, 'wholesalers', wholesalerId, 'warehouses');
                const warehouseData = {
                  name: 'Αποθήκη 1',
                  wholesalerId,
                  ownerId: user.uid,
                  adminUids: [user.uid],
                };
                const warehouseDocRef = await addDoc(warehousesRef, warehouseData);

                if(warehouseDocRef) {
                  const warehouseId = warehouseDocRef.id;
                  const inventoryRef = collection(firestore, 'wholesalers', wholesalerId, 'warehouses', warehouseId, 'inventories');
                  const batch = writeBatch(firestore);
                  
                  wholesalerStock.forEach(stockItem => {
                      const productDocRef = doc(inventoryRef, stockItem.productId);
                      const initialData = {
                          productId: stockItem.productId,
                          wholesalerId: wholesalerId,
                          warehouseId: warehouseId,
                          quantity: stockItem.quantity,
                          idealStock: stockItem.idealStock,
                          ownerId: user.uid,
                          adminUids: [user.uid],
                          lastAction: { type: 'counting', value: stockItem.quantity },
                      };
                      batch.set(productDocRef, initialData);
                  });
                  await batch.commit();
                }
            }

            toast({
                title: 'Η Επιχείρηση Καταχωρήθηκε!',
                description: `Ο λογαριασμός για την επιχείρηση "${businessName}" δημιουργήθηκε. Μπορείτε πλέον να συνδεθείτε.`
            });
            setIsRequestDialogOpen(false);

        } catch (error) {
            console.error("Error creating business document:", error);
            toast({
                variant: 'destructive',
                title: 'Σφάλμα Βάσης Δεδομένων',
                description: 'Δεν ήταν δυνατή η αποθήκευση της επιχείρησής σας.'
            });
        }
    };
    initiateEmailSignUp(auth, email, password, onCreateSuccess);
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
          <CardDescription>Για είσοδο, χρησιμοποιήστε τους παρακάτω δοκιμαστικούς λογαριασμούς, ή δημιουργήστε τη δική σας επιχείρηση.</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
             <div className="text-sm text-center bg-muted/50 p-3 rounded-lg">
                <p><span className="font-semibold">Προμηθευτής:</span> admin@frozenfoods.gr</p>
                <p><span className="font-semibold">Κατάστημα:</span> store@tastebakery.gr</p>
                <p><span className="font-semibold">Κωδικός (για όλους):</span> password123</p>
            </div>
             <div className="relative pt-2">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                        Σύνδεση
                    </span>
                </div>
            </div>
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
            <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-lg h-12" disabled={isLoggingIn}>
              {isLoggingIn ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Σύνδεση'}
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
                                <form onSubmit={handleSendRequest} className="space-y-4 pt-4">
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
                                        <Input id="joinerEmail" name="joinerEmail" type="email" required defaultValue="pol@gmail.com" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="joinerPassword">Κωδικός Σύνδεσης</Label>
                                        <Input id="joinerPassword" name="joinerPassword" type="password" required />
                                    </div>
                                    <Button type="submit" className="w-full">
                                        Αποστολή Αιτήματος Συμμετοχής
                                    </Button>
                                </form>
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
                                     <Input id="businessName" name="businessName" />
                                 </div>
                                  <div className="space-y-2">
                                     <Label htmlFor="vat">ΑΦΜ</Label>
                                     <Input id="vat" name="vat" />
                                 </div>
                                 <div className="space-y-2">
                                     <Label htmlFor="adminName">Το Ονοματεπώνυμό σας</Label>
                                     <Input id="adminName" name="adminName" />
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
