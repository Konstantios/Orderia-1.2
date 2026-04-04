'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle, Loader2 } from 'lucide-react';
import type { Product, Wholesaler } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useFirebase, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking, WithId } from "@/firebase";
import { collection, query, where, doc, limit } from "firebase/firestore";
import Image from 'next/image';

const ProductForm = ({ product, wholesaler, onSave, onCancel }: { product: Partial<WithId<Product>> | null; wholesaler: WithId<Wholesaler>; onSave: (productData: Omit<Product, 'id' | 'wholesalerOwnerId' | 'wholesalerAdminUids'>) => void; onCancel: () => void }) => {
    const [formData, setFormData] = useState<Partial<Product>>(product || { unit: 'τεμάχιο'});
    const { toast } = useToast();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({...prev, [name]: value}));
    }
    
    const handleSelectChange = (value: 'κιβώτιο' | 'κιλό' | 'τεμάχιο') => {
        setFormData(prev => ({...prev, unit: value}));
    }

    const handleSubmit = () => {
        if (!formData.name || !formData.code || !formData.unit) {
            toast({
                variant: 'destructive',
                title: 'Ελλιπή Στοιχεία',
                description: 'Παρακαλώ συμπληρώστε όλα τα υποχρεωτικά πεδία.',
            });
            return;
        }

        const productToSave: Omit<Product, 'id' | 'wholesalerOwnerId' | 'wholesalerAdminUids'> & { wholesalerId: string; wholesalerOwnerId: string; wholesalerAdminUids: string[]; } = {
            name: formData.name,
            code: formData.code,
            unit: formData.unit,
            imageUrl: formData.imageUrl || `https://picsum.photos/seed/${formData.code}/400/300`,
            imageHint: formData.name.toLowerCase(),
            wholesalerId: wholesaler.id,
            wholesalerOwnerId: wholesaler.ownerId,
            wholesalerAdminUids: wholesaler.adminUids,
        };

        onSave(productToSave);
    }
    
    return (
        <>
            <DialogHeader>
                <DialogTitle>{product?.id ? 'Επεξεργασία Προϊόντος' : 'Νέο Προϊόν'}</DialogTitle>
                <DialogDescription>
                    {product?.id ? 'Επεξεργαστείτε τα στοιχεία του προϊόντος.' : 'Συμπληρώστε τα στοιχεία για το νέο προϊόν.'}
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Όνομα</Label>
                    <Input id="name" name="name" value={formData.name || ''} onChange={handleChange} className="col-span-3" />
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="code" className="text-right">Κωδικός</Label>
                    <Input id="code" name="code" value={formData.code || ''} onChange={handleChange} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="unit" className="text-right">Μονάδα</Label>
                    <Select onValueChange={handleSelectChange} defaultValue={formData.unit}>
                        <SelectTrigger className="col-span-3">
                            <SelectValue placeholder="Επιλέξτε μονάδα" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="τεμάχιο">Τεμάχιο</SelectItem>
                            <SelectItem value="κιβώτιο">Κιβώτιο</SelectItem>
                            <SelectItem value="κιλό">Κιλό</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="imageUrl" className="text-right">URL Εικόνας</Label>
                    <Input id="imageUrl" name="imageUrl" value={formData.imageUrl || ''} onChange={handleChange} className="col-span-3" placeholder="https://..."/>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={onCancel}>Ακύρωση</Button>
                <Button onClick={handleSubmit}>Αποθήκευση</Button>
            </DialogFooter>
        </>
    );
};

