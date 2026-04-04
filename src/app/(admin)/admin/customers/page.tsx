'use client';

import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle, Loader2 } from 'lucide-react';
import type { Store, Wholesaler, SupplierStoreConnection } from '@/lib/types';
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
import { collection, query, where, doc, getDocs, writeBatch, documentId, serverTimestamp } from "firebase/firestore";


const CustomerForm = ({ customer, onSave, onCancel }: { customer: Partial<Store> | null; onSave: (customer: Omit<Store, 'id' | 'ownerId' | 'managerUids'>) => void; onCancel: () => void }) => {
    const [formData, setFormData] = useState<Partial<Store>>(customer || { deliveryDay: 'Δευτέρα' });
    const { toast } = useToast();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({...prev, [name]: value}));
    }
    
    const handleSelectChange = (value: string) => {
        setFormData(prev => ({...prev, deliveryDay: value}));
    }

    const handleSubmit = () => {
        if (!formData.businessName || !formData.ownerName || !formData.phone || !formData.email || !formData.address || !formData.deliveryDay) {
            toast({
                variant: 'destructive',
                title: 'Ελλιπή Στοιχεία',
                description: 'Παρακαλώ συμπληρώστε όλα τα υποχρεωτικά πεδία.',
            });
            return;
        }

        const customerToSave: Omit<Store, 'id' | 'ownerId' | 'managerUids'> = {
            businessName: formData.businessName,
            ownerName: formData.ownerName,
            taxId: formData.taxId,
            phone: formData.phone,
            phone2: formData.phone2,
            email: formData.email,
            address: formData.address,
            googleMapsLink: formData.googleMapsLink,
            deliveryDay: formData.deliveryDay,
        };

        onSave(customerToSave);
    }
    
    return (
        <>
            <DialogHeader>
                <DialogTitle>{customer?.id ? 'Επεξεργασία Πελάτη' : 'Καταχώρηση Νέου Πελάτη'}</DialogTitle>
                <DialogDescription>
                    {customer?.id ? 'Επεξεργαστείτε τα στοιχεία του πελάτη.' : 'Συμπληρώστε τα στοιχεία για να προσθέσετε έναν νέο πελάτη.'}
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="businessName" className="text-right">Επωνυμία</Label>
                    <Input id="businessName" name="businessName" value={formData.businessName || ''} onChange={handleChange} className="col-span-3" />
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="taxId" className="text-right">ΑΦΜ</Label>
                    <Input id="taxId" name="taxId" value={formData.taxId || ''} onChange={handleChange} className="col-span-3" />
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="ownerName" className="text-right">Υπεύθυνος</Label>
                    <Input id="ownerName" name="ownerName" value={formData.ownerName || ''} onChange={handleChange} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="email" className="text-right">Email</Label>
                    <Input id="email" name="email" type="email" value={formData.email || ''} onChange={handleChange} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="phone" className="text-right">Τηλέφωνο</Label>
                    <Input id="phone" name="phone" value={formData.phone || ''} onChange={handleChange} className="col-span-3" />
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="phone2" className="text-right">Τηλ. 2 (προερ.)</Label>
                    <Input id="phone2" name="phone2" value={formData.phone2 || ''} onChange={handleChange} className="col-span-3" />
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="address" className="text-right">Διεύθυνση</Label>
                    <Input id="address" name="address" value={formData.address || ''} onChange={handleChange} className="col-span-3" />
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="googleMapsLink" className="text-right">Google Maps</Label>
                    <Input id="googleMapsLink" name="googleMapsLink" value={formData.googleMapsLink || ''} onChange={handleChange} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="deliveryDay" className="text-right">Ημ. Παράδοσης</Label>
                    <Select onValueChange={handleSelectChange} defaultValue={formData.deliveryDay}>
                        <SelectTrigger className="col-span-3">
                            <SelectValue placeholder="Επιλέξτε ημέρα" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Δευτέρα">Δευτέρα</SelectItem>
                            <SelectItem value="Τρίτη">Τρίτη</SelectItem>
                            <SelectItem value="Τετάρτη">Τετάρτη</SelectItem>
                            <SelectItem value="Πέμπτη">Πέμπτη</SelectItem>
                            <SelectItem value="Παρασκευή">Παρασκευή</SelectItem>
                            <SelectItem value="Σάββατο">Σάββατο</SelectItem>
                            <SelectItem value="Κυριακή">Κυριακή</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={onCancel}>Ακύρωση</Button>
                <Button onClick={handleSubmit}>Αποθήκευση</Button>
            </DialogFooter>
        </>
    );
};


