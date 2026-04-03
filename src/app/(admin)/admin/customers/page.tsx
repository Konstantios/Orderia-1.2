'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle } from 'lucide-react';
import { adminCustomers as initialCustomers } from '@/lib/data';
import type { AdminCustomer } from '@/lib/types';
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


const CustomerForm = ({ customer, onSave, onCancel }: { customer: Partial<AdminCustomer> | null; onSave: (customer: AdminCustomer) => void; onCancel: () => void }) => {
    const [formData, setFormData] = useState<Partial<AdminCustomer>>(customer || {});
    const { toast } = useToast();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({...prev, [name]: value}));
    }
    
    const handleSelectChange = (value: string) => {
        setFormData(prev => ({...prev, deliveryDay: value}));
    }

    const handleSubmit = () => {
        // Basic validation
        if (!formData.companyName || !formData.vatNumber || !formData.phone1 || !formData.address || !formData.deliveryDay || !formData.contactName) {
            toast({
                variant: 'destructive',
                title: 'Ελλιπή Στοιχεία',
                description: 'Παρακαλώ συμπληρώστε όλα τα υποχρεωτικά πεδία.',
            });
            return;
        }

        const customerToSave: AdminCustomer = {
            id: formData.id || `cust-${Date.now()}`,
            companyName: formData.companyName,
            vatNumber: formData.vatNumber,
            phone1: formData.phone1,
            phone2: formData.phone2,
            address: formData.address,
            googleMapsLink: formData.googleMapsLink,
            deliveryDay: formData.deliveryDay,
            contactName: formData.contactName,
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
                    <Label htmlFor="companyName" className="text-right">Επωνυμία</Label>
                    <Input id="companyName" name="companyName" value={formData.companyName || ''} onChange={handleChange} className="col-span-3" />
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="vatNumber" className="text-right">ΑΦΜ</Label>
                    <Input id="vatNumber" name="vatNumber" value={formData.vatNumber || ''} onChange={handleChange} className="col-span-3" />
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="contactName" className="text-right">Υπεύθυνος</Label>
                    <Input id="contactName" name="contactName" value={formData.contactName || ''} onChange={handleChange} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="phone1" className="text-right">Τηλέφωνο</Label>
                    <Input id="phone1" name="phone1" value={formData.phone1 || ''} onChange={handleChange} className="col-span-3" />
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
    const [customers, setCustomers] = useState<AdminCustomer[]>(initialCustomers);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Partial<AdminCustomer> | null>(null);
    const { toast } = useToast();

    const handleSaveCustomer = (customer: AdminCustomer) => {
        if(editingCustomer?.id) { // Editing existing
            setCustomers(prev => prev.map(c => c.id === customer.id ? customer : c));
            toast({ title: "Επιτυχής Ενημέρωση", description: `Τα στοιχεία του πελάτη '${customer.companyName}' ενημερώθηκαν.` });
        } else { // Adding new
            setCustomers(prev => [customer, ...prev]);
            toast({ title: "Επιτυχής Καταχώρηση", description: `Ο πελάτης '${customer.companyName}' προστέθηκε.` });
        }
        setIsDialogOpen(false);
        setEditingCustomer(null);
    }
    
    const handleDeleteCustomer = (customerId: string) => {
        const customer = customers.find(c => c.id === customerId);
        setCustomers(prev => prev.filter(c => c.id !== customerId));
        toast({
            variant: 'destructive',
            title: "Επιτυχής Διαγραφή",
            description: `Ο πελάτης '${customer?.companyName}' διαγράφηκε.`
        });
    }

    const openDialogForEdit = (customer: AdminCustomer) => {
        setEditingCustomer(customer);
        setIsDialogOpen(true);
    }
    
    const openDialogForNew = () => {
        setEditingCustomer({});
        setIsDialogOpen(true);
    }

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
                     <Button onClick={openDialogForNew}>
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
                            {customers.map((customer) => (
                                <TableRow key={customer.id}>
                                    <TableCell className="font-medium">{customer.companyName}</TableCell>
                                    <TableCell>{customer.contactName}</TableCell>
                                    <TableCell className="hidden sm:table-cell text-muted-foreground">{customer.phone1}</TableCell>
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
