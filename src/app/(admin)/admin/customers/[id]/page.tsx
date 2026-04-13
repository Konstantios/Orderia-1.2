'use client';

import { useState, useMemo, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
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
    documentId,
    Timestamp as FirestoreTimestamp,
    orderBy as firestoreOrderBy
} from 'firebase/firestore';
import type { Store, Wholesaler, Product, StoreProductConfiguration, Order } from '@/lib/types';
import Image from 'next/image';
import { subMonths, subWeeks, startOfMonth, startOfWeek, endOfMonth, endOfWeek, format as dateFnsFormat, isWithinInterval } from 'date-fns';
import { el as elLocale } from 'date-fns/locale';

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: customerId } = use(params);
    const router = useRouter();
    const { toast } = useToast();
    const { user, firestore } = useFirebase();

    const [customer, setCustomer] = useState<WithId<Store> | null>(null);
    const [isLoadingCustomer, setIsLoadingCustomer] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Edit mode state
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        businessName: '',
        ownerName: '',
        email: '',
        phone: '',
        address: '',
        deliveryDay: '',
    });

    useEffect(() => {
        if (customer) {
            setEditForm({
                 businessName: customer.businessName || '',
                 ownerName: customer.ownerName || '',
                 email: customer.email || '',
                 phone: customer.phone || '',
                 address: customer.address || '',
                 deliveryDay: customer.deliveryDay || '',
            });
        }
    }, [customer]);

    // 2. Fetch Wholesaler (Moved up to fix initialization error)
    const wholesalerQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, 'wholesalers'), where('adminUids', 'array-contains', user.uid), limit(1));
    }, [user, firestore]);
    const { data: wholesalers, isLoading: isLoadingWholesaler } = useCollection<Wholesaler>(wholesalerQuery);
    const wholesaler = wholesalers?.[0];

    // 3. Fetch Wholesaler Products (Moved up to fix initialization error)
    const productsQuery = useMemoFirebase(() => {
        if (!firestore || !wholesaler) return null;
        return collection(firestore, 'wholesalers', wholesaler.id, 'products');
    }, [firestore, wholesaler]);
    const { data: allProducts, isLoading: isLoadingProducts } = useCollection<WithId<Product>>(productsQuery);

    // --- Statistics Logic ---

    const orderQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        // Simplified query to match working patterns in other pages
        // The rules seem very strict about index usage and filter combinations
        return query(
            collection(firestore, 'orders'),
            where('memberUids', 'array-contains', user.uid)
        );
    }, [firestore, user]);
    const { data: realOrders, isLoading: isLoadingOrders } = useCollection<Order>(orderQuery);

    // Dummy Data Generator
    const dummyOrders = useMemo(() => {
        if (!wholesaler || !allProducts || allProducts.length === 0) return [];
        
        const generated: any[] = [];
        const now = new Date();
        
        // Generate for last 6 months
        for (let i = 0; i < 6; i++) {
            const monthDate = subMonths(now, i);
            const orderCount = Math.floor(Math.random() * 5) + 3; // 3-8 orders per month
            
            for (let j = 0; j < orderCount; j++) {
                const dayOffset = Math.floor(Math.random() * 28);
                const orderDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), dayOffset);
                
                // Pick 3-6 random products
                const itemsCount = Math.floor(Math.random() * 4) + 3;
                const items = Array.from({ length: itemsCount }).map(() => {
                    const product = allProducts[Math.floor(Math.random() * allProducts.length)];
                    return {
                        productId: product.id,
                        quantity: Math.floor(Math.random() * 15) + 5, // 5-20 quantity
                        unit: product.unit // Store unit for easy aggregation
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
    }, [wholesaler, allProducts]);

    const combinedOrders = useMemo(() => {
        const processedReal = (realOrders || [])
            .filter(o => o.storeId === customerId && o.wholesalerId === wholesaler?.id)
            .map(o => ({
                ...o,
                date: (o.date as any)?.toDate ? (o.date as any).toDate() : new Date(o.date),
                items: o.items.map(item => {
                    const p = allProducts?.find(product => product.id === item.productId);
                    return { ...item, unit: p?.unit || 'τεμάχιο' };
                })
            }));
        return [...processedReal, ...dummyOrders].sort((a,b) => b.date.getTime() - a.date.getTime());
    }, [realOrders, dummyOrders, allProducts, customerId, wholesaler]);

    // Monthly Aggregation
    const monthlyStats = useMemo(() => {
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
    }, [combinedOrders]);

    // Weekly Aggregation (Last 8 weeks)
    const weeklyStats = useMemo(() => {
        const stats: Record<string, any> = {};
        const now = new Date();
        
        for (let i = 7; i >= 0; i--) {
            const d = subWeeks(now, i);
            const key = `Εβδ ${8-i}`;
            stats[key] = { name: key, κιβώτια: 0, κιλά: 0, τεμάχια: 0 };
        }

        combinedOrders.forEach(order => {
            const weeksAgo = Math.floor((now.getTime() - order.date.getTime()) / (1000 * 60 * 60 * 24 * 7));
            if (weeksAgo >= 0 && weeksAgo < 8) {
                const key = `Εβδ ${8-weeksAgo}`;
                if (stats[key]) {
                    order.items.forEach((item: any) => {
                        if (item.unit === 'κιβώτιο') stats[key].κιβώτια += item.quantity;
                        else if (item.unit === 'κιλό') stats[key].κιλά += item.quantity;
                        else stats[key].τεμάχια += item.quantity;
                    });
                }
            }
        });

        return Object.values(stats);
    }, [combinedOrders]);

    const totals = useMemo(() => {
        const t = { boxes: 0, kg: 0, pieces: 0 };
        combinedOrders.forEach(order => {
            order.items.forEach((item: any) => {
                if (item.unit === 'κιβώτιο') t.boxes += item.quantity;
                else if (item.unit === 'κιλό') t.kg += item.quantity;
                else t.pieces += item.quantity;
            });
        });
        return t;
    }, [combinedOrders]);


    const handleSaveCustomer = async () => {
        if (!firestore || !customer) return;
        setIsSaving(true);
        try {
            const storeRef = doc(firestore, 'stores', customer.id);
            await updateDoc(storeRef, {
                businessName: editForm.businessName,
                ownerName: editForm.ownerName,
                email: editForm.email,
                phone: editForm.phone,
                address: editForm.address,
                deliveryDay: editForm.deliveryDay,
            });
            setCustomer({ ...customer, ...editForm });
            setIsEditing(false);
            toast({ title: 'Αποθηκεύτηκε', description: 'Τα στοιχεία του πελάτη ενημερώθηκαν.' });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Σφάλμα', description: 'Δεν ήταν δυνατή η αποθήκευση.' });
        } finally {
            setIsSaving(false);
        }
    };

    // 1. Fetch Customer (Store)
    useEffect(() => {
        if (!firestore || !customerId) return;
        const fetchCustomer = async () => {
            setIsLoadingCustomer(true);
            try {
                // Workaround: Use getDocs instead of getDoc to bypass restricted 'get' rules
                // and take advantage of the more permissive 'list' rules.
                const q = query(collection(firestore, 'stores'), where(documentId(), '==', customerId));
                const snap = await getDocs(q);
                
                if (!snap.empty) {
                    const storeDoc = snap.docs[0];
                    setCustomer({ id: storeDoc.id, ...storeDoc.data() } as WithId<Store>);
                } else {
                    toast({ variant: 'destructive', title: 'Δεν βρέθηκε', description: 'Ο πελάτης δεν υπάρχει.' });
                    router.push('/admin/customers');
                }
            } catch (error) {
                console.error(error);
            } finally {
                setIsLoadingCustomer(false);
            }
        };
        fetchCustomer();
    }, [firestore, customerId, router, toast]);

    // 4. Fetch Existing Assignments (Configurations)

    const configQuery = useMemoFirebase(() => {
        if (!firestore || !customerId) return null;
        return query(
            collection(firestore, 'stores', customerId, 'productConfigurations'),
            where('wholesalerId', '==', wholesaler?.id || '')
        );
    }, [firestore, customerId, wholesaler]);
    const { data: configs, isLoading: isLoadingConfigs } = useCollection<StoreProductConfiguration>(configQuery);

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
        if (!firestore || !customer || !wholesaler) return;

        try {
            const configRef = doc(firestore, 'stores', customer.id, 'productConfigurations', productId);
            if (assigned) {
                // Remove assignment
                await deleteDoc(configRef);
                toast({ title: 'Προϊόν Αφαιρέθηκε', description: 'Το προϊόν δεν είναι πλέον διαθέσιμο στον πελάτη.' });
            } else {
                // Add assignment
                await setDoc(configRef, {
                    productId,
                    storeId: customer.id,
                    wholesalerId: wholesaler.id,
                    idealStock: 0,
                    ownerId: customer.ownerId || '',
                    managerUids: customer.managerUids || []
                });
                toast({ title: 'Προϊόν Προστέθηκε', description: 'Το προϊόν είναι πλέον διαθέσιμο στον πελάτη.' });
            }
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Σφάλμα', description: 'Δεν ήταν δυνατή η αλλαγή της ανάθεσης.' });
        }
    };

    const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !firestore || !customer || !wholesaler || !allProducts) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target?.result as string;
            if (!text) return;

            // Simple CSV parser logic (assuming first column is code or SKU)
            const lines = text.split('\n');
            const codes = lines.map(line => line.split(',')[0].trim().toLowerCase()).filter(Boolean);
            
            const productsToAssign = allProducts.filter(p => 
                codes.includes((p.code || '').toLowerCase()) || 
                codes.includes(p.id.toLowerCase())
            );

            if (productsToAssign.length === 0) {
                toast({ variant: 'destructive', title: 'Δεν βρέθηκαν προϊόντα', description: 'Κανένας κωδικός στο αρχείο δεν αντιστοιχεί στα προϊόντα σας.' });
                return;
            }

            setIsSaving(true);
            try {
                const batch = writeBatch(firestore);
                productsToAssign.forEach(p => {
                    const configRef = doc(firestore, 'stores', customer.id, 'productConfigurations', p.id);
                    batch.set(configRef, {
                        productId: p.id,
                        storeId: customer.id,
                        wholesalerId: wholesaler.id,
                        idealStock: 0,
                        ownerId: customer.ownerId || '',
                        managerUids: customer.managerUids || []
                    }, { merge: true });
                });
                await batch.commit();
                toast({ title: 'Επιτυχής Εισαγωγή', description: `Ανατέθηκαν ${productsToAssign.length} προϊόντα στον πελάτη.` });
            } catch (error) {
                console.error(error);
                toast({ variant: 'destructive', title: 'Σφάλμα', description: 'Προέκυψε σφάλμα κατά την μαζική ανάθεση.' });
            } finally {
                setIsSaving(false);
            }
        };
        reader.readAsText(file);
    };

    if (isLoadingCustomer || isLoadingWholesaler) {
        return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (!customer) return null;

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-10">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">{customer.businessName}</h1>
                    <p className="text-sm text-muted-foreground">Διαχείριση Καταλόγου Πελάτη</p>
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
                    <TabsTrigger 
                        value="stats" 
                        className="flex-1 rounded-xl px-4 py-3 gap-2.5 data-[state=active]:bg-background data-[state=active]:text-blue-600 data-[state=active]:shadow-lg data-[state=active]:ring-1 data-[state=active]:ring-blue-600/5 transition-all duration-300 font-bold text-base"
                    >
                        <TrendingUp className="h-5 w-5" />
                        Στατιστικά Παραγγελιών
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="catalog" className="mt-0">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Customer Info Card */}
                        <Card className="md:col-span-1 border-2 border-primary/5 shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
                                <CardTitle className="text-lg font-bold">Στοιχεία Πελάτη</CardTitle>
                                {!isEditing ? (
                                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)} className="h-8">
                                        <Pencil className="h-4 w-4 mr-1.5" /> Επεξεργασία
                                    </Button>
                                ) : (
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setIsEditing(false); if (customer) setEditForm({ businessName: customer.businessName || '', ownerName: customer.ownerName || '', email: customer.email || '', phone: customer.phone || '', address: customer.address || '', deliveryDay: customer.deliveryDay || '' }); }}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                        <Button size="icon" className="h-8 w-8 bg-green-600 hover:bg-green-700" onClick={handleSaveCustomer} disabled={isSaving}>
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
                                            <Input value={editForm.businessName} onChange={e => setEditForm(f => ({ ...f, businessName: e.target.value }))} className="h-10" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs uppercase font-bold text-muted-foreground">Ιδιοκτήτης</Label>
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
                                        <div className="space-y-1.5">
                                            <Label className="text-xs uppercase font-bold text-muted-foreground">Διεύθυνση</Label>
                                            <Input value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} className="h-10" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs uppercase font-bold text-muted-foreground">Ημέρα Παράδοσης</Label>
                                            <Select value={editForm.deliveryDay} onValueChange={val => setEditForm(f => ({ ...f, deliveryDay: val }))}>
                                                <SelectTrigger className="h-10"><SelectValue placeholder="Επιλέξτε ημέρα" /></SelectTrigger>
                                                <SelectContent>
                                                    {['Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο', 'Κυριακή'].map(day => (
                                                        <SelectItem key={day} value={day}>{day}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-5">
                                        <div className="flex items-start gap-4 p-3 rounded-lg bg-muted/30">
                                            <Mail className="h-5 w-5 mt-0.5 text-primary" />
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">EMAIL</p>
                                                <p className="text-sm font-medium break-all">{customer.email}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-4 p-3 rounded-lg bg-muted/30">
                                            <Phone className="h-5 w-5 mt-0.5 text-primary" />
                                            <div>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">ΤΗΛΕΦΩΝΟ</p>
                                                <p className="text-sm font-medium">{customer.phone}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-4 p-3 rounded-lg bg-muted/30">
                                            <MapPin className="h-5 w-5 mt-0.5 text-primary" />
                                            <div>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">ΔΙΕΥΘΥΝΣΗ</p>
                                                <p className="text-sm font-medium">{customer.address}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-4 p-3 rounded-lg bg-muted/30">
                                            <Package className="h-5 w-5 mt-0.5 text-primary" />
                                            <div>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">ΗΜΕΡΑ ΠΑΡΑΔΟΣΗΣ</p>
                                                <Badge className="mt-1 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
                                                    {customer.deliveryDay}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Product Assignment Card */}
                        <Card className="md:col-span-2 border-2 border-primary/5 shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
                                <div>
                                    <CardTitle className="text-lg font-bold">Κατάλογος Προϊόντων</CardTitle>
                                    <CardDescription>Επιλέξτε ποια προϊόντα βλέπει ο πελάτης.</CardDescription>
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
                                        className="pl-10 h-11 border-primary/10 focus-visible:ring-primary/20"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>

                                <div className="border rounded-xl overflow-hidden shadow-sm">
                                    <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
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
                                                                        className="h-5 w-5 border-primary/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                                                    />
                                                                </td>
                                                                <td className="p-4">
                                                                    <div className="flex items-center gap-3">
                                                                        {product.imageUrl ? (
                                                                             <div className="h-10 w-10 relative rounded-lg overflow-hidden border border-border bg-white shadow-xs group-hover:scale-110 transition-transform">
                                                                                <Image src={product.imageUrl} alt={product.name} fill className="object-contain p-1" />
                                                                             </div>
                                                                        ) : (
                                                                            <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center border border-dashed border-muted-foreground/30">
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
                                                            Δεν βρέθηκαν προϊόντα που να ταιριάζουν στην αναζήτησή σας.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                
                                <div className="bg-blue-600/5 border-l-4 border-l-blue-600 rounded-r-xl p-5 flex items-start gap-4 shadow-sm">
                                    <div className="p-2 bg-blue-600/10 rounded-full">
                                        <AlertCircle className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div className="text-sm">
                                        <p className="font-bold text-blue-900 dark:text-blue-100 mb-1 leading-tight">Μαζική Ανάθεση μέσω Excel</p>
                                        <p className="text-blue-700/80 dark:text-blue-300/80 leading-relaxed font-medium">Ανεβάστε ένα αρχείο (.csv ή .txt) όπου η πρώτη στήλη περιέχει τους κωδικούς (SKU/Barcode) των προϊόντων που θέλετε να ενεργοποιήσετε αυτόματα για τον πελάτη.</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="stats" className="mt-0 space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <Card className="border-2 border-primary/5 shadow-sm overflow-hidden">
                             <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Package className="h-12 w-12" />
                             </div>
                             <CardHeader className="pb-2">
                                <CardDescription className="text-xs font-bold uppercase tracking-widest">Συνολικά Κιβώτια</CardDescription>
                                <CardTitle className="text-4xl font-black text-primary">{totals.boxes.toLocaleString('el-GR')}</CardTitle>
                             </CardHeader>
                             <CardContent>
                                <p className="text-[10px] text-muted-foreground font-medium">Συνολική ποσότητα σε κιβώτια που έχουν παραδοθεί.</p>
                             </CardContent>
                        </Card>
                        <Card className="border-2 border-primary/5 shadow-sm overflow-hidden">
                             <div className="absolute top-0 right-0 p-4 opacity-10">
                                <div className="h-12 w-12 flex items-center justify-center font-bold text-2xl">KG</div>
                             </div>
                             <CardHeader className="pb-2">
                                <CardDescription className="text-xs font-bold uppercase tracking-widest">Συνολικά Κιλά</CardDescription>
                                <CardTitle className="text-4xl font-black text-primary">{totals.kg.toLocaleString('el-GR')}</CardTitle>
                             </CardHeader>
                             <CardContent>
                                <p className="text-[10px] text-muted-foreground font-medium">Συνολικό βάρος σε κιλά όλων των παραγγελιών.</p>
                             </CardContent>
                        </Card>
                         <Card className="border-2 border-primary/5 shadow-sm overflow-hidden">
                             <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Search className="h-12 w-12" />
                             </div>
                             <CardHeader className="pb-2">
                                <CardDescription className="text-xs font-bold uppercase tracking-widest">Συνολικά Τεμάχια</CardDescription>
                                <CardTitle className="text-4xl font-black text-primary">{totals.pieces.toLocaleString('el-GR')}</CardTitle>
                             </CardHeader>
                             <CardContent>
                                <p className="text-[10px] text-muted-foreground font-medium">Συνολική ποσότητα σε μεμονωμένα τεμάχια.</p>
                             </CardContent>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Weekly Progress */}
                        <Card className="border-2 border-primary/5 shadow-sm">
                            <CardHeader className="border-b bg-muted/10">
                                <CardTitle className="text-lg font-bold flex items-center gap-2">
                                    <BarChart className="h-5 w-5 text-primary" />
                                    Εβδομαδιαία Πρόοδος (8 Εβδομάδες)
                                </CardTitle>
                                <CardDescription>Ποσότητα παραγγελιών ανά εβδομάδα κατά μονάδα.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-8 pl-0">
                                <div className="h-[350px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={weeklyStats}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                            <XAxis 
                                                dataKey="name" 
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 500 }}
                                            />
                                            <YAxis 
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{ fill: '#6b7280', fontSize: 11 }}
                                            />
                                            <Tooltip 
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Legend verticalAlign="top" align="right" height={36}/>
                                            <Bar dataKey="κιβώτια" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20}>
                                                <LabelList dataKey="κιβώτια" position="top" style={{ fill: '#3b82f6', fontSize: 11, fontWeight: 'bold' }} offset={10} />
                                            </Bar>
                                            <Bar dataKey="κιλά" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20}>
                                                <LabelList dataKey="κιλά" position="top" style={{ fill: '#10b981', fontSize: 11, fontWeight: 'bold' }} offset={10} />
                                            </Bar>
                                            <Bar dataKey="τεμάχια" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={20}>
                                                <LabelList dataKey="τεμάχια" position="top" style={{ fill: '#f59e0b', fontSize: 11, fontWeight: 'bold' }} offset={10} />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Monthly Trends */}
                        <Card className="border-2 border-primary/5 shadow-sm">
                            <CardHeader className="border-b bg-muted/10">
                                <CardTitle className="text-lg font-bold flex items-center gap-2">
                                    <LineChart className="h-5 w-5 text-primary" />
                                    Μηνιαία Τάση & Όγκος
                                </CardTitle>
                                <CardDescription>Εξέλιξη παραγγελιών τους τελευταίους 6 μήνες.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-8 pl-0">
                                <div className="h-[350px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={monthlyStats}>
                                            <defs>
                                                <linearGradient id="colorBoxes" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                            <XAxis 
                                                dataKey="name" 
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{ fill: '#6b7280', fontSize: 12, fontWeight: 500 }}
                                            />
                                            <YAxis 
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{ fill: '#6b7280', fontSize: 11 }}
                                            />
                                            <Tooltip 
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Legend verticalAlign="top" align="right" height={36}/>
                                            <Area type="monotone" dataKey="κιβώτια" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorBoxes)">
                                                <LabelList dataKey="κιβώτια" position="top" style={{ fill: '#3b82f6', fontSize: 10, fontWeight: 'bold' }} offset={10} />
                                            </Area>
                                            <Area type="monotone" dataKey="κιλά" stroke="#10b981" strokeWidth={3} fillOpacity={0}>
                                                <LabelList dataKey="κιλά" position="top" style={{ fill: '#10b981', fontSize: 10, fontWeight: 'bold' }} offset={10} />
                                            </Area>
                                            <Area type="monotone" dataKey="τεμάχια" stroke="#f59e0b" strokeWidth={3} fillOpacity={0}>
                                                <LabelList dataKey="τεμάχια" position="top" style={{ fill: '#f59e0b', fontSize: 10, fontWeight: 'bold' }} offset={10} />
                                            </Area>
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="bg-amber-600/5 border-l-4 border-l-amber-600 rounded-r-xl p-5 flex items-start gap-4 shadow-sm">
                        <div className="p-2 bg-amber-600/10 rounded-full">
                            <Info className="h-5 w-5 text-amber-600" />
                        </div>
                        <div className="text-sm">
                            <p className="font-bold text-amber-900 dark:text-amber-100 mb-1 leading-tight">Λειτουργία Demo Ενεργή</p>
                            <p className="text-amber-700/80 dark:text-amber-300/80 leading-relaxed font-medium">Τα παραπάνω γραφήματα περιλαμβάνουν συνδυασμό πραγματικών δεδομένων και "dummy" παραγγελιών για τους προηγούμενους μήνες, ώστε να επιδειχθεί η πλήρης λειτουργικότητα των στατιστικών στον πελάτη.</p>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

        </div>
    );
}
