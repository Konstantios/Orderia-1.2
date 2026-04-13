'use client';

import { useState, useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirebase, updateDocumentNonBlocking, WithId } from '@/firebase';
import { collection, query, where, doc, getDocs } from 'firebase/firestore';
import { updateProfile, updateEmail } from 'firebase/auth';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';
import type { Store } from '@/lib/types';


const formSchema = z.object({
    // Business details
    businessName: z.string().min(2, "Η επωνυμία πρέπει να έχει τουλάχιστον 2 χαρακτήρες."),
    taxId: z.string().min(9, "Το ΑΦΜ πρέπει να έχει τουλάχιστον 9 χαρακτήρες."),
    businessPhone: z.string().min(10, "Το τηλέφωνο πρέπει να έχει 10 χαρακτήρες."),
    address: z.string().min(5, "Η διεύθυνση πρέπει να έχει τουλάχιστον 5 χαρακτήρες."),
    city: z.string().min(2, "Η πόλη πρέπει να έχει τουλάχιστον 2 χαρακτήρες."),
    deliveryDay: z.string().optional(),
    // User details
    userName: z.string().min(2, "Το όνομα πρέπει να έχει τουλάχιστον 2 χαρακτήρες."),
    userEmail: z.string().email("Μη έγκυρη διεύθυνση email."),
});

type FormValues = z.infer<typeof formSchema>;

export default function AccountPage() {
    const { user, isUserLoading, auth, firestore } = useFirebase();
    const { toast } = useToast();

    const [store, setStore] = useState<WithId<Store> | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const { register, handleSubmit, reset, formState: { isSubmitting, errors } } = useForm<FormValues>({
        resolver: zodResolver(formSchema),
    });
    
    useEffect(() => {
        if (isUserLoading || !user || !firestore) {
            return;
        }

        const fetchStoreData = async () => {
            setIsLoading(true);
            try {
                // Find the store document where the current user is the owner or manager
                const storesRef = collection(firestore, 'stores');
                const qOwner = query(storesRef, where("ownerId", "==", user.uid));
                const qManager = query(storesRef, where("managerUids", "array-contains", user.uid));
                
                const [ownerSnap, managerSnap] = await Promise.all([
                    getDocs(qOwner),
                    getDocs(qManager)
                ]);
                
                let storeDoc = null;
                if (!ownerSnap.empty) {
                    storeDoc = ownerSnap.docs[0];
                } else if (!managerSnap.empty) {
                    storeDoc = managerSnap.docs[0];
                }

                if (storeDoc) {
                    const storeData = { id: storeDoc.id, ...storeDoc.data() } as WithId<Store>;
                    setStore(storeData);
                    // Populate form
                    reset({
                        businessName: storeData.businessName,
                        taxId: storeData.taxId || '',
                        businessPhone: storeData.phone,
                        address: storeData.address,
                        city: storeData.city || '',
                        deliveryDay: storeData.deliveryDay || '',
                        userName: storeData.ownerName || user.displayName || '',
                        userEmail: user.email || '',
                    });
                } else {
                    console.log("No store found for user");
                }

            } catch (error) {
                console.error("Error fetching store data:", error);
                toast({
                    variant: 'destructive',
                    title: 'Σφάλμα',
                    description: 'Δεν ήταν δυνατή η φόρτωση των στοιχείων σας.',
                });
            } finally {
                setIsLoading(false);
            }
        };

        fetchStoreData();

    }, [user, isUserLoading, firestore, reset, toast]);


    const onSubmit: SubmitHandler<FormValues> = async (data) => {
        if (!user || !store || !firestore || !auth) {
            toast({
                variant: 'destructive',
                title: 'Σφάλμα',
                description: 'Προέκυψε σφάλμα κατά τη σύνδεση.',
            });
            return;
        }
        
        try {
            // Update Firestore document
            const storeRef = doc(firestore, 'stores', store.id);
            updateDocumentNonBlocking(storeRef, {
                businessName: data.businessName,
                taxId: data.taxId,
                phone: data.businessPhone,
                address: data.address,
                city: data.city,
                deliveryDay: data.deliveryDay,
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
        return <div className="flex justify-center items-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }
    
    if (!store) {
        return <div className="text-center p-12 bg-muted/30 rounded-xl">Δεν βρέθηκαν τα στοιχεία της επιχείρησής σας.</div>;
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-10">
             <div className="flex flex-col gap-1">
                <h1 className="font-headline text-3xl font-bold">Προφίλ Καταστήματος</h1>
                <p className="text-muted-foreground">Διαχειριστείτε τα στοιχεία εγγραφής και επικοινωνίας σας.</p>
             </div>

             <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                <Card className="border-2 border-primary/10 shadow-sm overflow-hidden">
                    <CardHeader className="bg-primary/5 pb-6">
                        <CardTitle>Στοιχεία Επιχείρησης</CardTitle>
                        <CardDescription>Οι πληροφορίες αυτές χρησιμοποιούνται για την ταυτοποίησή σας από τους προμηθευτές.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6">
                         <div className="grid sm:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="businessName">Επωνυμία Καταστήματος</Label>
                                <Input id="businessName" {...register('businessName')} className="h-11"/>
                                {errors.businessName && <p className="text-xs text-destructive font-medium">{errors.businessName.message}</p>}
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="taxId">ΑΦΜ</Label>
                                <Input id="taxId" {...register('taxId')} className="h-11"/>
                                {errors.taxId && <p className="text-xs text-destructive font-medium">{errors.taxId.message}</p>}
                            </div>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-6">
                           <div className="space-y-2">
                                <Label htmlFor="businessPhone">Τηλέφωνο Επικοινωνίας</Label>
                                <Input id="businessPhone" type="tel" {...register('businessPhone')} className="h-11"/>
                                {errors.businessPhone && <p className="text-xs text-destructive font-medium">{errors.businessPhone.message}</p>}
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="deliveryDay">Προτιμώμενη Ημέρα Παράδοσης</Label>
                                <Input id="deliveryDay" {...register('deliveryDay')} placeholder="π.χ. Δευτέρα, Τετάρτη" className="h-11"/>
                            </div>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="address">Διεύθυνση</Label>
                                <Input id="address" {...register('address')} className="h-11"/>
                                {errors.address && <p className="text-xs text-destructive font-medium">{errors.address.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="city">Πόλη / Περιοχή</Label>
                                <Input id="city" {...register('city')} className="h-11"/>
                                {errors.city && <p className="text-xs text-destructive font-medium">{errors.city.message}</p>}
                            </div>
                        </div>
                    </CardContent>
                </Card>
                
                <Card className="border-2 border-accent/10 shadow-sm overflow-hidden">
                    <CardHeader className="bg-accent/5 pb-6">
                        <CardTitle>Στοιχεία Διαχειριστή</CardTitle>
                        <CardDescription>Πληροφορίες για τη σύνδεσή σας στο σύστημα.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6">
                       <div className="grid sm:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="userName">Ονοματεπώνυμο</Label>
                                <Input id="userName" {...register('userName')} className="h-11"/>
                                 {errors.userName && <p className="text-xs text-destructive font-medium">{errors.userName.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="userEmail">Email Κατόχου</Label>
                                <Input id="userEmail" type="email" {...register('userEmail')} className="h-11"/>
                                {errors.userEmail && <p className="text-xs text-destructive font-medium">{errors.userEmail.message}</p>}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                 <div className="flex justify-end gap-3">
                    <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto min-w-[180px] h-12 text-base font-bold">
                        {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                        Αποθήκευση Αλλαγών
                    </Button>
                </div>
            </form>
        </div>
    );
}

