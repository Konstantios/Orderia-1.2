'use client';

import { useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, PlusCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const teamMembers = [
    { name: 'Νίκος Παπαδόπουλος', email: 'admin@frozenfoods.gr', role: 'Διαχειριστής' },
    { name: 'Μαρία Γεωργίου', email: 'maria@frozenfoods.gr', role: 'Αποθηκάριος' },
    { name: 'Γιάννης Αντωνίου', email: 'giannis@frozenfoods.gr', role: 'Πωλητής' },
]

export default function AdminTeamPage() {
    const { toast } = useToast();
    const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);

    const handleInvite = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const email = formData.get('email') as string;
        const name = formData.get('name') as string;
        const role = formData.get('role') as string;

        // In a real app, you would send an invitation email here.
        // For now, we just show a toast.
        toast({
            title: "Η πρόσκληση στάλθηκε!",
            description: `Ο χρήστης ${name} (${email}) έχει προσκληθεί ως ${role}.`,
        });

        setIsInviteDialogOpen(false); // Close the dialog
    }


    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-lg font-semibold md:text-2xl">Διαχείριση Ομάδας</h1>
                <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Πρόσκληση Μέλους
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                         <form onSubmit={handleInvite}>
                            <DialogHeader>
                                <DialogTitle>Πρόσκληση Νέου Μέλους</DialogTitle>
                                <DialogDescription>
                                    Συμπληρώστε τα στοιχεία του νέου μέλους για να του στείλετε μια πρόσκληση.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="name" className="text-right">
                                        Όνομα
                                    </Label>
                                    <Input id="name" name="name" required className="col-span-3" />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="email" className="text-right">
                                        Email
                                    </Label>
                                    <Input id="email" name="email" type="email" required className="col-span-3" />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="role" className="text-right">
                                        Ρόλος
                                    </Label>
                                    <Select name="role" required defaultValue="Πωλητής">
                                        <SelectTrigger className="col-span-3">
                                            <SelectValue placeholder="Επιλέξτε ρόλο" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Διαχειριστής">Διαχειριστής</SelectItem>
                                            <SelectItem value="Αποθηκάριος">Αποθηκάριος</SelectItem>
                                            <SelectItem value="Πωλητής">Πωλητής</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="submit">Αποστολή Πρόσκλησης</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
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