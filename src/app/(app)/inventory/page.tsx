'use client';

import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Loader2, Minus, Plus, Package, LayoutGrid, List } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { InventoryCounting } from './counting';
import { InventoryDatabase } from './database';
import { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { InventoryEntry } from './entry';
import { InventoryExit } from './exit';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, writeBatch, increment, getDocs, setDoc, documentId, addDoc } from 'firebase/firestore';
import type { Store, Wholesaler, CustomerInventoryItem, StoreProductConfiguration, Order, Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import type { WithId } from '@/firebase';
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer, 
    Legend 
} from 'recharts';
import { subMonths, format as dateFnsFormat } from 'date-fns';
import { el as elLocale } from 'date-fns/locale';

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

    const [partner, setPartner] = useState<WithId<Store | Wholesaler> | null>(null);
    const [partnerType, setPartnerType] = useState<'store' | 'wholesaler'>('store');
    const [isLoadingPartner, setIsLoadingPartner] = useState(true);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    // 1. Fetch user's partner (Store or Wholesaler) robustly
    useEffect(() => {
        if (!firestore || !user) {
            setIsLoadingPartner(false);
            return;
        };

        const findPartner = async () => {
            setIsLoadingPartner(true);
            
            // Try Store first
            const storesRef = collection(firestore, 'stores');
            const storeOwnerQuery = query(storesRef, where("ownerId", "==", user.uid));
            const storeManagerQuery = query(storesRef, where("managerUids", "array-contains", user.uid));

            const [storeOwnerSnap, storeManagerSnap] = await Promise.all([
                getDocs(storeOwnerQuery),
                getDocs(storeManagerQuery)
            ]);

            if (!storeOwnerSnap.empty || !storeManagerSnap.empty) {
                const docSnap = !storeOwnerSnap.empty ? storeOwnerSnap.docs[0] : storeManagerSnap.docs[0];
                setPartner({ id: docSnap.id, ...docSnap.data() } as WithId<Store>);
                setPartnerType('store');
                setIsLoadingPartner(false);
                return;
            }

            // Try Wholesaler
            const wholesalersRef = collection(firestore, 'wholesalers');
            const whOwnerQuery = query(wholesalersRef, where("ownerId", "==", user.uid));
            const whAdminQuery = query(wholesalersRef, where("adminUids", "array-contains", user.uid));

            const [whOwnerSnap, whAdminSnap] = await Promise.all([
                getDocs(whOwnerQuery),
                getDocs(whAdminQuery)
            ]);

            if (!whOwnerSnap.empty || !whAdminSnap.empty) {
                const docSnap = !whOwnerSnap.empty ? whOwnerSnap.docs[0] : whAdminSnap.docs[0];
                const whData = { id: docSnap.id, ...docSnap.data() } as WithId<Wholesaler>;
                setPartner(whData);
                setPartnerType('wholesaler');
            }
            
            setIsLoadingPartner(false);
        }

        findPartner();
    }, [user, firestore]);

    const isWholesalerPartner = partnerType === 'wholesaler';
    const partnerCollection = isWholesalerPartner ? 'wholesalers' : 'stores';

    // 2. Fetch partner's inventory
    const inventoryQuery = useMemoFirebase(() => {
        if (!firestore || !partner || !user) return null;
        return collection(firestore, partnerCollection, partner.id, 'inventories');
    }, [firestore, partner, partnerCollection]);
    const { data: inventory, isLoading: isLoadingInventory } = useCollection<CustomerInventoryItem>(inventoryQuery);

    // 3. Fetch partner's product configurations
    const productConfigQuery = useMemoFirebase(() => {
        if (!firestore || !partner || !user) return null;
        return collection(firestore, partnerCollection, partner.id, 'productConfigurations');
    }, [firestore, partner, partnerCollection]);
    const { data: productConfigs, isLoading: isLoadingProductConfigs } = useCollection<StoreProductConfiguration>(productConfigQuery);

    // --- Fetch Connected Supplier ---
    const connectionsQuery = useMemoFirebase(() => {
        if (!firestore || !partner || isWholesalerPartner) return null;
        return query(collection(firestore, 'supplierStoreConnections'), where('storeId', '==', partner.id), where('isActive', '==', true));
    }, [firestore, partner, isWholesalerPartner]);
    const { data: connections, isLoading: isLoadingConnections } = useCollection<WithId<any>>(connectionsQuery);

    const supplierId = isWholesalerPartner 
        ? (partner as Wholesaler).parentWholesalerId 
        : connections?.[0]?.wholesalerId;

    const [supplierData, setSupplierData] = useState<any>(null);
    useEffect(() => {
        if (!firestore || !supplierId) {
            setSupplierData(null);
            return;
        }
        const fetchSupplier = async () => {
            const snap = await getDocs(query(collection(firestore, 'wholesalers'), where(documentId(), '==', supplierId)));
            if (!snap.empty) {
                setSupplierData({ id: snap.docs[0].id, ...snap.docs[0].data() });
            }
        };
        fetchSupplier();
    }, [firestore, supplierId]);

    // Fetch Supplier's Products
    const supplierProductsQuery = useMemoFirebase(() => {
        if (!firestore || !supplierId) return null;
        return collection(firestore, 'wholesalers', supplierId, 'products');
    }, [firestore, supplierId]);
    const { data: supplierProducts, isLoading: isLoadingSupplierProducts } = useCollection<WithId<any>>(supplierProductsQuery);

    // Fetch Our Own Products
    const ownProductsQuery = useMemoFirebase(() => {
        if (!firestore || !partner || !isWholesalerPartner) return null;
        return collection(firestore, 'wholesalers', partner.id, 'products');
    }, [firestore, partner, isWholesalerPartner]);
    const { data: ownProducts, isLoading: isLoadingOwnProducts } = useCollection<WithId<any>>(ownProductsQuery);

    const inventoryProducts = useMemo(() => {
        const assignedIds = new Set(productConfigs?.map(c => c.productId) || []);
        const assignedProducts = (supplierProducts || []).filter(p => assignedIds.has(p.id));
        const localProducts = ownProducts || [];
        
        const productMap = new Map();
        assignedProducts.forEach(p => productMap.set(p.id, p));
        localProducts.forEach(p => productMap.set(p.id, p));
        
        return Array.from(productMap.values());
    }, [supplierProducts, productConfigs, ownProducts]);

    const supplierLogo = supplierData?.logoUrl ? { imageUrl: supplierData.logoUrl, imageHint: 'Supplier logo' } : PlaceHolderImages.find(img => img.id === 'frozen-foods-logo')!;
    const supplierName = supplierData?.companyName || (isWholesalerPartner ? 'Μητρικός Προμηθευτής' : 'Προμηθευτής');
    
    // --- Statistics Data Fetching ---
    const orderQuery = useMemoFirebase(() => {
        if (!firestore || !partner) return null;
        return query(
            collection(firestore, 'orders'),
            where('storeId', '==', partner.id)
        );
    }, [firestore, partner]);
    const { data: orders, isLoading: isLoadingOrders } = useCollection<Order>(orderQuery);

    const monthlyStats = useMemo(() => {
        if (!orders) return [];
        const stats: Record<string, any> = {};
        const now = new Date();
        
        for (let i = 5; i >= 0; i--) {
            const d = subMonths(now, i);
            const key = dateFnsFormat(d, 'MMM', { locale: elLocale });
            stats[key] = { name: key, κιβώτια: 0, κιλά: 0, τεμάχια: 0 };
        }

        orders.forEach(order => {
            const date = (order.date as any)?.toDate ? (order.date as any).toDate() : new Date(order.date);
            const key = dateFnsFormat(date, 'MMM', { locale: elLocale });
            if (stats[key]) {
                order.items.forEach((item: any) => {
                    const product = inventoryProducts.find(p => p.id === item.productId);
                    const unit = item.unit || product?.unit || 'τεμάχιο';
                    if (unit === 'κιβώτιο') stats[key].κιβώτια += item.quantity;
                    else if (unit === 'κιλό') stats[key].κιλά += item.quantity;
                    else stats[key].τεμάχια += item.quantity;
                });
            }
        });

        return Object.values(stats);
    }, [orders, inventoryProducts]);

    const totals = useMemo(() => {
        const t = { boxes: 0, kg: 0, pieces: 0 };
        if (!orders) return t;
        orders.forEach(order => {
            order.items.forEach((item: any) => {
                const product = inventoryProducts.find(p => p.id === item.productId);
                const unit = item.unit || product?.unit || 'τεμάχιο';
                if (unit === 'κιβώτιο') t.boxes += item.quantity;
                else if (unit === 'κιλό') t.kg += item.quantity;
                else t.pieces += item.quantity;
            });
        });
        return t;
    }, [orders, inventoryProducts]);

    const handleSync = async (scannedItems: Record<string, number>, type: 'counting' | 'in' | 'out') => {
        if (!firestore || !partner) {
            toast({ variant: 'destructive', title: 'Σφάλμα', description: 'Δεν βρέθηκε ο συνεργάτης.' });
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
            const docRef = doc(firestore, partnerCollection, partner.id, 'inventories', productId);
            const data: any = {
                productId,
                lastAction: { type: type, value: count }
            };
            if (isWholesalerPartner) data.wholesalerId = partner.id;
            else data.storeId = partner.id;
            
            data.ownerId = partner.ownerId || '';
            data.managerUids = (partner as Store).managerUids || (partner as Wholesaler).adminUids || [];

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
        if (!firestore || !partner || !user) return;

        const newStock = parseInt(value, 10);
        const stockValue = Math.max(0, isNaN(newStock) ? 0 : newStock);

        try {
            const docRef = doc(firestore, partnerCollection, partner.id, 'inventories', productId);
            const data: any = { 
                productId: productId, 
                currentStock: stockValue,
                ownerId: partner.ownerId || user.uid,
                managerUids: (partner as Store).managerUids || (partner as Wholesaler).adminUids || [user.uid]
            };
            if (isWholesalerPartner) data.wholesalerId = partner.id;
            else data.storeId = partner.id;

            await setDoc(docRef, data, { merge: true });
        } catch (error) {
            console.error('Stock write error:', error);
            toast({ variant: 'destructive', title: 'Σφάλμα', description: 'Δεν ήταν δυνατή η ενημέρωση του αποθέματος.' });
        }
    };

    const handleIdealStockChange = async (productId: string, value: string) => {
        if (!firestore || !partner || !user) return;

        const newIdealStock = parseInt(value, 10);
        const idealStockValue = Math.max(0, isNaN(newIdealStock) ? 0 : newIdealStock);

        try {
            const docRef = doc(firestore, partnerCollection, partner.id, 'productConfigurations', productId);
            const data: any = { 
                productId: productId, 
                idealStock: idealStockValue,
                ownerId: partner.ownerId || user.uid,
                managerUids: (partner as Store).managerUids || (partner as Wholesaler).adminUids || [user.uid]
            };
            if (isWholesalerPartner) data.wholesalerId = partner.id;
            else data.storeId = partner.id;

            await setDoc(docRef, data, { merge: true });
        } catch (error) {
            console.error('Ideal stock write error:', error);
            toast({ variant: 'destructive', title: 'Σφάλμα', description: 'Δεν ήταν δυνατή η ενημέρωση του ιδανικού αποθέματος.' });
        }
    };

    const handleAddProduct = async (productData: Product) => {
        if (!firestore || !partner || !isWholesalerPartner) return;
        try {
            const productsRef = collection(firestore, 'wholesalers', partner.id, 'products');
            await addDoc(productsRef, {
                ...productData,
                wholesalerId: partner.id,
                createdAt: new Date()
            });
            toast({ title: 'Το προϊόν προστέθηκε!', description: 'Είναι πλέον διαθέσιμο στον κατάλογό σας.' });
        } catch (error) {
            console.error('Add product error:', error);
            toast({ variant: 'destructive', title: 'Σφάλμα', description: 'Δεν ήταν δυνατή η πρόσθεση του προϊόντος.' });
        }
    };

    const getProductData = (productId: string) => {
        const product = inventoryProducts.find(p => p.id === productId)!;
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
    
    if (isUserLoading || isLoadingPartner) {
        return <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }
    
    if (!partner && !isLoadingPartner) {
        return (
            <div className="text-center py-10">
                <h2 className="text-2xl font-bold">Δεν βρέθηκε σύνδεση</h2>
                <p className="text-muted-foreground mt-2">Φαίνεται πως ο λογαριασμός σας δεν είναι συνδεδεμένος με κάποιο κατάστημα ή προμηθευτή.</p>
                <Button asChild className="mt-4"><Link href="/">Επιστροφή</Link></Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-10 px-4 sm:px-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="font-headline text-3xl font-bold tracking-tight">Αποθήκη</h1>
                    <p className="text-muted-foreground">Διαχείριση αποθέματος και παραλαβών για {isWholesalerPartner ? (partner as Wholesaler).companyName : partner ? (partner as Store).businessName : ''}</p>
                </div>
                {isWholesalerPartner && (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 self-start sm:self-center font-bold px-3 py-1">
                        ΛΕΙΤΟΥΡΓΙΑ ΥΠΟ-ΠΡΟΜΗΘΕΥΤΗ
                    </Badge>
                )}
            </div>

            <Tabs defaultValue="stock" className="w-full">
                <TabsList className="grid grid-cols-2 lg:grid-cols-6 w-full bg-muted/30 p-1 h-auto rounded-xl">
                    <TabsTrigger value="stock" className="rounded-lg py-2">Απόθεμα</TabsTrigger>
                    <TabsTrigger value="counting" className="rounded-lg py-2">Καταμέτρηση</TabsTrigger>
                    <TabsTrigger value="in" className="rounded-lg py-2">Είσοδος</TabsTrigger>
                    <TabsTrigger value="out" className="rounded-lg py-2">Έξοδος</TabsTrigger>
                    <TabsTrigger value="stats" className="rounded-lg py-2">Στατιστικά</TabsTrigger>
                    <TabsTrigger value="database" className="rounded-lg py-2">Βάση Σάρωσης</TabsTrigger>
                </TabsList>

                <TabsContent value="stock" className="mt-8">
                    <div className="space-y-6">
                        <Card className="border-none shadow-sm bg-gradient-to-r from-primary/5 to-transparent border-l-4 border-l-primary">
                            <CardContent className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                     <div className="h-12 w-12 relative rounded-xl overflow-hidden shadow-sm border border-background bg-white">
                                        <Image src={supplierLogo.imageUrl} alt={supplierName} fill className="object-contain p-1" data-ai-hint={supplierLogo.imageHint} />
                                     </div>
                                     <div>
                                         <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">KYPIΟΣ ΠΡΟΜΗΘΕΥΤΗΣ</p>
                                         <p className="font-bold text-lg">{supplierName}</p>
                                     </div>
                                </div>
                                <div className="hidden sm:block text-right">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">ΠΡΟΪΟΝΤΑ</p>
                                    <p className="font-bold text-lg">{inventoryProducts.length}</p>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="flex justify-end text-muted-foreground w-full">
                            <div className="flex border rounded-md">
                                <Button variant={viewMode === 'grid' ? "secondary" : "ghost"} size="icon" onClick={() => setViewMode('grid')} className="rounded-r-none h-8 w-8">
                                    <LayoutGrid className="h-4 w-4" />
                                </Button>
                                <Button variant={viewMode === 'list' ? "secondary" : "ghost"} size="icon" onClick={() => setViewMode('list')} className="rounded-l-none h-8 w-8">
                                    <List className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {viewMode === 'grid' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {(isLoadingInventory || isLoadingProductConfigs) && <div className="col-span-full flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
                            {!(isLoadingInventory || isLoadingProductConfigs) && inventoryProducts.map(({ id }) => {
                                const { product, idealStock, currentStock, suggestion, lastAction } = getProductData(id);
                                if (!product) return null;

                                const lastActionInfo = lastAction ? {
                                    'in': { text: 'Είσοδος', color: 'text-green-600', bg: 'bg-green-50' },
                                    'out': { text: 'Έξοδος', color: 'text-red-600', bg: 'bg-red-50' },
                                    'counting': { text: 'Καταμέτρηση', color: 'text-amber-600', bg: 'bg-amber-50' }
                                }[lastAction.type] : null;

                                return (
                                    <Card key={id} className="overflow-hidden border-2 border-primary/5 hover:border-primary/20 transition-all group shadow-sm hover:shadow-md">
                                        <CardContent className="p-0">
                                            <div className="p-4 flex items-center gap-4 border-b border-primary/5">
                                                {product.imageUrl ? (
                                                    <div className="h-14 w-14 relative rounded-lg overflow-hidden border border-border bg-white shadow-xs group-hover:scale-105 transition-transform">
                                                        <Image src={product.imageUrl} alt={product.name} fill className="object-contain p-1" data-ai-hint={product.imageHint} />
                                                    </div>
                                                ) : (
                                                    <div className="h-14 w-14 bg-muted rounded-lg flex items-center justify-center">
                                                        <Package className="h-8 w-8 text-muted-foreground/40" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold truncate" title={product.name}>{product.name}</p>
                                                    <Badge variant="outline" className="text-[10px] font-mono mt-1 border-none bg-muted/50">
                                                        {product.code || product.sku}
                                                    </Badge>
                                                </div>
                                            </div>
                                            
                                            <div className="p-4 grid grid-cols-3 gap-2">
                                                <div className={cn('rounded-xl p-2 flex flex-col items-center justify-center border-2 transition-colors', getStockColor(currentStock, idealStock))}>
                                                    <p className="text-[9px] font-black uppercase tracking-tighter opacity-70">ΑΠΟΘΕΜΑ</p>
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <span className="text-xl font-black">{currentStock}</span>
                                                        <div className="flex flex-col">
                                                            <button onClick={() => handleStockChange(id, String(currentStock + 1))} className="hover:text-primary transition-colors"><Plus className="h-3 w-3" /></button>
                                                            <button onClick={() => handleStockChange(id, String(currentStock - 1))} className="hover:text-primary transition-colors"><Minus className="h-3 w-3" /></button>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="rounded-xl p-2 flex flex-col items-center justify-center bg-muted/30 border-2 border-transparent">
                                                    <p className="text-[9px] font-black uppercase tracking-tighter opacity-70">ΙΔΑΝΙΚΟ</p>
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <span className="text-xl font-bold">{idealStock}</span>
                                                        <div className="flex flex-col">
                                                            <button onClick={() => handleIdealStockChange(id, String(idealStock + 1))} className="hover:text-primary transition-colors"><Plus className="h-3 w-3" /></button>
                                                            <button onClick={() => handleIdealStockChange(id, String(idealStock - 1))} className="hover:text-primary transition-colors"><Minus className="h-3 w-3" /></button>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="rounded-xl p-2 flex flex-col items-center justify-center bg-blue-50 text-blue-700 border-2 border-transparent">
                                                    <p className="text-[9px] font-black uppercase tracking-tighter opacity-70">ΠΡΟΤΑΣΗ</p>
                                                    <p className="text-xl font-black mt-1">+{suggestion}</p>
                                                </div>
                                            </div>

                                            {lastActionInfo && (
                                                <div className={cn("px-4 py-2 text-[10px] font-bold flex items-center justify-center gap-2", lastActionInfo.bg, lastActionInfo.color)}>
                                                    <span>ΤΕΛΕΥΤΑΙΑ ΕΝΕΡΓΕΙΑ:</span>
                                                    <span>{lastActionInfo.text.toUpperCase()} {lastAction.value}</span>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                        )}

                        {viewMode === 'list' && (
                            <div className="border rounded-md overflow-x-auto bg-card scrollbar-thin scrollbar-thumb-muted-foreground/20">
                                <div className="min-w-[600px] w-full">
                                    <Table>
                                        <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead className="w-[60px]">Εικόνα</TableHead>
                                            <TableHead>Προϊόν / Κωδικός</TableHead>
                                            <TableHead className="text-center w-[120px]">Απόθεμα</TableHead>
                                            <TableHead className="text-center w-[120px]">Ιδανικό</TableHead>
                                            <TableHead className="text-right w-[80px]">Πρόταση</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(isLoadingInventory || isLoadingProductConfigs) ? (
                                            <TableRow><TableCell colSpan={5} className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /></TableCell></TableRow>
                                        ) : inventoryProducts.map(({ id }) => {
                                            const { product, idealStock, currentStock, suggestion } = getProductData(id);
                                            if (!product) return null;
                                            return (
                                                <TableRow key={`list-${id}`}>
                                                    <TableCell>
                                                        {product.imageUrl ? (
                                                            <div className="h-10 w-10 relative rounded-md overflow-hidden bg-white border">
                                                                <Image src={product.imageUrl} alt={product.name} fill className="object-contain p-1" data-ai-hint={product.imageHint} />
                                                            </div>
                                                        ) : (
                                                            <div className="w-10 h-10 bg-muted rounded-md flex items-center justify-center flex-shrink-0">
                                                                <Package className="h-5 w-5 text-muted-foreground" />
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="font-semibold text-sm">{product.name}</div>
                                                        <div className="text-xs text-muted-foreground">{product.code || product.sku}</div>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Input
                                                            type="number"
                                                            defaultValue={currentStock}
                                                            onBlur={(e) => handleStockChange(id, e.target.value)}
                                                            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                                                            className={cn("w-20 h-8 mx-auto text-center font-bold px-1", getStockColor(currentStock, idealStock))}
                                                            min="0"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Input
                                                            type="number"
                                                            defaultValue={idealStock}
                                                            onBlur={(e) => handleIdealStockChange(id, e.target.value)}
                                                            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                                                            className="w-20 h-8 mx-auto text-center bg-muted/30 font-bold px-1"
                                                            min="0"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold text-accent text-lg">
                                                        +{suggestion}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="counting" className="mt-8">
                    <InventoryCounting 
                        products={inventoryProducts} 
                        customer={{ name: partnerType === 'store' ? (partner as Store)?.businessName : (partner as Wholesaler)?.companyName }} 
                        inventory={inventory || []} 
                        productConfigs={productConfigs || []} 
                        isLoading={isLoadingInventory || isLoadingProductConfigs}
                        onSync={(items) => handleSync(items, 'counting')} 
                    />
                </TabsContent>
                <TabsContent value="in" className="mt-8">
                    <InventoryEntry 
                        products={inventoryProducts} 
                        customer={{ name: partnerType === 'store' ? (partner as Store)?.businessName : (partner as Wholesaler)?.companyName }} 
                        inventory={inventory || []} 
                        productConfigs={productConfigs || []} 
                        isLoading={isLoadingInventory || isLoadingProductConfigs}
                        onSync={(items) => handleSync(items, 'in')} 
                    />
                </TabsContent>
                <TabsContent value="out" className="mt-8">
                    <InventoryExit 
                        products={inventoryProducts} 
                        customer={{ name: partnerType === 'store' ? (partner as Store)?.businessName : (partner as Wholesaler)?.companyName }} 
                        inventory={inventory || []} 
                        productConfigs={productConfigs || []} 
                        isLoading={isLoadingInventory || isLoadingProductConfigs}
                        onSync={(items) => handleSync(items, 'out')} 
                    />
                </TabsContent>
                <TabsContent value="stats" className="mt-8 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <Card className="border-2 border-primary/5 shadow-sm overflow-hidden">
                                <CardContent className="p-6">
                                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Συνολικά Κιβώτια</p>
                                <p className="text-4xl font-black text-primary">{totals.boxes.toLocaleString('el-GR')}</p>
                                </CardContent>
                        </Card>
                        <Card className="border-2 border-primary/5 shadow-sm overflow-hidden">
                                <CardContent className="p-6">
                                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Συνολικά Κιλά</p>
                                <p className="text-4xl font-black text-primary">{totals.kg.toLocaleString('el-GR')}</p>
                                </CardContent>
                        </Card>
                            <Card className="border-2 border-primary/5 shadow-sm overflow-hidden">
                                <CardContent className="p-6">
                                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Συνολικά Τεμάχια</p>
                                <p className="text-4xl font-black text-primary">{totals.pieces.toLocaleString('el-GR')}</p>
                                </CardContent>
                        </Card>
                    </div>

                    <Card className="border-2 border-primary/5 shadow-sm">
                        <CardContent className="pt-8">
                            <div className="mb-6">
                                <h3 className="text-lg font-bold">Όγκος Παραγγελιών / Κατανάλωση</h3>
                                <p className="text-sm text-muted-foreground">Σύγκριση ανά μήνα για το τελευταίο εξάμηνο.</p>
                            </div>
                            <div className="h-[350px] w-full">
                                {isLoadingOrders ? (
                                    <div className="h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={monthlyStats}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                            <YAxis axisLine={false} tickLine={false} />
                                            <Tooltip 
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                            />
                                            <Legend verticalAlign="top" align="right" iconType="circle" />
                                            <Bar name="Κιβώτια" dataKey="κιβώτια" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                            <Bar name="Κιλά" dataKey="κιλά" fill="#10b981" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="database" className="mt-8">
                    <InventoryDatabase 
                        products={inventoryProducts} 
                        isWholesaler={isWholesalerPartner}
                        onAddProduct={handleAddProduct}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
