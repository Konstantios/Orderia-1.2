'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { products as allProducts, customerInventory, customers, orderHistory } from '@/lib/data';
import type { OrderItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Minus, Plus, Lightbulb, Loader2, ArrowDown, ArrowUp } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PlaceHolderImages } from '@/lib/placeholder-images';

const customer = customers[0];
const customerProducts = allProducts.filter(p => customer.products.some(cp => cp.productId === p.id));
const supplierLogo = PlaceHolderImages.find(img => img.id === 'frozen-foods-logo')!;


export default function NewOrderPage() {
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuggestionModeActive, setIsSuggestionModeActive] = useState(false);
  const [preSuggestionOrderItems, setPreSuggestionOrderItems] = useState<OrderItem[]>([]);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const didMountNotes = useRef(false);
  const didMountOrderItems = useRef(false);

  // Load from localStorage on initial client render
  useEffect(() => {
    const savedNotes = localStorage.getItem('orderNotes');
    if (savedNotes) {
      setNotes(savedNotes);
    }
    const savedOrderItems = localStorage.getItem('orderItems');
    if (savedOrderItems) {
      try {
        const parsedItems = JSON.parse(savedOrderItems);
        if (Array.isArray(parsedItems)) {
          setOrderItems(parsedItems);
        }
      } catch (error) {
        console.error("Failed to parse order items from localStorage", error);
      }
    }
  }, []);

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
  
  const toggleSuggestionMode = useCallback(() => {
    if (isSuggestionModeActive) {
      // Deactivating suggestions
      setOrderItems(preSuggestionOrderItems);
      setIsSuggestionModeActive(false);
      toast({
        title: "Οι προτάσεις απενεργοποιήθηκαν",
        description: "Η παραγγελία σας επανήλθε στην προηγούμενη κατάστασή της.",
      });
    } else {
      // Activating suggestions
      setIsLoading(true);
      setTimeout(() => {
        try {
          setPreSuggestionOrderItems([...orderItems]); // Save current order

          const newOrderItems: OrderItem[] = customer.products
            .map(cp => {
              const inventory = customerInventory.find(i => i.productId === cp.productId);
              const currentStock = inventory?.currentStock || 0;
              const idealStock = cp.idealStock;
              const suggestedQuantity = Math.max(0, idealStock - currentStock);
              return { productId: cp.productId, quantity: suggestedQuantity };
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
        } finally {
          setIsLoading(false);
        }
      }, 300);
    }
  }, [isSuggestionModeActive, orderItems, preSuggestionOrderItems, toast]);
  
  useEffect(() => {
    const suggestedParam = searchParams.get('suggested');
    if (suggestedParam === 'true' && !isSuggestionModeActive && !isLoading && orderItems.length === 0) {
      toggleSuggestionMode();
    }
  }, [searchParams, isSuggestionModeActive, isLoading, orderItems.length, toggleSuggestionMode]);

  const handleSubmitOrder = () => {
    if (orderItems.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Κενή Παραγγελία',
        description: 'Παρακαλώ προσθέστε προϊόντα στην παραγγελία σας πριν την υποβολή.',
      });
      return;
    }
    toast({
      title: 'Η Παραγγελία Υποβλήθηκε!',
      description: 'Η παραγγελία σας υποβλήθηκε με επιτυχία.',
    });
    setOrderItems([]);
    setNotes('');
    setIsSuggestionModeActive(false);
    // Clear localStorage after submission
    localStorage.removeItem('orderNotes');
    localStorage.removeItem('orderItems');
    router.push('/dashboard');
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
  }, [orderItems]);

  const totalItems = useMemo(() => orderItems.reduce((sum, item) => sum + item.quantity, 0), [orderItems]);

  return (
    <div className="space-y-6">
      
      <div className="flex items-center gap-4">
        <Image src={supplierLogo.imageUrl} alt={customer.name} width={48} height={48} className="rounded-md" data-ai-hint={supplierLogo.imageHint} />
        <div>
          <p className="font-semibold">{customer.name}</p>
          <p className="text-sm text-muted-foreground">{customerProducts.length} Ενεργά Προϊόντα</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-headline text-3xl font-bold">Νέα Παραγγελία</h1>
        <Button 
          onClick={toggleSuggestionMode} 
          disabled={isLoading} 
          variant={isSuggestionModeActive ? 'default' : 'outline'}
          className={cn('sm:w-auto w-full', {
            "bg-primary hover:bg-primary/90 text-primary-foreground border-primary": isSuggestionModeActive,
            "border-primary text-primary bg-transparent hover:bg-primary/10": !isSuggestionModeActive,
          })}
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Lightbulb className="mr-2 h-4 w-4" />
          )}
          Έξυπνη Προτεινόμενη Παραγγελία
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Προϊόντα</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {customerProducts.map(product => (
              <div
                key={product.id}
                className={cn(
                  'flex flex-col gap-4 rounded-lg border p-4 transition-colors',
                  getQuantity(product.id) > 0 && 'border-primary',
                  isSuggestionModeActive && getQuantity(product.id) > 0 && 'bg-primary/10 border-2'
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="relative h-20 w-20 flex-shrink-0">
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        width={100}
                        height={100}
                        data-ai-hint={product.imageHint}
                        className="h-full w-full rounded-md object-cover"
                      />
                    </div>
                    <div>
                      <p className="font-semibold">{product.name}</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-sm text-muted-foreground">{product.code}</p>
                        {(() => {
                          const lastOrder = orderHistory.length > 0 ? orderHistory[0] : undefined;
                          const lastOrderItem = lastOrder?.items.find(
                            (item) => item.productId === product.id
                          );
                          const lastOrderQuantity = lastOrderItem?.quantity || 0;
                          const currentQuantity = getQuantity(product.id);

                          if (lastOrderQuantity === 0) {
                            return null;
                          }

                          let indicator = null;

                          if (currentQuantity > lastOrderQuantity) {
                            indicator = <ArrowUp className="h-3 w-3 text-green-400" />;
                          } else if (currentQuantity < lastOrderQuantity) {
                            indicator = <ArrowDown className="h-3 w-3 text-destructive" />;
                          } else if (currentQuantity > 0) { // same quantity and not zero
                            indicator = <Minus className="h-3 w-3 text-muted-foreground" />;
                          }

                          if (!indicator) return null;

                          return (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <span>(προηγ: {lastOrderQuantity})</span>
                              {indicator}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
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
