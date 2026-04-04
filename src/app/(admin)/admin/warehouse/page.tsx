'use client';

import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { products as allProducts } from '@/lib/data';
import { useState, useMemo, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { AdminWarehouseCounting } from './counting';
import { AdminWarehouseDatabase } from './database';
import { AdminWarehouseEntry } from './entry';
import { AdminWarehouseExit } from './exit';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import type { WholesalerStockItem, Warehouse } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Download, PlusCircle, Loader2, Minus, Plus } from 'lucide-react';
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

    const { data: wholesalers, isLoading: isLoadingWholesalers } = useCollection<any>(wholesalerQuery);
    const wholesaler = wholesalers?.[0];
    const wholesalerId = wholesaler?.id;

    const warehousesQuery = useMemoFirebase(() => {
        if (!firestore || !wholesalerId) return null;
        return collection(firestore, 'wholesalers', wholesalerId, 'warehouses');
    }, [firestore, wholesalerId]);

    const { data: warehouses, isLoading: isLoadingUserWarehouses } = useCollection<Warehouse>(warehousesQuery);

    const stockQuery = useMemoFirebase(() => {
        if (!firestore || !wholesalerId || !activeTab || activeTab === 'database') return null;
        return collection(firestore, 'wholesalers', wholesalerId, 'warehouses', activeTab, 'inventories');
    }, [firestore, wholesalerId, activeTab]);

    const { data: stock, isLoading: isLoadingStock } = useCollection<WholesalerStockItem>(stockQuery);

    // Effect to set the first warehouse as active tab once loaded
    useEffect(() => {
      if (!activeTab && warehouses && warehouses.length > 0) {
        setActiveTab(warehouses[0].id);
      }
       if (warehouses && warehouses.length === 0) {
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

        if (!firestore || !wholesalerId) return;

        const batch = writeBatch(firestore);

        for (const [productId, count] of Object.entries(scannedItems)) {
            const docRef = doc(firestore, 'wholesalers', wholesalerId, 'warehouses', warehouseId, 'inventories', productId);
            
            const data = { productId, wholesalerId, warehouseId, lastAction: { type: type, value: count } };

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
        if (!newWarehouseName.trim() || !firestore || !wholesalerId) {
            toast({ variant: 'destructive', title: 'Το όνομα είναι υποχρεωτικό' });
            return;
        }
        const warehousesColRef = collection(firestore, 'wholesalers', wholesalerId, 'warehouses');
        addDocumentNonBlocking(warehousesColRef, { name: newWarehouseName, wholesalerId });
        
        setNewWarehouseName('');
        setIsAddDialogOpen(false);
        toast({ title: `Η αποθήκη "${newWarehouseName}" δημιουργήθηκε` });
    }

    const handleIdealStockChange = (productId: string, value: string, warehouseId: string) => {
        const newIdealStock = parseInt(value, 10);
        const stockValue = Math.max(0, isNaN(newIdealStock) ? 0 : newIdealStock);
        
        if (!firestore || !wholesalerId) return;

        const docRef = doc(firestore, 'wholesalers', wholesalerId, 'warehouses', warehouseId, 'inventories', productId);
        const data = { productId: productId, wholesalerId, warehouseId: warehouseId, idealStock: stockValue };
        setDocumentNonBlocking(docRef, data, { merge: true });
    };

    const handleCurrentStockChange = (productId: string, value: string, warehouseId: string) => {
        const newStock = parseInt(value, 10);
        const stockValue = Math.max(0, isNaN(newStock) ? 0 : newStock);
        
        if (!firestore || !wholesalerId) return;

        const docRef = doc(firestore, 'wholesalers', wholesalerId, 'warehouses', warehouseId, 'inventories', productId);
        const data = { productId: productId, wholesalerId, warehouseId: warehouseId, quantity: stockValue };
        setDocumentNonBlocking(docRef, data, { merge: true });
    };

    const getStockData = (productId: string) => {
        const product = allProducts.find(p => p.id === productId)!;
        const stockItem = stock?.find(i => i.id === productId);
        const currentStock = stockItem?.quantity || 0;
        const idealStock = stockItem?.idealStock || 0;
        const suggestion = Math.max(0, idealStock - currentStock);
        const lastAction = stockItem?.lastAction;
        return { product, currentStock, idealStock, suggestion, lastAction };
    };

    const handleExport = (warehouse: WithId<Warehouse>) => {
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
                    <TabsTrigger value="database">Βάση Σάρωσης</TabsTrigger>
                </TabsList>
                
                {warehouses && warehouses.map(warehouse => (
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
                                            {(isLoadingStock || isLoadingUserWarehouses) && <div className="flex justify-center items-center h-20"><Loader2 className="h-6 w-6 animate-spin" /></div>}
                                            {!isLoadingStock && !isLoadingUserWarehouses && allProducts.map(product => {
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
                                                                <Image src={product.imageUrl} alt={product.name} width={64} height={64} className="rounded-lg object-cover" data-ai-hint={product.imageHint} />
                                                                <div className="flex-1">
                                                                    <p className="font-semibold">{product.name}</p>
                                                                    <p className="text-sm text-muted-foreground">{product.code}</p>
                                                                </div>
                                                            </div>
                                                            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                                                                <div className={cn('rounded-lg border p-2 flex flex-col justify-center items-center', getStockColor(currentStock, idealStock))}>
                                                                    <p className="text-xs font-semibold uppercase mb-1">ΑΠΟΘΕΜΑ</p>
                                                                    <div className="flex items-center justify-center gap-1">
                                                                        <Input
                                                                            key={`stock-${product.id}-${currentStock}`}
                                                                            type="number"
                                                                            defaultValue={currentStock}
                                                                            onBlur={(e) => handleCurrentStockChange(product.id, e.target.value, warehouse.id)}
                                                                            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                                                                            className="w-16 h-auto p-0 text-2xl font-bold text-center bg-transparent border-0 shadow-none focus-visible:ring-0"
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
                                                                            className="w-16 h-auto p-0 text-2xl font-bold text-center bg-transparent border-0 shadow-none focus-visible:ring-0"
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
                                <AdminWarehouseCounting products={allProducts} stock={stock || []} onSync={(items) => handleSync(items, 'counting', warehouse.id)} />
                            </TabsContent>
                            <TabsContent value="in">
                                <AdminWarehouseEntry products={allProducts} stock={stock || []} onSync={(items) => handleSync(items, 'in', warehouse.id)} />
                            </TabsContent>
                            <TabsContent value="out">
                                <AdminWarehouseExit products={allProducts} stock={stock || []} onSync={(items) => handleSync(items, 'out', warehouse.id)} />
                            </TabsContent>
                        </Tabs>
                    </TabsContent>
                ))}
                
                {isLoadingUserWarehouses && <TabsContent value="loading" className="mt-6"><div className="flex justify-center items-center h-20"><Loader2 className="h-6 w-6 animate-spin" /></div></TabsContent>}

                {warehouses && warehouses.length === 0 && !isLoadingUserWarehouses &&
                    <TabsContent value={activeTab || ''} className="mt-6 text-center py-10">
                        <h3 className="text-xl font-bold">Δεν υπάρχουν αποθήκες</h3>
                        <p className="text-muted-foreground mt-2">Πατήστε "Προσθήκη Αποθήκης" για να δημιουργήσετε την πρώτη σας.</p>
                    </TabsContent>
                }


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
