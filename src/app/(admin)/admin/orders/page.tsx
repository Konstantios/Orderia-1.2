'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminOrders } from "@/lib/data";
import type { Order } from "@/lib/types";
import { Download, History } from "lucide-react";
import { isToday, isYesterday } from 'date-fns';
import { useToast } from "@/hooks/use-toast";


export default function AdminOrdersPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [orders, setOrders] = useState<Order[]>(adminOrders);
    
    const todaysOrders = orders.filter(o => isToday(new Date(o.date)));
    const yesterdaysOrders = orders.filter(o => isYesterday(new Date(o.date)));

    // Note: Excel export for all orders is not implemented in this step.
    const handleExportAll = () => {
        toast({
            variant: "destructive",
            title: "Λειτουργία υπό κατασκευή",
            description: "Η εξαγωγή όλων των παραγγελιών δεν είναι ακόμα διαθέσιμη.",
        });
    };

    const renderOrderList = (orderList: Order[]) => {
      if (orderList.length === 0) {
        return <p className="text-muted-foreground text-center py-8">Δεν υπάρχουν παραγγελίες για αυτή την ημέρα.</p>
      }
      return (
        <div className="space-y-4">
          {orderList.map(order => (
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
            
            <Tabs defaultValue="today">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="today">Σήμερα</TabsTrigger>
                    <TabsTrigger value="yesterday">Χθες</TabsTrigger>
                </TabsList>
                <TabsContent value="today" className="mt-4">
                   {renderOrderList(todaysOrders)}
                </TabsContent>
                <TabsContent value="yesterday" className="mt-4">
                   {renderOrderList(yesterdaysOrders)}
                </TabsContent>
            </Tabs>
        </div>
    );
}
