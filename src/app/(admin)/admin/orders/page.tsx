'use client';

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Order, Wholesaler, Product } from "@/lib/types"; // ADD Product
import { Download, History, Loader2, CheckCircle2, Truck } from "lucide-react";
import { format, addDays, isSameDay } from 'date-fns';
import { el } from 'date-fns/locale';
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, Timestamp, writeBatch, doc } from 'firebase/firestore';

export default function AdminOrdersPage() {
    const router = useRouter();
    const { toast } = useToast();
    
    const { user, firestore } = useFirebase();

    // 1. Fetch Wholesaler
    const wholesalerQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'wholesalers'), where('adminUids', 'array-contains', user.uid));
    }, [firestore, user]);
    const { data: wholesalers, isLoading: isLoadingWholesalers } = useCollection<Wholesaler>(wholesalerQuery);
    const wholesaler = wholesalers?.[0];

    // 2. Fetch Orders for this Wholesaler
    const ordersQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, 'orders'), where('memberUids', 'array-contains', user.uid));
    }, [user, firestore]);
    const { data: orders, isLoading: isLoadingOrders } = useCollection<Order>(ordersQuery);

    // 3. Fetch Wholesaler's products for the export function
    const productsQuery = useMemoFirebase(() => {
        if (!firestore || !wholesaler) return null;
        return collection(firestore, 'wholesalers', wholesaler.id, 'products');
    }, [firestore, wholesaler]);
    const { data: products, isLoading: isLoadingProducts } = useCollection<Product>(productsQuery);


    const [nextSevenDays, setNextSevenDays] = useState<{ date: Date; dateString: string; dayName: string; formattedDate: string; }[]>([]);
    const [activeTab, setActiveTab] = useState<string>('');
    const [statusTab, setStatusTab] = useState<string>('Εκκρεμής');


    useEffect(() => {
        const days = Array.from({ length: 7 }).map((_, i) => {
            const date = addDays(new Date(), i);
            return {
                date,
                dateString: date.toISOString().split('T')[0],
                dayName: format(date, 'EEEE', { locale: el }),
                formattedDate: format(date, 'd/M'),
            };
        });
        setNextSevenDays(days);
        if (days.length > 0 && !activeTab) {
            setActiveTab(days[0].dateString);
        }
    }, [activeTab]);


    const ordersForDay = useMemo(() => {
        const selectedDayInfo = nextSevenDays.find(d => d.dateString === activeTab);
        if (!selectedDayInfo || !orders) {
            return [];
        }

        const selectedDate = selectedDayInfo.date;
        
        return orders.filter(o => {
            const deliveryDate = (o.deliveryDate as unknown as Timestamp)?.toDate();
            return deliveryDate && isSameDay(deliveryDate, selectedDate);
        });
    }, [activeTab, orders, nextSevenDays]);

    const filteredOrdersByStatus = useMemo(() => {
        return ordersForDay.filter(o => o.status === statusTab);
    }, [ordersForDay, statusTab]);

    const pendingCount = useMemo(() => ordersForDay.filter(o => o.status === 'Εκκρεμής').length, [ordersForDay]);
    const shippedCount = useMemo(() => ordersForDay.filter(o => o.status === 'Απεσταλμένη').length, [ordersForDay]);



    const handleExport = () => {
        if (filteredOrdersByStatus.length === 0) {
            toast({
                title: "Δεν υπάρχουν παραγγελίες",
                description: `Δεν βρέθηκαν ${statusTab.toLowerCase()} παραγγελίες για εξαγωγή για την επιλεγμένη ημέρα.`,
                variant: "destructive"
            });
            return;
        }


        if (!products) {
            toast({
                title: "Φόρτωση προϊόντων",
                description: "Παρακαλώ περιμένετε να φορτωθεί ο κατάλογος προϊόντων πριν την εξαγωγή.",
                variant: "destructive"
            });
            return;
        }

        const exportData = filteredOrdersByStatus.flatMap(order => {
            if (order.items.length === 0) {
                return [{
                    'Κωδικός': '-',
                    'Τίτλος': '-',
                    'Κιβώτια': 0,
                    'Ημερομηνία': (order.date as any)?.toDate ? (order.date as any).toDate().toLocaleString('el-GR') : new Date(order.date).toLocaleString('el-GR'),
                    'Πελάτης': order.customerName,
                    'Μονάδα': '-',
                    'ID Παραγγελίας': order.id,
                    'Κατάσταση': order.status,
                    'Τηλέφωνο Υπευθύνου': '6900000000', // Placeholder
                    'Σημειώσεις Πελάτη': order.notes || '-',
                }];
            }
            return order.items.map(item => {
                const product = products.find(p => p.id === item.productId); // USE LIVE PRODUCTS
                return {
                    'Κωδικός': product?.code || '-',
                    'Τίτλος': product?.name || 'Άγνωστο',
                    'Κιβώτια': item.quantity,
                    'Ημερομηνία': (order.date as any)?.toDate ? (order.date as any).toDate().toLocaleString('el-GR') : new Date(order.date).toLocaleString('el-GR'),
                    'Πελάτης': order.customerName,
                    'Μονάδα': product?.unit || '-',
                    'ID Παραγγελίας': order.id,
                    'Κατάσταση': order.status,
                    'Τηλέφωνο Υπευθύνου': '6900000000', // Placeholder
                    'Σημειώσεις Πελάτη': order.notes || '-',
                };
            });
        });

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `Παραγγελίες`);

        const colWidths = Object.keys(exportData[0] || {}).map(key => ({
            wch: Math.max(
                key.length,
                ...exportData.map(row => (String((row as any)[key]) || '').length)
            ) + 2
        }));
        worksheet['!cols'] = colWidths;
        
        const selectedDayInfo = nextSevenDays.find(d => d.dateString === activeTab);
        const fileName = `Παραγγελίες_${statusTab}_${selectedDayInfo?.dayName}_${selectedDayInfo?.formattedDate.replace('/', '-')}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    };
    
    const isLoading = isLoadingOrders || isLoadingWholesalers || isLoadingProducts;

    const [isShipping, setIsShipping] = useState(false);

    const pendingOrdersForDay = useMemo(() => {
        return ordersForDay.filter(o => o.status === 'Εκκρεμής');
    }, [ordersForDay]);

    const handleMarkAllShipped = async () => {
        if (!firestore || pendingOrdersForDay.length === 0) return;
        setIsShipping(true);
        try {
            const batch = writeBatch(firestore);
            pendingOrdersForDay.forEach(order => {
                const orderRef = doc(firestore, 'orders', order.id);
                batch.update(orderRef, { 
                    status: 'Απεσταλμένη',
                    shippedAt: Timestamp.now(),
                });
            });
            await batch.commit();
            toast({ 
                title: 'Απεστάλησαν!', 
                description: `${pendingOrdersForDay.length} παραγγελίες σημειώθηκαν ως απεσταλμένες.` 
            });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Σφάλμα', description: 'Δεν ήταν δυνατή η ενημέρωση.' });
        } finally {
            setIsShipping(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <h1 className="text-lg font-semibold md:text-2xl">Παραγγελίες</h1>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="outline" size="sm" className="flex-1 sm:flex-initial" onClick={() => router.push('/admin/orders/history')}><History className="mr-2 h-4 w-4" />Ιστορικό</Button>
                <Button variant="outline" size="sm" className="flex-1 sm:flex-initial" onClick={handleExport}><Download className="mr-2 h-4 w-4" />Εξαγωγή</Button>
              </div>
            </div>
            
            <div className="space-y-2">
                <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">Ημερομηνια Παραδοσης</h2>
                {nextSevenDays.length > 0 && (
                <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="flex w-full overflow-x-auto justify-start h-auto p-1 bg-muted/50 no-scrollbar">
                         {nextSevenDays.map(day => (
                             <TabsTrigger key={day.dateString} value={day.dateString} className="capitalize flex-shrink-0 py-2 px-4">
                                <div className="flex flex-col items-center">
                                    <span className="text-[10px] opacity-70">{day.dayName}</span>
                                    <span className="font-bold">{day.formattedDate}</span>
                                </div>
                             </TabsTrigger>
                        ))}
                    </TabsList>
                    
                    <TabsContent value={activeTab} className="mt-4 space-y-4">
                        <Tabs defaultValue={statusTab} value={statusTab} onValueChange={setStatusTab} className="w-full">
                            <TabsList className="grid grid-cols-2 max-w-[400px]">
                                <TabsTrigger value="Εκκρεμής" className="relative">
                                    Εκκρεμείς
                                    {pendingCount > 0 && (
                                        <Badge className="ml-2 bg-destructive text-destructive-foreground hover:bg-destructive h-5 min-w-5 flex items-center justify-center rounded-full p-0 px-1 text-[10px]">
                                            {pendingCount}
                                        </Badge>
                                    )}
                                </TabsTrigger>
                                <TabsTrigger value="Απεσταλμένη" className="relative">
                                    Απεσταλμένες
                                    {shippedCount > 0 && (
                                        <Badge className="ml-2 bg-primary text-primary-foreground hover:bg-primary h-5 min-w-5 flex items-center justify-center rounded-full p-0 px-1 text-[10px]">
                                            {shippedCount}
                                        </Badge>
                                    )}
                                </TabsTrigger>
                            </TabsList>

                            <div className="mt-4 h-px bg-border/40" />

                            <div className="space-y-4 mt-6">
                                {isLoading ? (
                                    <div className="flex items-center justify-center p-8">
                                        <Loader2 className="h-8 w-8 animate-spin" />
                                    </div>
                                ) : (
                                    <>
                                        {filteredOrdersByStatus.map(order => (
                                            <Card key={order.id} className="cursor-pointer hover:bg-muted/50 border-l-4 border-l-transparent transition-all hover:border-l-primary" onClick={() => router.push(`/admin/orders/${order.id}`)}>
                                                <CardHeader className="py-4">
                                                    <div className="flex justify-between items-center">
                                                        <div className="space-y-1">
                                                            <CardTitle className="text-lg font-bold">{order.customerName}</CardTitle>
                                                            <CardDescription className="font-mono text-[10px]">ID: #{order.id}</CardDescription>
                                                        </div>
                                                        <Badge variant={order.status === 'Εκκρεμής' ? 'destructive' : order.status === 'Απεσταλμένη' ? 'default' : 'secondary'} className="px-3 py-1">
                                                            {order.status}
                                                        </Badge>
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="pb-4">
                                                    <p className="text-sm text-muted-foreground font-medium">{order.items.length} προϊόντα • Σύνολο {order.items.reduce((acc, item) => acc + item.quantity, 0)} τεμάχια</p>
                                                </CardContent>
                                            </Card>
                                        ))}
            
                                        {filteredOrdersByStatus.length === 0 && (
                                            <div className="flex flex-col items-center justify-center py-12 text-center bg-muted/20 rounded-2xl border-2 border-dashed border-muted">
                                                <p className="text-muted-foreground font-medium">Δεν υπάρχουν {statusTab.toLowerCase()} παραγγελίες για αυτή την ημέρα.</p>
                                            </div>
                                        )}

                                        {statusTab === 'Εκκρεμής' && pendingOrdersForDay.length > 0 && (
                                            <div className="flex justify-center pt-6 pb-2">
                                                <Button 
                                                    size="lg" 
                                                    className="bg-green-600 hover:bg-green-700 text-white px-10 py-7 text-xl font-bold rounded-2xl shadow-xl shadow-green-600/20 transition-all hover:shadow-2xl hover:shadow-green-600/30 hover:-translate-y-1 active:scale-[0.98]"
                                                    onClick={(e) => { e.stopPropagation(); handleMarkAllShipped(); }}
                                                    disabled={isShipping}
                                                >
                                                    {isShipping ? (
                                                        <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                                                    ) : (
                                                        <Truck className="mr-3 h-6 w-6" />
                                                    )}
                                                    Ολοκλήρωση Αποστολής ({pendingOrdersForDay.length})
                                                </Button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </Tabs>
                    </TabsContent>
                </Tabs>
                )}
            </div>
        </div>
    );
}
