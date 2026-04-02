'use client';

import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { orderHistory, products } from '@/lib/data';
import { History } from 'lucide-react';

export default function OrderHistoryPage() {
  const { toast } = useToast();
  const router = useRouter();

  const handleReorder = (orderId: string) => {
    toast({
      title: `Επανάληψη Παραγγελίας #${orderId}`,
      description: 'Τα προϊόντα προστέθηκαν στη νέα σας παραγγελία.',
    });
    // In a real app, this would populate the new order page with items from the selected order
    router.push('/orders/new');
  };
  
  return (
    <div className="container mx-auto max-w-4xl space-y-6">
       <h1 className="font-headline text-3xl font-bold">Ιστορικό Παραγγελιών</h1>
      <div className="space-y-6">
        {orderHistory.map(order => (
          <Card key={order.id} className="overflow-hidden">
            <CardHeader className="flex-row items-center justify-between bg-muted/30">
              <div>
                <CardTitle className="text-lg">Παραγγελία #{order.id}</CardTitle>
                <CardDescription>{new Date(order.date).toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</CardDescription>
              </div>
              <Badge variant={order.status === 'Ολοκληρωμένη' ? 'secondary' : 'default'}>{order.status}</Badge>
            </CardHeader>
            <CardContent className="p-6">
              <ul className="space-y-3">
                {order.items.map(item => {
                  const product = products.find(p => p.id === item.productId);
                  return (
                    <li key={item.productId} className="flex justify-between items-center">
                      <span className="font-medium">{product?.name || 'Unknown Product'}</span>
                      <span className="text-muted-foreground">x {item.quantity}</span>
                    </li>
                  );
                })}
              </ul>
              {order.notes && (
                <>
                  <Separator className="my-4" />
                  <p className="text-sm text-muted-foreground">
                    <strong>Σημειώσεις:</strong> {order.notes}
                  </p>
                </>
              )}
            </CardContent>
            <CardFooter className="bg-muted/30 justify-end">
              <Button onClick={() => handleReorder(order.id)}>
                <History className="mr-2 h-4 w-4" />
                Επανάληψη Παραγγελίας
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