export default function AdminCustomersPage() {
    const { user, firestore } = useFirebase();
    const { toast } = useToast();
    
    const [customers, setCustomers] = useState<WithId<Store>[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Partial<WithId<Store>> | null>(null);

    const wholesalerQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, 'wholesalers'), where('adminUids', 'array-contains', user.uid), limit(1));
    }, [user, firestore]);
    const { data: wholesalers, isLoading: isLoadingWholesalers } = useCollection<Wholesaler>(wholesalerQuery);
    const wholesaler = wholesalers?.[0];

    const connectionsQuery = useMemoFirebase(() => {
        if (!firestore || !wholesaler) return null;
        return query(collection(firestore, 'supplierStoreConnections'), where('wholesalerId', '==', wholesaler.id));
    }, [firestore, wholesaler]);
    const { data: connections, isLoading: isLoadingConnections, error: connectionsError } = useCollection<SupplierStoreConnection>(connectionsQuery);

     useEffect(() => {
        const fetchAndSetCustomers = async () => {
            if (connectionsError) {
                console.error("Error fetching connections:", connectionsError);
                setIsLoading(false);
                setCustomers([]);
                return;
            }

            if (isLoadingConnections || !firestore) {
                return; // Wait until connections are loaded and firestore is available
            }

            setIsLoading(true);

            if (!connections || connections.length === 0) {
                setCustomers([]);
                setIsLoading(false);
                return;
            }

            const storeIds = connections.map(c => c.storeId);

            try {
                // Firestore 'in' queries are limited to 30 items as of recent updates.
                // For larger sets, you would need to chunk the array.
                const storesQuery = query(collection(firestore, 'stores'), where(documentId(), 'in', storeIds));
                const querySnapshot = await getDocs(storesQuery);
                const fetchedStores = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WithId<Store>));
                setCustomers(fetchedStores);
            } catch (e) {
                console.error("Error fetching customer stores:", e);
                toast({ variant: 'destructive', title: "Σφάλμα", description: "Δεν ήταν δυνατή η φόρτωση των πελατών."});
                setCustomers([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAndSetCustomers();
    }, [connections, isLoadingConnections, firestore, connectionsError, toast]);
    
    const handleSaveCustomer = async (customerData: Omit<Store, 'id' | 'ownerId' | 'managerUids'>) => {
        if (!firestore || !wholesaler) return;
        setIsLoading(true);
        try {
            if (editingCustomer?.id) { // Editing existing
                const storeRef = doc(firestore, 'stores', editingCustomer.id);
                await updateDocumentNonBlocking(storeRef, customerData);
                setCustomers(prev => prev.map(c => c.id === editingCustomer.id ? { ...c, ...customerData } : c));
                toast({ title: "Επιτυχής Ενημέρωση", description: `Τα στοιχεία του πελάτη '${customerData.businessName}' ενημερώθηκαν.` });
            } else { // Adding new
                const batch = writeBatch(firestore);
                
                // 1. Create the new Store document
                const newStoreRef = doc(collection(firestore, 'stores'));
                const newStoreData = { ...customerData, ownerId: null, managerUids: [] };
                batch.set(newStoreRef, newStoreData);

                // 2. Create the connection document
                const newConnectionRef = doc(collection(firestore, 'supplierStoreConnections'));
                const newConnectionData = {
                    wholesalerId: wholesaler.id,
                    storeId: newStoreRef.id,
                    isActive: true,
                    connectionDate: serverTimestamp(),
                };
                batch.set(newConnectionRef, newConnectionData);

                await batch.commit();

                // Manually add to local state to avoid re-fetch
                setCustomers(prev => [...prev, { ...newStoreData, id: newStoreRef.id }]);

                toast({ title: "Επιτυχής Καταχώρηση", description: `Ο πελάτης '${customerData.businessName}' προστέθηκε.` });
            }
        } catch (e) {
            console.error(e);
            toast({ variant: "destructive", title: "Σφάλμα Αποθήκευσης", description: "Δεν ήταν δυνατή η αποθήκευση του πελάτη."});
        } finally {
            setIsLoading(false);
            setIsDialogOpen(false);
            setEditingCustomer(null);
        }
    }
    
    const handleDeleteCustomer = async (customerId: string) => {
        if (!firestore || !wholesaler) return;
        const customer = customers.find(c => c.id === customerId);
        if (!customer) return;

        setIsLoading(true);
        try {
            const q = query(
                collection(firestore, 'supplierStoreConnections'),
                where('wholesalerId', '==', wholesaler.id),
                where('storeId', '==', customerId)
            );
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const connectionDoc = querySnapshot.docs[0];
                await deleteDocumentNonBlocking(connectionDoc.ref);
                setCustomers(prev => prev.filter(c => c.id !== customerId));
                toast({
                    variant: 'destructive',
                    title: "Επιτυχής Διαγραφή",
                    description: `Ο πελάτης '${customer?.businessName}' διαγράφηκε (αποσυνδέθηκε).`
                });
            } else {
                 throw new Error("Connection document not found");
            }
        } catch(e) {
             console.error(e);
             toast({ variant: 'destructive', title: 'Σφάλμα Διαγραφής'});
        } finally {
            setIsLoading(false);
        }
    }

    const openDialogForEdit = (customer: Store) => {
        setEditingCustomer(customer);
        setIsDialogOpen(true);
    }
    
    const openDialogForNew = () => {
        setEditingCustomer({});
        setIsDialogOpen(true);
    }
    
    const combinedLoading = isLoadingWholesalers || isLoading;

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-lg font-semibold md:text-2xl">Πελάτες</h1>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Λίστα Πελατών</CardTitle>
                        <CardDescription>
                            Διαχειριστείτε τους πελάτες της επιχείρησής σας.
                        </CardDescription>
                    </div>
                     <Button onClick={openDialogForNew} disabled={!wholesaler}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Καταχώρηση Πελάτη
                    </Button>
                </CardHeader>
                <CardContent>
                   <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Επωνυμία</TableHead>
                                <TableHead>Υπεύθυνος</TableHead>
                                <TableHead className="hidden sm:table-cell">Τηλέφωνο</TableHead>
                                <TableHead className="hidden md:table-cell">Ημέρα Παράδοσης</TableHead>
                                <TableHead className="text-right">Ενέργειες</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {combinedLoading && (
                                 <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                                    </TableCell>
                                </TableRow>
                            )}
                            {!combinedLoading && customers.map((customer) => (
                                <TableRow key={customer.id}>
                                    <TableCell className="font-medium">{customer.businessName}</TableCell>
                                    <TableCell>{customer.ownerName}</TableCell>
                                    <TableCell className="hidden sm:table-cell text-muted-foreground">{customer.phone}</TableCell>
                                    <TableCell className="hidden md:table-cell">{customer.deliveryDay}</TableCell>
                                    <TableCell className="text-right">
                                         <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => openDialogForEdit(customer)}>
                                                    Επεξεργασία
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteCustomer(customer.id)}>
                                                    Διαγραφή
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {!combinedLoading && customers.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Δεν έχετε προσθέσει ακόμα πελάτες.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                   </Table>
                </CardContent>
            </Card>

             <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-md">
                     {isDialogOpen && (
                         <CustomerForm 
                            customer={editingCustomer}
                            onSave={handleSaveCustomer}
                            onCancel={() => {
                                setIsDialogOpen(false);
                                setEditingCustomer(null);
                            }}
                         />
                     )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
