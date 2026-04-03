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
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import type { WholesalerStockItem } from '@/lib/types';

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

export default function AdminWarehousePage() {
    const [stock, setStock] = useState<WholesalerStockItem[]>(initialWholesalerStock);
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
            const stockMap = new Map(prevStock.map(item => [item.productId, item]));

            for (const [productId, count] of Object.entries(scannedItems)) {
                const existingItem = stockMap.get(productId) || { productId, quantity: 0, idealStock: 0 };
                let newStockValue = existingItem.quantity;
                let lastActionType: 'καταμέτρηση' | 'είσοδος' | 'έξοδος' | undefined = undefined;

                if (type === 'counting') {
                    newStockValue = count;
                    lastActionType = 'καταμέτρηση';
                } else if (type === 'in') {
                    newStockValue = existingItem.quantity + count;
                    lastActionType = 'είσοδος';
                } else if (type === 'out') {
                    newStockValue = Math.max(0, existingItem.quantity - count);
                    lastActionType = 'έξοδος';
                }
                
                stockMap.set(productId, {
                    ...existingItem,
                    quantity: newStockValue,
                    lastAction: lastActionType ? { type: lastActionType, value: count } : existingItem.lastAction,
                });
            }
            
            return Array.from(stockMap.values());
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

    const handleIdealStockChange = (productId: string, value: string) => {
        const newIdealStock = parseInt(value, 10);
        const stockValue = Math.max(0, isNaN(newIdealStock) ? 0 : newIdealStock);
        
        setStock(prevStock => {
            return prevStock.map(item => 
                item.productId === productId ? { ...item, idealStock: stockValue } : item
            );
        });
    };

    const getStockData = (productId: string) => {
        const product = allProducts.find(p => p.id === productId)!;
        const stockItem = stock.find(i => i.productId === productId);
        const currentStock = stockItem?.quantity || 0;
        const idealStock = stockItem?.idealStock || 0;
        const suggestion = Math.max(0, idealStock - currentStock);
        const lastAction = stockItem?.lastAction;
        return { product, currentStock, idealStock, suggestion, lastAction };
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
                                    const { currentStock, idealStock, suggestion, lastAction } = getStockData(product.id);
                                     const lastActionInfo = lastAction ? {
                                        'είσοδος': { text: 'Είσοδος', color: 'text-green-500' },
                                        'έξοδος': { text: 'Έξοδος', color: 'text-destructive' },
                                        'καταμέτρηση': { text: 'Καταμέτρηση', color: 'text-yellow-500' }
                                    }[lastAction.type] : null;

                                    return (
                                        <Card key={product.id} className="overflow-hidden bg-card">
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
