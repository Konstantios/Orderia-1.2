'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Search, Loader2 } from 'lucide-react';
import { customers, products as allProducts } from '@/lib/data';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import type { Customer, Product, Wholesaler } from '@/lib/types';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

// For now, let's assume the first customer in our mock data is the supplier.
// In a real app, this would come from a 'connections' collection in Firestore.
const connectedSuppliers: Customer[] = [customers[0]]; 

const SupplierProducts = ({ supplier }: { supplier: Customer }) => {
    const products = allProducts.filter(p => supplier.products.some(sp => sp.productId === p.id));

    return (
        <div className="space-y-4 pt-4">
            <h3 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">
                Λίστα Προϊόντων
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map(product => (
                    <Card key={product.id} className="overflow-hidden bg-card/50">
                        <CardContent className="p-3">
                            <div className="flex items-center gap-3">
                                <Image src={product.imageUrl} alt={product.name} width={56} height={56} className="rounded-md object-cover" data-ai-hint={product.imageHint} />
                                <div>
                                    <p className="font-semibold text-sm leading-tight">{product.name}</p>
                                    <p className="text-xs text-muted-foreground">{product.code}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
};

export default function SuppliersPage() {
    const { toast } = useToast();
    const { firestore } = useFirebase();

    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [searchCode, setSearchCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [foundSupplier, setFoundSupplier] = useState<Wholesaler | null>(null);

    const supplierLogo = PlaceHolderImages.find(img => img.id === 'frozen-foods-logo')!;

    const handleSearchSupplier = async () => {
        if (!searchCode.trim()) {
            toast({ variant: 'destructive', title: 'Εισάγετε Κωδικό' });
            return;
        }
        if (!firestore) return;

        setIsLoading(true);
        setFoundSupplier(null);

        try {
            const q = query(
                collection(firestore, 'wholesalers'),
                where('supplierCode', '==', searchCode.trim()),
                limit(1)
            );
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const supplierDoc = querySnapshot.docs[0];
                setFoundSupplier({ id: supplierDoc.id, ...supplierDoc.data() } as Wholesaler);
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Δεν Βρέθηκε Προμηθευτής',
                    description: 'Ελέγξτε τον κωδικό και προσπαθήστε ξανά.',
                });
            }
        } catch (error) {
            console.error("Error searching for supplier:", error);
            toast({ variant: 'destructive', title: 'Σφάλμα', description: 'Προέκυψε σφάλμα κατά την αναζήτηση.' });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleSendConnectionRequest = () => {
        if(!foundSupplier) return;
        
        // This is where you would create a 'SupplierStoreRequest' document in Firestore.
        // For this example, we'll just show a success toast.
        
        toast({
            title: "Το Αίτημα Στάλθηκε!",
            description: `Το αίτημα σύνδεσης στάλθηκε στον προμηθευτή "${foundSupplier.companyName}".`
        });
        
        setFoundSupplier(null);
        setSearchCode('');
        setIsAddDialogOpen(false);
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="font-headline text-3xl font-bold">Προμηθευτές</h1>
                 <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Προσθήκη Προμηθευτή
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Αναζήτηση Νέου Προμηθευτή</DialogTitle>
                            <DialogDescription>
                                Εισάγετε τον μοναδικό κωδικό που σας έχει δώσει ο προμηθευτής για να συνδεθείτε.
                            </DialogDescription>
                        </DialogHeader>
                        {!foundSupplier ? (
                             <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                     <Label htmlFor="supplier-code">Κωδικός Προμηθευτή</Label>
                                     <div className="flex w-full items-center space-x-2">
                                        <Input 
                                            id="supplier-code"
                                            placeholder="π.χ. FRZ-AB12"
                                            value={searchCode}
                                            onChange={(e) => setSearchCode(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSearchSupplier()}
                                        />
                                        <Button type="button" size="icon" onClick={handleSearchSupplier} disabled={isLoading}>
                                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Search className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="py-4 space-y-4">
                               <p className="text-sm text-muted-foreground">Βρέθηκε ο παρακάτω προμηθευτής. Θέλετε να στείλετε αίτημα σύνδεσης;</p>
                               <Card>
                                   <CardHeader>
                                       <CardTitle>{foundSupplier.companyName}</CardTitle>
                                       <CardDescription>
                                            {foundSupplier.description || 'Δεν υπάρχει διαθέσιμη περιγραφή.'}
                                       </CardDescription>
                                   </CardHeader>
                               </Card>
                               <DialogFooter className="pt-4">
                                    <Button variant="outline" onClick={() => setFoundSupplier(null)}>Ακύρωση</Button>
                                    <Button onClick={handleSendConnectionRequest}>Αποστολή Αιτήματος</Button>
                               </DialogFooter>
                           </div>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
            
            <Accordion type="single" collapsible defaultValue="item-1" className="w-full space-y-4">
                {connectedSuppliers.map(supplier => (
                    <AccordionItem key={supplier.id} value={`item-${supplier.id}`} className="border-none">
                        <Card className="rounded-lg">
                          <AccordionTrigger className="flex w-full items-center justify-between p-4 hover:no-underline">
                              <div className="flex items-center gap-4 text-left">
                                  {supplierLogo && <Image src={supplierLogo.imageUrl} alt={supplier.name} width={56} height={56} className="rounded-md" data-ai-hint={supplierLogo.imageHint} />}
                                  <div>
                                      <p className="font-semibold text-lg">{supplier.name}</p>
                                      <p className="text-sm text-muted-foreground">{supplier.products.length} Ενεργά Προϊόντα</p>
                                  </div>
                              </div>
                          </AccordionTrigger>
                           <AccordionContent className="px-4 pb-4">
                               <SupplierProducts supplier={supplier} />
                           </AccordionContent>
                        </Card>
                    </AccordionItem>
                ))}
            </Accordion>
        </div>
    );
}
