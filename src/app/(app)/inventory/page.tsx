'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { customerInventory as initialInventory, products, customers } from '@/lib/data';
import type { CustomerInventoryItem } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ScanLine } from 'lucide-react';
import { useRouter } from 'next/navigation';

const customer = customers[0];
const customerProducts = products.filter(p => customer.products.some(cp => cp.productId === p.id));

export default function InventoryPage() {
  const [inventory, setInventory] = useState<CustomerInventoryItem[]>(initialInventory);
  const { toast } = useToast();
  const router = useRouter();

  const handleStockChange = (productId: string, newStock: number) => {
    const updatedStock = Math.max(0, newStock);
    setInventory(prev => {
      const existing = prev.find(item => item.productId === productId);
      if (existing) {
        return prev.map(item =>
          item.productId === productId ? { ...item, currentStock: updatedStock } : item
        );
      }
      return [...prev, { productId, currentStock: updatedStock }];
    });
  };

  const getProductData = (productId: string) => {
    const product = customerProducts.find(p => p.id === productId)!;
    const idealStock = customer.products.find(cp => cp.productId === productId)?.idealStock || 0;
    const currentStock = inventory.find(i => i.productId === productId)?.currentStock || 0;
    const suggestion = Math.max(0, idealStock - currentStock);
    return { product, idealStock, currentStock, suggestion };
  };

  const handleScan = (productId: string) => {
    handleStockChange(productId, getProductData(productId).currentStock + 1);
    toast({
      title: `Σαρώθηκε: ${getProductData(productId).product.name}`,
      description: `Το απόθεμα είναι τώρα ${getProductData(productId).currentStock + 1}.`,
    });
  };

  const handleSaveInventory = () => {
    // Here you would save the inventory to your backend
    toast({
      title: 'Η Απογραφή Αποθηκεύτηκε',
      description: 'Τα επίπεδα αποθέματός σας έχουν ενημερωθεί.',
    });
  };
  
  const handleCreateOrder = () => {
    router.push('/orders/new?suggested=true');
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-headline text-3xl font-bold">Απογραφή Αποθήκης</h1>
          <p className="text-muted-foreground">Ενημερώστε το απόθεμά σας για να λάβετε έξυπνες προτάσεις παραγγελιών.</p>
        </div>
        <div className="flex gap-2">
            <Button onClick={handleSaveInventory} variant="outline">Αποθήκευση Απογραφής</Button>
            <Button onClick={handleCreateOrder}>Δημιουργία Παραγγελίας από Προτάσεις</Button>
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Προϊόν</TableHead>
                <TableHead className="text-center">Τρέχον Απόθεμα</TableHead>
                <TableHead className="text-center">Ιδανικό Απόθεμα</TableHead>
                <TableHead className="text-center text-primary font-semibold">Πρόταση</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customerProducts.map(p => {
                const { product, idealStock, currentStock, suggestion } = getProductData(p.id);
                return (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="text-center w-48">
                      <div className="flex items-center justify-center gap-2">
                        <Input
                          type="number"
                          value={currentStock}
                          onChange={(e) => handleStockChange(product.id, parseInt(e.target.value) || 0)}
                          className="w-20 text-center"
                        />
                        <Button variant="ghost" size="icon" onClick={() => handleScan(product.id)}>
                          <ScanLine className="h-5 w-5" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-medium">{idealStock}</TableCell>
                    <TableCell className="text-center font-bold text-primary text-lg">{suggestion}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
