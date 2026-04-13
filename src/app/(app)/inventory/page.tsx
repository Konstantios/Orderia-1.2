'use client';

import Image from 'next/image';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { products as allProducts, customers } from '@/lib/data';
import { cn } from '@/lib/utils';
import { Star, Loader2, Minus, Plus, Package } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { InventoryCounting } from './counting';
import { InventoryDatabase } from './database';
import { Separator } from '@/components/ui/separator';
import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { InventoryEntry } from './entry';
import { InventoryExit } from './exit';
import { useFirebase, useCollection, useFirestore, useMemoFirebase, setDocumentNonBlocking, type WithId } from '@/firebase';
import { collection, query, where, doc, writeBatch, increment, getDocs, setDoc } from 'firebase/firestore';
import type { Store, CustomerInventoryItem, StoreProductConfiguration } from '@/lib/types';
import { Button } from '@/components/ui/button';
import Link from 'next/link';


const getStockColor = (current: number, ideal: number) => {
    if (ideal === 0) return 'bg-muted/20 border-transparent text-muted-foreground';
    const ratio = current / ideal;
    if (ratio >= 0.8) {
      return 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400';
    }
    if (ratio >= 0.4) {
      return 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400';
    }
    return 'bg-red-500/20 border-red-500/40 text-red-600 dark:text-red-400 font-bold';
};

