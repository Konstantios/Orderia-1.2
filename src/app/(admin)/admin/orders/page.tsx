'use client';

import { useState } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { adminOrders, products } from "@/lib/data";
import type { Order, OrderItem } from "@/lib/types";
import { Download, History } from "lucide-react";
import { format, isToday, isYesterday } from 'date-fns';
import { el } from 'date-fns/locale';

function OrderDetailsDialog({ order, products, onNotesChange, open, onOpenChange }: { order: Order; products: typeof import('@/lib/data').products; onNotesChange: (orderId: string, notes: string) => void; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [supplierNotes, setSupplierNotes] = useState(order.supplierNotes || "");
  const { toast } = useToast();

  const handleSaveNotes = () => {
    onNotesChange(order.id, supplierNotes);
    toast({ title: "Οι σημειώσεις αποθηκεύτηκαν!" });
    onOpenChange(false);
  };
  
  const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Παραγγελία #{order.id}</DialogTitle>
          <DialogDescription>
            {order.customerName} - {format(new Date(order.date), 'PPpp', { locale: el })}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto pr-4">
          <ul className="space-y-4">
            {order.items.map((item: OrderItem) => {
              const product = products.find(p => p.id === item.productId);
              if (!product) return null;
              return (
                <li key={item.productId} className="flex items-center gap-4">
                  <Image src={product.imageUrl} alt={product.name} width={56} height={56} className="rounded-md object-cover" data-ai-hint={product.imageHint} />
                  <div className="flex-1">
                    <p className="font-semibold">{product.name}</p>
                    <p className="text-sm text-muted-foreground">{product.code}</p>
                  </div>
                  <div className="text-right">
                      <p className="font-bold text-lg">{item.quantity}</p>
                      <p className="text-xs text-muted-foreground">{product.unit}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          
          <Separator className="my-4" />

          {order.notes && (
            <div className="space-y-2">
                <h4 className="font-semibold text-sm">Σημειώσεις Πελάτη</h4>
                <p className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-md">{order.notes}</p>
            </div>
          )}

          <div className="space-y-2 mt-4">
            <h4 className="font-semibold text-sm">Οι Σημειώσεις σας</h4>
            <Textarea
              placeholder="Προσθέστε σημειώσεις για την ομάδα σας..."
              value={supplierNotes}
              onChange={(e) => setSupplierNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Κλείσιμο</Button>
          <Button onClick={handleSaveNotes}>Αποθήκευση Σημειώσεων</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


export default function AdminOrdersPage() {
    const [orders, setOrders] = useState<Order[]>(adminOrders);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    const handleNotesChange = (orderId: string, notes: string) => {
        setOrders(prevOrders => prevOrders.map(o => o.id === orderId ? { ...o, supplierNotes: notes } : o));
    };
    
    const todaysOrders = orders.filter(o => isToday(new Date(o.date)));
    const yesterdaysOrders = orders.filter(o => isYesterday(new Date(o.date)));

    const renderOrderList = (orderList: Order[]) => {
      if (orderList.length === 0) {
        return <p className="text-muted-foreground text-center py-8">Δεν υπάρχουν παραγγελίες για αυτή την ημέρα.</p>
      }
      return (
        <div className="space-y-4">
          {orderList.map(order => (
            <Card key={order.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedOrder(order)}>
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
                <Button variant="outline"><Download className="mr-2 h-4 w-4" />Εξαγωγή</Button>
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
            
            {selectedOrder && (
              <OrderDetailsDialog 
                order={selectedOrder} 
                products={products}
                onNotesChange={handleNotesChange}
                open={!!selectedOrder}
                onOpenChange={(open) => { if(!open) setSelectedOrder(null) }}
              />
            )}
        </div>
    );
}
