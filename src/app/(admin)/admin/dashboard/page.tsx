'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Icons } from "@/components/icons"
import { adminDashboardData } from "@/lib/data"
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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from "@/lib/utils"
import { ArrowDown, ArrowUp } from "lucide-react"

const kpis = [
  { title: "Σημερινές Παραγγελίες", value: adminDashboardData.todayOrders, icon: Icons.newOrder },
  { title: "Εκκρεμείς Παραγγελίες", value: adminDashboardData.pendingOrders, icon: Icons.history },
  { title: "Προϊόντα σε Έλλειψη", value: adminDashboardData.lowStockItems, icon: Icons.warehouse },
  { title: "Νέοι Πελάτες", value: adminDashboardData.newCustomers, icon: Icons.customers },
]

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
        <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false}/>
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`}/>
            <Tooltip
                contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                }}
            />
            <Bar dataKey={dataKey} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        </BarChart>
    </ResponsiveContainer>
);


export default function AdminDashboardPage() {
  const router = useRouter();

  const handleRoleChange = (role: string) => {
    if (role === 'store') {
      router.push('/');
    }
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
      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
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
      </div>
      
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
    </>
  )
}
