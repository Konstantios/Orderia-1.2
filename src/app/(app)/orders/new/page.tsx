'use client';

import { useState } from 'react';
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
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

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
          title: "Suggestions Applied",
          description: "We've filled out the order based on your ideal stock levels.",
        });

      } catch (error) {
        console.error(error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not generate suggestions.",
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
        title: 'Empty Order',
        description: 'Please add items to your order before submitting.',
      });
      return;
    }
    toast({
      title: 'Order Placed!',
      description: 'Your order has been successfully submitted.',
    });
    setOrderItems([]);
    setNotes('');
    router.push('/dashboard');
  };

  return (
    <div className="container mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-headline text-3xl font-bold">New Order</h1>
        <Button onClick={handleGetSuggestions} disabled={isLoading} className="bg-primary hover:bg-primary/90">
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Lightbulb className="mr-2 h-4 w-4" />
          )}
          Smart Suggested Order
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
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
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="e.g. deliver before 08:00..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </CardContent>
      </Card>
      
      <div className="flex justify-end">
        <Button onClick={handleSubmitOrder} size="lg" className="h-14 bg-accent text-accent-foreground text-xl font-bold hover:bg-accent/90">
          Submit Order
        </Button>
      </div>
    </div>
  );
}
