'use client';

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Order, Wholesaler, Product } from "@/lib/types";
import { ChevronLeft, ChevronRight, Download, Loader2, Package, Boxes } from "lucide-react";
import { format, isSameDay, isSameMonth, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths } from 'date-fns';
import { el } from 'date-fns/locale';
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { useFirebase, useCollection, useMemoFirebase, type WithId } from '@/firebase';
import { collection, query, where, Timestamp } from 'firebase/firestore';
import { cn } from "@/lib/utils";

export default function AdminOrdersHistoryPage() {
    const router = useRouter();
    const { toast } = useToast();
    const { user, firestore } = useFirebase();

    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());

    // 1. Fetch Wholesaler
    const wholesalerQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'wholesalers'), where('adminUids', 'array-contains', user.uid));
    }, [firestore, user]);
    const { data: wholesalers, isLoading: isLoadingWholesalers } = useCollection<Wholesaler>(wholesalerQuery);
    const wholesaler = wholesalers?.[0];

    // 2. Fetch shipped orders
    const ordersQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, 'orders'), where('memberUids', 'array-contains', user.uid));
    }, [user, firestore]);
    const { data: allOrders, isLoading: isLoadingOrders } = useCollection<Order>(ordersQuery);

    // 3. Fetch products
    const productsQuery = useMemoFirebase(() => {
        if (!firestore || !wholesaler) return null;
        return collection(firestore, 'wholesalers', wholesaler.id, 'products');
    }, [firestore, wholesaler]);
    const { data: products } = useCollection<Product>(productsQuery);

    const shippedOrders = useMemo(() => {
        if (!allOrders) return [];
        return allOrders.filter(o => o.status === 'Απεσταλμένη' || o.status === 'Ολοκληρωμένη');
    }, [allOrders]);

    // Get order date helper
    const getOrderShippedDate = (order: WithId<Order>): Date | null => {
        try {
            const shippedDate = (order.shippedAt as unknown as Timestamp)?.toDate?.();
            const deliveryDate = (order.deliveryDate as unknown as Timestamp)?.toDate?.();
            const orderDate = (order.date as unknown as Timestamp)?.toDate?.();
            return shippedDate || deliveryDate || orderDate || null;
        } catch { return null; }
    };

    // Count orders per day for calendar dots
    const ordersByDate = useMemo(() => {
        const map = new Map<string, WithId<Order>[]>();
        shippedOrders.forEach(order => {
            const date = getOrderShippedDate(order);
            if (date) {
                const key = format(date, 'yyyy-MM-dd');
                if (!map.has(key)) map.set(key, []);
                map.get(key)!.push(order);
            }
        });
        return map;
    }, [shippedOrders]);

    // Orders for selected date
    const ordersForSelectedDate = useMemo(() => {
        if (!selectedDate) return [];
        const key = format(selectedDate, 'yyyy-MM-dd');
        return ordersByDate.get(key) || [];
    }, [selectedDate, ordersByDate]);

    // Total boxes for selected date
    const totalBoxes = useMemo(() => {
        return ordersForSelectedDate.reduce((total, order) => {
            return total + order.items.reduce((acc, item) => acc + item.quantity, 0);
        }, 0);
    }, [ordersForSelectedDate]);

    // Calendar grid generation
    const calendarDays = useMemo(() => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(currentMonth);
        const calStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
        const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

        const days: Date[] = [];
        let day = calStart;
        while (day <= calEnd) {
            days.push(day);
            day = addDays(day, 1);
        }
        return days;
    }, [currentMonth]);

    const handleExportDay = () => {
        if (ordersForSelectedDate.length === 0) {
            toast({ variant: 'destructive', title: 'Κενή Ημέρα', description: 'Δεν υπάρχουν παραγγελίες αυτή την ημέρα.' });
            return;
        }
        const exportData = ordersForSelectedDate.flatMap(order =>
            order.items.map(item => {
                const product = products?.find(p => p.id === item.productId);
                return {
                    'Πελάτης': order.customerName,
                    'ID': order.id,
                    'Κωδικός': product?.code || '-',
                    'Προϊόν': product?.name || 'Άγνωστο',
                    'Ποσότητα': item.quantity,
                    'Μονάδα': product?.unit || '-',
                    'Σημειώσεις': order.notes || '-',
                };
            })
        );
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Ημέρα');
        XLSX.writeFile(workbook, `Παραγγελίες_${format(selectedDate, 'd-M-yyyy')}.xlsx`);
    };

    const isLoading = isLoadingOrders || isLoadingWholesalers;
    const weekDays = ['Δε', 'Τρ', 'Τε', 'Πε', 'Πα', 'Σα', 'Κυ'];

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/admin/orders')}>
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <h1 className="text-lg font-semibold md:text-2xl">Ιστορικό Παραγγελιών</h1>
                </div>
                <Button variant="outline" onClick={handleExportDay} disabled={ordersForSelectedDate.length === 0}>
                    <Download className="mr-2 h-4 w-4" />Εξαγωγή Ημέρας
                </Button>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center p-12">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Calendar */}
                    <Card className="lg:col-span-1">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <CardTitle className="text-base capitalize">
                                    {format(currentMonth, 'LLLL yyyy', { locale: el })}
                                </CardTitle>
                                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="px-3 pb-3">
                            {/* Weekday headers */}
                            <div className="grid grid-cols-7 mb-1">
                                {weekDays.map(d => (
                                    <div key={d} className="text-center text-[11px] font-semibold text-muted-foreground py-1">
                                        {d}
                                    </div>
                                ))}
                            </div>
                            {/* Days */}
                            <div className="grid grid-cols-7 gap-0.5">
                                {calendarDays.map((day, i) => {
                                    const key = format(day, 'yyyy-MM-dd');
                                    const ordersThisDay = ordersByDate.get(key) || [];
                                    const isCurrentMonth = isSameMonth(day, currentMonth);
                                    const isSelected = isSameDay(day, selectedDate);
                                    const isToday = isSameDay(day, new Date());
                                    const hasOrders = ordersThisDay.length > 0;

                                    return (
                                        <button
                                            key={i}
                                            className={cn(
                                                "relative flex flex-col items-center justify-center py-2 rounded-md text-sm transition-all",
                                                !isCurrentMonth && "text-muted-foreground/30",
                                                isCurrentMonth && "hover:bg-muted/50 cursor-pointer",
                                                isSelected && "bg-primary text-primary-foreground hover:bg-primary/90 font-bold",
                                                isToday && !isSelected && "ring-1 ring-primary/50",
                                            )}
                                            onClick={() => setSelectedDate(day)}
                                        >
                                            <span className="text-sm">{format(day, 'd')}</span>
                                            {hasOrders && (
                                                <span className={cn(
                                                    "absolute bottom-0.5 h-1.5 w-1.5 rounded-full",
                                                    isSelected ? "bg-primary-foreground" : "bg-primary"
                                                )} />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Orders for selected day */}
                    <div className="lg:col-span-2 space-y-4">
                        {/* Date Header + Totals */}
                        <Card className="bg-muted/30">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-lg font-bold capitalize">
                                            {format(selectedDate, 'EEEE, d MMMM yyyy', { locale: el })}
                                        </h2>
                                        <p className="text-sm text-muted-foreground">
                                            {ordersForSelectedDate.length} παραγγελίες
                                        </p>
                                    </div>
                                    {ordersForSelectedDate.length > 0 && (
                                        <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-xl px-4 py-2">
                                            <Boxes className="h-5 w-5 text-primary" />
                                            <div className="text-right">
                                                <p className="text-2xl font-black text-primary leading-none">{totalBoxes}</p>
                                                <p className="text-[10px] font-semibold uppercase text-primary/70">τεμάχια</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Order list */}
                        {ordersForSelectedDate.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
                                <p className="font-medium">Δεν υπάρχουν παραγγελίες</p>
                                <p className="text-sm">Επιλέξτε μια ημέρα με αποστολές.</p>
                            </div>
                        ) : (
                            ordersForSelectedDate.map(order => (
                                <Card key={order.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => router.push(`/admin/orders/${order.id}`)}>
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-start">
                                            <div className="min-w-0">
                                                <CardTitle className="text-base">{order.customerName}</CardTitle>
                                                <CardDescription className="text-xs truncate">ID: #{order.id}</CardDescription>
                                            </div>
                                            <Badge variant={order.status === 'Απεσταλμένη' ? 'default' : 'secondary'}>{order.status}</Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm text-muted-foreground">
                                                {order.items.length} προϊόντα
                                            </p>
                                            <div className="flex items-center gap-1.5 text-sm font-semibold">
                                                <Boxes className="h-4 w-4 text-muted-foreground" />
                                                {order.items.reduce((acc, item) => acc + item.quantity, 0)} τεμ.
                                            </div>
                                        </div>
                                        {order.notes && (
                                            <p className="text-xs text-muted-foreground/70 mt-1.5 italic truncate">📝 {order.notes}</p>
                                        )}
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
