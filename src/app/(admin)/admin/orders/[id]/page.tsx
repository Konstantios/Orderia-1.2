'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { adminOrders, products } from '@/lib/data';
import type { Order, OrderItem } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Download } from 'lucide-react';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';
import * as XLSX from 'xlsx';

export default function OrderDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const [order, setOrder] = useState<Order | null>(null);
    const [supplierNotes, setSupplierNotes] = useState('');

    useEffect(() => {
        const orderId = params.id as string;
        // In a real app, you would fetch this data.
        const foundOrder = adminOrders.find(o => o.id === orderId);
        if (foundOrder) {
            setOrder(foundOrder);
            setSupplierNotes(foundOrder.supplierNotes || '');
        }
    }, [params.id]);

    const handleSaveNotes = () => {
        if (!order) return;
        // This is a demo, so we're not persisting this change.
        // In a real app, this would be an API call.
        toast({ title: "Οι σημειώσεις αποθηκεύτηκαν (Demo)!" });
    };
    
    const handleExport = () => {
        if (!order) return;

        const exportData = order.items.map(item => {
            const product = products.find(p => p.id === item.productId);
            return {
                'ID Παραγγελίας': order.id,
                'Πελάτης': order.customerName,
                'Ημερομηνία Παραγγελίας': new Date(order.date).toLocaleString('el-GR'),
                'Κατάσταση': order.status,
                'Τηλέφωνο Υπευθύνου': '6900000000', // Placeholder for demo
                'Κωδικός Προϊόντος': product?.code || '-',
                'Προϊόν': product?.name || 'Άγνωστο',
                'Ποσότητα': item.quantity,
                'Μονάδα': product?.unit || '-',
                'Σημειώσεις Πελάτη': order.notes || '-',
            };
        });
        
        // If there are no items, we can still export order-level info
        if (exportData.length === 0) {
             exportData.push({
                'ID Παραγγελίας': order.id,
                'Πελάτης': order.customerName,
                'Ημερομηνία Παραγγελίας': new Date(order.date).toLocaleString('el-GR'),
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

        // Auto-fit columns for better readability
        const colWidths = Object.keys(exportData[0] || {}).map(key => ({
            wch: Math.max(
                key.length,
                ...exportData.map(row => (String(row[key as keyof typeof row]) || '').length)
            ) + 2 // add a little padding
        }));
        worksheet['!cols'] = colWidths;

        XLSX.writeFile(workbook, `Order_${order.id}.xlsx`);
    };

    if (!order) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <p className="text-lg mb-4">Η παραγγελία δεν βρέθηκε ή φορτώνεται...</p>
                <Button asChild variant="outline">
                    <Link href="/admin/orders">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Επιστροφή στις παραγγελίες
                    </Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" className="shrink-0" onClick={() => router.push('/admin/orders')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">Παραγγελία #{order.id}</h1>
                        <p className="text-base text-muted-foreground">{order.customerName} - {format(new Date(order.date), 'PPpp', { locale: el })}</p>
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
                                {order.items.length > 0 ? order.items.map((item: OrderItem) => {
                                    const product = products.find(p => p.id === item.productId);
                                    if (!product) return null;
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
