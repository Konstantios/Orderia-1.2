'use client';

import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { AdminWarehouseCounting } from './counting';
import { AdminWarehouseEntry } from './entry';
import { AdminWarehouseExit } from './exit';
import { AdminWarehouseDatabase } from './database';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import type { WholesalerStockItem, Warehouse, Wholesaler, Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Download, PlusCircle, Loader2, Minus, Plus, Package } from 'lucide-react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { useFirebase, useCollection, useFirestore, useMemoFirebase, addDocumentNonBlocking, setDocumentNonBlocking, WithId } from '@/firebase';
import { collection, increment, writeBatch, query, where, doc } from 'firebase/firestore';


const getStockColor = (current: number, ideal: number) => {
    if (ideal === 0) return 'bg-muted/20 border-transparent text-muted-foreground';
    const ratio = current / ideal;
    if (ratio >= 0.8) {
      return 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400';
    }
    if (ratio >= 0.4) {
      return 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400';
    }
    return 'bg-red-500/20 border-red-500/40 text-red-600 dark:text-red-400 font-bold';
};

export default function AdminWarehousePage() {
    const [activeTab, setActiveTab] = useState<string | null>(null);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [newWarehouseName, setNewWarehouseName] = useState('');
    
    const { toast } = useToast();
    const firestore = useFirestore();
    const { user, isUserLoading } = useFirebase();

    const wholesalerQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'wholesalers'), where('adminUids', 'array-contains', user.uid));
    }, [firestore, user]);

    const { data: wholesalers, isLoading: isLoadingWholesalers } = useCollection<Wholesaler>(wholesalerQuery);
    const wholesaler = wholesalers?.[0];
    const wholesalerId = wholesaler?.id;

    const warehousesQuery = useMemoFirebase(() => {
        if (!firestore || !wholesalerId) return null;
        return collection(firestore, 'wholesalers', wholesalerId, 'warehouses');
    }, [firestore, wholesalerId]);

    const { data: warehouses, isLoading: isLoadingUserWarehouses } = useCollection<Warehouse>(warehousesQuery);
    
    const productsQuery = useMemoFirebase(() => {
        if (!firestore || !wholesalerId) return null;
        return collection(firestore, 'wholesalers', wholesalerId, 'products');
    }, [firestore, wholesalerId]);
    const { data: allProducts, isLoading: isLoadingProducts } = useCollection<Product>(productsQuery);

    const stockQuery = useMemoFirebase(() => {
        if (!firestore || !wholesalerId || !activeTab) return null;
        return collection(firestore, 'wholesalers', wholesalerId, 'warehouses', activeTab, 'inventories');
    }, [firestore, wholesalerId, activeTab]);

    const { data: stock, isLoading: isLoadingStock } = useCollection<WholesalerStockItem>(stockQuery);

    useEffect(() => {
      // Set initial active tab only if none is set and warehouses are available
      if (!activeTab && warehouses && warehouses.length > 0) {
        setActiveTab(warehouses[0].id);
      }
      // If warehouses are empty, unset active tab
      if (warehouses && warehouses.length === 0 && activeTab !== null) {
        setActiveTab(null);
      }
    }, [warehouses, activeTab]);


    const handleSync = async (scannedItems: Record<string, number>, type: 'counting' | 'in' | 'out', warehouseId: string) => {
        if (Object.keys(scannedItems).length === 0) {
            toast({
                variant: 'destructive',
                title: 'Δεν υπάρχουν δεδομένα',
                description: 'Παρακαλώ σκανάρετε κάποια προϊόντα πρώτα.',
            });
            return;
        }

        if (!firestore || !wholesalerId || !wholesaler) return;

        const batch = writeBatch(firestore);

        for (const [productId, count] of Object.entries(scannedItems)) {
            const docRef = doc(firestore, 'wholesalers', wholesalerId, 'warehouses', warehouseId, 'inventories', productId);
            
            const data = { 
                productId, 
                wholesalerId, 
                warehouseId, 
                lastAction: { type: type, value: count },
                ownerId: wholesaler.ownerId,
                adminUids: wholesaler.adminUids,
            };

            if (type === 'counting') {
                batch.set(docRef, { ...data, quantity: count }, { merge: true });
            } else if (type === 'in') {
                batch.set(docRef, { ...data, quantity: increment(count) }, { merge: true });
            } else if (type === 'out') {
                 batch.set(docRef, { ...data, quantity: increment(-count) }, { merge: true });
            }
        }
        
        await batch.commit();

        const title = {
            'counting': 'Συγχρονισμός Ολοκληρώθηκε!',
            'in': 'Η Είσοδος Ολοκληρώθηκε!',
            'out': 'Η Έξοδος Ολοκληρώθηκε!'
        }[type];
        
        toast({
            title: title,
            description: `Το απόθεμα για την αποθήκη "${warehouses?.find(w => w.id === warehouseId)?.name}" ενημερώθηκε.`,
        });
    };
    
    const handleAddWarehouse = () => {
        if (!newWarehouseName.trim() || !firestore || !wholesalerId || !wholesaler) {
            toast({ variant: 'destructive', title: 'Το όνομα είναι υποχρεωτικό' });
            return;
        }
        const warehousesColRef = collection(firestore, 'wholesalers', wholesalerId, 'warehouses');
        addDocumentNonBlocking(warehousesColRef, { 
            name: newWarehouseName, 
            wholesalerId,
            ownerId: wholesaler.ownerId,
            adminUids: wholesaler.adminUids,
        });
        
        setNewWarehouseName('');
        setIsAddDialogOpen(false);
        toast({ title: `Η αποθήκη "${newWarehouseName}" δημιουργήθηκε` });
    }

    const handleIdealStockChange = (productId: string, value: string, warehouseId: string) => {
        const newIdealStock = parseInt(value, 10);
        const stockValue = Math.max(0, isNaN(newIdealStock) ? 0 : newIdealStock);
        
        if (!firestore || !wholesalerId || !wholesaler) return;

        const docRef = doc(firestore, 'wholesalers', wholesalerId, 'warehouses', warehouseId, 'inventories', productId);
        const data = { 
            productId: productId, 
            wholesalerId, 
            warehouseId: warehouseId, 
            idealStock: stockValue,
            ownerId: wholesaler.ownerId,
            adminUids: wholesaler.adminUids,
        };
        setDocumentNonBlocking(docRef, data, { merge: true });
    };

    const handleCurrentStockChange = (productId: string, value: string, warehouseId: string) => {
        const newStock = parseInt(value, 10);
        const stockValue = Math.max(0, isNaN(newStock) ? 0 : newStock);
        
        if (!firestore || !wholesalerId || !wholesaler) return;

        const docRef = doc(firestore, 'wholesalers', wholesalerId, 'warehouses', warehouseId, 'inventories', productId);
        const data = { 
            productId: productId, 
            wholesalerId, 
            warehouseId: warehouseId, 
            quantity: stockValue,
            ownerId: wholesaler.ownerId,
            adminUids: wholesaler.adminUids,
        };
        setDocumentNonBlocking(docRef, data, { merge: true });
    };

    // Pre-index stock data for O(1) lookup
    const stockMap = useMemo(() => {
        const map = new Map<string, WholesalerStockItem>();
        if (!stock) return map;
        stock.forEach(item => map.set(item.productId, item));
        return map;
    }, [stock]);

    const getStockData = useCallback((productId: string) => {
        const stockItem = stockMap.get(productId);
        const currentStock = stockItem?.quantity || 0;
        const idealStock = stockItem?.idealStock || 0;
        const suggestion = Math.max(0, idealStock - currentStock);
        const lastAction = stockItem?.lastAction;
        return { currentStock, idealStock, suggestion, lastAction };
    }, [stockMap]);

    const handleExport = (warehouse: WithId<Warehouse>) => {
        if (!allProducts) {
             toast({ title: "Δεν υπάρχουν προϊόντα", variant: "destructive" });
             return;
        }
        const warehouseStock = stock || [];
        const dataToExport = allProducts.map(product => {
            const stockItem = warehouseStock.find(s => s.id === product.id);
            const currentStock = stockItem?.quantity || 0;
            const idealStock = stockItem?.idealStock || 0;
            const suggestion = Math.max(0, idealStock - currentStock);
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
    
        const colWidths = Object.keys(dataToExport[0] || {}).map(key => ({
            wch: Math.max(
                key.length,
                ...dataToExport.map(row => (String((row as any)[key]) || '').length)
            ) + 2
        }));
        worksheet['!cols'] = colWidths;
        
        const today = format(new Date(), 'dd-MM-yyyy');
        const fileName = `${warehouse.name.replace(/ /g, '_')}-${today}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    };

    if (isUserLoading || isLoadingWholesalers) {
        return <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }
    
    if (!wholesaler && !isLoadingWholesalers) {
        return (
            <div className="text-center py-10">
                <h2 className="text-2xl font-bold">Δεν βρέθηκε επιχείρηση προμηθευτή</h2>
                <p className="text-muted-foreground mt-2">Φαίνεται πως ο λογαριασμός σας δεν είναι συνδεδεμένος με κάποιον προμηθευτή. Μπορείτε να δημιουργήσετε έναν από την αρχική σελίδα.</p>
                <Button asChild className="mt-4"><Link href="/">Επιστροφή</Link></Button>
            </div>
        );
    }
    
    const productsForWarehouse = allProducts || [];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="font-headline text-3xl font-bold">Διαχείριση Αποθηκών</h1>
                 <Button onClick={() => setIsAddDialogOpen(true)} variant="outline">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Προσθήκη Αποθήκης
                </Button>
            </div>
            <Tabs value={activeTab || 'loading'} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid h-auto grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:flex lg:flex-wrap lg:h-auto lg:justify-start">
                    {warehouses && warehouses.map(wh => (
                        <TabsTrigger key={wh.id} value={wh.id}>{wh.name}</TabsTrigger>
                    ))}
                    {isLoadingUserWarehouses && <div className="flex items-center px-4"><Loader2 className="h-4 w-4 animate-spin" /></div>}
                </TabsList>
                
                {/* 
                    OPTIMIZATION: Only render the content of the active warehouse.
                    Standard Radix/Shadcn TabsContent renders all contents but hides them.
                    Manual conditional rendering ensures only the active warehouse's components are mounted.
                */}
                {warehouses && warehouses.length > 0 && activeTab && warehouses.some(w => w.id === activeTab) && (
                    <TabsContent value={activeTab} className="mt-6">
                        {(() => {
                            const warehouse = warehouses.find(w => w.id === activeTab)!;
                            return (
                                <Tabs defaultValue="stock" className="w-full">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-4">
                                        <TabsList className="flex-wrap h-auto">
                                            <TabsTrigger value="stock">Απόθεμα</TabsTrigger>
                                            <TabsTrigger value="counting">Καταμέτρηση</TabsTrigger>
                                            <TabsTrigger value="in">Είσοδος</TabsTrigger>
                                            <TabsTrigger value="out">Έξοδος</TabsTrigger>
                                            <TabsTrigger value="database">Βάση Σάρωσης</TabsTrigger>
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
                                                    {(isLoadingStock || isLoadingProducts) && <div className="flex justify-center items-center h-20"><Loader2 className="h-6 w-6 animate-spin" /></div>}
                                                    {!(isLoadingStock || isLoadingProducts) && productsForWarehouse.map(product => {
                                                        const { currentStock, idealStock, suggestion, lastAction } = getStockData(product.id);
                                                        const lastActionInfo = lastAction ? {
                                                            'in': { text: 'Είσοδος', color: 'text-green-500' },
                                                            'out': { text: 'Έξοδος', color: 'text-destructive' },
                                                            'counting': { text: 'Καταμέτρηση', color: 'text-yellow-500' }
                                                        }[lastAction.type] : null;

                                                        return (
                                                            <Card key={product.id} className="overflow-hidden bg-card">
                                                                <CardContent className="p-4">
                                                                    <div className="flex items-center gap-4">
                                                                        {product.imageUrl ? (
                                                                            <Image src={product.imageUrl} alt={product.name} width={64} height={64} className="rounded-lg object-cover flex-shrink-0" data-ai-hint={product.imageHint} />
                                                                        ) : (
                                                                            <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                                                                                <Package className="h-8 w-8 text-muted-foreground" />
                                                                            </div>
                                                                        )}
                                                                        <div className="flex-1">
                                                                            <p className="font-semibold">{product.name}</p>
                                                                            <p className="text-sm text-muted-foreground">{product.code}</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
                                                                        <div className={cn('rounded-lg border p-2 flex flex-col justify-center items-center', getStockColor(currentStock, idealStock))}>
                                                                            <p className="text-xs font-semibold uppercase mb-1">ΑΠΟΘΕΜΑ</p>
                                                                            <div className="flex items-center justify-center gap-1">
                                                                                <Input
                                                                                    key={`stock-${product.id}-${currentStock}`}
                                                                                    type="number"
                                                                                    defaultValue={currentStock}
                                                                                    onBlur={(e) => handleCurrentStockChange(product.id, e.target.value, warehouse.id)}
                                                                                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                                                                                    className="w-14 sm:w-16 h-auto p-0 text-xl font-bold text-center bg-transparent border-0 shadow-none focus-visible:ring-0"
                                                                                    min="0"
                                                                                />
                                                                                <div className="flex flex-col gap-1">
                                                                                    <Button variant="outline" size="icon" className="h-6 w-6 rounded-md" onClick={() => handleCurrentStockChange(product.id, String(currentStock + 1), warehouse.id)}>
                                                                                        <Plus className="h-4 w-4" />
                                                                                    </Button>
                                                                                    <Button variant="outline" size="icon" className="h-6 w-6 rounded-md" onClick={() => handleCurrentStockChange(product.id, String(currentStock - 1), warehouse.id)}>
                                                                                        <Minus className="h-4 w-4" />
                                                                                    </Button>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="rounded-lg bg-muted/30 p-2 flex flex-col justify-center items-center">
                                                                            <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">ΙΔΑΝΙΚΟ</p>
                                                                            <div className="flex items-center justify-center gap-1">
                                                                                <Input
                                                                                    key={`ideal-${product.id}-${idealStock}`}
                                                                                    type="number"
                                                                                    defaultValue={idealStock}
                                                                                    onBlur={(e) => handleIdealStockChange(product.id, e.target.value, warehouse.id)}
                                                                                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                                                                                    className="w-14 sm:w-16 h-auto p-0 text-xl font-bold text-center bg-transparent border-0 shadow-none focus-visible:ring-0"
                                                                                    min="0"
                                                                                />
                                                                                <div className="flex flex-col gap-1">
                                                                                    <Button variant="outline" size="icon" className="h-6 w-6 rounded-md" onClick={() => handleIdealStockChange(product.id, String(idealStock + 1), warehouse.id)}>
                                                                                        <Plus className="h-4 w-4" />
                                                                                    </Button>
                                                                                    <Button variant="outline" size="icon" className="h-6 w-6 rounded-md" onClick={() => handleIdealStockChange(product.id, String(idealStock - 1), warehouse.id)}>
                                                                                        <Minus className="h-4 w-4" />
                                                                                    </Button>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="rounded-lg bg-muted/30 p-2 flex flex-col justify-center">
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
                                        <AdminWarehouseCounting products={productsForWarehouse} stock={stock || []} onSync={(items) => handleSync(items, 'counting', warehouse.id)} />
                                    </TabsContent>
                                    <TabsContent value="in">
                                        <AdminWarehouseEntry products={productsForWarehouse} stock={stock || []} onSync={(items) => handleSync(items, 'in', warehouse.id)} />
                                    </TabsContent>
                                    <TabsContent value="out">
                                        <AdminWarehouseExit products={productsForWarehouse} stock={stock || []} onSync={(items) => handleSync(items, 'out', warehouse.id)} />
                                    </TabsContent>
                                    <TabsContent value="database">
                                        <AdminWarehouseDatabase products={productsForWarehouse} wholesaler={wholesaler} />
                                    </TabsContent>
                                </Tabs>
                            );
                        })()}
                    </TabsContent>
                )}
                
                {isLoadingUserWarehouses && <TabsContent value="loading" className="mt-6"><div className="flex justify-center items-center h-20"><Loader2 className="h-6 w-6 animate-spin" /></div></TabsContent>}

                {warehouses && warehouses.length === 0 && !isLoadingUserWarehouses &&
                    <TabsContent value={activeTab || ''} className="mt-6 text-center py-10">
                        <h3 className="text-xl font-bold">Δεν υπάρχουν αποθήκες</h3>
                        <p className="text-muted-foreground mt-2">Πατήστε "Προσθήκη Αποθήκης" για να δημιουργήσετε την πρώτη σας.</p>
                    </TabsContent>
                }
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
