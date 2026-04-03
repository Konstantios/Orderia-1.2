'use client';

import Image from 'next/image';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { products as allProducts, customerInventory as initialInventory, customers } from '@/lib/data';
import { cn } from '@/lib/utils';
import { Star } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { InventoryCounting } from './counting';
import { InventoryDatabase } from './database';
import { Separator } from '@/components/ui/separator';
import { useState } from 'react';
import { Input } from '@/components/ui/input';


const getStockColor = (current: number, ideal: number) => {
    if (ideal === 0) return 'bg-muted/50 border-transparent';
    const ratio = current / ideal;
    if (ratio > 5 / 6) {
      return 'bg-green-400/10 border-green-400/50 text-green-400';
    }
    if (ratio <= 1 / 3) {
      return 'bg-destructive/20 border-destructive/50 text-destructive';
    }
    if (ratio <= 1 / 2) {
      return 'bg-yellow-400/10 border-yellow-400/50 text-yellow-400';
    }
    return 'bg-muted/50 border-transparent';
};

export default function InventoryPage() {
    const [supplier, setSupplier] = useState(customers[0]);
    const supplierLogo = PlaceHolderImages.find(img => img.id === 'frozen-foods-logo')!;
    const inventoryProducts = allProducts.filter(p => supplier.products.some(cp => cp.productId === p.id));

    const getProductData = (productId: string) => {
        const product = inventoryProducts.find(p => p.id === productId)!;
        const idealStock = supplier.products.find(cp => cp.productId === productId)?.idealStock || 0;
        const inventoryItem = initialInventory.find(i => i.productId === productId);
        const currentStock = inventoryItem?.currentStock || 0;
        const lastAction = inventoryItem?.lastAction;
        const suggestion = Math.max(0, idealStock - currentStock);
        return { product, idealStock, currentStock, suggestion, lastAction };
    };
    
    const handleIdealStockChange = (productId: string, value: string) => {
        const newIdealStock = parseInt(value, 10);
        const stockValue = Math.max(0, isNaN(newIdealStock) ? 0 : newIdealStock);
        
        setSupplier(prevSupplier => {
            const updatedProducts = prevSupplier.products.map(p => 
                p.productId === productId ? { ...p, idealStock: stockValue } : p
            );
            return { ...prevSupplier, products: updatedProducts };
        });
    };

    return (
        <div className="space-y-6">
            <h1 className="font-headline text-3xl font-bold">Αποθήκη</h1>
            <Tabs defaultValue="stock" className="w-full">
                <div className="flex justify-center">
                    <TabsList className="flex-wrap h-auto">
                        <TabsTrigger value="stock">Απόθεμα</TabsTrigger>
                        <TabsTrigger value="counting">Καταμέτρηση</TabsTrigger>
                        <TabsTrigger value="in" disabled>Είσοδος</TabsTrigger>
                        <TabsTrigger value="out" disabled>Έξοδος</TabsTrigger>
                        <TabsTrigger value="database">Βάση Σάρωσης</TabsTrigger>
                    </TabsList>
                </div>
                <TabsContent value="stock" className="mt-6">
                    <div className="space-y-4">
                        <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">Προμηθευτες</h2>
                        <Accordion type="single" collapsible defaultValue="item-1" className="w-full">
                            <AccordionItem value="item-1" className="border-none">
                                <Card className="rounded-lg">
                                  <AccordionTrigger className="flex w-full items-center justify-between p-3 hover:no-underline">
                                      <div className="flex items-center gap-4 text-left">
                                          <Image src={supplierLogo.imageUrl} alt={supplier.name} width={48} height={48} className="rounded-md" data-ai-hint={supplierLogo.imageHint} />
                                          <div>
                                              <div className="flex items-center gap-2">
                                                  <p className="font-semibold">{supplier.name}</p>
                                                  <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                                              </div>
                                              <p className="text-sm text-muted-foreground">{supplier.products.length} Ενεργά Προϊόντα</p>
                                          </div>
                                      </div>
                                  </AccordionTrigger>
                                </Card>
                                <AccordionContent className="p-0">
                                    <div className="space-y-4 pt-4">
                                        <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">Λιστα προϊοντων</h2>
                                        {inventoryProducts.map(({ id }) => {
                                            const { product, idealStock, currentStock, suggestion, lastAction } = getProductData(id);
                                            if (!product) return null;

                                            const lastActionInfo = lastAction ? {
                                                'είσοδος': { text: 'Είσοδος', color: 'text-green-500' },
                                                'έξοδος': { text: 'Έξοδος', color: 'text-destructive' },
                                                'καταμέτρηση': { text: 'Καταμέτρηση', color: 'text-yellow-500' }
                                            }[lastAction.type] : null;

                                            return (
                                                <Card key={id} className="overflow-hidden bg-card">
                                                    <CardContent className="p-4">
                                                        <div className="flex items-center gap-4">
                                                            <Image src={product.imageUrl} alt={product.name} width={64} height={64} className="rounded-lg object-cover" data-ai-hint={product.imageHint} />
                                                            <div className="flex-1">
                                                                <p className="font-semibold">{product.name}</p>
                                                                <p className="text-sm text-muted-foreground">{product.code}</p>
                                                            </div>
                                                        </div>
                                                        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                                                            <div className={cn('rounded-lg border p-2', getStockColor(currentStock, idealStock))}>
                                                                <p className="text-xs font-semibold uppercase">ΑΠΟΘΕΜΑ</p>
                                                                <p className="text-2xl font-bold">{currentStock}</p>
                                                            </div>
                                                            <div className="rounded-lg bg-muted/30 p-2 flex flex-col justify-center">
                                                                <p className="text-xs font-semibold uppercase text-muted-foreground">ΙΔΑΝΙΚΟ</p>
                                                                <Input
                                                                    type="number"
                                                                    value={idealStock}
                                                                    onChange={(e) => handleIdealStockChange(product.id, e.target.value)}
                                                                    className="w-full h-auto p-0 text-2xl font-bold text-center bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                                                                    min="0"
                                                                />
                                                            </div>
                                                            <div className="rounded-lg bg-muted/30 p-2">
                                                                <p className="text-xs font-semibold uppercase text-muted-foreground">ΠΡΟΤΑΣΗ</p>
                                                                <p className="text-2xl font-bold text-accent">+{suggestion}</p>
                                                            </div>
                                                        </div>
                                                        {lastAction && lastActionInfo && (
                                                            <>
                                                                <Separator className="my-3" />
                                                                <div className={cn("flex items-center justify-center gap-2 text-xs font-medium", lastActionInfo.color)}>
                                                                    <span>Προηγ. ενέργεια:</span>
                                                                    <span className="font-bold">{lastActionInfo.text} {lastAction.value}</span>
                                                                </div>
                                                            </>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </div>
                </TabsContent>
                <TabsContent value="counting" className="mt-6">
                    <InventoryCounting products={inventoryProducts} customer={supplier} />
                </TabsContent>
                <TabsContent value="database" className="mt-6">
                    <InventoryDatabase products={inventoryProducts} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
