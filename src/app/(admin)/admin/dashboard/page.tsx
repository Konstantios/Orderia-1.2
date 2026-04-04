'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Icons } from "@/components/icons"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useRouter } from "next/navigation"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, Cell } from 'recharts';
import { cn } from "@/lib/utils"
import { ArrowDown, ArrowUp, Edit, PlusCircle, Trash2, Loader2 } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useFirebase, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking, WithId } from "@/firebase";
import { collection, query, where, doc, serverTimestamp, orderBy, Timestamp } from "firebase/firestore";
import type { Order, Wholesaler, Product, Warehouse, WholesalerStockItem, PostItNote as PostItNoteType } from "@/lib/types";
import { isToday, isYesterday, format, subDays, isSameDay, startOfWeek, endOfWeek, subWeeks, isWithinInterval, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { el } from 'date-fns/locale';

type PostItNote = WithId<PostItNoteType>;

const noteColors: { [key: string]: string } = {
    yellow: 'bg-yellow-400/10 border-yellow-500/30',
    blue: 'bg-blue-400/10 border-blue-500/30',
    green: 'bg-green-400/10 border-green-500/30'
}

const renderSalesTable = (data: {period: string, items: number, change: number}[]) => (
    <Table>
        <TableHeader>
            <TableRow>
                <TableHead>Περίοδος</TableHead>
                <TableHead className="text-center">Τεμάχια</TableHead>
                <TableHead className="text-right">Απόκλιση</TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {data.map(sale => (
                <TableRow key={sale.period}>
                    <TableCell className="font-medium">{sale.period}</TableCell>
                    <TableCell className="text-center">{sale.items}</TableCell>
                    <TableCell className={cn(
                        "text-right font-semibold flex justify-end items-center gap-1",
                        sale.change > 0 ? 'text-green-500' : 'text-red-500'
                    )}>
                        {sale.change > 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                        {Math.abs(sale.change)}
                    </TableCell>
                </TableRow>
            ))}
        </TableBody>
    </Table>
);

const SalesChart = ({ data, dataKey }: { data: any[], dataKey: string }) => (
    <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false}/>
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`}/>
            <Tooltip
                contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                }}
            />
            <Bar dataKey={dataKey} radius={[4, 4, 0, 0]}>
                <LabelList dataKey={dataKey} position="top" className="fill-foreground" fontSize={12} />
                {data.map((entry, index) => {
                    const prevEntry = index > 0 ? data[index - 1] : null;
                    const color = !prevEntry || entry[dataKey] >= prevEntry[dataKey]
                        ? '#22c55e' // text-green-500
                        : '#ef4444'; // text-red-500
                    return <Cell key={`cell-${index}`} fill={color} />;
                })}
            </Bar>
        </BarChart>
    </ResponsiveContainer>
);

const NoteForm = ({ note, onSave, onCancel }: { note: Partial<PostItNote> | null, onSave: (data: { text: string, color: 'yellow' | 'blue' | 'green' }) => void, onCancel: () => void }) => {
    const [text, setText] = useState(note?.text || '');
    const [color, setColor] = useState<'yellow' | 'blue' | 'green'>(note?.color || 'yellow');
    const { toast } = useToast();

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!text) {
            toast({ variant: 'destructive', title: "Το κείμενο δεν μπορεί να είναι κενό" });
            return;
        }
        onSave({ text, color });
    };

    const dialogColors = {
        yellow: 'bg-yellow-400/10',
        blue: 'bg-blue-400/10',
        green: 'bg-green-400/10',
    };
    
    const colorRing = {
        yellow: 'ring-yellow-500',
        blue: 'ring-blue-500',
        green: 'ring-green-500',
    }

    const colorBg = {
        yellow: 'bg-yellow-400',
        blue: 'bg-blue-400',
        green: 'bg-green-400',
    }
    
    const colorTextareaBg = {
        yellow: 'bg-yellow-400/20 focus-visible:bg-yellow-400/30',
        blue: 'bg-blue-400/20 focus-visible:bg-blue-400/30',
        green: 'bg-green-400/20 focus-visible:bg-green-400/30',
    }


    return (
        <form onSubmit={handleSubmit} className={cn("flex flex-col", dialogColors[color])}>
            <DialogHeader className="p-6 pb-4">
                <DialogTitle>{note?.id ? 'Επεξεργασία Σημείωσης' : 'Νέα Σημείωση'}</DialogTitle>
                <DialogDescription>
                    {note?.id ? 'Επεξεργαστείτε τη σημείωσή σας.' : 'Προσθέστε μια νέα σημείωση στον πίνακα ελέγχου.'}
                </DialogDescription>
            </DialogHeader>
            <div className="p-6 pt-0 space-y-4 flex-1">
                <Textarea 
                    id="note-text" 
                    name="text" 
                    value={text} 
                    onChange={(e) => setText(e.target.value)} 
                    required 
                    className={cn(
                        "h-32 text-base resize-none border-black/20 focus-visible:ring-offset-0 focus-visible:ring-2", 
                        colorTextareaBg[color],
                        colorRing[color]
                    )}
                    placeholder="Γράψτε τη σημείωσή σας εδώ..."
                />
                <div className="space-y-2">
                    <Label>Χρώμα</Label>
                    <div className="flex gap-4 pt-2">
                        {(['yellow', 'blue', 'green'] as const).map(c => (
                             <button
                                key={c}
                                type="button"
                                title={c.charAt(0).toUpperCase() + c.slice(1)}
                                onClick={() => setColor(c)}
                                className={cn(
                                    'w-8 h-8 rounded-full transition-all duration-150 border-2 border-transparent',
                                    colorBg[c],
                                    color === c ? `ring-2 ring-offset-2 ring-offset-background ${colorRing[c]}` : 'scale-90 opacity-70 hover:opacity-100'
                                )}
                            />
                        ))}
                    </div>
                </div>
            </div>
            <DialogFooter className="p-6 mt-auto bg-black/5">
                <Button type="button" variant="ghost" onClick={onCancel}>Ακύρωση</Button>
                <Button type="submit">Αποθήκευση</Button>
            </DialogFooter>
        </form>
    );
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, firestore, isUserLoading } = useFirebase();

  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<PostItNote | null>(null);

  // 1. Fetch Wholesaler
  const wholesalerQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'wholesalers'), where('adminUids', 'array-contains', user.uid));
  }, [user, firestore]);
  const { data: wholesalers, isLoading: isLoadingWholesalers } = useCollection<Wholesaler>(wholesalerQuery);
  const wholesaler = wholesalers?.[0];

  // 2. Fetch Orders for KPIs and Sales Analysis
  const ordersQuery = useMemoFirebase(() => {
    if (!wholesaler || !firestore) return null;
    return query(collection(firestore, 'orders'), where('wholesalerId', '==', wholesaler.id));
  }, [wholesaler, firestore]);
  const { data: orders, isLoading: isLoadingOrders } = useCollection<Order>(ordersQuery);

  // 3. Fetch Products, Warehouses, and Stock for Low Stock Items
  const productsQuery = useMemoFirebase(() => {
    if (!wholesaler || !firestore) return null;
    return collection(firestore, 'wholesalers', wholesaler.id, 'products');
  }, [wholesaler, firestore]);
  const { data: products, isLoading: isLoadingProducts } = useCollection<Product>(productsQuery);

  const warehousesQuery = useMemoFirebase(() => {
    if (!wholesaler || !firestore) return null;
    return collection(firestore, 'wholesalers', wholesaler.id, 'warehouses');
  }, [wholesaler, firestore]);
  const { data: warehouses, isLoading: isLoadingWarehouses } = useCollection<Warehouse>(warehousesQuery);
  const firstWarehouse = warehouses?.[0];

  const stockQuery = useMemoFirebase(() => {
    if (!firstWarehouse || !wholesaler || !firestore) return null;
    return collection(firestore, 'wholesalers', wholesaler.id, 'warehouses', firstWarehouse.id, 'inventories');
  }, [firstWarehouse, wholesaler, firestore]);
  const { data: stock, isLoading: isLoadingStock } = useCollection<WholesalerStockItem>(stockQuery);
  
  // 4. Fetch Post-it notes
  const postitsQuery = useMemoFirebase(() => {
    if (!wholesaler || !firestore) return null;
    return query(collection(firestore, 'wholesalers', wholesaler.id, 'postits'), orderBy('createdAt', 'desc'));
  }, [wholesaler, firestore]);
  const { data: postItNotes, isLoading: isLoadingNotes } = useCollection<PostItNoteType>(postitsQuery);

  const { todayOrders, pendingOrders } = useMemo(() => {
    if (!orders) return { todayOrders: 0, pendingOrders: 0 };
    const todayOrdersCount = orders.filter(o => isToday(new Date(o.date))).length;
    const pendingOrdersCount = orders.filter(o => o.status === 'Εκκρεμής').length;
    return { todayOrders: todayOrdersCount, pendingOrders: pendingOrdersCount };
  }, [orders]);

  const salesData = useMemo(() => {
    const getOrderTotalItems = (order: Order) => order.items.reduce((sum, item) => sum + item.quantity, 0);

    if (!orders) {
      return { daily: [], weekly: [], monthly: [] };
    }
    const now = new Date();

    // Daily
    const daily = Array.from({ length: 7 }).map((_, i) => {
        const targetDate = subDays(now, i);
        const prevTargetDate = subDays(now, i + 1);

        const items = orders
            .filter(o => isSameDay(new Date(o.date), targetDate))
            .reduce((sum, o) => sum + getOrderTotalItems(o), 0);
        
        const prevItems = orders
            .filter(o => isSameDay(new Date(o.date), prevTargetDate))
            .reduce((sum, o) => sum + getOrderTotalItems(o), 0);

        let periodLabel = format(targetDate, 'dd/MM');
        if (isToday(targetDate)) periodLabel = 'Σήμερα';
        if (isYesterday(targetDate)) periodLabel = 'Χθες';

        return { period: periodLabel, items, change: items - prevItems };
    });

    // Weekly
    const weekly = Array.from({ length: 4 }).map((_, i) => {
      const weekAgo = subWeeks(now, i);
      const start = startOfWeek(weekAgo, { weekStartsOn: 1 });
      const end = endOfWeek(weekAgo, { weekStartsOn: 1 });

      const prevWeekAgo = subWeeks(now, i + 1);
      const prevStart = startOfWeek(prevWeekAgo, { weekStartsOn: 1 });
      const prevEnd = endOfWeek(prevWeekAgo, { weekStartsOn: 1 });
      
      const items = orders
          .filter(o => isWithinInterval(new Date(o.date), { start, end }))
          .reduce((sum, o) => sum + getOrderTotalItems(o), 0);
      
      const prevItems = orders
          .filter(o => isWithinInterval(new Date(o.date), { start: prevStart, end: prevEnd }))
          .reduce((sum, o) => sum + getOrderTotalItems(o), 0);
      
      let periodLabel = `${format(start, 'dd/MM')} - ${format(end, 'dd/MM')}`;
      if (i === 0) periodLabel = "Αυτή η εβδομάδα";
      if (i === 1) periodLabel = "Προηγούμενη εβδ.";

      return { period: periodLabel, items, change: items - prevItems };
    });
    
    // Monthly
    const monthly = Array.from({ length: 6 }).map((_, i) => {
        const monthAgo = subMonths(now, i);
        const start = startOfMonth(monthAgo);
        const end = endOfMonth(monthAgo);

        const prevMonthAgo = subMonths(now, i + 1);
        const prevStart = startOfMonth(prevMonthAgo);
        const prevEnd = endOfMonth(prevMonthAgo);

        const items = orders
            .filter(o => isWithinInterval(new Date(o.date), { start, end }))
            .reduce((sum, o) => sum + getOrderTotalItems(o), 0);
        
        const prevItems = orders
            .filter(o => isWithinInterval(new Date(o.date), { start: prevStart, end: prevEnd }))
            .reduce((sum, o) => sum + getOrderTotalItems(o), 0);
        
        return { period: format(monthAgo, 'LLLL', { locale: el }), items, change: items - prevItems };
    });

    return { daily, weekly, monthly };
  }, [orders]);


  const lowStockItems = useMemo(() => {
    if (!stock || !products) return [];
    return stock
    .map(stockItem => {
        const product = products.find(p => p.id === stockItem.productId);
        if (!product) return null;
        const { quantity, idealStock } = stockItem;
        if (idealStock > 0 && quantity < idealStock * 0.4) {
            return {
                ...product,
                currentStock: quantity,
                idealStock,
                suggestion: Math.max(0, idealStock - quantity),
            };
        }
        return null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a,b) => (a.currentStock/a.idealStock) - (b.currentStock/b.idealStock));
  }, [stock, products]);

  const handleRoleChange = (role: string) => {
    if (role === 'store') {
      router.push('/');
    }
  };

  const openNoteDialog = (note: PostItNote | null) => {
    setEditingNote(note);
    setIsNoteDialogOpen(true);
  };

  const handleDeleteNote = (noteId: string) => {
    if (!firestore || !wholesaler) return;
    const noteRef = doc(firestore, 'wholesalers', wholesaler.id, 'postits', noteId);
    deleteDocumentNonBlocking(noteRef);
    toast({ title: "Η σημείωση διαγράφηκε" });
  };

  const handleSaveNote = (data: { text: string; color: 'yellow' | 'blue' | 'green' }) => {
    if (!firestore || !wholesaler) return;
    const { text, color } = data;

    if (editingNote?.id) { // Editing
        const noteRef = doc(firestore, 'wholesalers', wholesaler.id, 'postits', editingNote.id);
        updateDocumentNonBlocking(noteRef, { text, color });
        toast({ title: "Η σημείωση ενημερώθηκε" });
    } else { // Adding
        const notesColRef = collection(firestore, 'wholesalers', wholesaler.id, 'postits');
        const newNote: PostItNoteType = {
            text,
            color,
            createdAt: serverTimestamp(),
            wholesalerId: wholesaler.id,
            ownerId: wholesaler.ownerId,
            adminUids: wholesaler.adminUids,
        };
        addDocumentNonBlocking(notesColRef, newNote);
        toast({ title: "Η σημείωση προστέθηκε" });
    }
    setIsNoteDialogOpen(false);
    setEditingNote(null);
  };


  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold md:text-2xl">Πίνακας Ελέγχου</h1>
         <div className="flex justify-center">
            <Tabs defaultValue="supplier" onValueChange={handleRoleChange} className="w-full max-w-sm">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="store">Κατάστημα</TabsTrigger>
                    <TabsTrigger value="supplier">Προμηθευτής</TabsTrigger>
                </TabsList>
            </Tabs>
      </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Left Column */}
        <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Σημερινές Παραγγελίες</CardTitle>
                <Icons.newOrder className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoadingOrders ? <Loader2 className="h-6 w-6 animate-spin"/> : <div className="text-2xl font-bold">{todayOrders}</div>}
              </CardContent>
            </Card>
             <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Εκκρεμείς Παραγγελίες</CardTitle>
                <Icons.history className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoadingOrders ? <Loader2 className="h-6 w-6 animate-spin"/> : <div className="text-2xl font-bold">{pendingOrders}</div>}
              </CardContent>
            </Card>
          
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Icons.warehouse className="h-5 w-5 text-destructive" />
                        <span>Προϊόντα σε Έλλειψη</span>
                    </CardTitle>
                    <CardDescription>
                        Προϊόντα με απόθεμα κάτω του 40% του ιδανικού.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoadingProducts || isLoadingStock ? (
                         <div className="flex justify-center items-center h-20"><Loader2 className="h-6 w-6 animate-spin"/></div>
                    ) : lowStockItems.length > 0 ? (
                        <Accordion type="multiple" className="w-full space-y-2">
                            {lowStockItems.map(item => (
                                <AccordionItem key={item.id} value={`low-stock-${item.id}`} className="rounded-lg border border-destructive/30 bg-destructive/10 px-4">
                                    <AccordionTrigger className="py-3 text-sm font-semibold hover:no-underline text-left">
                                        {item.name}
                                    </AccordionTrigger>
                                    <AccordionContent className="pt-0 pb-3 text-sm text-muted-foreground space-y-1">
                                        <div className="flex justify-between"><span>Κωδικός:</span> <span>{item.code}</span></div>
                                        <div className="flex justify-between"><span>Απόθεμα:</span> <span className="font-bold text-destructive">{item.currentStock}</span></div>
                                        <div className="flex justify-between"><span>Ιδανικό:</span> <span>{item.idealStock}</span></div>
                                        <div className="flex justify-between"><span>Πρόταση:</span> <span className="font-bold text-accent">+{item.suggestion}</span></div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    ) : (
                        <p className="text-center text-sm text-muted-foreground py-4">Κανένα προϊόν σε κρίσιμη έλλειψη.</p>
                    )}
                </CardContent>
            </Card>
           <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Post-it</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => openNoteDialog({})}>
                    <PlusCircle className="h-5 w-5" />
                </Button>
            </CardHeader>
            <CardContent>
                {isLoadingNotes ? (
                     <div className="flex justify-center items-center h-20"><Loader2 className="h-6 w-6 animate-spin"/></div>
                ) : postItNotes && postItNotes.length > 0 ? (
                    <Accordion type="multiple" className="w-full space-y-2">
                        {postItNotes.map(note => (
                            <AccordionItem key={note.id} value={`item-${note.id}`} className={cn("rounded-lg border", noteColors[note.color])}>
                                <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline text-left">
                                    {note.text.substring(0, 40)}{note.text.length > 40 ? '...' : ''}
                                </AccordionTrigger>
                                <AccordionContent className="px-4 pt-0 pb-3 text-sm text-muted-foreground space-y-2">
                                <p>{note.text}</p>
                                <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openNoteDialog(note)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteNote(note.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                ) : (
                    <p className="text-center text-sm text-muted-foreground py-4">Δεν υπάρχουν σημειώσεις.</p>
                )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
                <CardTitle>Ανάλυση Πωλήσεων</CardTitle>
                <CardDescription>Συγκριτικά δεδομένα πωλήσεων ανά χρονική περίοδο.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoadingOrders ? (
                    <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin"/></div>
                ) : (
                    <Tabs defaultValue="days">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="days">Ημέρες</TabsTrigger>
                            <TabsTrigger value="weeks">Εβδομάδες</TabsTrigger>
                            <TabsTrigger value="months">Μήνες</TabsTrigger>
                        </TabsList>
                        <TabsContent value="days" className="mt-4">
                            {renderSalesTable(salesData.daily)}
                        </TabsContent>
                        <TabsContent value="weeks" className="mt-4">
                            {renderSalesTable(salesData.weekly)}
                        </TabsContent>
                        <TabsContent value="months" className="mt-4">
                            {renderSalesTable(salesData.monthly)}
                        </TabsContent>
                    </Tabs>
                )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
                <CardTitle>Γράφημα Προόδου</CardTitle>
                <CardDescription>Οπτικοποίηση της προόδου των πωλήσεών σας.</CardDescription>
            </CardHeader>
            <CardContent>
                 {isLoadingOrders ? (
                    <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin"/></div>
                ) : (
                    <Tabs defaultValue="days">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="days">Ημέρες</TabsTrigger>
                            <TabsTrigger value="weeks">Εβδομάδες</TabsTrigger>
                            <TabsTrigger value="months">Μήνες</TabsTrigger>
                        </TabsList>
                        <TabsContent value="days" className="mt-4">
                            <SalesChart data={salesData.daily.slice().reverse()} dataKey="items" />
                        </TabsContent>
                        <TabsContent value="weeks" className="mt-4">
                            <SalesChart data={salesData.weekly.slice().reverse()} dataKey="items" />
                        </TabsContent>
                        <TabsContent value="months" className="mt-4">
                            <SalesChart data={salesData.monthly.slice().reverse()} dataKey="items" />
                        </TabsContent>
                    </Tabs>
                )}
            </CardContent>
          </Card>
        </div>
      </div>
       <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
        <DialogContent className="p-0 sm:max-w-md overflow-hidden">
            {isNoteDialogOpen && (
                <NoteForm 
                    note={editingNote} 
                    onSave={handleSaveNote} 
                    onCancel={() => {
                        setIsNoteDialogOpen(false);
                        setEditingNote(null);
                    }}
                />
            )}
        </DialogContent>
      </Dialog>
    </>
  )
}