export default function AdminProductsPage() {
    const { user, firestore } = useFirebase();
    const { toast } = useToast();

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Partial<WithId<Product>> | null>(null);

    const wholesalerQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, 'wholesalers'), where('adminUids', 'array-contains', user.uid), limit(1));
    }, [user, firestore]);
    const { data: wholesalers, isLoading: isLoadingWholesalers } = useCollection<Wholesaler>(wholesalerQuery);
    const wholesaler = wholesalers?.[0];

    const productsQuery = useMemoFirebase(() => {
        if (!firestore || !wholesaler) return null;
        return collection(firestore, 'wholesalers', wholesaler.id, 'products');
    }, [firestore, wholesaler]);
    const { data: products, isLoading: isLoadingProducts } = useCollection<Product>(productsQuery);

    const handleSaveProduct = (productData: Omit<Product, 'id'>) => {
        if (!firestore || !wholesaler) return;
        
        if (editingProduct?.id) { // Editing existing
            const productRef = doc(firestore, 'wholesalers', wholesaler.id, 'products', editingProduct.id);
            updateDocumentNonBlocking(productRef, productData);
            toast({ title: "Επιτυχής Ενημέρωση", description: `Το προϊόν '${productData.name}' ενημερώθηκε.` });
        } else { // Adding new
            const productsColRef = collection(firestore, 'wholesalers', wholesaler.id, 'products');
            addDocumentNonBlocking(productsColRef, productData);
            toast({ title: "Επιτυχής Καταχώρηση", description: `Το προϊόν '${productData.name}' προστέθηκε.` });
        }
        setIsDialogOpen(false);
        setEditingProduct(null);
    }
    
    const handleDeleteProduct = (productId: string) => {
        if (!firestore || !wholesaler) return;
        const product = products?.find(p => p.id === productId);
        if (!product) return;

        const productRef = doc(firestore, 'wholesalers', wholesaler.id, 'products', productId);
        deleteDocumentNonBlocking(productRef);
        toast({
            variant: 'destructive',
            title: "Επιτυχής Διαγραφή",
            description: `Το προϊόν '${product?.name}' διαγράφηκε.`
        });
    }

    const openDialogForEdit = (product: WithId<Product>) => {
        setEditingProduct(product);
        setIsDialogOpen(true);
    }
    
    const openDialogForNew = () => {
        setEditingProduct({});
        setIsDialogOpen(true);
    }
    
    const isLoading = isLoadingWholesalers || isLoadingProducts;

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-lg font-semibold md:text-2xl">Προϊόντα</h1>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Λίστα Προϊόντων</CardTitle>
                        <CardDescription>
                            Διαχειριστείτε τα προϊόντα που προσφέρετε.
                        </CardDescription>
                    </div>
                     <Button onClick={openDialogForNew} disabled={!wholesaler}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Προσθήκη Προϊόντος
                    </Button>
                </CardHeader>
                <CardContent>
                   <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[80px]">Εικόνα</TableHead>
                                <TableHead>Όνομα</TableHead>
                                <TableHead className="hidden sm:table-cell">Κωδικός</TableHead>
                                <TableHead className="hidden md:table-cell">Μονάδα</TableHead>
                                <TableHead className="text-right">Ενέργειες</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto"/>
                                    </TableCell>
                                </TableRow>
                            )}
                            {!isLoading && products?.map((product) => (
                                <TableRow key={product.id}>
                                    <TableCell>
                                        <Image src={product.imageUrl} alt={product.name} width={40} height={40} className="rounded-sm object-cover" />
                                    </TableCell>
                                    <TableCell className="font-medium">{product.name}</TableCell>
                                    <TableCell className="hidden sm:table-cell text-muted-foreground">{product.code}</TableCell>
                                    <TableCell className="hidden md:table-cell">{product.unit}</TableCell>
                                    <TableCell className="text-right">
                                         <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => openDialogForEdit(product)}>
                                                    Επεξεργασία
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteProduct(product.id)}>
                                                    Διαγραφή
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {!isLoading && products?.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                        Δεν έχετε προσθέσει ακόμα προϊόντα.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                   </Table>
                </CardContent>
            </Card>

             <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-md">
                     {isDialogOpen && wholesaler && (
                         <ProductForm 
                            product={editingProduct}
                            wholesaler={wholesaler}
                            onSave={handleSaveProduct}
                            onCancel={() => {
                                setIsDialogOpen(false);
                                setEditingProduct(null);
                            }}
                         />
                     )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
