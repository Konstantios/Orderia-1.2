'use client';

import { useState, useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirebase, updateDocumentNonBlocking, WithId } from '@/firebase';
import { collection, query, where, doc, getDocs, limit } from 'firebase/firestore';
import { updateProfile, updateEmail } from 'firebase/auth';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Info } from 'lucide-react';
import type { Wholesaler } from '@/lib/types';

const formSchema = z.object({
    // Business details
    companyName: z.string().min(2, "Η επωνυμία πρέπει να έχει τουλάχιστον 2 χαρακτήρες."),
    taxId: z.string().min(9, "Το ΑΦΜ πρέπει να έχει τουλάχιστον 9 χαρακτήρες."),
    phone: z.string().min(10, "Το τηλέφωνο πρέπει να έχει 10 χαρακτήρες."),
    address: z.string().min(5, "Η διεύθυνση πρέπει να έχει τουλάχιστον 5 χαρακτήρες."),
    description: z.string().optional(),
    orderAcceptanceHours: z.string().optional(),
    // User details
    userName: z.string().min(2, "Το όνομα πρέπει να έχει τουλάχιστον 2 χαρακτήρες."),
    userEmail: z.string().email("Μη έγκυρη διεύθυνση email."),
});

type FormValues = z.infer<typeof formSchema>;

