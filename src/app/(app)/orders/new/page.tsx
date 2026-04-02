'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { products as allProducts, customerInventory, customers } from '@/lib/data';
import type { OrderItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Minus, Plus, Lightbulb, Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

const customer = customers[0];
const customerProducts = allProducts.filter(p => customer.products.some(cp => cp.productId === p.id));

export default function NewOrderPage() {
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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
      localStorage.setItem('orderItems', JSON.stringify(orderItems));
    } else {
      didMountOrderItems.current = true;
    }
  }, [orderItems]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [notes]);

  const handleQuantityChange = (productId: string, newQuantity: number) => {
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

  const handleGetSuggestions = () => {
    setIsLoading(true);
    // Short delay to show loading state
    setTimeout(() => {
      try {
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
  };
  
  if (searchParams.get('suggested') && orderItems.length === 0 && !isLoading) {
    handleGetSuggestions();
  }

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
    // Clear localStorage after submission
    localStorage.removeItem('orderNotes');
    localStorage.removeItem('orderItems');
    router.push('/dashboard');
  };

  return (
    <div className="container mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-headline text-3xl font-bold">Νέα Παραγγελία</h1>
        <Button onClick={handleGetSuggestions} disabled={isLoading} className="bg-primary hover:bg-primary/90">
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
                  'flex flex-col items-start gap-4 rounded-lg border p-4 transition-colors sm:flex-row sm:items-center',
                  getQuantity(product.id) > 0 ? 'border-primary bg-primary/5' : ''
                )}
              >
                <div className="relative h-24 w-full flex-shrink-0 sm:h-20 sm:w-20">
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    width={100}
                    height={100}
                    data-ai-hint={product.imageHint}
                    className="h-full w-full rounded-md object-cover"
                  />
                </div>
                <div className="flex-grow">
                  <p className="font-semibold">{product.name}</p>
                  <p className="text-sm text-muted-foreground">{product.code}</p>
                </div>
                <div className="flex w-full items-center justify-end gap-3 sm:w-auto">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-full"
                    onClick={() => handleQuantityChange(product.id, getQuantity(product.id) - 1)}
                  >
                    <Minus className="h-5 w-5" />
                  </Button>
                  <Input
                    type="number"
                    className="h-12 w-20 text-center text-lg font-bold"
                    value={getQuantity(product.id)}
                    onChange={e => handleQuantityChange(product.id, parseInt(e.target.value) || 0)}
                    min="0"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-full"
                    onClick={() => handleQuantityChange(product.id, getQuantity(product.id) + 1)}
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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
