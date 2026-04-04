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
import { MoreHorizontal, PlusCircle, Check, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useFirebase, useCollection, useMemoFirebase, updateDocumentNonBlocking, WithId } from "@/firebase";
import { collection, query, where, doc } from "firebase/firestore";

const teamMembersData = [
    { id: '1', name: 'Νίκος Παπαδόπουλος', email: 'admin@frozenfoods.gr', role: 'Διαχειριστής' },
    { id: '2', name: 'Μαρία Γεωργίου', email: 'maria@frozenfoods.gr', role: 'Αποθηκάριος' },
    { id: '3', name: 'Γιάννης Αντωνίου', email: 'giannis@frozenfoods.gr', role: 'Πωλητής' },
]


export default function AdminTeamPage() {
    const { toast } = useToast();
    const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
    const [teamMembers, setTeamMembers] = useState(teamMembersData);
    
    const { user, firestore, isUserLoading } = useFirebase();

    // 1. Fetch user's wholesaler
    const wholesalerQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'wholesalers'), where("ownerId", "==", user.uid));
    }, [firestore, user]);
    const { data: wholesalers, isLoading: isLoadingWholesalers } = useCollection<any>(wholesalerQuery);
    const wholesaler = wholesalers?.[0];
    
    // 2. Fetch join requests for this wholesaler
    const requestsQuery = useMemoFirebase(() => {
        if (!firestore || !wholesaler) return null;
        return query(collection(firestore, 'joinRequests'), where("businessId", "==", wholesaler.id), where("status", "==", "pending"));
    }, [firestore, wholesaler]);
    const { data: pendingRequests, isLoading: isLoadingRequests } = useCollection<any>(requestsQuery);


    const handleInvite = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const email = formData.get('email') as string;
        const name = formData.get('name') as string;
        const role = formData.get('role') as string;

        toast({
            title: "Η πρόσκληση στάλθηκε!",
            description: `Ο χρήστης ${name} (${email}) έχει προσκληθεί ως ${role}.`,
        });

        setIsInviteDialogOpen(false); // Close the dialog
    };

    const handleRequest = (request: WithId<{requesterName: string}>, accepted: boolean) => {
        if (!firestore) return;
        
        const requestRef = doc(firestore, 'joinRequests', request.id);
        const newStatus = accepted ? 'approved' : 'rejected';

        updateDocumentNonBlocking(requestRef, { status: newStatus });

        if(accepted) {
             toast({
                title: "Το Αίτημα Εγκρίθηκε",
                description: `Ο χρήστης ${request.requesterName} μπορεί πλέον να εγγραφεί.`,
            });
        } else {
            toast({
                variant: 'destructive',
                title: "Το Αίτημα Απορρίφθηκε",
                description: `Το αίτημα του χρήστη ${request.requesterName} έχει απορριφθεί.`,
            });
        }
    }


    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-lg font-semibold md:text-2xl">Διαχείριση Ομάδας</h1>
            </div>

            {(isLoadingRequests || isLoadingWholesalers) ? (
                <div className="flex justify-center items-center h-24">
                    <Loader2 className="h-6 w-6 animate-spin" />
                </div>
            ) : pendingRequests && pendingRequests.length > 0 && (
                 <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Εκκρεμή Αιτήματα</CardTitle>
                        <CardDescription>
                            Εγκρίνετε ή απορρίψτε τα αιτήματα χρηστών για συμμετοχή στην ομάδα σας.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {pendingRequests.map((request) => (
                            <div key={request.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                <div>
                                    <p className="font-semibold">{request.requesterName}</p>
                                    <p className="text-sm text-muted-foreground">{request.requesterEmail}</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleRequest(request, false)}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                    <Button variant="outline" size="icon" className="text-green-500 hover:text-green-500" onClick={() => handleRequest(request, true)}>
                                        <Check className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Μέλη Ομάδας</CardTitle>
                        <CardDescription>
                            Προσκαλέστε και διαχειριστείτε τα μέλη της ομάδας που έχουν πρόσβαση στο σύστημα.
                        </CardDescription>
                    </div>
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

    