export default function AdminAccountPage() {
    const { user, isUserLoading, auth, firestore } = useFirebase();
    const { toast } = useToast();

    const [wholesaler, setWholesaler] = useState<WithId<Wholesaler> | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const { register, handleSubmit, reset, formState: { isSubmitting, errors } } = useForm<FormValues>({
        resolver: zodResolver(formSchema),
    });
    
    useEffect(() => {
        if (isUserLoading || !user || !firestore) {
            return;
        }

        const fetchWholesalerData = async () => {
            setIsLoading(true);
            try {
                const wholesalersRef = collection(firestore, 'wholesalers');
                const qAdmin = query(wholesalersRef, where("adminUids", "array-contains", user.uid), limit(1));
                const qOwner = query(wholesalersRef, where("ownerId", "==", user.uid), limit(1));
                
                const [adminSnap, ownerSnap] = await Promise.all([
                    getDocs(qAdmin),
                    getDocs(qOwner)
                ]);
                
                let wholesalerDoc = null;
                if (!adminSnap.empty) {
                    wholesalerDoc = adminSnap.docs[0];
                } else if (!ownerSnap.empty) {
                    wholesalerDoc = ownerSnap.docs[0];
                }

                if (wholesalerDoc) {
                    const wholesalerData = { id: wholesalerDoc.id, ...wholesalerDoc.data() } as WithId<Wholesaler>;
                    setWholesaler(wholesalerData);
                    // Populate form
                    reset({
                        companyName: wholesalerData.companyName,
                        taxId: wholesalerData.taxId,
                        phone: wholesalerData.phone,
                        address: wholesalerData.address,
                        description: wholesalerData.description || '',
                        orderAcceptanceHours: wholesalerData.orderAcceptanceHours || '',
                        userName: wholesalerData.ownerName || user.displayName || '',
                        userEmail: user.email || '',
                    });
                } else {
                    console.log("No wholesaler found for user");
                }

            } catch (error) {
                console.error("Error fetching wholesaler data:", error);
                toast({
                    variant: 'destructive',
                    title: 'Σφάλμα',
                    description: 'Δεν ήταν δυνατή η φόρτωση των στοιχείων σας.',
                });
            } finally {
                setIsLoading(false);
            }
        };

        fetchWholesalerData();

    }, [user, isUserLoading, firestore, reset, toast]);


    const onSubmit: SubmitHandler<FormValues> = async (data) => {
        if (!user || !wholesaler || !firestore || !auth) {
            toast({
                variant: 'destructive',
                title: 'Σφάλμα',
                description: 'Δεν είστε συνδεδεμένος.',
            });
            return;
        }
        
        try {
            // Update Firestore document
            const wholesalerRef = doc(firestore, 'wholesalers', wholesaler.id);
            updateDocumentNonBlocking(wholesalerRef, {
                companyName: data.companyName,
                taxId: data.taxId,
                phone: data.phone,
                address: data.address,
                description: data.description,
                orderAcceptanceHours: data.orderAcceptanceHours,
                ownerName: data.userName,
            });

            // Update Firebase Auth user profile
            if (user.displayName !== data.userName) {
                await updateProfile(user, { displayName: data.userName });
            }
            if (user.email !== data.userEmail) {
                await updateEmail(user, data.userEmail);
            }

            toast({
                title: 'Επιτυχής Ενημέρωση',
                description: 'Τα στοιχεία της επιχείρησής σας αποθηκεύτηκαν.',
            });

        } catch (error: any) {
             toast({
                variant: 'destructive',
                title: 'Σφάλμα Ενημέρωσης',
                description: error.message || 'Δεν ήταν δυνατή η αποθήκευση των αλλαγών.',
            });
        }
    };
    
    if (isLoading || isUserLoading) {
        return <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }
    
    if (!wholesaler) {
        return <div className="text-center">Δεν βρέθηκαν τα στοιχεία της επιχείρησής σας.</div>;
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
             <h1 className="font-headline text-3xl font-bold">Προφίλ Επιχείρησης</h1>
             <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Στοιχεία Προμηθευτή</CardTitle>
                        <CardDescription>Διαχειριστείτε τις πληροφορίες που βλέπουν οι πελάτες σας.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="companyName">Επωνυμία Εταιρείας</Label>
                                <Input id="companyName" {...register('companyName')} />
                                {errors.companyName && <p className="text-xs text-destructive">{errors.companyName.message}</p>}
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="taxId">ΑΦΜ</Label>
                                <Input id="taxId" {...register('taxId')} />
                                {errors.taxId && <p className="text-xs text-destructive">{errors.taxId.message}</p>}
                            </div>
                        </div>
                        
                        <div className="grid sm:grid-cols-2 gap-4">
                           <div className="space-y-2">
                                <Label htmlFor="phone">Τηλέφωνο Επικοινωνίας</Label>
                                <Input id="phone" type="tel" {...register('phone')} />
                                {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="address">Διεύθυνση Έδρας</Label>
                                <Input id="address" {...register('address')} />
                                {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="supplierCode">Κωδικός Προμηθευτή (Μη επεξεργάσιμο)</Label>
                            <div className="flex items-center gap-2 bg-muted p-2 rounded-md border border-border">
                                <Info className="h-4 w-4 text-muted-foreground" />
                                <span className="font-mono font-bold">{wholesaler.supplierCode}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">Αυτός ο κωδικός χρησιμοποιείται από τα καταστήματα για να σας βρουν.</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="orderAcceptanceHours">Ωράριο Αποδοχής Παραγγελιών</Label>
                            <Input id="orderAcceptanceHours" {...register('orderAcceptanceHours')} placeholder="π.χ. 08:00 - 16:00" />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Περιγραφή Επιχείρησης</Label>
                            <Textarea id="description" {...register('description')} placeholder="Λίγα λόγια για την επιχείρησή σας..." className="min-h-[100px]" />
                        </div>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader>
                        <CardTitle>Στοιχεία Διαχειριστή</CardTitle>
                        <CardDescription>Πληροφορίες πρόσβασης στο σύστημα.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                       <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="userName">Ονοματεπώνυμο</Label>
                                <Input id="userName" {...register('userName')} />
                                 {errors.userName && <p className="text-xs text-destructive">{errors.userName.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="userEmail">Email Σύνδεσης</Label>
                                <Input id="userEmail" type="email" {...register('userEmail')} />
                                {errors.userEmail && <p className="text-xs text-destructive">{errors.userEmail.message}</p>}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                 <div className="flex justify-end">
                    <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Αποθήκευση Στοιχείων
                    </Button>
                </div>
            </form>
        </div>
    );
}
