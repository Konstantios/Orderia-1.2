'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { Bell, History, Package, ShoppingCart, Users, Loader2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRouter } from 'next/navigation';
import { useFirebase, useCollection, useMemoFirebase, type WithId } from '@/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { useEffect, useState, useMemo } from 'react';
import { AlertCircle, ArrowRight } from 'lucide-react';
import type { Store, CustomerInventoryItem, StoreProductConfiguration, Product } from '@/lib/types';


const menuItems = [
  {
    title: 'Νέα Παραγγελία',
    description: 'Δημιουργήστε μια νέα εβδομαδιαία παραγγελία',
    href: '/orders/new',
    icon: ShoppingCart,
    color: 'text-accent',
  },
  {
    title: 'Απογραφή Αποθήκης',
    description: 'Ενημερώστε το απόθεμά σας',
    href: '/inventory',
    icon: Package,
    color: 'text-primary',
  },
  {
    title: 'Προτεινόμενη Παραγγελία',
    description: 'Έξυπνες προτάσεις',
    href: '/orders/new?suggested=true',
    icon: ShoppingCart,
    color: 'text-green-400',
  },
  {
    title: 'Ιστορικό Παραγγελιών',
    description: 'Δείτε τις προηγούμενες παραγγελίες σας',
    href: '/orders/history',
    icon: History,
    color: 'text-orange-400',
  },
  {
    title: 'Διαχείριση Ομάδας',
    description: 'Προσκαλέστε μέλη και ορίστε δικαιώματα',
    href: '/team',
    icon: Users,
    color: 'text-purple-400',
  },
  {
    title: 'Ειδοποιήσεις',
    description: '7 μη αναγνωσμένα μηνύματα',
    href: '/notifications',
    icon: Bell,
    color: 'text-red-400',
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const { user, firestore, isUserLoading } = useFirebase();

  const [storeName, setStoreName] = useState('Φόρτωση...');
  const [store, setStore] = useState<WithId<Store> | null>(null);

  useEffect(() => {
    if (user && firestore) {
      const checkWholesalerAndGetStore = async () => {
        const wholesalersRef = collection(firestore, 'wholesalers');
        const qAdmin = query(wholesalersRef, where("adminUids", "array-contains", user.uid));
        const qOwner = query(wholesalersRef, where("ownerId", "==", user.uid));
        
        const storesRef = collection(firestore, 'stores');
        const qStoreManager = query(storesRef, where("managerUids", "array-contains", user.uid));
        const qStoreOwner = query(storesRef, where("ownerId", "==", user.uid));

        const [adminSnap, ownerSnap, storeManagerSnap, storeOwnerSnap] = await Promise.all([
          getDocs(qAdmin),
          getDocs(qOwner),
          getDocs(qStoreManager),
          getDocs(qStoreOwner)
        ]);

        if (!adminSnap.empty || !ownerSnap.empty) {
          router.replace('/admin/dashboard');
          return;
        }

        if (!storeOwnerSnap.empty) {
            const doc = storeOwnerSnap.docs[0];
            setStore({ id: doc.id, ...doc.data() } as WithId<Store>);
            setStoreName(doc.data().businessName || 'Το Κατάστημά μου');
        } else if (!storeManagerSnap.empty) {
            const doc = storeManagerSnap.docs[0];
            setStore({ id: doc.id, ...doc.data() } as WithId<Store>);
            setStoreName(doc.data().businessName || 'Το Κατάστημά μου');
        } else {
            setStoreName('Νέος Χρήστης');
        }
      };
      checkWholesalerAndGetStore();
    }
  }, [user, firestore, router]);

  // Fetch Inventory & Configs for Alerts
  const inventoryQuery = useMemoFirebase(() => {
      if (!firestore || !store || !user) return null;
      return query(collection(firestore, 'stores', store.id, 'inventories'));
  }, [firestore, store, user]);
  const { data: inventory } = useCollection<CustomerInventoryItem>(inventoryQuery);

  const configQuery = useMemoFirebase(() => {
      if (!firestore || !store || !user) return null;
      return query(collection(firestore, 'stores', store.id, 'productConfigurations'));
  }, [firestore, store, user]);
  const { data: configs } = useCollection<StoreProductConfiguration>(configQuery);

  // Fetch whistleblower products to get names
  const [allProducts, setAllProducts] = useState<Record<string, string>>({});
  useEffect(() => {
      if (!firestore || !store?.wholesalerIds?.[0]) return;
      const fetchProducts = async () => {
          const pSnap = await getDocs(collection(firestore, 'wholesalers', store.wholesalerIds[0], 'products'));
          const pMap: Record<string, string> = {};
          pSnap.forEach(d => { pMap[d.id] = d.data().name; });
          setAllProducts(pMap);
      };
      fetchProducts();
  }, [firestore, store]);

  const criticalItems = useMemo(() => {
      if (!inventory || !configs || Object.keys(allProducts).length === 0) return [];
      
      // ONLY use product IDs that exist in the wholesaler's real catalog.
      // This filters out phantom/stale entries from old seed data.
      const realProductIds = Object.keys(allProducts);

      const items = realProductIds.map(pid => {
          // Robust fetch for Ideal Stock: Doc ID > Field match
          const config = configs.find(c => c.id === pid) || configs.find(c => c.productId === pid);
          const ideal = config?.idealStock || 0;
          
          // Robust fetch for Current Stock: Doc ID > Field match
          const inv = inventory.find(i => i.id === pid) || inventory.find(i => i.productId === pid);
          const current = inv?.currentStock || 0;
          
          const ratio = ideal > 0 ? current / ideal : 1;
          
          return { 
              productId: pid, 
              name: allProducts[pid], 
              current, 
              ideal, 
              ratio 
          };
      });

      // Filter for items that have an ideal stock set and are below the critical threshold
      return items
          .filter(item => item.ideal > 0 && item.ratio < 0.4)
          .sort((a, b) => a.ratio - b.ratio);
  }, [inventory, configs, allProducts]);


  if (isUserLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
           <h1 className="font-headline text-3xl font-bold">Καλώς ήρθες, {storeName}</h1>
           <p className="text-muted-foreground italic text-sm">Πίνακας Ελέγχου Καταστήματος</p>
      </div>

      {criticalItems.length > 0 && (
          <div className="space-y-3">
              <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <h2 className="font-bold">Ελλείψεις Αποθέματος ({criticalItems.length})</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {criticalItems.slice(0, 3).map(item => (
                      <Card key={item.productId} className="bg-destructive/10 border-destructive/20 p-3 flex flex-col gap-1">
                          <div className="flex justify-between items-start">
                              <p className="font-bold text-sm truncate pr-2">{item.name}</p>
                              <span className="text-[10px] bg-destructive text-white px-1.5 py-0.5 rounded-full font-bold">CRITICAL</span>
                          </div>
                          <p className="text-xs text-muted-foreground">Απόθεμα: <span className="text-destructive font-bold">{item.current}</span> / {item.ideal}</p>
                          <Link href="/orders/new?suggested=true" className="text-[10px] text-destructive flex items-center gap-1 mt-1 font-bold hover:underline">
                              ΠΑΡΑΓΓΕΛΙΑ <ArrowRight className="h-3 w-3" />
                          </Link>
                      </Card>
                  ))}
                  {criticalItems.length > 3 && (
                      <Link href="/inventory" className="flex items-center justify-center p-4 border rounded-lg border-dashed text-sm text-muted-foreground hover:bg-muted/50 transition-colors">
                          Δείτε άλλες {criticalItems.length - 3} ελλείψεις...
                      </Link>
                  )}
              </div>
          </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {menuItems.map((item) => (
          <Link href={item.href} key={item.title}>
            <Card className="group h-full transform-gpu transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="font-headline text-lg font-medium">{item.title}</CardTitle>
                <item.icon className={`h-6 w-6 ${item.color} transition-transform group-hover:scale-110`} />
              </CardHeader>
              <div className="p-6 pt-0">
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
