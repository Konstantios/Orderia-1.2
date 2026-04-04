'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import type { Order, OrderItem, Product } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { useFirebase, useDoc, useCollection, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { doc, collection } from 'firebase/firestore';


export default function OrderDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const orderId = params.id as string;
    const { firestore } = useFirebase();
    
    const orderRef = useMemoFirebase(() => {
        if (!firestore || !orderId) return null;
        return doc(firestore, 'orders', orderId);
    }, [firestore, orderId]);

    const { data: order, isLoading: isLoadingOrder, error } = useDoc<Order>(orderRef);

    const productsQuery = useMemoFirebase(() => {
        if (!firestore || !order?.wholesalerId) return null;
        return collection(firestore, 'wholesalers', order.wholesalerId, 'products');
    }, [firestore, order]);

    const { data: products, isLoading: isLoadingProducts } = useCollection<Product>(productsQuery);

    const [supplierNotes, setSupplierNotes] = useState('');

    useEffect(() => {
        if (order) {
            setSupplierNotes(order.supplierNotes || '');
        }
    }, [order]);

    const handleSaveNotes = () => {
        if (!orderRef) return;
        updateDocumentNonBlocking(orderRef, { supplierNotes });
        toast({ title: "Οι σημειώσεις αποθηκεύτηκαν!" });
    };
    
    const handleExport = () => {
        if (!order || !products) return;

        const orderDate = (order.date as any)?.toDate ? (order.date as any).toDate() : new Date(order.date);

        const exportData = order.items.map(item => {
            const product = products.find(p => p.id === item.productId);
            return {
                'ID Παραγγελίας': order.id,
                'Πελάτης': order.customerName,
                'Ημερομηνία Παραγγελίας': orderDate.toLocaleString('el-GR'),
                'Κατάσταση': order.status,
                'Τηλέφωνο Υπευθύνου': '6900000000', // Placeholder for demo
                'Κωδικός Προϊόντος': product?.code || '-',
                'Προϊόν': product?.name || 'Άγνωστο',
                'Ποσότητα': item.quantity,
                'Μονάδα': product?.unit || '-',
                'Σημειώσεις Πελάτη': order.notes || '-',
            };
        });
        
        if (exportData.length === 0) {
             exportData.push({
                'ID Παραγγελίας': order.id,
                'Πελάτης': order.customerName,
                'Ημερομηνία Παραγγελίας': orderDate.toLocaleString('el-GR'),
                'Κατάσταση': order.status,
                'Τηλέφωνο Υπευθύνου': '6900000000',
                'Κωδικός Προϊόντος': '-',
                'Προϊόν': '-',
                'Ποσότητα': 0,
                'Μονάδα': '-',
                'Σημειώσεις Πελάτη': order.notes || '-',
             })
        }

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `Order_${order.id}`);

        const colWidths = Object.keys(exportData[0] || {}).map(key => ({
            wch: Math.max(
                key.length,
                ...exportData.map(row => (String(row[key as keyof typeof row]) || '').length)
            ) + 2
        }));
        worksheet['!cols'] = colWidths;

        XLSX.writeFile(workbook, `Order_${order.id}.xlsx`);
    };
    
    if (isLoadingOrder || isLoadingProducts) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                <p className="text-lg">Φόρτωση παραγγελίας...</p>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <p className="text-lg mb-4">Η παραγγελία δεν βρέθηκε ή δεν έχετε δικαίωμα πρόσβασης.</p>
                <Button asChild variant="outline">
                    <Link href="/admin/orders">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Επιστροφή στις παραγγελίες
                    </Link>
                </Button>
            </div>
        );
    }

    const orderDate = (order.date as any)?.toDate ? (order.date as any).toDate() : new Date(order.date);

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" className="shrink-0" onClick={() => router.push('/admin/orders')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">Παραγγελία #{order.id}</h1>
                        <p className="text-base text-muted-foreground">{order.customerName} - {format(orderDate, 'PPpp', { locale: el })}</p>
                    </div>
                </div>
                <Button variant="outline" onClick={handleExport}><Download className="mr-2 h-4 w-4" />Εξαγωγή</Button>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                 <div className="space-y-6">
                    <Card>
                        <CardHeader><CardTitle>Προϊόντα</CardTitle></CardHeader>
                        <CardContent>
                            <ul className="space-y-4">
                                {order.items.length > 0 && products ? order.items.map((item: OrderItem) => {
                                    const product = products.find(p => p.id === item.productId);
                                    if (!product) return (
                                        <li key={item.productId} className="flex items-center gap-4 text-sm text-destructive">
                                            Δεν βρέθηκε το προϊόν ID: {item.productId}
                                        </li>
                                    );
                                    return (
                                        <li key={item.productId} className="flex items-center gap-4">
                                            <Image src={product.imageUrl} alt={product.name} width={56} height={56} className="rounded-md object-cover" data-ai-hint={product.imageHint} />
                                            <div className="flex-1">
                                                <p className="font-semibold">{product.name}</p>
                                                <p className="text-sm text-muted-foreground">{product.code}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-lg">{item.quantity}</p>
                                                <p className="text-xs text-muted-foreground">{product.unit}</p>
                                            </div>
                                        </li>
                                    );
                                }) : <p className="text-sm text-muted-foreground">Δεν υπάρχουν προϊόντα σε αυτή την παραγγελία.</p>}
                            </ul>
                        </CardContent>
                    </Card>
                </div>
                 <div className="space-y-6">
                    {order.notes && (
                        <Card>
                            <CardHeader><CardTitle>Σημειώσεις Πελάτη</CardTitle></CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-md">{order.notes}</p>
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader><CardTitle>Οι Σημειώσεις σας</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <Textarea
                                placeholder="Προσθέστε σημειώσεις για την ομάδα σας..."
                                value={supplierNotes}
                                onChange={(e) => setSupplierNotes(e.target.value)}
                                className="min-h-[120px]"
                            />
                            <Button onClick={handleSaveNotes} className="w-full">Αποθήκευση Σημειώσεων</Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