export default function InventoryPage() {
    const { toast } = useToast();
    const { user, isUserLoading, firestore } = useFirebase();

    const [store, setStore] = useState<WithId<Store> | null>(null);
    const [isLoadingStores, setIsLoadingStores] = useState(true);

    // 1. Fetch user's store robustly
    useEffect(() => {
        if (!firestore || !user) {
            setIsLoadingStores(false);
            return;
        };

        const findStore = async () => {
            setIsLoadingStores(true);
            const storesRef = collection(firestore, 'stores');
            
            const ownerQuery = query(storesRef, where("ownerId", "==", user.uid));
            const managerQuery = query(storesRef, where("managerUids", "array-contains", user.uid));

            const [ownerSnap, managerSnap] = await Promise.all([
                getDocs(ownerQuery),
                getDocs(managerQuery)
            ]);

            let foundStore: WithId<Store> | null = null;
            if (!ownerSnap.empty) {
                const storeDoc = ownerSnap.docs[0];
                foundStore = { id: storeDoc.id, ...storeDoc.data() } as WithId<Store>;
            } else if (!managerSnap.empty) {
                 const storeDoc = managerSnap.docs[0];
                 foundStore = { id: storeDoc.id, ...storeDoc.data() } as WithId<Store>;
            }
            
            setStore(foundStore);
            setIsLoadingStores(false);
        }

        findStore();

    }, [user, firestore]);

    // 2. Fetch store's inventory - NOW A SECURE QUERY
    const inventoryQuery = useMemoFirebase(() => {
        if (!firestore || !store || !user) return null;
        return query(
          collection(firestore, 'stores', store.id, 'inventories'),
          where('managerUids', 'array-contains', user.uid)
        );
    }, [firestore, store, user]);
    const { data: inventory, isLoading: isLoadingInventory } = useCollection<CustomerInventoryItem>(inventoryQuery);

    // 3. Fetch store's product configurations (ideal stock) - NOW A SECURE QUERY
    const productConfigQuery = useMemoFirebase(() => {
        if (!firestore || !store || !user) return null;
        return query(
          collection(firestore, 'stores', store.id, 'productConfigurations'),
          where('managerUids', 'array-contains', user.uid)
        );
    }, [firestore, store, user]);
    const { data: productConfigs, isLoading: isLoadingProductConfigs } = useCollection<StoreProductConfiguration>(productConfigQuery);

    // --- Fetch Connected Wholesaler ---
    const connectionsQuery = useMemoFirebase(() => {
        if (!firestore || !store) return null;
        return query(collection(firestore, 'supplierStoreConnections'), where('storeId', '==', store.id), where('isActive', '==', true));
    }, [firestore, store]);
    const { data: connections, isLoading: isLoadingConnections } = useCollection<WithId<any>>(connectionsQuery);

    const wholesalerId = connections?.[0]?.wholesalerId;

    const [wholesalerData, setWholesalerData] = useState<any>(null);
    useEffect(() => {
        if (!firestore || !wholesalerId) return;
        const fetchWholesaler = async () => {
            const snap = await getDocs(query(collection(firestore, 'wholesalers'), where('__name__', '==', wholesalerId)));
            if (!snap.empty) {
                setWholesalerData({ id: snap.docs[0].id, ...snap.docs[0].data() });
            }
        };
        fetchWholesaler();
    }, [firestore, wholesalerId]);

    const wholesalerProductsQuery = useMemoFirebase(() => {
        if (!firestore || !wholesalerId) return null;
        return collection(firestore, 'wholesalers', wholesalerId, 'products');
    }, [firestore, wholesalerId]);
    const { data: wholesalerProducts, isLoading: isLoadingProducts } = useCollection<WithId<any>>(wholesalerProductsQuery);

    const inventoryProducts = wholesalerProducts || [];
    const supplierLogo = wholesalerData?.logoUrl ? { imageUrl: wholesalerData.logoUrl, imageHint: 'Wholesaler logo' } : PlaceHolderImages.find(img => img.id === 'frozen-foods-logo')!;
    const supplierName = wholesalerData?.companyName || 'Προμηθευτής';
    
    const handleSync = async (scannedItems: Record<string, number>, type: 'counting' | 'in' | 'out') => {
        if (!firestore || !store) {
            toast({ variant: 'destructive', title: 'Σφάλμα', description: 'Δεν βρέθηκε το κατάστημα.' });
            return;
        }

        if (Object.keys(scannedItems).length === 0) {
            toast({
                variant: 'destructive',
                title: 'Δεν υπάρχουν δεδομένα',
                description: 'Παρακαλώ σκανάρετε κάποια προϊόντα πρώτα.',
            });
            return;
        }

        const batch = writeBatch(firestore);
        for (const [productId, count] of Object.entries(scannedItems)) {
            const docRef = doc(firestore, 'stores', store.id, 'inventories', productId);
            const data: Partial<CustomerInventoryItem> = {
                productId,
                storeId: store.id,
                ownerId: store.ownerId,
                managerUids: store.managerUids,
                lastAction: { type: type, value: count }
            };
            if (type === 'counting') {
                batch.set(docRef, { ...data, currentStock: count }, { merge: true });
            } else if (type === 'in') {
                batch.set(docRef, { ...data, currentStock: increment(count) }, { merge: true });
            } else if (type === 'out') {
                batch.set(docRef, { ...data, currentStock: increment(-count) }, { merge: true });
            }
        }
        await batch.commit();

        const title = {
            'counting': 'Συγχρονισμός Ολοκληρώθηκε!',
            'in': 'Η Είσοδος Ολοκληρώθηκε!',
            'out': 'Η Έξοδος Ολοκληρώθηκε!'
        }[type];
        
        toast({
            title: title,
            description: 'Το απόθεμα ενημερώθηκε.',
        });
    };
    
    const handleStockChange = async (productId: string, value: string) => {
        if (!firestore || !store || !user) return;

        const newStock = parseInt(value, 10);
        const stockValue = Math.max(0, isNaN(newStock) ? 0 : newStock);

        try {
            const docRef = doc(firestore, 'stores', store.id, 'inventories', productId);
            await setDoc(docRef, { 
                productId: productId, 
                storeId: store.id, 
                currentStock: stockValue,
                ownerId: store.ownerId || user.uid,
                managerUids: store.managerUids || [user.uid]
            }, { merge: true });
        } catch (error) {
            console.error('Stock write error:', error);
            toast({ variant: 'destructive', title: 'Σφάλμα', description: 'Δεν ήταν δυνατή η ενημέρωση του αποθέματος.' });
        }
    };

    const handleIdealStockChange = async (productId: string, value: string) => {
        if (!firestore || !store || !user) return;

        const newIdealStock = parseInt(value, 10);
        const idealStockValue = Math.max(0, isNaN(newIdealStock) ? 0 : newIdealStock);

        try {
            const docRef = doc(firestore, 'stores', store.id, 'productConfigurations', productId);
            await setDoc(docRef, { 
                productId: productId, 
                storeId: store.id, 
                idealStock: idealStockValue,
                ownerId: store.ownerId || user.uid,
                managerUids: store.managerUids || [user.uid]
            }, { merge: true });
        } catch (error) {
            console.error('Ideal stock write error:', error);
            toast({ variant: 'destructive', title: 'Σφάλμα', description: 'Δεν ήταν δυνατή η ενημέρωση του ιδανικού αποθέματος.' });
        }
    };

    const getProductData = (productId: string) => {
        const product = inventoryProducts.find(p => p.id === productId)!;
        
        // Robust fetch: Priority 1: Doc ID matches productId. Priority 2: productId field matches.
        const idealStock = productConfigs?.find(i => i.id === productId)?.idealStock 
                        ?? productConfigs?.find(i => i.productId === productId)?.idealStock 
                        ?? 0;
                        
        const inventoryItem = inventory?.find(i => i.id === productId) 
                           ?? inventory?.find(i => i.productId === productId);
                           
        const currentStock = inventoryItem?.currentStock || 0;
        const lastAction = inventoryItem?.lastAction;
        const suggestion = Math.max(0, idealStock - currentStock);
        return { product, idealStock, currentStock, suggestion, lastAction };
    };
    
    if (isUserLoading || isLoadingStores) {
        return <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }
    
    if (!store && !isLoadingStores) {
        return (
            <div className="text-center py-10">
                <h2 className="text-2xl font-bold">Δεν βρέθηκε κατάστημα</h2>
                <p className="text-muted-foreground mt-2">Φαίνεται πως ο λογαριασμός σας δεν είναι συνδεδεμένος με κάποιο κατάστημα. Μπορείτε να δημιουργήσετε ένα από την αρχική σελίδα.</p>
                <Button asChild className="mt-4"><Link href="/">Επιστροφή</Link></Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h1 className="font-headline text-3xl font-bold">Αποθήκη</h1>
            <Tabs defaultValue="stock" className="w-full">
                <div className="flex justify-center">
                    <TabsList className="flex-wrap h-auto">
                        <TabsTrigger value="stock">Απόθεμα</TabsTrigger>
                        <TabsTrigger value="counting">Καταμέτρηση</TabsTrigger>
                        <TabsTrigger value="in">Είσοδος</TabsTrigger>
                        <TabsTrigger value="out">Έξοδος</TabsTrigger>
                        <TabsTrigger value="database">Βάση Σάρωσης</TabsTrigger>
                    </TabsList>
                </div>
                <TabsContent value="stock" className="mt-6">
                    <div className="space-y-4">
                        <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">Προμηθευτες</h2>
                        <Accordion type="single" collapsible defaultValue="item-1" className="w-full">
                            <AccordionItem value="item-1" className="border-none">
                                <Card className="rounded-lg">
                                  <AccordionTrigger className="flex w-full items-center justify-between p-3 hover:no-underline">
                                      <div className="flex items-center gap-4 text-left">
                                          <Image src={supplierLogo.imageUrl} alt={supplierName} width={48} height={48} className="rounded-md" data-ai-hint={supplierLogo.imageHint} />
                                          <div>
                                              <div className="flex items-center gap-2">
                                                  <p className="font-semibold">{supplierName}</p>
                                                  <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                                              </div>
                                              <p className="text-sm text-muted-foreground">{inventoryProducts.length} Ενεργά Προϊόντα</p>
                                          </div>
                                      </div>
                                  </AccordionTrigger>
                                </Card>
                                <AccordionContent className="p-0">
                                    <div className="space-y-4 pt-4">
                                        <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">Λιστα προϊοντων</h2>
                                        {(isLoadingInventory || isLoadingProductConfigs) && <div className="flex justify-center items-center h-20"><Loader2 className="h-6 w-6 animate-spin" /></div>}
                                        {!(isLoadingInventory || isLoadingProductConfigs) && inventoryProducts.map(({ id }) => {
                                            const { product, idealStock, currentStock, suggestion, lastAction } = getProductData(id);
                                            if (!product) return null;

                                            const lastActionInfo = lastAction ? {
                                                'in': { text: 'Είσοδος', color: 'text-green-500' },
                                                'out': { text: 'Έξοδος', color: 'text-destructive' },
                                                'counting': { text: 'Καταμέτρηση', color: 'text-yellow-500' }
                                            }[lastAction.type] : null;

                                            return (
                                                <Card key={id} className="overflow-hidden bg-card">
                                                    <CardContent className="p-4">
                                                        <div className="flex items-center gap-4">
                                                            {product.imageUrl ? (
                                                                <Image src={product.imageUrl} alt={product.name} width={64} height={64} className="rounded-lg flex-shrink-0 object-cover" data-ai-hint={product.imageHint} />
                                                            ) : (
                                                                <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                                                                    <Package className="h-8 w-8 text-muted-foreground" />
                                                                </div>
                                                            )}
                                                            <div className="flex-1">
                                                                <p className="font-semibold">{product.name}</p>
                                                                <p className="text-sm text-muted-foreground">{product.code}</p>
                                                            </div>
                                                        </div>
                                                        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                                                            <div className={cn('rounded-lg border p-2 flex flex-col justify-center items-center', getStockColor(currentStock, idealStock))}>
                                                                <p className="text-xs font-semibold uppercase mb-1">ΑΠΟΘΕΜΑ</p>
                                                                <div className="flex items-center justify-center gap-1">
                                                                    <Input
                                                                        key={`stock-${id}-${currentStock}`}
                                                                        type="number"
                                                                        defaultValue={currentStock}
                                                                        onBlur={(e) => handleStockChange(id, e.target.value)}
                                                                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                                                                        className="w-16 h-auto p-0 text-2xl font-black text-center bg-transparent border-0 shadow-none focus-visible:ring-0"
                                                                        min="0"
                                                                    />
                                                                    <div className="flex flex-col gap-1">
                                                                        <Button variant="outline" size="icon" className="h-6 w-6 rounded-md" onClick={() => handleStockChange(id, String(currentStock + 1))}>
                                                                            <Plus className="h-4 w-4" />
                                                                        </Button>
                                                                        <Button variant="outline" size="icon" className="h-6 w-6 rounded-md" onClick={() => handleStockChange(id, String(currentStock - 1))}>
                                                                            <Minus className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="rounded-lg bg-muted/30 p-2 flex flex-col justify-center items-center">
                                                                <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">ΙΔΑΝΙΚΟ</p>
                                                                <div className="flex items-center justify-center gap-1">
                                                                    <Input
                                                                        key={`ideal-${id}-${idealStock}`}
                                                                        type="number"
                                                                        defaultValue={idealStock}
                                                                        onBlur={(e) => handleIdealStockChange(id, e.target.value)}
                                                                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                                                                        className="w-16 h-auto p-0 text-2xl font-bold text-center bg-transparent border-0 shadow-none focus-visible:ring-0"
                                                                        min="0"
                                                                    />
                                                                    <div className="flex flex-col gap-1">
                                                                        <Button variant="outline" size="icon" className="h-6 w-6 rounded-md" onClick={() => handleIdealStockChange(id, String(idealStock + 1))}>
                                                                            <Plus className="h-4 w-4" />
                                                                        </Button>
                                                                        <Button variant="outline" size="icon" className="h-6 w-6 rounded-md" onClick={() => handleIdealStockChange(id, String(idealStock - 1))}>
                                                                            <Minus className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="rounded-lg bg-muted/30 p-2">
                                                                <p className="text-xs font-semibold uppercase text-muted-foreground">ΠΡΟΤΑΣΗ</p>
                                                                <p className="text-2xl font-bold text-accent">+{suggestion}</p>
                                                            </div>
                                                        </div>
                                                        {lastAction && lastActionInfo && (
                                                            <>
                                                                <Separator className="my-3" />
                                                                <div className={cn("flex items-center justify-center gap-2 text-xs font-medium", lastActionInfo.color)}>
                                                                    <span>Προηγ. ενέργεια:</span>
                                                                    <span className="font-bold">{lastActionInfo.text} {lastAction.value}</span>
                                                                </div>
                                                            </>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </div>
                </TabsContent>
                <TabsContent value="counting" className="mt-6">
                    <InventoryCounting products={inventoryProducts} customer={{ name: supplierName }} inventory={inventory || []} onSync={(items) => handleSync(items, 'counting')} />
                </TabsContent>
                <TabsContent value="in" className="mt-6">
                    <InventoryEntry products={inventoryProducts} customer={{ name: supplierName }} inventory={inventory || []} onSync={(items) => handleSync(items, 'in')} />
                </TabsContent>
                 <TabsContent value="out" className="mt-6">
                    <InventoryExit products={inventoryProducts} customer={{ name: supplierName }} inventory={inventory || []} onSync={(items) => handleSync(items, 'out')} />
                </TabsContent>
                <TabsContent value="database" className="mt-6">
                    <InventoryDatabase products={inventoryProducts} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

    