
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, PlusCircle } from "lucide-react";

const teamMembers = [
    { name: 'Νίκος Παπαδόπουλος', email: 'admin@frozenfoods.gr', role: 'Διαχειριστής' },
    { name: 'Μαρία Γεωργίου', email: 'maria@frozenfoods.gr', role: 'Αποθηκάριος' },
    { name: 'Γιάννης Αντωνίου', email: 'giannis@frozenfoods.gr', role: 'Πωλητής' },
]

export default function AdminTeamPage() {
    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-lg font-semibold md:text-2xl">Διαχείριση Ομάδας</h1>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Πρόσκληση Μέλους
                </Button>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Μέλη Ομάδας</CardTitle>
                    <CardDescription>
                        Προσκαλέστε και διαχειριστείτε τα μέλη της ομάδας που έχουν πρόσβαση στο σύστημα.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                   <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Ονοματεπώνυμο</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Ρόλος</TableHead>
                                <TableHead className="text-right">Ενέργειες</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {teamMembers.map((member) => (
                                <TableRow key={member.email}>
                                    <TableCell className="font-medium">{member.name}</TableCell>
                                    <TableCell className="text-muted-foreground">{member.email}</TableCell>
                                    <TableCell>
                                        <Badge variant={member.role === 'Διαχειριστής' ? 'default' : 'secondary'}>
                                            {member.role}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                         <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem>Επεξεργασία</DropdownMenuItem>
                                                <DropdownMenuItem className="text-destructive">Αφαίρεση</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                   </Table>
                </CardContent>
            </Card>
        </div>
    );
}
