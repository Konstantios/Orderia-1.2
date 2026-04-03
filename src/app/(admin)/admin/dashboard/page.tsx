
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
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useRouter } from "next/navigation"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { cn } from "@/lib/utils"
import { CheckCircle, Clock } from "lucide-react"

const kpis = [
  { title: "Σημερινές Παραγγελίες", value: adminDashboardData.todayOrders, icon: Icons.newOrder },
  { title: "Εκκρεμείς Παραγγελίες", value: adminDashboardData.pendingOrders, icon: Icons.history },
  { title: "Προϊόντα σε Έλλειψη", value: adminDashboardData.lowStockItems, icon: Icons.warehouse },
  { title: "Νέοι Πελάτες", value: adminDashboardData.newCustomers, icon: Icons.customers },
]

const recentOrders = [
    { id: 'ORD-001', customer: 'Φούρνος "Η Γεύση"', date: '2023-10-24', status: 'Εκκρεμής', total: '€125.50' },
    { id: 'ORD-002', customer: 'Snack Bar "Το Γρήγορο"', date: '2023-10-24', status: 'Απεσταλμένη', total: '€88.00' },
    { id: 'ORD-003', customer: 'Φούρνος "Η Γεύση"', date: '2023-10-23', status: 'Ολοκληρωμένη', total: '€110.20' },
    { id: 'ORD-004', customer: 'Ζαχαροπλαστείο "Ο Γλυκός Πειρασμός"', date: '2023-10-23', status: 'Ολοκληρωμένη', total: '€215.00' },
    { id: 'ORD-005', customer: 'Φούρνος "Η Γεύση"', date: '2023-10-22', status: 'Ολοκληρωμένη', total: '€130.80' },
]

const salesData = [
  { name: 'Εβδ. 1', 'Παραγγελίες': 40 },
  { name: 'Εβδ. 2', 'Παραγγελίες': 30 },
  { name: 'Εβδ. 3', 'Παραγγελίες': 50 },
  { name: 'Εβδ. 4', 'Παραγγελίες': 45 },
];

const dailyRoutine = [
    { task: 'Προετοιμασία Παραγγελιών', time: '08:00 - 09:30', status: 'completed' },
    { task: 'Επικοινωνία με πελάτες', time: '09:30 - 10:30', status: 'completed' },
    { task: 'Δρομολόγηση', time: '10:30 - 11:30', status: 'ongoing' },
    { task: 'Tιμολόγηση', time: '11:30 - 12:30', status: 'pending' },
    { task: 'Απολογισμός & Προγραμματισμός', time: '12:30 - 13:00', status: 'pending' },
]

export default function AdminDashboardPage() {
  const router = useRouter();

  const handleRoleChange = (role: string) => {
    if (role === 'store') {
      router.push('/');
    }
  };

  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();

  const getStatus = (timeRange: string, status: string) => {
      if (status === 'completed') return 'completed';
      const [start] = timeRange.split(' - ');
      const [startHour, startMinute] = start.split(':').map(Number);
      const startTime = startHour * 60 + startMinute;
      
      if (currentTime > startTime && status === 'pending') return 'delayed';
      if (status === 'ongoing') return 'ongoing';

      return 'pending';
  }

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
      <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Πρόσφατες Παραγγελίες</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Πελάτης</TableHead>
                  <TableHead className="hidden sm:table-cell">Κατάσταση</TableHead>
                  <TableHead className="hidden md:table-cell">Ημερομηνία</TableHead>
                  <TableHead className="text-right">Σύνολο</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.map(order => (
                  <TableRow key={order.id}>
                    <TableCell>
                        <div className="font-medium">{order.customer}</div>
                        <div className="hidden text-sm text-muted-foreground md:inline">{order.id}</div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell"><Badge variant={order.status === 'Εκκρεμής' ? 'destructive' : order.status === 'Απεσταλμένη' ? 'default' : 'secondary'}>{order.status}</Badge></TableCell>
                    <TableCell className="hidden md:table-cell">{order.date}</TableCell>
                    <TableCell className="text-right">{order.total}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Ημερήσια Ρουτίνα</CardTitle>
                    <CardDescription>Η πρόοδος των σημερινών εργασιών</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {dailyRoutine.map(item => {
                       const status = getStatus(item.time, item.status);
                       return (
                        <div key={item.task} className="flex items-start gap-3">
                            <div>
                                {status === 'completed' && <CheckCircle className="h-5 w-5 text-green-500" />}
                                {status === 'ongoing' && <Clock className="h-5 w-5 text-blue-500 animate-pulse" />}
                                {status === 'pending' && <Clock className="h-5 w-5 text-muted-foreground" />}
                                {status === 'delayed' && <Clock className="h-5 w-5 text-red-500" />}
                            </div>
                            <div className="flex-1">
                                <p className={cn("font-medium", status === 'ongoing' && "text-blue-500")}>{item.task}</p>
                                <p className="text-xs text-muted-foreground">{item.time}</p>
                            </div>
                        </div>
                       )
                    })}
                </CardContent>
            </Card>
        </div>
      </div>
      <Card>
        <CardHeader>
            <CardTitle>Ανάλυση Παραγγελιών</CardTitle>
            <CardDescription>Εβδομαδιαία σύγκριση</CardDescription>
        </CardHeader>
        <CardContent>
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Παραγγελίες" fill="hsl(var(--primary))" />
                </BarChart>
            </ResponsiveContainer>
        </CardContent>
      </Card>
    </>
  )
}
