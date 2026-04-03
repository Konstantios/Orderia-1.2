'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminOrders, products, adminCustomers } from "@/lib/data";
import type { Order } from "@/lib/types";
import { Download, History } from "lucide-react";
import { isToday } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';

export default function AdminOrdersPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [orders] = useState<Order[]>(adminOrders);

    const getTodayGreekDay = () => {
        const day = new Date().toLocaleDateString('el-GR', { weekday: 'long' });
        return day.charAt(0).toUpperCase() + day.slice(1);
    };

    const todayDayName = getTodayGreekDay();

    // Customers who should have delivery today
    const customersForTodayDelivery = adminCustomers.filter(c => c.deliveryDay === todayDayName);
    const customerNamesForTodayDelivery = new Set(customersForTodayDelivery.map(c => c.companyName));

    // Orders placed today by those customers
    const ordersForTodayDelivery = orders.filter(o => 
        customerNamesForTodayDelivery.has(o.customerName) && isToday(new Date(o.date))
    );

    // Customers for today who haven't placed an order today
    const customersWhoOrderedToday = new Set(ordersForTodayDelivery.map(o => o.customerName));
    const customersWithoutOrdersToday = customersForTodayDelivery.filter(
        c => !customersWhoOrderedToday.has(c.companyName)
    );
    
    const handleExportAll = () => {
        const ordersToExport = orders; 

        if (ordersToExport.length === 0) {
            toast({
                title: "Δεν υπάρχουν παραγγελίες",
                description: "Δεν βρέθηκαν παραγγελίες για εξαγωγή.",
                variant: "destructive"
            });
            return;
        }

        const exportData = ordersToExport.flatMap(order => {
            const commonData = {
                'ID Παραγγελίας': order.id,
                'Πελάτης': order.customerName,
                'Ημερομηνία Παραγγελίας': new Date(order.date).toLocaleString('el-GR'),
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

        XLSX.writeFile(workbook, `Συνολικές_Παραγγελίες.xlsx`);
    };

    const renderOrderList = (orderList: Order[]) => {
      if (orderList.length === 0) {
        return <p className="text-muted-foreground text-center py-8">Δεν υπάρχουν παραγγελίες.</p>
      }
      return (
        <div className="space-y-4">
          {orderList.map(order => (
            <Card key={order.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/admin/orders/${order.id}`)}>
              <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-lg">{order.customerName}</CardTitle>
                        <CardDescription>ID: #{order.id} &bull; {new Date(order.date).toLocaleDateString('el-GR')}</CardDescription>
                    </div>
                    <Badge variant={order.status === 'Εκκρεμής' ? 'destructive' : order.status === 'Απεσταλμένη' ? 'default' : 'secondary'}>{order.status}</Badge>
                  </div>
              </CardHeader>
              <CardContent>
                  <p className="text-sm text-muted-foreground">{order.items.length} προϊόντα • Σύνολο {order.items.reduce((acc, item) => acc + item.quantity, 0)} τεμάχια</p>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold md:text-2xl">Παραγγελίες</h1>
              <div className="flex gap-2">
                <Button variant="outline"><History className="mr-2 h-4 w-4" />Ιστορικό</Button>
                <Button variant="outline" onClick={handleExportAll}><Download className="mr-2 h-4 w-4" />Εξαγωγή</Button>
              </div>
            </div>
            
            <Tabs defaultValue="today_delivery">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="today_delivery">Σημερινή Παράδοση</TabsTrigger>
                    <TabsTrigger value="all_orders">Όλες οι Παραγγελίες</TabsTrigger>
                </TabsList>
                <TabsContent value="today_delivery" className="mt-4">
                    <div className="space-y-4">
                        {ordersForTodayDelivery.map(order => (
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

                        {ordersForTodayDelivery.length > 0 && customersWithoutOrdersToday.length > 0 && (
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
                        
                        {customersWithoutOrdersToday.map(customer => (
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
                        
                        {ordersForTodayDelivery.length === 0 && customersWithoutOrdersToday.length === 0 && (
                            <p className="text-muted-foreground text-center py-8">Δεν υπάρχουν παραγγελίες ή πελάτες για παράδοση σήμερα.</p>
                        )}
                   </div>
                </TabsContent>
                <TabsContent value="all_orders" className="mt-4">
                   {renderOrderList(orders)}
                </TabsContent>
            </Tabs>
        </div>
    );
}
