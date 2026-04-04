'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Icons } from "@/components/icons"
import { adminDashboardData, products, wholesalerStock } from "@/lib/data"
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
import { ArrowDown, ArrowUp, Edit, PlusCircle, Trash2 } from "lucide-react"
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type PostItNote = {
    id: number;
    text: string;
    color: 'yellow' | 'blue' | 'green';
};

const initialPostItNotes: PostItNote[] = [
    { id: 1, text: 'Να γίνει τηλεφώνημα στον πελάτη Χ για το τιμολόγιο.', color: 'yellow' },
    { id: 2, text: 'Ο νέος προμηθευτής για αλεύρι φτάνει την Παρασκευή.', color: 'blue' },
    { id: 3, text: 'Check new product samples for next week.', color: 'green' },
];

const noteColors: { [key: string]: string } = {
    yellow: 'bg-yellow-400/10 border-yellow-500/30',
    blue: 'bg-blue-400/10 border-blue-500/30',
    green: 'bg-green-400/10 border-green-500/30'
}

// New Dummy Data
const dailySales = [
  { period: 'Σήμερα', items: 120, change: 15 },
  { period: 'Χθες', items: 105, change: -20 },
  { period: 'Προχθές', items: 125, change: 5 },
  { period: '25/10', items: 120, change: -10 },
  { period: '24/10', items: 130, change: 30 },
  { period: '23/10', items: 100, change: -5 },
  { period: '22/10', items: 105, change: 10 },
];

const weeklySales = [
    { period: 'Αυτή η εβδομάδα', items: 450, change: 50 },
    { period: 'Προηγούμενη εβδ.', items: 400, change: -100 },
    { period: '2-9 Οκτ', items: 500, change: 80 },
    { period: '25 Σεπτ - 1 Οκτ', items: 420, change: 20 },
];

const monthlySales = [
    { period: 'Οκτώβριος', items: 1800, change: 200 },
    { period: 'Σεπτέμβριος', items: 1600, change: -150 },
    { period: 'Αύγουστος', items: 1750, change: 300 },
    { period: 'Ιούλιος', items: 1450, change: 50 },
    { period: 'Ιούνιος', items: 1400, change: -50 },
];

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


export default function AdminDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [postItNotes, setPostItNotes] = useState<PostItNote[]>(initialPostItNotes);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Partial<PostItNote> | null>(null);
  
  const lowStockItems = useMemo(() => {
    return wholesalerStock
    .map(stockItem => {
        const product = products.find(p => p.id === stockItem.productId);
        if (!product) return null;
        const { quantity, idealStock } = stockItem;
        if (idealStock > 0 && quantity <= idealStock / 3) {
            return {
                ...product,
                currentStock: quantity,
                idealStock,
                suggestion: Math.max(0, idealStock - quantity),
            };
        }
        return null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
  }, []);

  const kpis = [
    { title: "Σημερινές Παραγγελίες", value: adminDashboardData.todayOrders, icon: Icons.newOrder },
    { title: "Εκκρεμείς Παραγγελίες", value: adminDashboardData.pendingOrders, icon: Icons.history },
  ];

  const handleRoleChange = (role: string) => {
    if (role === 'store') {
      router.push('/');
    }
  };

  const openNoteDialog = (note: Partial<PostItNote> | null) => {
    setEditingNote(note);
    setIsNoteDialogOpen(true);
  };

  const handleDeleteNote = (noteId: number) => {
    setPostItNotes(prev => prev.filter(note => note.id !== noteId));
    toast({ title: "Η σημείωση διαγράφηκε" });
  };

  const handleSaveNote = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const text = formData.get("text") as string;
    const color = formData.get("color") as 'yellow' | 'blue' | 'green';

    if (!text) {
        toast({ variant: 'destructive', title: "Το κείμενο δεν μπορεί να είναι κενό" });
        return;
    }

    if (editingNote?.id) { // Editing
        setPostItNotes(prev => prev.map(note => note.id === editingNote.id ? { ...note, text, color } : note));
        toast({ title: "Η σημείωση ενημερώθηκε" });
    } else { // Adding
        const newNote: PostItNote = { id: Date.now(), text, color };
        setPostItNotes(prev => [newNote, ...prev]);
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
          {kpis.map(kpi => (
            <Card key={kpi.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
                <kpi.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpi.value}</div>
              </CardContent>
            </Card>
          ))}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Icons.warehouse className="h-5 w-5 text-destructive" />
                        <span>Προϊόντα σε Έλλειψη</span>
                    </CardTitle>
                    <CardDescription>
                        Προϊόντα με απόθεμα κάτω του 33% του ιδανικού.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {lowStockItems.length > 0 ? (
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
                <Tabs defaultValue="days">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="days">Ημέρες</TabsTrigger>
                        <TabsTrigger value="weeks">Εβδομάδες</TabsTrigger>
                        <TabsTrigger value="months">Μήνες</TabsTrigger>
                    </TabsList>
                    <TabsContent value="days" className="mt-4">
                        {renderSalesTable(dailySales)}
                    </TabsContent>
                    <TabsContent value="weeks" className="mt-4">
                        {renderSalesTable(weeklySales)}
                    </TabsContent>
                    <TabsContent value="months" className="mt-4">
                        {renderSalesTable(monthlySales)}
                    </TabsContent>
                </Tabs>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
                <CardTitle>Γράφημα Προόδου</CardTitle>
                <CardDescription>Οπτικοποίηση της προόδου των πωλήσεών σας.</CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="days">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="days">Ημέρες</TabsTrigger>
                        <TabsTrigger value="weeks">Εβδομάδες</TabsTrigger>
                        <TabsTrigger value="months">Μήνες</TabsTrigger>
                    </TabsList>
                    <TabsContent value="days" className="mt-4">
                        <SalesChart data={dailySales.slice().reverse()} dataKey="items" />
                    </TabsContent>
                    <TabsContent value="weeks" className="mt-4">
                        <SalesChart data={weeklySales.slice().reverse()} dataKey="items" />
                    </TabsContent>
                    <TabsContent value="months" className="mt-4">
                        <SalesChart data={monthlySales.slice().reverse()} dataKey="items" />
                    </TabsContent>
                </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
      <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{editingNote?.id ? 'Επεξεργασία Σημείωσης' : 'Νέα Σημείωση'}</DialogTitle>
                <DialogDescription>
                    {editingNote?.id ? 'Επεξεργαστείτε το κείμενο ή το χρώμα της σημείωσης.' : 'Προσθέστε μια νέα σημείωση στον πίνακα ελέγχου.'}
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveNote} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="note-text">Κείμενο</Label>
                    <Textarea id="note-text" name="text" defaultValue={editingNote?.text || ''} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="note-color">Χρώμα</Label>
                    <Select name="color" defaultValue={editingNote?.color || 'yellow'}>
                        <SelectTrigger id="note-color">
                            <SelectValue placeholder="Επιλέξτε χρώμα" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="yellow">Κίτρινο</SelectItem>
                            <SelectItem value="blue">Μπλε</SelectItem>
                            <SelectItem value="green">Πράσινο</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsNoteDialogOpen(false)}>Ακύρωση</Button>
                    <Button type="submit">Αποθήκευση</Button>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
