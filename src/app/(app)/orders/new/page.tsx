'use client';

import { useState, useRef, useEffect, useCallback, useMemo, Suspense } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { OrderItem, Store, CustomerInventoryItem, StoreProductConfiguration, Wholesaler, Product } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Minus, Plus, Lightbulb, Loader2, ArrowDown, ArrowUp, Package } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { products as allProducts } from '@/lib/data';
import { useFirebase, useCollection, useMemoFirebase, type WithId } from '@/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc } from 'firebase/firestore';

// Removed hardcoded customer/product constants

function getNextDeliveryDate(deliveryDay: string): Date {
    const dayMapping: { [key: string]: number } = {
        'Κυριακή': 0, 'Δευτέρα': 1, 'Τρίτη': 2, 'Τετάρτη': 3, 'Πέμπτη': 4, 'Παρασκευή': 5, 'Σάββατο': 6
    };
    const deliveryDayIndex = dayMapping[deliveryDay];

    if (typeof deliveryDayIndex === 'undefined') {
        // Fallback to next day if day is invalid
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow;
    }

    const today = new Date();
    const todayDayIndex = today.getDay();
    
    let dayDifference = deliveryDayIndex - todayDayIndex;
    
    // If the delivery day is today or has passed for this week, schedule for next week
    if (dayDifference <= 0) { 
        dayDifference += 7;
    }

    const deliveryDate = new Date();
    deliveryDate.setDate(today.getDate() + dayDifference);
    deliveryDate.setHours(12, 0, 0, 0); // Set a neutral time like noon
    return deliveryDate;
}


