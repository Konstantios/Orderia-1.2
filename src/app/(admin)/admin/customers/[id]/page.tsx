'use client';

import { useState, useMemo, useEffect, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
    LineChart, 
    Line, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer, 
    BarChart, 
    Bar, 
    Legend,
    AreaChart,
    Area,
    LabelList
} from 'recharts';
import { 
    ChevronLeft, 
    Upload, 
    Download, 
    Search, 
    Loader2, 
    CheckCircle2, 
    Package, 
    Mail, 
    Phone, 
    MapPin,
    AlertCircle,
    Pencil,
    Save,
    X,
    Info,
    TrendingUp,
    Users
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useFirebase, useCollection, useMemoFirebase, type WithId } from '@/firebase';
import { 
    collection, 
    query, 
    where, 
    doc, 
    getDocs, 
    writeBatch, 
    limit, 
    deleteDoc, 
    updateDoc,
    setDoc,
    documentId,
    Timestamp as FirestoreTimestamp,
    orderBy as firestoreOrderBy
} from 'firebase/firestore';
import type { Store, Wholesaler, Product, StoreProductConfiguration, Order, WholesalerProductConfiguration } from '@/lib/types';
import Image from 'next/image';
import { subMonths, subWeeks, startOfMonth, startOfWeek, endOfMonth, endOfWeek, format as dateFnsFormat, isWithinInterval } from 'date-fns';
import { el as elLocale } from 'date-fns/locale';

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: partnerId } = use(params);
    const searchParams = useSearchParams();
    const type = searchParams.get('type') || 'store';
    const isWholesalerType = type === 'wholesaler';

    const router = useRouter();
    const { toast } = useToast();
    const { user, firestore } = useFirebase();

    const [partner, setPartner] = useState<WithId<Store | Wholesaler> | null>(null);
    const [isLoadingPartner, setIsLoadingPartner] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Edit mode state
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        name: '',
        ownerName: '',
        email: '',
        phone: '',
        address: '',
        deliveryDay: '',
        taxId: '',
    });

    useEffect(() => {
        if (partner) {
            setEditForm({
                 name: (partner as Store).businessName || (partner as Wholesaler).companyName || '',
                 ownerName: partner.ownerName || '',
                 email: partner.email || '',
                 phone: partner.phone || '',
                 address: (partner as Store).address || '',
                 deliveryDay: (partner as Store).deliveryDay || '',
                 taxId: (partner as Wholesaler).taxId || '',
            });
        }
    }, [partner]);

    // 2. Fetch Wholesaler (Current Admin)
    const wholesalerQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, 'wholesalers'), where('adminUids', 'array-contains', user.uid), limit(1));
    }, [user, firestore]);
    const { data: wholesalers, isLoading: isLoadingWholesaler } = useCollection<Wholesaler>(wholesalerQuery);
    const wholesaler = wholesalers?.[0];

    // 3. Fetch Wholesaler Products
    const productsQuery = useMemoFirebase(() => {
        if (!firestore || !wholesaler) return null;
        return collection(firestore, 'wholesalers', wholesaler.id, 'products');
    }, [firestore, wholesaler]);
    const { data: allProducts, isLoading: isLoadingProducts } = useCollection<WithId<Product>>(productsQuery);

    // --- Statistics Logic (Only for Stores) ---
    const orderQuery = useMemoFirebase(() => {
        if (!firestore || !user || isWholesalerType) return null;
        return query(
            collection(firestore, 'orders'),
            where('memberUids', 'array-contains', user.uid)
        );
    }, [firestore, user, isWholesalerType]);
    const { data: realOrders, isLoading: isLoadingOrders } = useCollection<Order>(orderQuery);

    // Dummy Data Generator (Omitted for wholesalers)
    const dummyOrders = useMemo(() => {
        if (isWholesalerType || !wholesaler || !allProducts || allProducts.length === 0) return [];
        
        const generated: any[] = [];
        const now = new Date();
        
        for (let i = 0; i < 6; i++) {
            const monthDate = subMonths(now, i);
            const orderCount = Math.floor(Math.random() * 5) + 3;
            
            for (let j = 0; j < orderCount; j++) {
                const dayOffset = Math.floor(Math.random() * 28);
                const orderDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), dayOffset);
                const itemsCount = Math.floor(Math.random() * 4) + 3;
                const items = Array.from({ length: itemsCount }).map(() => {
                    const product = allProducts[Math.floor(Math.random() * allProducts.length)];
                    return {
                        productId: product.id,
                        quantity: Math.floor(Math.random() * 15) + 5,
                        unit: product.unit
                    };
                });
                
                generated.push({
                    id: `dummy-${i}-${j}`,
                    date: orderDate,
                    items,
                    status: 'Απεσταλμένη'
                });
            }
        }
        return generated;
    }, [wholesaler, allProducts, isWholesalerType]);

    const combinedOrders = useMemo(() => {
        if (isWholesalerType) return [];
        const processedReal = (realOrders || [])
            .filter(o => o.storeId === partnerId && o.wholesalerId === wholesaler?.id)
            .map(o => ({
                ...o,
                date: (o.date as any)?.toDate ? (o.date as any).toDate() : new Date(o.date),
                items: o.items.map(item => {
                    const p = allProducts?.find(product => product.id === item.productId);
                    return { ...item, unit: p?.unit || 'τεμάχιο' };
                })
            }));
        return [...processedReal, ...dummyOrders].sort((a,b) => b.date.getTime() - a.date.getTime());
    }, [realOrders, dummyOrders, allProducts, partnerId, wholesaler, isWholesalerType]);

    // Monthly Aggregation
    const monthlyStats = useMemo(() => {
        if (isWholesalerType) return [];
        const stats: Record<string, any> = {};
        const now = new Date();
        
        for (let i = 5; i >= 0; i--) {
            const d = subMonths(now, i);
            const key = dateFnsFormat(d, 'MMM', { locale: elLocale });
            stats[key] = { name: key, κιβώτια: 0, κιλά: 0, τεμάχια: 0 };
        }

        combinedOrders.forEach(order => {
            const key = dateFnsFormat(order.date, 'MMM', { locale: elLocale });
            if (stats[key]) {
                order.items.forEach((item: any) => {
                    if (item.unit === 'κιβώτιο') stats[key].κιβώτια += item.quantity;
                    else if (item.unit === 'κιλό') stats[key].κιλά += item.quantity;
                    else stats[key].τεμάχια += item.quantity;
                });
            }
        });

        return Object.values(stats);
    }, [combinedOrders, isWholesalerType]);

    // Product Monthly Stats
    const productMonthlyStats = useMemo(() => {
        if (isWholesalerType || !allProducts) return { monthKeys: [], products: [] };
        
        const monthKeys: string[] = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            monthKeys.push(dateFnsFormat(subMonths(now, i), 'MMM yy', { locale: elLocale }));
        }

        const statsMap = new Map<string, any>();

        combinedOrders.forEach(order => {
            const key = dateFnsFormat(order.date, 'MMM yy', { locale: elLocale });
            if (monthKeys.includes(key)) {
                order.items.forEach((item: any) => {
                    const product = allProducts.find(p => p.id === item.productId);
                    if (!product) return;

                    if (!statsMap.has(item.productId)) {
                        const initialMonths: Record<string, number> = {};
                        monthKeys.forEach(m => initialMonths[m] = 0);
                        statsMap.set(item.productId, {
                            id: item.productId,
                            name: product.name,
                            code: product.code || product.sku || '',
                            unit: item.unit || product.unit,
                            months: initialMonths,
                            total: 0
                        });
                    }
                    const stat = statsMap.get(item.productId);
                    stat.months[key] += item.quantity;
                    stat.total += item.quantity;
                });
            }
        });

        const productsArray = Array.from(statsMap.values()).sort((a,b) => b.total - a.total);
        return { monthKeys, products: productsArray };
    }, [combinedOrders, isWholesalerType, allProducts]);

    // Totals
    const totals = useMemo(() => {
        const t = { boxes: 0, kg: 0, pieces: 0 };
        if (isWholesalerType) return t;
        combinedOrders.forEach(order => {
            order.items.forEach((item: any) => {
                if (item.unit === 'κιβώτιο') t.boxes += item.quantity;
                else if (item.unit === 'κιλό') t.kg += item.quantity;
                else t.pieces += item.quantity;
            });
        });
        return t;
    }, [combinedOrders, isWholesalerType]);


    const handleSavePartner = async () => {
        if (!firestore || !partner) return;
        setIsSaving(true);
        try {
            const docRef = doc(firestore, isWholesalerType ? 'wholesalers' : 'stores', partner.id);
            const updateData: any = {
                ownerName: editForm.ownerName,
                email: editForm.email,
                phone: editForm.phone,
            };

            if (isWholesalerType) {
                updateData.companyName = editForm.name;
                updateData.taxId = editForm.taxId;
            } else {
                updateData.businessName = editForm.name;
                updateData.address = editForm.address;
                updateData.deliveryDay = editForm.deliveryDay;
            }

            await updateDoc(docRef, updateData);
            setPartner({ ...partner, ...updateData });
            setIsEditing(false);
            toast({ title: 'Αποθηκεύτηκε', description: 'Τα στοιχεία ενημερώθηκαν επιτυχώς.' });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Σφάλμα', description: 'Δεν ήταν δυνατή η αποθήκευση.' });
        } finally {
            setIsSaving(false);
        }
    };

    // 1. Fetch Partner
    useEffect(() => {
        if (!firestore || !partnerId) return;
        const fetchPartner = async () => {
            setIsLoadingPartner(true);
            try {
                const collectionName = isWholesalerType ? 'wholesalers' : 'stores';
                const q = query(collection(firestore, collectionName), where(documentId(), '==', partnerId));
                const snap = await getDocs(q);
                
                if (!snap.empty) {
                    const docSnap = snap.docs[0];
                    setPartner({ id: docSnap.id, ...docSnap.data() } as WithId<Store | Wholesaler>);
                } else {
                    toast({ variant: 'destructive', title: 'Δεν βρέθηκε', description: 'Ο συνεργάτης δεν υπάρχει.' });
                    router.push('/admin/customers');
                }
            } catch (error) {
                console.error(error);
            } finally {
                setIsLoadingPartner(false);
            }
        };
        fetchPartner();
    }, [firestore, partnerId, router, toast, isWholesalerType]);

    // 4. Fetch Existing Assignments (Configurations)
    const configQuery = useMemoFirebase(() => {
        if (!firestore || !partnerId || !wholesaler) return null;
        const collectionName = isWholesalerType ? 'wholesalers' : 'stores';
        return query(
            collection(firestore, collectionName, partnerId, 'productConfigurations'),
            where('wholesalerId', '==', wholesaler.id)
        );
    }, [firestore, partnerId, wholesaler, isWholesalerType]);
    const { data: configs, isLoading: isLoadingConfigs } = useCollection<StoreProductConfiguration | WholesalerProductConfiguration>(configQuery);

    // 5. Assigned Product IDs
    const assignedProductIds = useMemo(() => {
        if (!configs) return new Set<string>();
        return new Set(configs.map(c => c.productId));
    }, [configs]);

    const filteredProducts = useMemo(() => {
        if (!allProducts) return [];
        return allProducts.filter(p => 
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            (p.code || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [allProducts, searchTerm]);

    const handleToggleProduct = async (productId: string, assigned: boolean) => {
        if (!firestore || !partner || !wholesaler) return;

        try {
            const collectionName = isWholesalerType ? 'wholesalers' : 'stores';
            const configRef = doc(firestore, collectionName, partner.id, 'productConfigurations', productId);
            if (assigned) {
                await deleteDoc(configRef);
                toast({ title: 'Προϊόν Αφαιρέθηκε' });
            } else {
                const configData: any = {
                    productId,
                    wholesalerId: wholesaler.id,
                    ownerId: partner.ownerId || '',
                    managerUids: (partner as Store).managerUids || (partner as Wholesaler).adminUids || []
                };
                if (isWholesalerType) {
                    (configData as WholesalerProductConfiguration).targetWholesalerId = partner.id;
                } else {
                    (configData as StoreProductConfiguration).storeId = partner.id;
                    (configData as StoreProductConfiguration).idealStock = 0;
                }
                await setDoc(configRef, configData);
                toast({ title: 'Προϊόν Προστέθηκε' });
            }
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Σφάλμα' });
        }
    };

    const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !firestore || !partner || !wholesaler || !allProducts) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target?.result as string;
            if (!text) return;

            const lines = text.split('\n');
            const codes = lines.map(line => line.split(',')[0].trim().toLowerCase()).filter(Boolean);
            
            const productsToAssign = allProducts.filter(p => 
                codes.includes((p.code || '').toLowerCase()) || 
                codes.includes(p.id.toLowerCase())
            );

            if (productsToAssign.length === 0) {
                toast({ variant: 'destructive', title: 'Δεν βρέθηκαν προϊόντα' });
                return;
            }

            setIsSaving(true);
            try {
                const batch = writeBatch(firestore);
                const collectionName = isWholesalerType ? 'wholesalers' : 'stores';
                productsToAssign.forEach(p => {
                    const configRef = doc(firestore, collectionName, partner.id, 'productConfigurations', p.id);
                    const configData: any = {
                        productId: p.id,
                        wholesalerId: wholesaler.id,
                        ownerId: partner.ownerId || '',
                        managerUids: (partner as Store).managerUids || (partner as Wholesaler).adminUids || []
                    };
                    if (isWholesalerType) {
                        (configData as WholesalerProductConfiguration).targetWholesalerId = partner.id;
                    } else {
                        (configData as StoreProductConfiguration).storeId = partner.id;
                        (configData as StoreProductConfiguration).idealStock = 0;
                    }
                    batch.set(configRef, configData, { merge: true });
                });
                await batch.commit();
                toast({ title: 'Επιτυχής Εισαγωγή', description: `Ανατέθηκαν ${productsToAssign.length} προϊόντα.` });
            } catch (error) {
                console.error(error);
                toast({ variant: 'destructive', title: 'Σφάλμα', description: 'Προέκυψε σφάλμα κατά την μαζική ανάθεση.' });
            } finally {
                setIsSaving(false);
            }
        };
        reader.readAsText(file);
    };

    if (isLoadingPartner || isLoadingWholesaler) {
        return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (!partner) return null;

    const partnerName = isWholesalerType ? (partner as Wholesaler).companyName : (partner as Store).businessName;

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-10">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">{partnerName}</h1>
                    <p className="text-sm text-muted-foreground">
                        Διαχείριση Καταλόγου {isWholesalerType ? 'Υπο-Προμηθευτή' : 'Πελάτη'}
                    </p>
                </div>
            </div>

            <Tabs defaultValue="catalog" className="w-full">
                <TabsList className="bg-muted/30 p-1.5 rounded-2xl mb-8 flex w-full max-w-md border border-muted shadow-xs">
                    <TabsTrigger 
                        value="catalog" 
                        className="flex-1 rounded-xl px-4 py-3 gap-2.5 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-lg data-[state=active]:ring-1 data-[state=active]:ring-primary/5 transition-all duration-300 font-bold text-base"
                    >
                        <Users className="h-5 w-5" />
                        Προφίλ & Κατάλογος
                    </TabsTrigger>
                    {!isWholesalerType && (
                        <TabsTrigger 
                            value="stats" 
                            className="flex-1 rounded-xl px-4 py-3 gap-2.5 data-[state=active]:bg-background data-[state=active]:text-blue-600 data-[state=active]:shadow-lg data-[state=active]:ring-1 data-[state=active]:ring-blue-600/5 transition-all duration-300 font-bold text-base"
                        >
                            <TrendingUp className="h-5 w-5" />
                            Στατιστικά
                        </TabsTrigger>
                    )}
                </TabsList>

                <TabsContent value="catalog" className="mt-0">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Info Card */}
                        <Card className="md:col-span-1 border-2 border-primary/5 shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
                                <CardTitle className="text-lg font-bold">Στοιχεία {isWholesalerType ? 'Υπο-Προμηθευτή' : 'Πελάτη'}</CardTitle>
                                {!isEditing ? (
                                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)} className="h-8">
                                        <Pencil className="h-4 w-4 mr-1.5" /> Επεξεργασία
                                    </Button>
                                ) : (
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setIsEditing(false); }}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                        <Button size="icon" className="h-8 w-8 bg-green-600 hover:bg-green-700" onClick={handleSavePartner} disabled={isSaving}>
                                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                )}
                            </CardHeader>
                            <CardContent className="space-y-6 pt-6">
                                {isEditing ? (
                                    <div className="space-y-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs uppercase font-bold text-muted-foreground">Επωνυμία</Label>
                                            <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="h-10" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs uppercase font-bold text-muted-foreground">Ιδιοκτήτης / Υπεύθυνος</Label>
                                            <Input value={editForm.ownerName} onChange={e => setEditForm(f => ({ ...f, ownerName: e.target.value }))} className="h-10" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs uppercase font-bold text-muted-foreground">Email</Label>
                                            <Input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} className="h-10" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs uppercase font-bold text-muted-foreground">Τηλέφωνο</Label>
                                            <Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} className="h-10" />
                                        </div>
                                        {isWholesalerType ? (
                                            <div className="space-y-1.5">
                                                <Label className="text-xs uppercase font-bold text-muted-foreground">ΑΦΜ</Label>
                                                <Input value={editForm.taxId} onChange={e => setEditForm(f => ({ ...f, taxId: e.target.value }))} className="h-10" />
                                            </div>
                                        ) : (
                                            <>
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs uppercase font-bold text-muted-foreground">Διεύθυνση</Label>
                                                    <Input value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} className="h-10" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-xs uppercase font-bold text-muted-foreground">Ημέρες Παράδοσης</Label>
                                                    <div className="grid grid-cols-2 gap-2 border rounded-md p-3 bg-muted/20">
                                                        {['Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο', 'Κυριακή'].map(day => {
                                                            const isChecked = editForm.deliveryDay?.split(',').map(d => d.trim()).includes(day);
                                                            return (
                                                                <div key={day} className="flex items-center space-x-2">
                                                                    <Checkbox 
                                                                        id={`day-${day}`} 
                                                                        checked={isChecked}
                                                                        onCheckedChange={() => {
                                                                            const currentDays = editForm.deliveryDay ? editForm.deliveryDay.split(',').map(d => d.trim()) : [];
                                                                            let newDays;
                                                                            if (currentDays.includes(day)) {
                                                                                newDays = currentDays.filter(d => d !== day);
                                                                            } else {
                                                                                newDays = [...currentDays, day];
                                                                            }
                                                                            const DAYS_ORDER = ['Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο', 'Κυριακή'];
                                                                            newDays.sort((a, b) => DAYS_ORDER.indexOf(a) - DAYS_ORDER.indexOf(b));
                                                                            setEditForm(f => ({ ...f, deliveryDay: newDays.join(', ') }));
                                                                        }}
                                                                    />
                                                                    <label 
                                                                        htmlFor={`day-${day}`}
                                                                        className="text-xs font-medium leading-none cursor-pointer"
                                                                    >
                                                                        {day}
                                                                    </label>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-5">
                                        <div className="flex items-start gap-4 p-3 rounded-lg bg-muted/30">
                                            <Users className="h-5 w-5 mt-0.5 text-primary" />
                                            <div>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">ΥΠΕΥΘΥΝΟΣ</p>
                                                <p className="text-sm font-medium">{partner.ownerName}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-4 p-3 rounded-lg bg-muted/30">
                                            <Mail className="h-5 w-5 mt-0.5 text-primary" />
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">EMAIL</p>
                                                <p className="text-sm font-medium break-all">{partner.email}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-4 p-3 rounded-lg bg-muted/30">
                                            <Phone className="h-5 w-5 mt-0.5 text-primary" />
                                            <div>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">ΤΗΛΕΦΩΝΟ</p>
                                                <p className="text-sm font-medium">{partner.phone}</p>
                                            </div>
                                        </div>
                                        {isWholesalerType && (partner as Wholesaler).taxId && (
                                            <div className="flex items-start gap-4 p-3 rounded-lg bg-muted/30">
                                                <Info className="h-5 w-5 mt-0.5 text-primary" />
                                                <div>
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">ΑΦΜ</p>
                                                    <p className="text-sm font-medium">{(partner as Wholesaler).taxId}</p>
                                                </div>
                                            </div>
                                        )}
                                        {!isWholesalerType && (
                                            <>
                                                <div className="flex items-start gap-4 p-3 rounded-lg bg-muted/30">
                                                    <MapPin className="h-5 w-5 mt-0.5 text-primary" />
                                                    <div>
                                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">ΔΙΕΥΘΥΝΣΗ</p>
                                                        <p className="text-sm font-medium">{(partner as Store).address}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-start gap-4 p-3 rounded-lg bg-muted/30">
                                                    <Package className="h-5 w-5 mt-0.5 text-primary" />
                                                    <div>
                                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">ΗΜΕΡΕΣ ΠΑΡΑΔΟΣΗΣ</p>
                                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                                            {(partner as Store).deliveryDay?.split(',').map(day => (
                                                                <Badge key={day.trim()} className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
                                                                    {day.trim()}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Product Assignment Card */}
                        <Card className="md:col-span-2 border-2 border-primary/5 shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
                                <div>
                                    <CardTitle className="text-lg font-bold">Κατάλογος Προϊόντων</CardTitle>
                                    <CardDescription>Επιλέξτε ποια προϊόντα θα είναι διαθέσιμα στον συνεργάτη.</CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" className="relative cursor-pointer h-9 px-4" disabled={isSaving}>
                                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2 text-primary" />}
                                        Εισαγωγή Excel
                                        <input 
                                            type="file" 
                                            className="absolute inset-0 opacity-0 cursor-pointer" 
                                            accept=".csv,.txt"
                                            onChange={handleBulkUpload}
                                            disabled={isSaving}
                                        />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6 pt-6">
                                <div className="relative">
                                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Αναζήτηση προϊόντων με όνομα ή κωδικό..."
                                        className="pl-10 h-11 border-primary/10"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>

                                <div className="border rounded-xl overflow-hidden shadow-sm">
                                    <div className="max-h-[500px] overflow-y-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted/80 sticky top-0 z-10">
                                                <tr>
                                                    <th className="p-4 text-left font-bold uppercase text-[10px] tracking-wider w-12">Σύνδεση</th>
                                                    <th className="p-4 text-left font-bold uppercase text-[10px] tracking-wider">Προϊόν</th>
                                                    <th className="p-4 text-left font-bold uppercase text-[10px] tracking-wider">Κωδικός</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y border-t">
                                                {isLoadingProducts || isLoadingConfigs ? (
                                                    <tr>
                                                        <td colSpan={3} className="p-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></td>
                                                    </tr>
                                                ) : filteredProducts.length > 0 ? (
                                                    filteredProducts.map(product => {
                                                        const isAssigned = assignedProductIds.has(product.id);
                                                        return (
                                                            <tr key={product.id} className="hover:bg-primary/5 transition-colors group">
                                                                <td className="p-4">
                                                                    <Checkbox 
                                                                        checked={isAssigned}
                                                                        onCheckedChange={() => handleToggleProduct(product.id, isAssigned)}
                                                                        className="h-5 w-5"
                                                                    />
                                                                </td>
                                                                <td className="p-4">
                                                                    <div className="flex items-center gap-3">
                                                                        {product.imageUrl ? (
                                                                             <div className="h-10 w-10 relative rounded-lg overflow-hidden border border-border bg-white shadow-xs">
                                                                                <Image src={product.imageUrl} alt={product.name} fill className="object-contain p-1" />
                                                                             </div>
                                                                        ) : (
                                                                            <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                                                                                <Package className="h-5 w-5 text-muted-foreground/50" />
                                                                            </div>
                                                                        )}
                                                                        <div>
                                                                            <p className="font-bold text-foreground">{product.name}</p>
                                                                            <p className="text-[10px] text-muted-foreground font-medium">{product.unit}</p>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="p-4">
                                                                    <Badge variant="outline" className="font-mono bg-muted/50 border-none text-[11px] px-2 py-0.5">
                                                                        {product.code || product.sku}
                                                                    </Badge>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                ) : (
                                                    <tr>
                                                        <td colSpan={3} className="p-16 text-center text-muted-foreground font-medium">
                                                            Δεν βρέθηκαν προϊόντα.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {!isWholesalerType && (
                    <TabsContent value="stats" className="mt-0 space-y-6">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                            <Card className="border-2 border-primary/5 shadow-sm overflow-hidden">
                                 <CardHeader className="pb-2">
                                    <CardDescription className="text-xs font-bold uppercase tracking-widest">Συνολικά Κιβώτια</CardDescription>
                                    <CardTitle className="text-4xl font-black text-primary">{totals.boxes.toLocaleString('el-GR')}</CardTitle>
                                 </CardHeader>
                            </Card>
                            <Card className="border-2 border-primary/5 shadow-sm overflow-hidden">
                                 <CardHeader className="pb-2">
                                    <CardDescription className="text-xs font-bold uppercase tracking-widest">Συνολικά Κιλά</CardDescription>
                                    <CardTitle className="text-4xl font-black text-primary">{totals.kg.toLocaleString('el-GR')}</CardTitle>
                                 </CardHeader>
                            </Card>
                             <Card className="border-2 border-primary/5 shadow-sm overflow-hidden">
                                 <CardHeader className="pb-2">
                                    <CardDescription className="text-xs font-bold uppercase tracking-widest">Συνολικά Τεμάχια</CardDescription>
                                    <CardTitle className="text-4xl font-black text-primary">{totals.pieces.toLocaleString('el-GR')}</CardTitle>
                                 </CardHeader>
                            </Card>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Weekly Progress */}
                            <Card className="border-2 border-primary/5 shadow-sm">
                                <CardHeader className="border-b bg-muted/10">
                                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                                        <BarChart className="h-5 w-5 text-primary" />
                                        Μηνιαία Πρόοδος (Demo)
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-8 pl-0">
                                    <div className="h-[350px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={monthlyStats}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                                <YAxis axisLine={false} tickLine={false} />
                                                <Tooltip />
                                                <Legend />
                                                <Bar dataKey="κιβώτια" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                                <Bar dataKey="κιλά" fill="#10b981" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Product Monthly Stats Table */}
                            <Card className="border-2 border-primary/5 shadow-sm lg:col-span-2">
                                <CardHeader className="border-b bg-muted/10">
                                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                                        <Package className="h-5 w-5 text-primary" />
                                        Ανάλυση ανά Προϊόν
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-0 px-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted/50 border-b">
                                                <tr>
                                                    <th className="p-4 text-left font-bold uppercase text-[10px] tracking-wider sticky left-0 bg-muted/50 z-10 w-64 min-w-64">Προϊόν</th>
                                                    <th className="p-4 text-center font-bold uppercase text-[10px] tracking-wider w-20">Σύνολο</th>
                                                    {productMonthlyStats.monthKeys.map((m: string) => (
                                                        <th key={m} className="p-4 text-center font-bold uppercase text-[10px] tracking-wider whitespace-nowrap">{m}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {productMonthlyStats.products.length > 0 ? (
                                                    productMonthlyStats.products.map((p: any) => (
                                                        <tr key={p.id} className="hover:bg-primary/5 transition-colors group">
                                                            <td className="p-4 font-medium sticky left-0 bg-background group-hover:bg-primary/5">
                                                                <div className="flex flex-col">
                                                                    <span>{p.name}</span>
                                                                    <span className="text-[10px] text-muted-foreground">{p.code ? `${p.code} - ` : ''}{p.unit}</span>
                                                                </div>
                                                            </td>
                                                            <td className="p-4 text-center font-bold bg-primary/5">{p.total}</td>
                                                            {productMonthlyStats.monthKeys.map((m: string) => (
                                                                <td key={m} className="p-4 text-center text-muted-foreground">
                                                                    {p.months[m] > 0 ? <span className="font-medium text-foreground">{p.months[m]}</span> : '-'}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan={productMonthlyStats.monthKeys.length + 2} className="p-8 text-center text-muted-foreground">
                                                            Δεν υπάρχουν δεδομένα προϊόντων
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}
