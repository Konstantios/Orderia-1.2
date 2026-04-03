'use client';

import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { products as allProducts, wholesalerStock as initialWholesalerStock } from '@/lib/data';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { AdminWarehouseCounting } from './counting';
import { AdminWarehouseDatabase } from './database';
import { AdminWarehouseEntry } from './entry';
import { AdminWarehouseExit } from './exit';

export default function AdminWarehousePage() {
    const [stock, setStock] = useState(initialWholesalerStock);
    const { toast } = useToast();

    const handleSync = (scannedItems: Record<string, number>, type: 'counting' | 'in' | 'out') => {
        if (Object.keys(scannedItems).length === 0) {
            toast({
                variant: 'destructive',
                title: 'Δεν υπάρχουν δεδομένα',
                description: 'Παρακαλώ σκανάρετε κάποια προϊόντα πρώτα.',
            });
            return;
        }

        setStock(prevStock => {
            const stockMap = new Map(prevStock.map(item => [item.productId, item.quantity]));

            for (const [productId, count] of Object.entries(scannedItems)) {
                const currentStock = stockMap.get(productId) || 0;
                let newStock = currentStock;

                if (type === 'counting') {
                    newStock = count;
                } else if (type === 'in') {
                    newStock = currentStock + count;
                } else if (type === 'out') {
                    newStock = Math.max(0, currentStock - count);
                }
                stockMap.set(productId, newStock);
            }
            
            return Array.from(stockMap.entries()).map(([productId, quantity]) => ({ productId, quantity }));
        });

        const title = {
            'counting': 'Συγχρονισμός Ολοκληρώθηκε!',
            'in': 'Η Είσοδος Ολοκληρώθηκε!',
            'out': 'Η Έξοδος Ολοκληρώθηκε!'
        }[type];
        
        toast({
            title: title,
            description: 'Το απόθεμα αποθήκης ενημερώθηκε.',
        });
    };

    const getStockData = (productId: string) => {
        const product = allProducts.find(p => p.id === productId)!;
        const stockItem = stock.find(i => i.productId === productId);
        const currentStock = stockItem?.quantity || 0;
        return { product, currentStock };
    };

    return (
        <div className="space-y-6">
            <h1 className="font-headline text-3xl font-bold">Αποθήκη</h1>
            <Tabs defaultValue="stock" className="w-full">
                <div className="flex justify-center">
                    <TabsList className="flex-wrap h-auto">
                        <TabsTrigger value="stock">Απόθεμα</TabsTrigger>
                        <TabsTrigger value="counting">Καταμέτρηση</TabsTrigger>
                        <TabsTrigger value="in">Είσοδος</TabsTrigger>
                        <TabsTrigger value="out">Έξοδος</TabsTrigger>
                        <TabsTrigger value="database">Βάση Σάρωσης</TabsTrigger>
                    </TabsList>
                </div>
                <TabsContent value="stock" className="mt-6">
                    <div className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Απόθεμα Αποθήκης</CardTitle>
                                <CardDescription>Επισκόπηση του αποθέματος για όλα τα προϊόντα.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {allProducts.map(product => {
                                    const { currentStock } = getStockData(product.id);
                                    return (
                                        <Card key={product.id} className="overflow-hidden bg-card/50">
                                            <CardContent className="p-4">
                                                <div className="flex items-center gap-4">
                                                    <Image src={product.imageUrl} alt={product.name} width={64} height={64} className="rounded-lg object-cover" data-ai-hint={product.imageHint} />
                                                    <div className="flex-1">
                                                        <p className="font-semibold">{product.name}</p>
                                                        <p className="text-sm text-muted-foreground">{product.code}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs font-semibold uppercase text-muted-foreground">ΑΠΟΘΕΜΑ</p>
                                                        <p className="text-2xl font-bold">{currentStock}</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
                <TabsContent value="counting" className="mt-6">
                    <AdminWarehouseCounting products={allProducts} stock={stock} onSync={(items) => handleSync(items, 'counting')} />
                </TabsContent>
                <TabsContent value="in" className="mt-6">
                    <AdminWarehouseEntry products={allProducts} stock={stock} onSync={(items) => handleSync(items, 'in')} />
                </TabsContent>
                 <TabsContent value="out" className="mt-6">
                    <AdminWarehouseExit products={allProducts} stock={stock} onSync={(items) => handleSync(items, 'out')} />
                </TabsContent>
                <TabsContent value="database" className="mt-6">
                    <AdminWarehouseDatabase products={allProducts} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
