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
                // Find the store document where the current user is the owner
                const storesRef = collection(firestore, 'stores');
                const q = query(storesRef, where("ownerId", "==", user.uid));
                const querySnapshot = await getDocs(q);
                
                if (!querySnapshot.empty) {
                    const storeDoc = querySnapshot.docs[0];
                    const storeData = { id: storeDoc.id, ...storeDoc.data() } as WithId<Store>;
                    setStore(storeData);
                    // Populate form
                    reset({
                        businessName: storeData.businessName,
                        taxId: storeData.taxId,
                        businessPhone: storeData.phone,
                        address: storeData.address,
                        userName: storeData.ownerName, // Or user.displayName
                        userEmail: user.email || '',
                    });
                } else {
                    console.log("No store found for user, this shouldn't happen in a real app after onboarding");
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
                description: 'Δεν είστε συνδεδεμένος.',
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
                description: 'Τα στοιχεία σας αποθηκεύτηκαν με επιτυχία.',
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
    
    if (!store) {
        return <div className="text-center">Δεν βρέθηκαν τα στοιχεία της επιχείρησής σας.</div>;
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
             <h1 className="font-headline text-3xl font-bold">Τα Στοιχεία μου</h1>
             <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Στοιχεία Επιχείρησης</CardTitle>
                        <CardDescription>Επεξεργαστείτε τα στοιχεία της επιχείρησής σας.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="businessName">Επωνυμία</Label>
                                <Input id="businessName" {...register('businessName')} />
                                {errors.businessName && <p className="text-xs text-destructive">{errors.businessName.message}</p>}
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="taxId">ΑΦΜ</Label>
                                <Input id="taxId" {...register('taxId')} />
                                {errors.taxId && <p className="text-xs text-destructive">{errors.taxId.message}</p>}
                            </div>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4">
                           <div className="space-y-2">
                                <Label htmlFor="businessPhone">Τηλέφωνο Επιχείρησης</Label>
                                <Input id="businessPhone" type="tel" {...register('businessPhone')} />
                                {errors.businessPhone && <p className="text-xs text-destructive">{errors.businessPhone.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="address">Διεύθυνση</Label>
                                <Input id="address" {...register('address')} />
                                {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
                            </div>
                        </div>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader>
                        <CardTitle>Στοιχεία Χρήστη</CardTitle>
                        <CardDescription>Επεξεργαστείτε τα προσωπικά σας στοιχεία.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                       <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="userName">Ονοματεπώνυμο</Label>
                                <Input id="userName" {...register('userName')} />
                                 {errors.userName && <p className="text-xs text-destructive">{errors.userName.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="userEmail">Email</Label>
                                <Input id="userEmail" type="email" {...register('userEmail')} />
                                {errors.userEmail && <p className="text-xs text-destructive">{errors.userEmail.message}</p>}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                 <div className="flex justify-end">
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Αποθήκευση Αλλαγών
                    </Button>
                </div>
            </form>
        </div>
    );
}
