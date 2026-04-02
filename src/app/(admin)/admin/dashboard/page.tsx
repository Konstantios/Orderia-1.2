import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
]

export default function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
          <CardTitle>Πρόσφατες Παραγγελίες</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Κωδ. Παραγγελίας</TableHead>
                <TableHead>Πελάτης</TableHead>
                <TableHead>Ημερομηνία</TableHead>
                <TableHead>Κατάσταση</TableHead>
                <TableHead className="text-right">Σύνολο</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentOrders.map(order => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.id}</TableCell>
                  <TableCell>{order.customer}</TableCell>
                  <TableCell>{order.date}</TableCell>
                  <TableCell><Badge variant={order.status === 'Εκκρεμής' ? 'destructive' : order.status === 'Απεσταλμένη' ? 'default' : 'secondary'}>{order.status}</Badge></TableCell>
                  <TableCell className="text-right">{order.total}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
