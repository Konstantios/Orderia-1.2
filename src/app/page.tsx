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
  const [dialogView, setDialogView] = useState<'initial' | 'join' | 'register' | 'register_confirm'>('initial');
  
  // Registration Data for confirmation
  const [registrationData, setRegistrationData] = useState<any>(null);
  const [selectedType, setSelectedType] = useState<'store' | 'supplier'>('store');

  
  // State for joining
  const [searchAfm, setSearchAfm] = useState('');
  const [foundBusiness, setFoundBusiness] = useState<{ name: string; afm: string; id: string; type: 'store' | 'wholesaler'; wholesalerIds?: string[] } | null>(null);

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
                return;
            }
    
            const [storeSnap, storeOwnerSnap] = await Promise.all([
                getDocs(storeQuery),
                getDocs(storeOwnerQuery)
            ]);
    
            if (!storeSnap.empty || !storeOwnerSnap.empty) {
                router.push('/dashboard');
                return;
            }

            // --- CLAIM LOGIC ---
            // If not found by UID, search by email to see if it's a 'shadow' user
            const wholesalersEmailQuery = query(wholesalersRef, where("email", "==", user.email), limit(1));
            const storesEmailQuery = query(storesRef, where("email", "==", user.email), limit(1));

            const [wholesalerEmailSnap, storeEmailSnap] = await Promise.all([
                getDocs(wholesalersEmailQuery),
                getDocs(storesEmailQuery)
            ]);

            if (!wholesalerEmailSnap.empty) {
                const whDoc = wholesalerEmailSnap.docs[0];
                await updateDoc(whDoc.ref, {
                    adminUids: arrayUnion(user.uid)
                });
                router.push('/admin/dashboard');
                return;
            }

            if (!storeEmailSnap.empty) {
                const stDoc = storeEmailSnap.docs[0];
                await updateDoc(stDoc.ref, {
                    managerUids: arrayUnion(user.uid)
                });
                router.push('/dashboard');
                return;
            }
            // --- END CLAIM LOGIC ---
    
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
            const storeDoc = storeSnapshot.docs[0];
            setFoundBusiness({ 
                id: storeDoc.id, 
                name: storeDoc.data().businessName, 
                afm: storeDoc.data().taxId, 
                type: 'store',
                wholesalerIds: storeDoc.data().wholesalerIds || []
            });
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

  const handleSendRequest = async (e: React.FormEvent) => {
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

    // Use wholesalerIds already fetched during the business search (no extra getDoc needed)
    const wholesalerIds: string[] = foundBusiness.wholesalerIds || [];

    const onUserCreated = (user: User) => {
        if (!firestore || !foundBusiness) return;
        
        const joinRequestsRef = collection(firestore, 'joinRequests');
        const newRequest: any = {
            requesterUid: user.uid,
            businessId: foundBusiness.id,
            businessName: foundBusiness.name,
            businessType: foundBusiness.type,
            requesterName,
            requesterEmail,
            status: 'pending',
            createdAt: new Date().toISOString(),
        };

        // Embed the wholesalerId so the wholesaler can query for this request directly
        if (wholesalerIds.length > 0) {
            newRequest.wholesalerId = wholesalerIds[0];
        }

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
  
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = {
        businessType: selectedType,
        businessName: formData.get('businessName') as string,
        taxId: formData.get('vat') as string,
        ownerName: formData.get('adminName') as string,
        email: formData.get('adminEmail') as string,
        password: formData.get('adminPassword') as string,
    };

    if (!data.email || !data.password || !data.businessName || !data.taxId || !data.ownerName) {
        toast({ variant: 'destructive', title: 'Ελλιπή Στοιχεία', description: 'Παρακαλώ συμπληρώστε όλα τα πεδία.' });
        return;
    }
    if (data.password.length < 6) {
        toast({ variant: 'destructive', title: 'Αδύναμος Κωδικός', description: 'Ο κωδικός πρόσβασης πρέπει να έχει τουλάχιστον 6 χαρακτήρες.' });
        return;
    }

    setRegistrationData(data);
    setDialogView('register_confirm');
  };

  const handleRegisterBusiness = () => {
    if (!firestore || !auth || !registrationData) return;
    const { businessType, businessName, taxId, ownerName, email, password } = registrationData;


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
          <CardTitle className="text-2xl">Σύνδεση</CardTitle>
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
          <CardFooter className="flex flex-col gap-6">
            <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-lg h-12" disabled={isLoggingIn}>
              {isLoggingIn ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Είσοδος στο Σύστημα'}
            </Button>
            
            <div className="w-full space-y-4 pt-2 border-t border-primary/10">
              <div className="text-center">
                <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Νέος στην πλατφόρμα;
                </span>
              </div>
              
              <div className="grid grid-cols-1 gap-3">
                <Card 
                  onClick={() => { setDialogView('register'); setIsRequestDialogOpen(true); }} 
                  className="cursor-pointer hover:bg-muted/50 hover:border-primary transition-all duration-200 group border-primary/10"
                >
                  <div className="flex items-center gap-3 p-3">
                    <div className="bg-primary/10 p-2 rounded-lg group-hover:bg-primary/20 transition-colors">
                      <Building className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-bold leading-none">Νέα Επιχείρηση</p>
                      <p className="text-[11px] text-muted-foreground mt-1">Για νέες καταχωρήσεις</p>
                    </div>
                  </div>
                </Card>

                <Card 
                  onClick={() => { setDialogView('join'); setIsRequestDialogOpen(true); }} 
                  className="cursor-pointer hover:bg-muted/50 hover:border-accent transition-all duration-200 group border-accent/10"
                >
                  <div className="flex items-center gap-3 p-3">
                    <div className="bg-accent/10 p-2 rounded-lg group-hover:bg-accent/20 transition-colors">
                      <UserPlus className="h-5 w-5 text-accent" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-bold leading-none">Αίτημα Συμμετοχής</p>
                      <p className="text-[11px] text-muted-foreground mt-1">Για σύνδεση με υπάρχουσα</p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>

             <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>

                <DialogContent className="sm:max-w-md">



                    
                    {dialogView === 'join' && (
                        <>
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
                                        <Input id="joinerName" name="joinerName" placeholder="π.χ. Γιώργος Παπαδάκης" required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="joinerEmail">Το Email σας</Label>
                                        <Input id="joinerEmail" name="joinerEmail" type="email" placeholder="π.χ. employee@mybusiness.gr" required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="joinerPassword">Κωδικός Πρόσβασης Λογαριασμού</Label>
                                        <Input id="joinerPassword" name="joinerPassword" type="password" placeholder="Τουλάχιστον 6 χαρακτήρες" required />
                                        <p className="text-xs text-muted-foreground">Αυτός θα είναι ο κωδικός για να συνδέεστε στην εφαρμογή.</p>
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
                             <DialogHeader>
                                <DialogTitle>Εγγραφή Νέας Επιχείρησης</DialogTitle>
                                <DialogDescription>
                                   Συμπληρώστε τα παρακάτω στοιχεία για να ξεκινήσετε.
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleRegisterSubmit} className="space-y-4 pt-4">
                                <div className="space-y-4">
                                    <Label className="text-sm font-semibold">Τύπος Επιχείρησης</Label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div 
                                            onClick={() => setSelectedType('store')}
                                            className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${selectedType === 'store' ? 'border-primary bg-primary/5 shadow-md' : 'border-muted bg-background hover:border-primary/50'}`}
                                        >
                                            <div className={`p-3 rounded-full ${selectedType === 'store' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                                <Building className="h-6 w-6" />
                                            </div>
                                            <span className="font-bold text-sm">Κατάστημα</span>
                                        </div>
                                        <div 
                                            onClick={() => setSelectedType('supplier')}
                                            className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${selectedType === 'supplier' ? 'border-accent bg-accent/5 shadow-md' : 'border-muted bg-background hover:border-accent/50'}`}
                                        >
                                            <div className={`p-3 rounded-full ${selectedType === 'supplier' ? 'bg-accent text-accent-foreground' : 'bg-muted'}`}>
                                                <UserPlus className="h-6 w-6" />
                                            </div>
                                            <span className="font-bold text-sm">Προμηθευτής</span>
                                        </div>
                                    </div>
                                </div>
                                 <div className="space-y-2">
                                     <Label htmlFor="businessName">Επωνυμία Επιχείρησης</Label>
                                     <Input id="businessName" name="businessName" required placeholder="π.χ. Taste Bakery ή Frozen Foods"/>
                                 </div>
                                  <div className="space-y-2">
                                     <Label htmlFor="vat">ΑΦΜ (9 ψηφία)</Label>
                                     <Input id="vat" name="vat" required placeholder="π.χ. 123456789"/>
                                 </div>
                                 <div className="space-y-2">
                                     <Label htmlFor="adminName">Το Ονοματεπώνυμό σας</Label>
                                     <Input id="adminName" name="adminName" required placeholder="π.χ. Νίκος Παπαδόπουλος"/>
                                 </div>
                                 <div className="space-y-2">
                                     <Label htmlFor="adminEmail">Το Email σας</Label>
                                     <Input id="adminEmail" name="adminEmail" type="email" required placeholder="admin@mybusiness.gr"/>
                                 </div>
                                 <div className="space-y-2">
                                     <Label htmlFor="adminPassword">Κωδικός Πρόσβασης</Label>
                                     <Input id="adminPassword" name="adminPassword" type="password" required placeholder="Τουλάχιστον 6 χαρακτήρες"/>
                                 </div>
                                <DialogFooter className="pt-4">
                                     <Button type="submit" className="w-full h-12 text-lg font-bold">Ολοκλήρωση Εγγραφής</Button>
                                </DialogFooter>
                            </form>
                        </>
                    )}

                    {dialogView === 'register_confirm' && registrationData && (
                        <div className="space-y-6 pt-4">
                            <DialogHeader>
                                <DialogTitle className="text-xl">Επιβεβαίωση Εγγραφής</DialogTitle>
                                <DialogDescription>
                                    Παρακαλούμε επιβεβαιώστε τα στοιχεία της επιχείρησής σας.
                                </DialogDescription>
                            </DialogHeader>
                            
                            <div className="bg-muted/50 p-6 rounded-2xl space-y-4 border border-border">
                                <div className="flex items-center gap-4 border-b pb-4 border-border/50">
                                    <div className={`p-3 rounded-full ${registrationData.businessType === 'store' ? 'bg-primary text-primary-foreground' : 'bg-accent text-accent-foreground'}`}>
                                        {registrationData.businessType === 'store' ? <Building className="h-6 w-6" /> : <UserPlus className="h-6 w-6" />}
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Τύπος Επιχείρησης</p>
                                        <p className="text-lg font-bold">{registrationData.businessType === 'store' ? 'Κατάστημα (B2C)' : 'Προμηθευτής (B2B)'}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-muted-foreground">Επωνυμία</p>
                                        <p className="font-semibold">{registrationData.businessName}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">ΑΦΜ</p>
                                        <p className="font-semibold">{registrationData.taxId}</p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Διαχειριστής</p>
                                    <p className="font-semibold">{registrationData.ownerName} ({registrationData.email})</p>
                                </div>
                            </div>

                            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-start gap-3">
                                <div className="mt-0.5">⚠️</div>
                                <p className="text-xs text-amber-600 dark:text-amber-500 leading-relaxed font-medium">
                                    Βεβαιωθείτε ότι επιλέξατε τον σωστό τύπο επιχείρησης. Αυτή η ρύθμιση καθορίζει τις λειτουργίες που θα έχετε πρόσβαση (Παραγγελίες ή Πωλήσεις).
                                </p>
                            </div>

                            <DialogFooter className="flex flex-col sm:flex-row gap-2">
                                <Button variant="ghost" onClick={() => setDialogView('register')} className="flex-1">
                                    Πίσω για διόρθωση
                                </Button>
                                <Button onClick={handleRegisterBusiness} className="flex-[2] bg-primary hover:bg-primary/90 text-primary-foreground h-12 font-bold text-lg">
                                    Επιβεβαίωση & Δημιουργία
                                </Button>
                            </DialogFooter>
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

