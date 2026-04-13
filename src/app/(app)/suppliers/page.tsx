'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirebase, useCollection, useMemoFirebase, type WithId } from '@/firebase';
import { collection, query, where, getDocs, limit, doc } from 'firebase/firestore';
import { PlusCircle, Search, Loader2, Package } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { PlaceHolderImages } from '@/lib/placeholder-images';
import type { Product, Wholesaler } from '@/lib/types';
import { useEffect, useMemo } from 'react';

const SupplierProducts = ({ wholesalerId, allowedProductIds }: { wholesalerId: string, allowedProductIds: Set<string> }) => {
    const { firestore } = useFirebase();
    const productsQuery = useMemoFirebase(() => {
        if (!firestore || !wholesalerId) return null;
        return collection(firestore, 'wholesalers', wholesalerId, 'products');
    }, [firestore, wholesalerId]);
    const { data: allProducts, isLoading } = useCollection<WithId<Product>>(productsQuery);

    const filteredProducts = useMemo(() => {
        if (!allProducts) return [];
        return allProducts.filter(p => allowedProductIds.has(p.id));
    }, [allProducts, allowedProductIds]);

    if (isLoading) return <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
    if (filteredProducts.length === 0) return <div className="text-center p-4 text-muted-foreground">Δεν βρέθηκαν διαθέσιμα προϊόντα.</div>;

    return (
        <div className="space-y-4 pt-4">
            <h3 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">
                Λίστα Προϊόντων
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProducts.map(product => (
                    <Card key={product.id} className="overflow-hidden bg-card/50">
                        <CardContent className="p-3">
                            <div className="flex items-center gap-3">
                                {product.imageUrl ? (
                                    <Image src={product.imageUrl} alt={product.name} width={56} height={56} className="rounded-md object-cover" data-ai-hint={product.imageHint} />
                                ) : (
                                    <div className="w-14 h-14 bg-muted rounded-md flex items-center justify-center flex-shrink-0">
                                        <Package className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm leading-tight truncate">{product.name}</p>
                                    <p className="text-xs text-muted-foreground">{product.code || product.sku}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
};

// Component to fetch and display wholesaler count
const WholesalerCard = ({ connection, logo }: { connection: any, logo: any }) => {
    const { firestore } = useFirebase();
    const [wholesaler, setWholesaler] = useState<any>(null);

    // Fetch Wholesaler basic info
    useEffect(() => {
        if (!firestore || !connection.wholesalerId) return;
        const fetchWholesaler = async () => {
             const snap = await getDocs(query(collection(firestore, 'wholesalers'), where('__name__', '==', connection.wholesalerId)));
             if (!snap.empty) {
                 setWholesaler(snap.docs[0].data());
             }
        };
        fetchWholesaler();
    }, [firestore, connection.wholesalerId]);

    // Fetch Product Configurations for this customer
    const configQuery = useMemoFirebase(() => {
        if (!firestore || !connection.storeId || !connection.wholesalerId) return null;
        return query(
            collection(firestore, 'stores', connection.storeId, 'productConfigurations'),
            where('wholesalerId', '==', connection.wholesalerId)
        );
    }, [firestore, connection.storeId, connection.wholesalerId]);
    const { data: configs, isLoading: isLoadingConfigs } = useCollection<any>(configQuery);

    const allowedProductIds = useMemo(() => {
        if (!configs) return new Set<string>();
        return new Set(configs.map((c: any) => c.productId));
    }, [configs]);

    const name = wholesaler?.companyName || 'Προμηθευτής';

    return (
        <AccordionItem value={`item-${connection.id}`} className="border-none">
            <Card className="rounded-lg">
                <AccordionTrigger className="flex w-full items-center justify-between p-4 hover:no-underline">
                    <div className="flex items-center gap-4 text-left">
                        <Image src={wholesaler?.logoUrl || logo.imageUrl} alt={name} width={56} height={56} className="rounded-md" data-ai-hint={logo.imageHint} />
                        <div>
                            <p className="font-semibold text-lg">{name}</p>
                            <p className="text-sm text-muted-foreground">
                                {isLoadingConfigs ? 'Φόρτωση...' : `${allowedProductIds.size} Ενεργά Προϊόντα`}
                            </p>
                        </div>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                    {!isLoadingConfigs && (
                        <SupplierProducts wholesalerId={connection.wholesalerId} allowedProductIds={allowedProductIds} />
                    )}
                </AccordionContent>
            </Card>
        </AccordionItem>
    );
};

export default function SuppliersPage() {
    const { toast } = useToast();
    const { firestore, user } = useFirebase();

    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [searchCode, setSearchCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [foundSupplier, setFoundSupplier] = useState<Wholesaler | null>(null);
    const [joinType, setJoinType] = useState<'store' | 'wholesaler'>('wholesaler');

    const supplierLogo = PlaceHolderImages.find(img => img.id === 'frozen-foods-logo')!;

    const handleSearchSupplier = async () => {
        if (!searchCode.trim()) {
            toast({ variant: 'destructive', title: 'Εισάγετε Κωδικό' });
            return;
        }
        if (!firestore) return;

        setIsLoading(true);
        setFoundSupplier(null);

        try {
            // 1. Search by Supplier Code
            const qCode = query(
                collection(firestore, 'wholesalers'),
                where('supplierCode', '==', searchCode.trim()),
                limit(1)
            );
            let querySnapshot = await getDocs(qCode);

            // 2. If not found, search by Tax ID (AFM)
            if (querySnapshot.empty) {
                const qTax = query(
                    collection(firestore, 'wholesalers'),
                    where('taxId', '==', searchCode.trim()),
                    limit(1)
                );
                querySnapshot = await getDocs(qTax);
            }

            if (!querySnapshot.empty) {
                const supplierDoc = querySnapshot.docs[0];
                setFoundSupplier({ id: supplierDoc.id, ...supplierDoc.data() } as Wholesaler);
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Δεν Βρέθηκε Προμηθευτής',
                    description: 'Ελέγξτε τον κωδικό ή το ΑΦΜ και προσπαθήστε ξανά.',
                });
            }
        } catch (error) {
            console.error("Error searching for supplier:", error);
            toast({ variant: 'destructive', title: 'Σφάλμα', description: 'Προέκυψε σφάλμα κατά την αναζήτηση.' });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleSendConnectionRequest = async () => {
        if (!foundSupplier || !user || !firestore) return;
        
        setIsLoading(true);
        try {
            const requestsCol = collection(firestore, 'joinRequests');
            const newRequest = {
                requesterUid: user.uid,
                requesterName: user.displayName || user.email?.split('@')[0] || 'Χρήστης',
                requesterEmail: user.email || '',
                businessId: foundSupplier.id,
                businessName: foundSupplier.companyName,
                businessType: joinType,
                status: 'pending',
                createdAt: new Date().toISOString()
            };
            
            await addDoc(requestsCol, newRequest);
            
            toast({
                title: "Το Αίτημα Στάλθηκε!",
                description: `Το αίτημα συμμετοχής ως ${joinType === 'wholesaler' ? 'μέλος ομάδας' : 'πελάτης'} στάλθηκε στον προμηθευτή "${foundSupplier.companyName}".`
            });
            
            setFoundSupplier(null);
            setSearchCode('');
            setIsAddDialogOpen(false);
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Σφάλμα', description: 'Αποτυχία αποστολής αιτήματος.' });
        } finally {
            setIsLoading(false);
        }
    }

    const [store, setStore] = useState<any>(null);
    useEffect(() => {
        if (!firestore || !user) return;
        const findStore = async () => {
             const storesRef = collection(firestore, 'stores');
             const q = query(storesRef, where("managerUids", "array-contains", user.uid), limit(1));
             const snap = await getDocs(q);
             if (!snap.empty) setStore({ id: snap.docs[0].id, ...snap.docs[0].data() });
        };
        findStore();
    }, [firestore, user]);

    const connectionsQuery = useMemoFirebase(() => {
        if (!firestore || !store) return null;
        return query(collection(firestore, 'supplierStoreConnections'), where('storeId', '==', store.id), where('isActive', '==', true));
    }, [firestore, store]);
    const { data: connections, isLoading: isLoadingConnections } = useCollection<WithId<any>>(connectionsQuery);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="font-headline text-3xl font-bold">Προμηθευτές</h1>
                 <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Προσθήκη Προμηθευτή
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Αναζήτηση Νέου Προμηθευτή</DialogTitle>
                            <DialogDescription>
                                Εισάγετε τον μοναδικό κωδικό που σας έχει δώσει ο προμηθευτής για να συνδεθείτε.
                            </DialogDescription>
                        </DialogHeader>
                        {!foundSupplier ? (
                             <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                     <Label htmlFor="supplier-code">Κωδικός Προμηθευτή</Label>
                                     <div className="flex w-full items-center space-x-2">
                                        <Input 
                                            id="supplier-code"
                                            placeholder="π.χ. FRZ-AB12"
                                            value={searchCode}
                                            onChange={(e) => setSearchCode(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSearchSupplier()}
                                        />
                                        <Button type="button" size="icon" onClick={handleSearchSupplier} disabled={isLoading}>
                                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Search className="h-4 w-4" />}
                                        </Button>
                                     </div>
                                </div>
                            </div>
                        ) : (
                            <>
                               <div className="space-y-3">
                                   <Label>Τύπος Συμμετοχής</Label>
                                   <Select value={joinType} onValueChange={(v: any) => setJoinType(v)}>
                                       <SelectTrigger>
                                           <SelectValue />
                                       </SelectTrigger>
                                       <SelectContent>
                                           <SelectItem value="wholesaler">Μέλος Ομάδας (Αποθήκη/Προμηθευτής)</SelectItem>
                                           <SelectItem value="store">Πελάτης (Κατάστημα)</SelectItem>
                                       </SelectContent>
                                   </Select>
                               </div>
                               <DialogFooter className="pt-4">
                                    <Button variant="outline" onClick={() => setFoundSupplier(null)} disabled={isLoading}>Ακύρωση</Button>
                                    <Button onClick={handleSendConnectionRequest} disabled={isLoading}>
                                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        Αποστολή Αιτήματος
                                    </Button>
                               </DialogFooter>
                            </>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
            
            {isLoadingConnections && <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
            
            {!isLoadingConnections && (!connections || connections.length === 0) && (
                <Card className="p-8 text-center border-dashed">
                    <p className="text-muted-foreground">Δεν έχετε συνδεδεμένους προμηθευτές ακόμα.</p>
                </Card>
            )}

            <Accordion type="single" collapsible defaultValue={connections?.[0]?.id} className="w-full space-y-4">
                {connections?.map(conn => (
                    <WholesalerCard key={conn.id} connection={conn} logo={supplierLogo} />
                ))}
            </Accordion>
        </div>
    );
}
