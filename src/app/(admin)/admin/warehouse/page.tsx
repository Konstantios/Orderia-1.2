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
import { Button } from '@/components/ui/button';
import { Download, PlusCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"


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

type Warehouse = {
    id: string;
    name: string;
    stock: WholesalerStockItem[];
}

export default function AdminWarehousePage() {
    const [warehouses, setWarehouses] = useState<Warehouse[]>([
        { id: 'wh1', name: 'Αποθήκη 1', stock: initialWholesalerStock }
    ]);
    const [activeTab, setActiveTab] = useState<string>('wh1');
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [newWarehouseName, setNewWarehouseName] = useState('');
    
    const { toast } = useToast();

    const handleSync = (scannedItems: Record<string, number>, type: 'counting' | 'in' | 'out', warehouseId: string) => {
        if (Object.keys(scannedItems).length === 0) {
            toast({
                variant: 'destructive',
                title: 'Δεν υπάρχουν δεδομένα',
                description: 'Παρακαλώ σκανάρετε κάποια προϊόντα πρώτα.',
            });
            return;
        }

        setWarehouses(prevWarehouses => prevWarehouses.map(wh => {
            if (wh.id !== warehouseId) return wh;

            const stockMap = new Map(wh.stock.map(item => [item.productId, item]));

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
            
            return { ...wh, stock: Array.from(stockMap.values()) };
        }));

        const title = {
            'counting': 'Συγχρονισμός Ολοκληρώθηκε!',
            'in': 'Η Είσοδος Ολοκληρώθηκε!',
            'out': 'Η Έξοδος Ολοκληρώθηκε!'
        }[type];
        
        toast({
            title: title,
            description: `Το απόθεμα για την αποθήκη "${warehouses.find(w => w.id === warehouseId)?.name}" ενημερώθηκε.`,
        });
    };
    
    const handleAddWarehouse = () => {
        if (!newWarehouseName.trim()) {
            toast({ variant: 'destructive', title: 'Το όνομα είναι υποχρεωτικό' });
            return;
        }
        const newWarehouseId = `wh${Date.now()}`;
        setWarehouses(prev => [
            ...prev,
            { id: newWarehouseId, name: newWarehouseName, stock: [] }
        ]);
        setActiveTab(newWarehouseId);
        setNewWarehouseName('');
        setIsAddDialogOpen(false);
        toast({ title: `Η αποθήκη "${newWarehouseName}" δημιουργήθηκε` });
    }

    const handleIdealStockChange = (productId: string, value: string, warehouseId: string) => {
        const newIdealStock = parseInt(value, 10);
        const stockValue = Math.max(0, isNaN(newIdealStock) ? 0 : newIdealStock);
        
         setWarehouses(prevWarehouses => prevWarehouses.map(wh => {
            if (wh.id !== warehouseId) return wh;
            
            const newStock = wh.stock.map(item => 
                item.productId === productId ? { ...item, idealStock: stockValue } : item
            );
            return { ...wh, stock: newStock };
        }));
    };

    const getStockData = (productId: string, warehouseId: string) => {
        const warehouse = warehouses.find(wh => wh.id === warehouseId);
        const product = allProducts.find(p => p.id === productId)!;
        
        if (!warehouse) {
            return { product, currentStock: 0, idealStock: 0, suggestion: 0, lastAction: undefined };
        }
        
        const stockItem = warehouse.stock.find(i => i.productId === productId);
        const currentStock = stockItem?.quantity || 0;
        const idealStock = stockItem?.idealStock || 0;
        const suggestion = Math.max(0, idealStock - currentStock);
        const lastAction = stockItem?.lastAction;
        return { product, currentStock, idealStock, suggestion, lastAction };
    };

    const handleExport = (warehouse: Warehouse) => {
        const dataToExport = allProducts.map(product => {
            const { currentStock, idealStock, suggestion } = getStockData(product.id, warehouse.id);
            return {
                'Κωδικός Προϊόντος': product.code,
                'Όνομα': product.name,
                'Απόθεμα': currentStock,
                'Ιδανικό': idealStock,
                'Προτεινόμενο': suggestion
            };
        });
    
        if (dataToExport.length === 0) {
            toast({
                title: "Δεν υπάρχουν δεδομένα",
                description: `Δεν υπάρχουν προϊόντα στην ${warehouse.name} για εξαγωγή.`,
                variant: "destructive"
            });
            return;
        }
    
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, warehouse.name);
    
        // Auto-fit columns
        const colWidths = Object.keys(dataToExport[0] || {}).map(key => ({
            wch: Math.max(
                key.length,
                ...dataToExport.map(row => (String((row as any)[key]) || '').length)
            ) + 2
        }));
        worksheet['!cols'] = colWidths;
        
        const today = format(new Date(), 'dd-MM-yyyy');
        const fileName = `${warehouse.name} - ${today}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="font-headline text-3xl font-bold">Διαχείριση Αποθηκών</h1>
                 <Button onClick={() => setIsAddDialogOpen(true)} variant="outline">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Προσθήκη Αποθήκης
                </Button>
            </div>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid h-auto grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:flex lg:flex-wrap lg:h-auto lg:justify-start">
                    {warehouses.map(wh => (
                        <TabsTrigger key={wh.id} value={wh.id}>{wh.name}</TabsTrigger>
                    ))}
                    <TabsTrigger value="database">Βάση Σάρωσης</TabsTrigger>
                </TabsList>
                
                {warehouses.map(warehouse => (
                    <TabsContent key={warehouse.id} value={warehouse.id} className="mt-6">
                        <Tabs defaultValue="stock" className="w-full">
                           <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-4">
                                <TabsList className="flex-wrap h-auto">
                                    <TabsTrigger value="stock">Απόθεμα</TabsTrigger>
                                    <TabsTrigger value="counting">Καταμέτρηση</TabsTrigger>
                                    <TabsTrigger value="in">Είσοδος</TabsTrigger>
                                    <TabsTrigger value="out">Έξοδος</TabsTrigger>
                                </TabsList>
                                <Button onClick={() => handleExport(warehouse)} variant="outline">
                                    <Download className="mr-2 h-4 w-4" />
                                    Εξαγωγή {warehouse.name}
                                </Button>
                            </div>
                            <TabsContent value="stock">
                                <div className="space-y-4">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Απόθεμα - {warehouse.name}</CardTitle>
                                            <CardDescription>Επισκόπηση του αποθέματος για όλα τα προϊόντα σε αυτή την αποθήκη.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            {allProducts.map(product => {
                                                const { currentStock, idealStock, suggestion, lastAction } = getStockData(product.id, warehouse.id);
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
                                                                        onChange={(e) => handleIdealStockChange(product.id, e.target.value, warehouse.id)}
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
                             <TabsContent value="counting">
                                <AdminWarehouseCounting products={allProducts} stock={warehouse.stock} onSync={(items) => handleSync(items, 'counting', warehouse.id)} />
                            </TabsContent>
                            <TabsContent value="in">
                                <AdminWarehouseEntry products={allProducts} stock={warehouse.stock} onSync={(items) => handleSync(items, 'in', warehouse.id)} />
                            </TabsContent>
                            <TabsContent value="out">
                                <AdminWarehouseExit products={allProducts} stock={warehouse.stock} onSync={(items) => handleSync(items, 'out', warehouse.id)} />
                            </TabsContent>
                        </Tabs>
                    </div>
                </TabsContent>
            ))}

            <TabsContent value="database" className="mt-6">
                <AdminWarehouseDatabase products={allProducts} />
            </TabsContent>
        </Tabs>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Προσθήκη Νέας Αποθήκης</DialogTitle>
                    <DialogDescription>Δώστε ένα όνομα για τη νέα σας αποθήκη.</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Input
                        id="warehouseName"
                        placeholder="π.χ. Αποθήκη Κέντρου"
                        value={newWarehouseName}
                        onChange={(e) => setNewWarehouseName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddWarehouse()}
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Ακύρωση</Button>
                    <Button onClick={handleAddWarehouse}>Αποθήκευση</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </div>
    );
}
