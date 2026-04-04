'use client';

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { products, adminCustomers } from "@/lib/data";
import type { Order, Wholesaler } from "@/lib/types";
import { Download, History, Loader2 } from "lucide-react";
import { format, addDays } from 'date-fns';
import { el } from 'date-fns/locale';
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';

export default function AdminOrdersPage() {
    const router = useRouter();
    const { toast } = useToast();
    
    const { user, firestore } = useFirebase();

    const wholesalerQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'wholesalers'), where('adminUids', 'array-contains', user.uid));
    }, [firestore, user]);
    const { data: wholesalers, isLoading: isLoadingWholesalers } = useCollection<Wholesaler>(wholesalerQuery);
    const wholesaler = wholesalers?.[0];

    const ordersQuery = useMemoFirebase(() => {
        if (!firestore || !wholesaler) return null;
        return query(collection(firestore, 'orders'), where('wholesalerId', '==', wholesaler.id), orderBy('date', 'desc'));
    }, [firestore, wholesaler]);
    const { data: orders, isLoading: isLoadingOrders } = useCollection<Order>(ordersQuery);


    const [nextSevenDays, setNextSevenDays] = useState<{ date: Date; dateString: string; dayName: string; formattedDate: string; }[]>([]);
    const [activeTab, setActiveTab] = useState<string>('');

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


    const { ordersForDay, customersWithoutOrders } = useMemo(() => {
        const selectedDayInfo = nextSevenDays.find(d => d.dateString === activeTab);
        if (!selectedDayInfo || !orders) {
            return { ordersForDay: [], customersWithoutOrders: [] };
        }

        const dayName = selectedDayInfo.dayName;
        
        const customersForDay = adminCustomers.filter(c => c.deliveryDay === dayName);
        const customerNamesForDay = new Set(customersForDay.map(c => c.companyName));

        const filteredOrders = orders.filter(o => 
            o.status === 'Εκκρεμής' && customerNamesForDay.has(o.customerName)
        );

        const customersWhoHaveOrdered = new Set(filteredOrders.map(o => o.customerName));
        const customersWithoutOrders = customersForDay.filter(
            c => !customersWhoHaveOrdered.has(c.companyName)
        );

        return { ordersForDay: filteredOrders, customersWithoutOrders };
    }, [activeTab, orders, nextSevenDays]);


    const handleExport = () => {
        if (ordersForDay.length === 0) {
            toast({
                title: "Δεν υπάρχουν παραγγελίες",
                description: "Δεν βρέθηκαν εκκρεμείς παραγγελίες για εξαγωγή για την επιλεγμένη ημέρα.",
                variant: "destructive"
            });
            return;
        }

        const exportData = ordersForDay.flatMap(order => {
            const commonData = {
                'ID Παραγγελίας': order.id,
                'Πελάτης': order.customerName,
                'Ημερομηνία Παραγγελίας': (order.date as any)?.toDate ? (order.date as any).toDate().toLocaleString('el-GR') : new Date(order.date).toLocaleString('el-GR'),
                'Κατάσταση': order.status,
                'Τηλέφωνο Υπευθύνου': '6900000000', // Placeholder
                'Σημειώσεις Πελάτη': order.notes || '-',
            };

            if (order.items.length === 0) {
                return [{
                    ...commonData,
                    'Κωδικός Προϊόντος': '-',
                    'Προϊόν': '-',
                    'Ποσότητα': 0,
                    'Μονάδα': '-',
                }];
            }
            return order.items.map(item => {
                const product = products.find(p => p.id === item.productId);
                return {
                    ...commonData,
                    'Κωδικός Προϊόντος': product?.code || '-',
                    'Προϊόν': product?.name || 'Άγνωστο',
                    'Ποσότητα': item.quantity,
                    'Μονάδα': product?.unit || '-',
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
        const fileName = `Παραδόσεις_${selectedDayInfo?.dayName}_${selectedDayInfo?.formattedDate.replace('/', '-')}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold md:text-2xl">Παραγγελίες</h1>
              <div className="flex gap-2">
                <Button variant="outline"><History className="mr-2 h-4 w-4" />Ιστορικό</Button>
                <Button variant="outline" onClick={handleExport}><Download className="mr-2 h-4 w-4" />Εξαγωγή</Button>
              </div>
            </div>
            
            <div className="space-y-2">
                <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">ημέρα αποστολής-παράδοσης</h2>
                {nextSevenDays.length > 0 && (
                <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 sm:grid-cols-4 md:grid-cols-7">
                         {nextSevenDays.map(day => (
                             <TabsTrigger key={day.dateString} value={day.dateString} className="capitalize">
                                {day.dayName} {day.formattedDate}
                             </TabsTrigger>
                        ))}
                    </TabsList>
                    
                    <TabsContent value={activeTab} className="mt-4">
                         <div className="space-y-4">
                            {isLoadingOrders || isLoadingWholesalers ? (
                                <div className="flex items-center justify-center p-8">
                                    <Loader2 className="h-8 w-8 animate-spin" />
                                </div>
                            ) : (
                                <>
                                    {ordersForDay.map(order => (
                                        <Card key={order.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/admin/orders/${order.id}`)}>
                                            <CardHeader>
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <CardTitle className="text-lg">{order.customerName}</CardTitle>
                                                        <CardDescription>ID: #{order.id}</CardDescription>
                                                    </div>
                                                    <Badge variant={order.status === 'Εκκρεμής' ? 'destructive' : order.status === 'Απεσταλμένη' ? 'default' : 'secondary'}>{order.status}</Badge>
                                                </div>
                                            </CardHeader>
                                            <CardContent>
                                                <p className="text-sm text-muted-foreground">{order.items.length} προϊόντα • Σύνολο {order.items.reduce((acc, item) => acc + item.quantity, 0)} τεμάχια</p>
                                            </CardContent>
                                        </Card>
                                    ))}
        
                                    {ordersForDay.length > 0 && customersWithoutOrders.length > 0 && (
                                        <div className="relative py-4">
                                            <div className="absolute inset-0 flex items-center">
                                                <span className="w-full border-t" />
                                            </div>
                                            <div className="relative flex justify-center">
                                                <span className="bg-background px-2 text-xs uppercase text-muted-foreground">
                                                    Δεν έχουν παραγγείλει
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {customersWithoutOrders.map(customer => (
                                        <Card key={customer.id} className="opacity-60 bg-muted/20">
                                            <CardHeader>
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <CardTitle className="text-lg">{customer.companyName}</CardTitle>
                                                        <CardDescription>Δεν έχει υποβληθεί παραγγελία</CardDescription>
                                                    </div>
                                                    <Badge variant="outline">Εκκρεμεί</Badge>
                                                </div>
                                            </CardHeader>
                                             <CardContent>
                                                <p className="text-sm text-muted-foreground">Τηλέφωνο: {customer.phone1}</p>
                                            </CardContent>
                                        </Card>
                                    ))}
                                    
                                    {ordersForDay.length === 0 && customersWithoutOrders.length === 0 && (
                                        <p className="text-muted-foreground text-center py-8">Δεν υπάρχουν παραγγελίες ή πελάτες για παράδοση αυτήν την ημέρα.</p>
                                    )}
                                </>
                            )}
                       </div>
                    </TabsContent>
                </Tabs>
                )}
            </div>
        </div>
    );
}
