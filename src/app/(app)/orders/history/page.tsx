'use client';

import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { History, Loader2, Package, Truck, CheckCircle2, Clock, Eye } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { Order } from '@/lib/types';

export default function OrderHistoryPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { user, firestore } = useFirebase();

  // --- NEW: Fetch Wholesaler Products for lookup ---
  const [store, setStore] = useState<any>(null);
  const [wholesalerProducts, setWholesalerProducts] = useState<any[]>([]);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(true);

  useEffect(() => {
    if (!firestore || !user) return;

    const fetchMetadata = async () => {
        setIsLoadingMetadata(true);
        try {
            // Find store
            const storesRef = collection(firestore, 'stores');
            const ownerQuery = query(storesRef, where("ownerId", "==", user.uid));
            const managerQuery = query(storesRef, where("managerUids", "array-contains", user.uid));
            const [ownerSnap, managerSnap] = await Promise.all([getDocs(ownerQuery), getDocs(managerQuery)]);
            
            let foundStore = null;
            if (!ownerSnap.empty) foundStore = { id: ownerSnap.docs[0].id, ...ownerSnap.docs[0].data() };
            else if (!managerSnap.empty) foundStore = { id: managerSnap.docs[0].id, ...managerSnap.docs[0].data() };
            
            if (foundStore) {
                setStore(foundStore);
                // Find connection
                const connectionsRef = collection(firestore, 'supplierStoreConnections');
                const connQuery = query(connectionsRef, where('storeId', '==', foundStore.id), where('isActive', '==', true));
                const connSnap = await getDocs(connQuery);
                
                if (!connSnap.empty) {
                    const wholesalerId = connSnap.docs[0].data().wholesalerId;
                    const productsRef = collection(firestore, 'wholesalers', wholesalerId, 'products');
                    const productSnap = await getDocs(productsRef);
                    setWholesalerProducts(productSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                }
            }
        } catch (e) {
            console.error("Error fetching history metadata:", e);
        } finally {
            setIsLoadingMetadata(false);
        }
    };

    fetchMetadata();
  }, [firestore, user]);

  const productLookup = useMemo(() => {
    const map: Record<string, string> = {};
    wholesalerProducts.forEach(p => {
        map[p.id] = p.name;
    });
    return map;
  }, [wholesalerProducts]);

  const ordersQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'orders'),
      where('memberUids', 'array-contains', user.uid)
    );
  }, [user, firestore]);

  const { data: rawOrders, isLoading: isLoadingOrders } = useCollection<Order>(ordersQuery);
  
  // ... rest of the memoization logic ...
  const allOrders = useMemo(() => {
    if (!rawOrders) return [];
    return [...rawOrders].sort((a, b) => {
      const dateA = (a.date as any)?.toDate ? (a.date as any).toDate() : new Date(a.date);
      const dateB = (b.date as any)?.toDate ? (b.date as any).toDate() : new Date(b.date);
      return dateB.getTime() - dateA.getTime();
    });
  }, [rawOrders]);

  const sentOrders = useMemo(() => {
    return allOrders.filter(o => o.status === 'Εκκρεμής');
  }, [allOrders]);

  const arrivedOrders = useMemo(() => {
    return allOrders.filter(o => o.status === 'Απεσταλμένη' || o.status === 'Ολοκληρωμένη');
  }, [allOrders]);

  const handleReorder = (orderId: string) => {
    const order = allOrders.find(o => o.id === orderId);
    if (order) {
      localStorage.setItem('orderItems', JSON.stringify(order.items));
      if (order.notes) {
        localStorage.setItem('orderNotes', order.notes);
      } else {
        localStorage.removeItem('orderNotes');
      }
      
      toast({
        title: `Επανάληψη Παραγγελίας #${orderId.slice(0, 8)}`,
        description: 'Η παραγγελία φορτώθηκε. Μεταφορά στη νέα παραγγελία...',
      });
      // Use timestamp to force route entry/re-initialization
      router.push(`/orders/new?reorder=true&t=${Date.now()}`);
    }
  };

  const OrderDetailsDialog = ({ order }: { order: Order }) => (
    <DialogContent className="max-w-[90vw] sm:max-w-md rounded-2xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Λεπτομέρειες Παραγγελίας
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="flex justify-between items-center text-sm border-b pb-2">
            <span className="text-muted-foreground font-medium">Κωδικός:</span>
            <span className="font-bold">#{order.id.slice(0, 8)}</span>
        </div>
        <div className="flex justify-between items-center text-sm border-b pb-2">
            <span className="text-muted-foreground font-medium">Ημερομηνία:</span>
            <span className="font-bold">
                {order.date ? (
                  (order.date as any).toDate 
                    ? (order.date as any).toDate().toLocaleDateString('el-GR', { day: 'numeric', month: 'long', year: 'numeric' }) 
                    : new Date(order.date as any).toLocaleDateString('el-GR', { day: 'numeric', month: 'long', year: 'numeric' })
                ) : '-'}
            </span>
        </div>
        
        <div className="space-y-2">
            <p className="text-sm font-bold text-primary">Προϊόντα & Κιβώτια:</p>
            <div className="bg-muted/30 rounded-xl p-3 space-y-2">
                {order.items.map((item, idx) => {
                    const name = productLookup[item.productId] || `Προϊόν (ID: ${item.productId.slice(0, 6)})`;
                    return (
                        <div key={idx} className="flex justify-between items-center text-sm">
                            <span className="font-medium">{name}</span>
                            <span className="font-black bg-primary/10 px-2 py-0.5 rounded text-primary">x{item.quantity}</span>
                        </div>
                    );
                })}
            </div>
        </div>

        {order.notes && (
          <div className="space-y-1">
            <p className="text-sm font-bold text-primary">Σημειώσεις Καταστήματος:</p>
            <p className="text-sm text-muted-foreground italic bg-muted/20 p-2 rounded-lg border">
                {order.notes}
            </p>
          </div>
        )}

        <Button onClick={() => handleReorder(order.id)} className="w-full font-bold h-12 rounded-xl mt-2">
            <History className="mr-2 h-4 w-4" />
            Επανάληψη αυτής της παραγγελίας
        </Button>
      </div>
    </DialogContent>
  );

  const OrderCard = ({ order }: { order: Order }) => (
    <Card key={order.id} className="overflow-hidden border-2 hover:border-primary/20 transition-all shadow-sm">
      <CardHeader className="flex-row items-center justify-between bg-muted/30 py-3 px-4">
        <div className="flex items-center gap-3">
            <div className={cn(
                "p-2 rounded-full",
                order.status === 'Απεσταλμένη' ? "bg-blue-500/10 text-blue-500" :
                order.status === 'Ολοκληρωμένη' ? "bg-green-500/10 text-green-500" :
                "bg-orange-500/10 text-orange-500"
            )}>
                {order.status === 'Απεσταλμένη' ? <Truck className="h-4 w-4" /> :
                 order.status === 'Ολοκληρωμένη' ? <CheckCircle2 className="h-4 w-4" /> :
                 <Clock className="h-4 w-4" />}
            </div>
            <div>
              <CardTitle className="text-sm font-bold">#{order.id.slice(0, 8)}</CardTitle>
              <CardDescription className="text-xs">
                {order.date ? (
                  (order.date as any).toDate 
                    ? (order.date as any).toDate().toLocaleDateString('el-GR', { day: 'numeric', month: 'long' }) 
                    : new Date(order.date as any).toLocaleDateString('el-GR', { day: 'numeric', month: 'long' })
                ) : 'No date'}
              </CardDescription>
            </div>
        </div>
        <Badge variant={order.status === 'Ολοκληρωμένη' ? 'secondary' : order.status === 'Απεσταλμένη' ? 'default' : 'outline'} className="font-bold">
            {order.status}
        </Badge>
      </CardHeader>
      
      <Dialog>
        <DialogTrigger asChild>
            <CardContent className="p-4 cursor-pointer hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-2 mb-3">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">{order.items.length} Προϊόντα</span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {order.items.slice(0, 3).map((item, idx) => {
                        const name = productLookup[item.productId] || `ID: ${item.productId.slice(0, 4)}...`;
                        return (
                            <span key={idx} className="bg-muted px-2 py-1 rounded-md">
                                {name} x{item.quantity}
                            </span>
                        );
                    })}
                    {order.items.length > 3 && <span>+{order.items.length - 3} ακόμα</span>}
                </div>
                <div className="mt-3 flex items-center text-xs text-primary font-bold gap-1 animate-pulse">
                    <Eye className="h-3 w-3" /> Προβολή λεπτομερειών
                </div>
            </CardContent>
        </DialogTrigger>
        <OrderDetailsDialog order={order} />
      </Dialog>

      <CardFooter className="bg-muted/10 py-2 flex justify-end gap-2 border-t">
        <Button variant="ghost" size="sm" className="h-8 text-xs font-bold gap-2 text-primary" onClick={() => handleReorder(order.id)}>
          <History className="h-3.5 w-3.5" />
          Επανάληψη
        </Button>
      </CardFooter>
    </Card>
  );

  if (isLoadingOrders) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
          <h1 className="font-headline text-3xl font-bold italic text-primary">Ιστορικό</h1>
          <p className="text-muted-foreground text-sm">Παρακολουθήστε την πορεία των παραγγελιών σας.</p>
      </div>

      <Tabs defaultValue="sent" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6 h-14 p-1.5 bg-muted/30 border-2 rounded-2xl overflow-hidden">
          <TabsTrigger 
            value="sent" 
            className="rounded-xl font-bold text-sm transition-all h-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg active:scale-95"
          >
            Οι παραγγελίες μου ({sentOrders.length})
          </TabsTrigger>
          <TabsTrigger 
            value="arrived" 
            className="rounded-xl font-bold text-sm transition-all h-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg active:scale-95"
          >
            Ήρθαν / Απεσταλμένες ({arrivedOrders.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sent" className="space-y-4 outline-none animate-in fade-in slide-in-from-bottom-2">
          {sentOrders.length === 0 ? (
            <div className="text-center py-20 bg-muted/10 rounded-3xl border border-dashed flex flex-col items-center gap-3">
              <Package className="h-12 w-12 text-muted-foreground/30" />
              <div className="space-y-1">
                  <p className="font-bold text-muted-foreground">Δεν υπάρχουν ενεργές παραγγελίες</p>
                  <p className="text-sm text-muted-foreground/60">Όλες οι παραγγελίες σας έχουν ολοκληρωθεί.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => router.push('/orders/new')} className="mt-2 rounded-xl">Νέα Παραγγελία</Button>
            </div>
          ) : (
            sentOrders.map(order => <OrderCard key={order.id} order={order} />)
          )}
        </TabsContent>

        <TabsContent value="arrived" className="space-y-4 outline-none animate-in fade-in slide-in-from-bottom-2">
          {arrivedOrders.length === 0 ? (
            <div className="text-center py-20 bg-muted/10 rounded-3xl border border-dashed flex flex-col items-center gap-3">
              <Truck className="h-12 w-12 text-muted-foreground/30" />
              <div className="space-y-1">
                  <p className="font-bold text-muted-foreground">Καμία πρόσφατη παραλαβή</p>
                  <p className="text-sm text-muted-foreground/60">Εδώ θα βλέπετε τις παραγγελίες που έρχονται.</p>
              </div>
            </div>
          ) : (
            arrivedOrders.map(order => <OrderCard key={order.id} order={order} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