function NewOrderPageContent() {
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [notes, setNotes] = useState('');
  const [isCalculatingSuggestions, setIsCalculatingSuggestions] = useState(false);
  const [isSuggestionModeActive, setIsSuggestionModeActive] = useState(false);
  const [preSuggestionOrderItems, setPreSuggestionOrderItems] = useState<OrderItem[]>([]);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const { user, firestore } = useFirebase();
  const [activeCategory, setActiveCategory] = useState('All');

  const [store, setStore] = useState<WithId<Store> | null>(null);
  const [isLoadingStores, setIsLoadingStores] = useState(true);

  // Robustly fetch user's store
  useEffect(() => {
      if (!firestore || !user) {
          setIsLoadingStores(false);
          return;
      };

      const findStore = async () => {
          setIsLoadingStores(true);
          const storesRef = collection(firestore, 'stores');
          
          const ownerQuery = query(storesRef, where("ownerId", "==", user.uid));
          const managerQuery = query(storesRef, where("managerUids", "array-contains", user.uid));

          const [ownerSnap, managerSnap] = await Promise.all([
              getDocs(ownerQuery),
              getDocs(managerQuery)
          ]);

          let foundStore: WithId<Store> | null = null;
          if (!ownerSnap.empty) {
              const storeDoc = ownerSnap.docs[0];
              foundStore = { id: storeDoc.id, ...storeDoc.data() } as WithId<Store>;
          } else if (!managerSnap.empty) {
               const storeDoc = managerSnap.docs[0];
               foundStore = { id: storeDoc.id, ...storeDoc.data() } as WithId<Store>;
          }
          
          setStore(foundStore);
          setIsLoadingStores(false);
      }

      findStore();
  }, [user, firestore]);

  const inventoryQuery = useMemoFirebase(() => {
      if (!firestore || !store) return null;
      return collection(firestore, 'stores', store.id, 'inventories');
  }, [firestore, store]);
  const { data: inventory, isLoading: isLoadingInventory } = useCollection<CustomerInventoryItem>(inventoryQuery);

  const productConfigQuery = useMemoFirebase(() => {
      if (!firestore || !store) return null;
      return collection(firestore, 'stores', store.id, 'productConfigurations');
  }, [firestore, store]);
  const { data: productConfigs, isLoading: isLoadingProductConfigs } = useCollection<StoreProductConfiguration>(productConfigQuery);

  // --- NEW: Fetch Connected Wholesaler ---
  const connectionsQuery = useMemoFirebase(() => {
      if (!firestore || !store) return null;
      return query(collection(firestore, 'supplierStoreConnections'), where('storeId', '==', store.id), where('isActive', '==', true));
  }, [firestore, store]);
  const { data: connections, isLoading: isLoadingConnections } = useCollection<WithId<any>>(connectionsQuery);

  const wholesalerId = connections?.[0]?.wholesalerId;

  const wholesalerProductsQuery = useMemoFirebase(() => {
      if (!firestore || !wholesalerId) return null;
      return collection(firestore, 'wholesalers', wholesalerId, 'products');
  }, [firestore, wholesalerId]);
  const { data: wholesalerProducts, isLoading: isLoadingProducts } = useCollection<Product>(wholesalerProductsQuery);

  const customerProducts = useMemo(() => {
      // Use Firestore products if available and not empty, otherwise fallback to demo products
      const list = (wholesalerProducts && wholesalerProducts.length > 0) 
        ? wholesalerProducts 
        : (isLoadingProducts ? [] : allProducts);
      
      // Only show products that are assigned to this store (have a config)
      const assignedIds = new Set(productConfigs?.map(c => c.productId) || []);
      
      let filtered = list;
      if (assignedIds.size > 0) {
          filtered = filtered.filter(p => assignedIds.has(p.id));
      }

      if (activeCategory === 'All') return filtered;
      return filtered.filter(p => p.category === activeCategory);
  }, [wholesalerProducts, isLoadingProducts, activeCategory, productConfigs]);

  const categories = useMemo(() => {
      const list = (wholesalerProducts && wholesalerProducts.length > 0) 
        ? wholesalerProducts 
        : (isLoadingProducts ? ['All'] : allProducts);

      const assignedIds = new Set(productConfigs?.map(c => c.productId) || []);
      const visibleProducts = assignedIds.size > 0 
          ? list.filter(p => assignedIds.has(p.id))
          : list;
          
      const cats = new Set(visibleProducts.map(p => p.category).filter(Boolean));
      return ['All', ...Array.from(cats)];
  }, [wholesalerProducts, isLoadingProducts, productConfigs]);

  const wholesalerListQuery = useMemoFirebase(() => {
    if (!firestore || !wholesalerId) return null;
    return query(collection(firestore, 'wholesalers'), where('__name__', '==', wholesalerId));
  }, [firestore, wholesalerId]);
  const { data: wholesalers } = useCollection<Wholesaler>(wholesalerListQuery);
  const wholesaler = wholesalers?.[0];

  const supplierLogo = wholesaler?.logoUrl ? { imageUrl: wholesaler.logoUrl, imageHint: 'Wholesaler logo' } : PlaceHolderImages.find(img => img.id === 'frozen-foods-logo')!;


  const didMountNotes = useRef(false);
  const didMountOrderItems = useRef(false);

  // Load from localStorage on initial client render
  useEffect(() => {
    const handleLoad = () => {
      const isReorder = searchParams.get('reorder') === 'true';
      const isSuggested = searchParams.get('suggested') === 'true';

      if (isReorder || isSuggested) {
        // Only load from localStorage if explicitly reordering or suggested
        const savedNotes = localStorage.getItem('orderNotes');
        if (savedNotes) setNotes(savedNotes);
        
        const savedOrderItems = localStorage.getItem('orderItems');
        if (savedOrderItems) {
          try {
            const parsedItems = JSON.parse(savedOrderItems);
            if (Array.isArray(parsedItems)) setOrderItems(parsedItems);
          } catch (error) {
            console.error("Failed to parse order", error);
          }
        }
      } else {
        // Fresh navigation: Zero everything out
        setOrderItems([]);
        setNotes('');
        localStorage.removeItem('orderItems');
        localStorage.removeItem('orderNotes');
      }
    };

    handleLoad();
  }, [searchParams]);

  // Save notes to localStorage when they change, skipping the initial mount.
  useEffect(() => {
    if (didMountNotes.current) {
      localStorage.setItem('orderNotes', notes);
    } else {
      didMountNotes.current = true;
    }
  }, [notes]);

  // Save order items to localStorage when they change, skipping the initial mount.
  useEffect(() => {
    if (didMountOrderItems.current) {
      // Don't save suggested items to localStorage to avoid confusion on page reload
      if (!isSuggestionModeActive) {
        localStorage.setItem('orderItems', JSON.stringify(orderItems));
      }
    } else {
      didMountOrderItems.current = true;
    }
  }, [orderItems, isSuggestionModeActive]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [notes]);

  const handleQuantityChange = (productId: string, newQuantity: number) => {
    if (isSuggestionModeActive) {
      toast({
        title: 'Η λειτουργία προτάσεων είναι ενεργή',
        description: 'Απενεργοποιήστε τις προτάσεις για να αλλάξετε τις ποσότητες.',
      });
      return;
    }
    const updatedQuantity = Math.max(0, newQuantity);
    setOrderItems(prevItems => {
      const existingItem = prevItems.find(item => item.productId === productId);
      if (existingItem) {
        if (updatedQuantity === 0) {
          return prevItems.filter(item => item.productId !== productId);
        }
        return prevItems.map(item =>
          item.productId === productId ? { ...item, quantity: updatedQuantity } : item
        );
      }
      if (updatedQuantity > 0) {
        return [...prevItems, { productId, quantity: updatedQuantity }];
      }
      return prevItems;
    });
  };

  const getQuantity = (productId: string) => {
    return orderItems.find(item => item.productId === productId)?.quantity || 0;
  };
  
  const isDataLoading = isLoadingStores || isLoadingInventory || isLoadingProductConfigs;

  // Robust data fetching helper to ensure consistency between UI and Logic
  const getStockData = useCallback((productId: string) => {
      const invItemDoc = inventory?.find(i => i.id === productId);
      const invItemField = inventory?.find(i => i.productId === productId);
      const inventoryItem = invItemDoc || invItemField;
      const currentStock = inventoryItem?.currentStock || 0;

      const configDoc = productConfigs?.find(pc => pc.id === productId);
      const configField = productConfigs?.find(pc => pc.productId === productId);
      const configItem = configDoc || configField;
      const idealStock = configItem?.idealStock || 0;

      const suggestion = Math.max(0, idealStock - currentStock);
      const ratio = idealStock > 0 ? currentStock / idealStock : (currentStock > 0 ? 1 : 0);

      return { currentStock, idealStock, suggestion, ratio };
  }, [inventory, productConfigs]);

  const toggleSuggestionMode = useCallback(() => {
    if (isSuggestionModeActive) {
      // Deactivating suggestions: Zero everything out as per user request
      setOrderItems([]);
      setIsSuggestionModeActive(false);
      toast({
        title: "Οι προτάσεις απενεργοποιήθηκαν",
        description: "Η παραγγελία μηδενίστηκε.",
      });
    } else {
      // Activating suggestions
      if (isDataLoading) {
          toast({ title: 'Παρακαλώ περιμένετε', description: 'Φόρτωση δεδομένων αποθέματος...' });
          return;
      }
      
      try {
        setPreSuggestionOrderItems([...orderItems]); // Save current order

        const newOrderItems: OrderItem[] = customerProducts
          .map(product => {
            const { suggestion } = getStockData(product.id);
            return { productId: product.id, quantity: suggestion };
          })
          .filter(item => item.quantity > 0);
          
        setOrderItems(newOrderItems);
        setIsSuggestionModeActive(true);
        
        toast({
          title: "Οι Προτάσεις Εφαρμόστηκαν",
          description: "Συμπληρώσαμε την παραγγελία με βάση τα ιδανικά επίπεδα αποθέματός σας.",
        });
      } catch (error) {
        console.error(error);
        toast({
          variant: "destructive",
          title: "Σφάλμα",
          description: "Δεν ήταν δυνατή η δημιουργία προτάσεων.",
        });
      }
    }
  }, [isSuggestionModeActive, orderItems, preSuggestionOrderItems, toast, customerProducts, getStockData, isDataLoading]);
  
  useEffect(() => {
    const suggestedParam = searchParams.get('suggested');
    if (suggestedParam === 'true' && !isSuggestionModeActive && !isCalculatingSuggestions && !isDataLoading && orderItems.length === 0) {
      toggleSuggestionMode();
    }
  }, [searchParams, isSuggestionModeActive, isCalculatingSuggestions, isDataLoading, orderItems.length, toggleSuggestionMode]);

  const handleSubmitOrder = async () => {
    if (!firestore || !user || !store) {
        toast({ variant: "destructive", title: "Σφάλμα", description: "Δεν είναι δυνατή η υποβολή, ο χρήστης ή το κατάστημα δεν βρέθηκε." });
        return;
    }
    if (orderItems.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Κενή Παραγγελία',
        description: 'Παρακαλώ προσθέστε προϊόντα στην παραγγελία σας πριν την υποβολή.',
      });
      return;
    }

    try {
        if (!wholesaler) {
            toast({ variant: "destructive", title: "Σφάλμα", description: "Δεν βρέθηκε ο προμηθευτής." });
            return;
        }
        
        const storeMembers = store.managerUids || [store.ownerId];
        const wholesalerMembers = wholesaler.adminUids || [wholesaler.ownerId];
        const memberUids = Array.from(new Set([...storeMembers, ...wholesalerMembers]));

        // Calculate the next delivery date
        const deliveryDate = getNextDeliveryDate(store.deliveryDay);

        // Construct the new order object with all necessary fields
        const newOrderData = {
            storeId: store.id,
            customerName: store.businessName,
            wholesalerId: wholesaler.id,
            date: serverTimestamp(),
            deliveryDate: deliveryDate,
            status: 'Εκκρεμής',
            notes: notes || '',
            items: orderItems,
            memberUids: memberUids,
        };
        
        await addDoc(collection(firestore, "orders"), newOrderData);
        
        toast({
          title: 'Η Παραγγελία Υποβλήθηκε!',
          description: 'Η παραγγελία σας υποβλήθηκε με επιτυχία.',
        });

        // Reset state and clear storage
        setOrderItems([]);
        setNotes('');
        setIsSuggestionModeActive(false);
        localStorage.removeItem('orderNotes');
        localStorage.removeItem('orderItems');
        router.push('/dashboard');

    } catch (error) {
        console.error("Error submitting order: ", error);
        toast({
            variant: "destructive",
            title: "Σφάλμα Υποβολής",
            description: "Δεν ήταν δυνατή η υποβολή της παραγγελίας. Ελέγξτε τους κανόνες ασφαλείας.",
        });
    }
  };

  const orderTotals = useMemo(() => {
    return orderItems.reduce((acc, item) => {
        const product = customerProducts.find(p => p.id === item.productId);
        if (product) {
            if (!acc[product.unit]) {
                acc[product.unit] = 0;
            }
            acc[product.unit] += item.quantity;
        }
        return acc;
    }, {} as Record<'κιβώτιο' | 'κιλό' | 'τεμάχιο', number>);
  }, [orderItems, customerProducts]);

  const totalItems = useMemo(() => orderItems.reduce((sum, item) => sum + item.quantity, 0), [orderItems]);

  return (
    <div className="space-y-6">
      
      <div className="flex items-center gap-4">
        {supplierLogo && <Image src={supplierLogo.imageUrl} alt={wholesaler?.companyName || 'Supplier'} width={48} height={48} className="rounded-md" data-ai-hint={(supplierLogo as any).imageHint} />}
        <div>
          <p className="font-semibold">{wholesaler?.companyName || 'Φόρτωση...'}</p>
          <p className="text-sm text-muted-foreground">{customerProducts.length} Ενεργά Προϊόντα</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-headline text-3xl font-bold">Νέα Παραγγελία</h1>
        <Button 
          onClick={toggleSuggestionMode} 
          disabled={isCalculatingSuggestions} 
          variant={isSuggestionModeActive ? 'default' : 'outline'}
          className={cn('sm:w-auto w-full', {
            "bg-primary hover:bg-primary/90 text-primary-foreground border-primary": isSuggestionModeActive,
            "border-primary text-primary bg-transparent hover:bg-primary/10": !isSuggestionModeActive,
          })}
        >
          {isCalculatingSuggestions ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Lightbulb className="mr-2 h-4 w-4" />
          )}
          Έξυπνη Προτεινόμενη Παραγγελία
        </Button>
      </div>

      <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-none">
        {categories.map(category => (
          <Button
            key={category}
            variant={activeCategory === category ? 'default' : 'secondary'}
            size="sm"
            onClick={() => setActiveCategory(category)}
            className="whitespace-nowrap"
          >
            {category}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Προϊόντα</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isLoadingProducts ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : customerProducts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Δεν βρέθηκαν διαθέσιμα προϊόντα.
              </div>
            ) : customerProducts.map(product => (
              <div
                key={product.id}
                className={cn(
                  'flex flex-col gap-3 rounded-lg border p-3 transition-colors',
                  getQuantity(product.id) > 0 && 'border-primary',
                  isSuggestionModeActive && getQuantity(product.id) > 0 && 'bg-primary/10 border-2'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="relative h-16 w-16 flex-shrink-0 bg-muted/30 rounded-md overflow-hidden flex items-center justify-center">
                    {product.imageUrl ? (
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        width={80}
                        height={80}
                        data-ai-hint={product.imageHint}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Package className="h-7 w-7 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm leading-tight">{product.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{product.code}</p>
                    {(() => {
                      const { currentStock, idealStock, suggestion, ratio: stockRatio } = getStockData(product.id);

                      const stockColor = idealStock === 0 ? 'bg-muted text-muted-foreground' 
                        : stockRatio >= 0.8 ? 'bg-green-500/15 text-green-400' 
                        : stockRatio >= 0.4 ? 'bg-yellow-500/15 text-yellow-400' 
                        : 'bg-destructive/15 text-destructive';

                      return (
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span className={cn('text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full', stockColor)}>
                            Απόθ: {currentStock}
                          </span>
                          {idealStock > 0 && (
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                              Ιδαν: {idealStock}
                            </span>
                          )}
                          {suggestion > 0 && (
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-accent/20 text-accent">
                              +{suggestion} πρόταση
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
                
                <div className="flex items-center justify-end gap-3 flex-grow sm:flex-grow-0 ml-auto">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-full"
                    onClick={() => handleQuantityChange(product.id, getQuantity(product.id) - 1)}
                    disabled={isSuggestionModeActive}
                  >
                    <Minus className="h-5 w-5" />
                  </Button>
                  <Input
                    type="number"
                    className="h-12 w-20 text-center text-lg font-bold"
                    value={getQuantity(product.id)}
                    onChange={e => handleQuantityChange(product.id, parseInt(e.target.value) || 0)}
                    min="0"
                    readOnly={isSuggestionModeActive}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-full"
                    onClick={() => handleQuantityChange(product.id, getQuantity(product.id) + 1)}
                    disabled={isSuggestionModeActive}
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {totalItems > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Σύνολο Παραγγελίας</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(orderTotals).map(([unit, total]) => {
              if (total <= 0) return null;
              
              const unitText = {
                'κιβώτιο': 'κιβώτια',
                'κιλό': 'κιλά',
                'τεμάχιο': 'τεμάχια'
              }[unit] || unit;

              return (
                <div key={unit} className="flex justify-between items-center text-lg">
                  <span>Σύνολο σε {unitText}:</span>
                  <span className="font-bold text-xl">{total}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Σημειώσεις</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            ref={textareaRef}
            placeholder="π.χ. παράδοση πριν τις 08:00..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="resize-none"
          />
        </CardContent>
      </Card>
      
      <div className="flex justify-end">
        <Button onClick={handleSubmitOrder} size="lg" className="h-14 bg-accent text-accent-foreground text-xl font-bold hover:bg-accent/90">
          Υποβολή Παραγγελίας
        </Button>
      </div>
    </div>
  );
}

export default function NewOrderPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <NewOrderPageContent />
    </Suspense>
  );
}
