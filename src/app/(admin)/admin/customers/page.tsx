'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle, Loader2, CheckCircle2, XCircle, Bell, FileSpreadsheet, Check, Download } from 'lucide-react';
import type { Store, Wholesaler, SupplierStoreConnection, JoinRequest } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea"
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useFirebase, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking, WithId } from "@/firebase";
import { collection, query, where, doc, getDocs, writeBatch, documentId, serverTimestamp, limit, updateDoc, arrayUnion, getDoc, addDoc } from "firebase/firestore";


const CustomerForm = ({ customer, onSave, onCancel }: { customer: Partial<Store> | null; onSave: (customer: Omit<Store, 'id' | 'ownerId' | 'managerUids'>) => void; onCancel: () => void }) => {
    const [formData, setFormData] = useState<Partial<Store>>(customer || { deliveryDay: 'Δευτέρα' });
    const { toast } = useToast();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({...prev, [name]: value}));
    }
    
    const handleSelectChange = (value: string) => {
        setFormData(prev => ({...prev, deliveryDay: value}));
    }

    const handleSubmit = () => {
        if (!formData.businessName || !formData.ownerName || !formData.phone || !formData.email || !formData.address || !formData.deliveryDay) {
            toast({
                variant: 'destructive',
                title: 'Ελλιπή Στοιχεία',
                description: 'Παρακαλώ συμπληρώστε όλα τα υποχρεωτικά πεδία.',
            });
            return;
        }

        const customerToSave: Omit<Store, 'id' | 'ownerId' | 'managerUids'> = {
            businessName: formData.businessName,
            ownerName: formData.ownerName,
            taxId: formData.taxId,
            phone: formData.phone,
            phone2: formData.phone2,
            email: formData.email,
            address: formData.address,
            googleMapsLink: formData.googleMapsLink,
            deliveryDay: formData.deliveryDay,
        };

        onSave(customerToSave);
    }
    
    return (
        <>
            <DialogHeader>
                <DialogTitle>{customer?.id ? 'Επεξεργασία Πελάτη' : 'Καταχώρηση Νέου Πελάτη'}</DialogTitle>
                <DialogDescription>
                    {customer?.id ? 'Επεξεργαστείτε τα στοιχεία του πελάτη.' : 'Συμπληρώστε τα στοιχεία για να προσθέσετε έναν νέο πελάτη.'}
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="businessName" className="text-right">Επωνυμία</Label>
                    <Input id="businessName" name="businessName" value={formData.businessName || ''} onChange={handleChange} className="col-span-3" />
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="taxId" className="text-right">ΑΦΜ</Label>
                    <Input id="taxId" name="taxId" value={formData.taxId || ''} onChange={handleChange} className="col-span-3" />
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="ownerName" className="text-right">Υπεύθυνος</Label>
                    <Input id="ownerName" name="ownerName" value={formData.ownerName || ''} onChange={handleChange} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="email" className="text-right">Email</Label>
                    <Input id="email" name="email" type="email" value={formData.email || ''} onChange={handleChange} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="phone" className="text-right">Τηλέφωνο</Label>
                    <Input id="phone" name="phone" value={formData.phone || ''} onChange={handleChange} className="col-span-3" />
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="phone2" className="text-right">Τηλ. 2 (προερ.)</Label>
                    <Input id="phone2" name="phone2" value={formData.phone2 || ''} onChange={handleChange} className="col-span-3" />
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="address" className="text-right">Διεύθυνση</Label>
                    <Input id="address" name="address" value={formData.address || ''} onChange={handleChange} className="col-span-3" />
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="googleMapsLink" className="text-right">Google Maps</Label>
                    <Input id="googleMapsLink" name="googleMapsLink" value={formData.googleMapsLink || ''} onChange={handleChange} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="deliveryDay" className="text-right">Ημ. Παράδοσης</Label>
                    <Select onValueChange={handleSelectChange} defaultValue={formData.deliveryDay}>
                        <SelectTrigger className="col-span-3">
                            <SelectValue placeholder="Επιλέξτε ημέρα" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Δευτέρα">Δευτέρα</SelectItem>
                            <SelectItem value="Τρίτη">Τρίτη</SelectItem>
                            <SelectItem value="Τετάρτη">Τετάρτη</SelectItem>
                            <SelectItem value="Πέμπτη">Πέμπτη</SelectItem>
                            <SelectItem value="Παρασκευή">Παρασκευή</SelectItem>
                            <SelectItem value="Σάββατο">Σάββατο</SelectItem>
                            <SelectItem value="Κυριακή">Κυριακή</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={onCancel}>Ακύρωση</Button>
                <Button onClick={handleSubmit}>Αποθήκευση</Button>
            </DialogFooter>
        </>
    );
};


export default function AdminCustomersPage() {
    const router = useRouter();
    const { user, firestore } = useFirebase();
    
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState('all');
    const DAYS_OF_WEEK = ['Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο', 'Κυριακή'];

    const handleExportExcel = (day?: string) => {
        const listToExport = day ? customers.filter(c => c.deliveryDay === day) : customers;
        
        if (listToExport.length === 0) {
            toast({ variant: 'destructive', title: 'Κενή Λίστα', description: `Δεν υπάρχουν πελάτες για ${day || 'όλες τις ημέρες'}.` });
            return;
        }

        const data = listToExport.map(c => ({
            'Επωνυμία': c.businessName,
            'Υπεύθυνος': c.ownerName,
            'Τηλέφωνο': c.phone,
            'Τηλέφωνο 2': c.phone2 || '-',
            'Email': c.email,
            'Διεύθυνση': c.address,
            'ΑΦΜ': c.taxId || '-',
            'Ημέρα Παράδοσης': c.deliveryDay
        }));

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, day || 'Όλοι οι Πελάτες');
        XLSX.writeFile(workbook, `Πελάτες_${day || 'Σύνολο'}_${new Date().toLocaleDateString('el-GR').replace(/\//g, '-')}.xlsx`);
        
        toast({ title: 'Η εξαγωγή ολοκληρώθηκε', description: `Το αρχείο για ${day || 'όλους τους πελάτες'} δημιουργήθηκε.` });
    };
    
    const [customers, setCustomers] = useState<WithId<Store>[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessingRequest, setIsProcessingRequest] = useState<string | null>(null);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Partial<WithId<Store>> | null>(null);

    // CSV Import state
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [parsedCustomers, setParsedCustomers] = useState<Array<{ businessName: string; ownerName: string; phone: string; deliveryDay: string }>>([]);
    const [isImporting, setIsImporting] = useState(false);
    const [isSendingNotifications, setIsSendingNotifications] = useState(false);
    const [indexErrorLink, setIndexErrorLink] = useState<string | null>(null);

    // Custom notification states
    const [isCustomNotifDialogOpen, setIsCustomNotifDialogOpen] = useState(false);
    const [customNotifTitle, setCustomNotifTitle] = useState('');
    const [customNotifBody, setCustomNotifBody] = useState('');
    const [isSendingCustomNotif, setIsSendingCustomNotif] = useState(false);
    // Maps recipientUid to an array of acknowledged message titles
    const [acknowledgedMessages, setAcknowledgedMessages] = useState<Map<string, {id: string, title: string}[]>>(new Map());

    const wholesalerQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, 'wholesalers'), where('adminUids', 'array-contains', user.uid), limit(1));
    }, [user, firestore]);
    const { data: wholesalers, isLoading: isLoadingWholesalers } = useCollection<Wholesaler>(wholesalerQuery);
    const wholesaler = wholesalers?.[0];

    const connectionsQuery = useMemoFirebase(() => {
        if (!firestore || !wholesaler) return null;
        return query(collection(firestore, 'supplierStoreConnections'), where('wholesalerId', '==', wholesaler.id));
    }, [firestore, wholesaler]);
    const { data: connections, isLoading: isLoadingConnections, error: connectionsError } = useCollection<SupplierStoreConnection>(connectionsQuery);

    // Fetch all join requests for this wholesaler. Filter status in JS to avoid
    // 1. Fetch requests directed to the wholesaler specifically
    const joinRequestsQuery = useMemoFirebase(() => {
        if (!firestore || !wholesaler) return null;
        return query(
            collection(firestore, 'joinRequests'),
            where('wholesalerId', '==', wholesaler.id)
        );
    }, [firestore, wholesaler]);
    const { data: allJoinRequests } = useCollection<JoinRequest>(joinRequestsQuery);

    // 2. Fetch requests directed to the connected stores (for backwards compatibility/missing wholesalerId)
    const storeRequestsQuery = useMemoFirebase(() => {
        if (!firestore || !connections || connections.length === 0) return null;
        const storeIds = connections.map(c => c.storeId);
        return query(
            collection(firestore, 'joinRequests'),
            where('businessId', 'in', storeIds.slice(0, 30))
        );
    }, [firestore, connections]);
    const { data: storeJoinRequests } = useCollection<JoinRequest>(storeRequestsQuery);

    const allPendingRequests = useMemo(() => {
        const combined = new Map<string, WithId<JoinRequest>>();
        
        if (allJoinRequests) {
            (allJoinRequests as WithId<JoinRequest>[]).forEach(req => combined.set(req.id, req));
        }
        if (storeJoinRequests) {
            (storeJoinRequests as WithId<JoinRequest>[]).forEach(req => combined.set(req.id, req));
        }

        return Array.from(combined.values()).filter(r => r.status === 'pending');
    }, [allJoinRequests, storeJoinRequests]);

     useEffect(() => {
        const fetchAndSetCustomers = async () => {
            if (connectionsError) {
                console.error("[DEBUG] Error fetching connections:", connectionsError);
                setIsLoading(false);
                setCustomers([]);
                return;
            }

            if (isLoadingConnections || !firestore) {
                return;
            }

            setIsLoading(true);
            console.log("[DEBUG] Wholesaler:", wholesaler?.id);
            console.log("[DEBUG] Connections loaded:", connections?.length, connections);

            if (!connections || connections.length === 0) {
                console.log("[DEBUG] No connections found for wholesaler:", wholesaler?.id);
                setCustomers([]);
                setIsLoading(false);
                return;
            }

            const storeIds = connections.map(c => c.storeId);

            try {
                const storesQuery = query(collection(firestore, 'stores'), where(documentId(), 'in', storeIds));
                const querySnapshot = await getDocs(storesQuery);
                const fetchedStores = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WithId<Store>));
                setCustomers(fetchedStores);
            } catch (e) {
                console.error("Error fetching customer stores:", e);
                toast({ variant: 'destructive', title: "Σφάλμα", description: "Δεν ήταν δυνατή η φόρτωση των πελατών."});
                setCustomers([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAndSetCustomers();
    }, [connections, isLoadingConnections, firestore, connectionsError, toast]);

    // Fetch recent acknowledgements
    useEffect(() => {
        if (!firestore || !wholesaler) return;

        const fetchAcknowledgements = async () => {
            try {
                // Get all custom_message notifications for this wholesaler that are acknowledged
                // Note: In production a time limit (e.g. last 48h) would be better
                const q = query(
                    collection(firestore, 'notifications'), 
                    where('wholesalerId', '==', wholesaler.id),
                    where('type', '==', 'custom_message')
                );
                const querySnapshot = await getDocs(q);
                const results = new Map<string, {id: string, title: string}[]>();
                
                querySnapshot.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.acknowledgedAt) {
                        const uid = data.recipientUid;
                        const messageInfo = { id: doc.id, title: data.title };
                        
                        if (!results.has(uid)) {
                            results.set(uid, []);
                        }
                        
                        // Avoid duplicates for the same message title/id
                        const current = results.get(uid)!;
                        if (!current.find(m => m.id === doc.id)) {
                            current.push(messageInfo);
                        }
                    }
                });
                setAcknowledgedMessages(results);
            } catch (e) {
                console.error("Error fetching acknowledgements:", e);
            }
        };

        fetchAcknowledgements();
        // Poll every 30 seconds for real-time-ish updates if needed
        const interval = setInterval(fetchAcknowledgements, 30000);
        return () => clearInterval(interval);
    }, [firestore, wholesaler]);

    const handleApproveRequest = async (request: WithId<JoinRequest>) => {
        if (!firestore || !wholesaler) return;
        setIsProcessingRequest(request.id);
        try {
            const batch = writeBatch(firestore);
            const requestRef = doc(firestore, 'joinRequests', request.id);

            if (request.businessType === 'store') {
                // Approve access to an existing store
                const storeRef = doc(firestore, 'stores', request.businessId);
                batch.update(storeRef, { managerUids: arrayUnion(request.requesterUid) });
            } else {
                // Approve access to the wholesaler (admin team member)
                const wholesalerRef = doc(firestore, 'wholesalers', request.businessId);
                batch.update(wholesalerRef, { adminUids: arrayUnion(request.requesterUid) });
            }

            // Mark request as approved
            batch.update(requestRef, { status: 'approved' });
            await batch.commit();

            toast({ title: 'Αίτημα Εγκρίθηκε!', description: `Ο/Η ${request.requesterName} εντάχθηκε στην επιχείρηση.` });
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Σφάλμα', description: 'Δεν ήταν δυνατή η έγκριση.' });
        } finally {
            setIsProcessingRequest(null);
        }
    };

    const handleRejectRequest = async (request: WithId<JoinRequest>) => {
        if (!firestore) return;
        setIsProcessingRequest(request.id);
        try {
            const requestRef = doc(firestore, 'joinRequests', request.id);
            await updateDoc(requestRef, { status: 'rejected' });
            toast({ title: 'Αίτημα Απορρίφθηκε', description: `Το αίτημα του/της ${request.requesterName} απορρίφθηκε.` });
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Σφάλμα', description: 'Δεν ήταν δυνατή η απόρριψη.' });
        } finally {
            setIsProcessingRequest(null);
        }
    };
    
    const handleSaveCustomer = async (customerData: Omit<Store, 'id' | 'ownerId' | 'managerUids'>) => {
        if (!firestore || !wholesaler) return;
        setIsLoading(true);
        try {
            if (editingCustomer?.id) { // Editing existing
                const storeRef = doc(firestore, 'stores', editingCustomer.id);
                await updateDocumentNonBlocking(storeRef, customerData);
                setCustomers(prev => prev.map(c => c.id === editingCustomer.id ? { ...c, ...customerData } : c));
                toast({ title: "Επιτυχής Ενημέρωση", description: `Τα στοιχεία του πελάτη '${customerData.businessName}' ενημερώθηκαν.` });
            } else { // Adding new
                const batch = writeBatch(firestore);
                
                // 1. Create the new Store document
                const newStoreRef = doc(collection(firestore, 'stores'));
                const cleanData = JSON.parse(JSON.stringify(customerData));
                const newStoreData = { 
                    ...cleanData, 
                    ownerId: '', 
                    managerUids: [],
                    wholesalerIds: [wholesaler.id],
                    email: customerData.email || '' 
                };
                batch.set(newStoreRef, newStoreData);

                // 2. Create the connection document
                const newConnectionRef = doc(collection(firestore, 'supplierStoreConnections'));
                const newConnectionData = {
                    wholesalerId: wholesaler.id,
                    storeId: newStoreRef.id,
                    isActive: true,
                    connectionDate: serverTimestamp(),
                    wholesalerOwnerId: wholesaler.ownerId,
                    wholesalerAdminUids: wholesaler.adminUids,
                };
                batch.set(newConnectionRef, newConnectionData);

                await batch.commit();

                setCustomers(prev => [...prev, { ...newStoreData, id: newStoreRef.id }]);

                toast({ title: "Επιτυχής Καταχώρηση", description: `Ο πελάτης '${customerData.businessName}' προστέθηκε.` });
            }
        } catch (e) {
            console.error(e);
            toast({ variant: "destructive", title: "Σφάλμα Αποθήκευσης", description: "Δεν ήταν δυνατή η αποθήκευση του πελάτη."});
        } finally {
            setIsLoading(false);
            setIsDialogOpen(false);
            setEditingCustomer(null);
        }
    }

    // --- CSV Import Handlers ---
    const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            if (!text) return;
            const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
            const results: Array<{ businessName: string; ownerName: string; phone: string; deliveryDay: string }> = [];
            for (const line of lines) {
                const delimiter = line.includes(';') ? ';' : ',';
                const parts = line.split(delimiter).map(p => p.trim().replace(/^"|"$/g, ''));
                if (parts.length < 2) continue;
                const businessName = parts[0];
                const ownerName = parts[1] || '';
                const phone = parts[2] || '';
                const deliveryDay = parts[3] || 'Δευτέρα';
                // Skip header row
                if (businessName.toLowerCase() === 'επωνυμία' || businessName.toLowerCase() === 'business' || businessName.toLowerCase() === 'name') continue;
                if (businessName) {
                    results.push({ businessName, ownerName, phone, deliveryDay });
                }
            }
            if (results.length === 0) {
                toast({ variant: 'destructive', title: 'Κενό Αρχείο', description: 'Δεν βρέθηκαν πελάτες στο αρχείο.' });
                return;
            }
            setParsedCustomers(results);
            setIsImportDialogOpen(true);
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const handleConfirmImport = async () => {
        if (!firestore || !wholesaler || parsedCustomers.length === 0) return;
        setIsImporting(true);
        try {
            const batch = writeBatch(firestore);
            const newCustomerEntries: WithId<Store>[] = [];

            parsedCustomers.forEach(c => {
                const newStoreRef = doc(collection(firestore, 'stores'));
                const storeData = {
                    businessName: c.businessName,
                    ownerName: c.ownerName,
                    phone: c.phone,
                    deliveryDay: c.deliveryDay,
                    email: '',
                    address: '',
                    taxId: '',
                    ownerId: '',
                    managerUids: [],
                    wholesalerIds: [wholesaler.id],
                };
                batch.set(newStoreRef, storeData);

                const newConnRef = doc(collection(firestore, 'supplierStoreConnections'));
                batch.set(newConnRef, {
                    wholesalerId: wholesaler.id,
                    storeId: newStoreRef.id,
                    isActive: true,
                    connectionDate: serverTimestamp(),
                    wholesalerOwnerId: wholesaler.ownerId,
                    wholesalerAdminUids: wholesaler.adminUids,
                });

                newCustomerEntries.push({ ...storeData, id: newStoreRef.id } as WithId<Store>);
            });

            await batch.commit();
            setCustomers(prev => [...prev, ...newCustomerEntries]);
            toast({ title: 'Επιτυχής Εισαγωγή', description: `Προστέθηκαν ${parsedCustomers.length} πελάτες.` });
            setIsImportDialogOpen(false);
            setParsedCustomers([]);
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Σφάλμα', description: 'Αποτυχία εισαγωγής πελατών.' });
        } finally {
            setIsImporting(false);
        }
    };

    const handleSendDeliveryNotification = async () => {
        if (!firestore || !wholesaler || activeTab === 'all') return;
        
        const dayCustomers = customers.filter(c => c.deliveryDay === activeTab);
        if (dayCustomers.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Κενή Λίστα',
                description: `Δεν υπάρχουν πελάτες την ${activeTab} για να σταλεί ειδοποίηση.`
            });
            return;
        }

        setIsSendingNotifications(true);

        try {
            const batch = writeBatch(firestore);
            let totalNotifications = 0;

            console.log("[DEBUG] Starting notification batch for day:", activeTab);

            for (const store of dayCustomers) {
                const recipientUids = new Set<string>();
                if (store.ownerId) recipientUids.add(store.ownerId);
                if (store.managerUids) {
                    store.managerUids.forEach(uid => recipientUids.add(uid));
                }

                recipientUids.forEach(uid => {
                    const notifRef = doc(collection(firestore, 'notifications'));
                    const title = 'Υπενθύμιση Παραγγελίας';
                    const description = `Παρακαλούμε καταχωρήστε την παραγγελία σας για την επόμενη παράδοση (${activeTab}) από: ${wholesaler.companyName}.`;
                    
                    const notifData = {
                        title,
                        description,
                        date: new Date().toISOString(),
                        read: false,
                        recipientUid: uid,
                        wholesalerId: wholesaler.id,
                        wholesalerName: wholesaler.companyName,
                        type: 'order_reminder',
                        createdAt: serverTimestamp()
                    };
                    console.log("[DEBUG] Adding notification to batch:", notifData);
                    batch.set(notifRef, notifData);
                    totalNotifications++;

                    // Trigger real push notification via our new API
                    fetch('/api/notifications/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            recipientUid: uid,
                            title,
                            body: description
                        })
                    }).catch(e => console.error('[DEBUG] Push notification trigger failed for', uid, e));
                });
            }

            if (totalNotifications > 0) {
                console.log("[DEBUG] Committing batch for", totalNotifications, "notifications...");
                await batch.commit();
                console.log("[DEBUG] Batch commit successful!");
                toast({
                    title: 'Επιτυχία!',
                    description: `Στάλθηκαν ${totalNotifications} ειδοποιήσεις υπενθύμισης για την ${activeTab}.`
                });
            } else {
                 toast({
                    variant: 'destructive',
                    title: 'Προσοχή',
                    description: 'Δεν βρέθηκαν εγγεγραμμένοι χρήστες για τους πελάτες αυτής της ημέρας.'
                });
            }
        } catch (error: any) {
            console.error('[CRITICAL DEBUG] Error sending notifications:', error);
            
            // Check for index creation link in the error message
            const message = error.message || '';
            const linkMatch = message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
            if (linkMatch) {
                setIndexErrorLink(linkMatch[0]);
            }

            toast({
                variant: 'destructive',
                title: 'Σφάλμα',
                description: linkMatch 
                    ? 'Απαιτείται δημιουργία ευρετηρίου (Index) για αυτή τη λειτουργία.' 
                    : 'Αποτυχία αποστολής ειδοποιήσεων.'
            });
        } finally {
            setIsSendingNotifications(false);
        }
    };

    const handleSendCustomNotification = async () => {
        if (!firestore || !wholesaler || activeTab === 'all' || !customNotifTitle || !customNotifBody) {
             toast({
                variant: 'destructive',
                title: 'Ελλιπή στοιχεία',
                description: 'Παρακαλώ συμπληρώστε τίτλο και κείμενο για την ειδοποίηση.'
            });
            return;
        }
        
        const dayCustomers = customers.filter(c => c.deliveryDay === activeTab);
        if (dayCustomers.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Κενή Λίστα',
                description: `Δεν υπάρχουν πελάτες την ${activeTab} για να σταλεί ειδοποίηση.`
            });
            return;
        }

        setIsSendingCustomNotif(true);

        try {
            const batch = writeBatch(firestore);
            let totalNotifications = 0;

            for (const store of dayCustomers) {
                const recipientUids = new Set<string>();
                if (store.ownerId) recipientUids.add(store.ownerId);
                if (store.managerUids) {
                    store.managerUids.forEach(uid => recipientUids.add(uid));
                }

                recipientUids.forEach(uid => {
                    const notifRef = doc(collection(firestore, 'notifications'));
                    
                    const notifData = {
                        title: customNotifTitle,
                        description: customNotifBody,
                        date: new Date().toISOString(),
                        read: false,
                        recipientUid: uid,
                        wholesalerId: wholesaler.id,
                        wholesalerName: wholesaler.companyName,
                        type: 'custom_message',
                        createdAt: serverTimestamp()
                    };
                    batch.set(notifRef, notifData);
                    totalNotifications++;

                    // Trigger real push notification
                    fetch('/api/notifications/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            recipientUid: uid,
                            title: customNotifTitle,
                            body: customNotifBody
                        })
                    }).catch(e => console.error('[DEBUG] Push notification failed', e));
                });
            }

            if (totalNotifications > 0) {
                await batch.commit();
                toast({
                    title: 'Επιτυχία!',
                    description: `Στάλθηκαν ${totalNotifications} προσαρμοσμένες ειδοποιήσεις για την ${activeTab}.`
                });
                setIsCustomNotifDialogOpen(false);
                setCustomNotifTitle('');
                setCustomNotifBody('');
            }
        } catch (error: any) {
            console.error('Error sending custom notifications:', error);
            toast({
                variant: 'destructive',
                title: 'Σφάλμα',
                description: 'Αποτυχία αποστολής ειδοποιήσεων.'
            });
        } finally {
            setIsSendingCustomNotif(false);
        }
    };
    
    const handleDeleteCustomer = async (customerId: string) => {
        if (!firestore || !wholesaler) return;
        const customer = customers.find(c => c.id === customerId);
        if (!customer) return;

        setIsLoading(true);
        try {
            const q = query(
                collection(firestore, 'supplierStoreConnections'),
                where('wholesalerId', '==', wholesaler.id),
                where('storeId', '==', customerId)
            );
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const connectionDoc = querySnapshot.docs[0];
                await deleteDocumentNonBlocking(connectionDoc.ref);
                setCustomers(prev => prev.filter(c => c.id !== customerId));
                toast({
                    variant: 'destructive',
                    title: "Επιτυχής Διαγραφή",
                    description: `Ο πελάτης '${customer?.businessName}' διαγράφηκε (αποσυνδέθηκε).`
                });
            } else {
                 throw new Error("Connection document not found");
            }
        } catch(e) {
             console.error(e);
             toast({ variant: 'destructive', title: 'Σφάλμα Διαγραφής'});
        } finally {
            setIsLoading(false);
        }
    }

    const openDialogForEdit = (customer: Store) => {
        setEditingCustomer(customer);
        setIsDialogOpen(true);
    }
    
    const openDialogForNew = () => {
        setEditingCustomer({});
        setIsDialogOpen(true);
    }
    
    const combinedLoading = isLoadingWholesalers || isLoading;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-lg font-semibold md:text-2xl">Πελάτες</h1>
            </div>

            {/* Pending Join Requests */}
            {allPendingRequests.length > 0 && (
                <Card className="border-amber-500/50 bg-amber-500/5">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Bell className="h-5 w-5 text-amber-500" />
                            <CardTitle className="text-amber-500">Εκκρεμή Αιτήματα Σύνδεσης</CardTitle>
                            <Badge variant="secondary" className="bg-amber-500 text-white">{allPendingRequests.length}</Badge>
                        </div>
                        <CardDescription>
                            Χρήστες που ζητούν πρόσβαση στην επιχείρησή σας. Εγκρίνετε ή απορρίψτε τα αιτήματα.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Όνομα</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Επιχείρηση</TableHead>
                                    <TableHead>Ημερομηνία</TableHead>
                                    <TableHead className="text-right">Ενέργειες</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {allPendingRequests.map((request) => (
                                    <TableRow key={request.id}>
                                        <TableCell className="font-medium">{request.requesterName}</TableCell>
                                        <TableCell className="text-muted-foreground">{request.requesterEmail}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">
                                                {request.businessType === 'store' ? '🏪 Κατάστημα' : '🏭 Προμηθευτής'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm">
                                            {new Date(request.createdAt).toLocaleDateString('el-GR')}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="text-green-600 border-green-600 hover:bg-green-600 hover:text-white"
                                                    onClick={() => handleApproveRequest(request)}
                                                    disabled={isProcessingRequest === request.id}
                                                >
                                                    {isProcessingRequest === request.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <CheckCircle2 className="h-4 w-4 mr-1" />
                                                    )}
                                                    Έγκριση
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="text-destructive border-destructive hover:bg-destructive hover:text-white"
                                                    onClick={() => handleRejectRequest(request)}
                                                    disabled={isProcessingRequest === request.id}
                                                >
                                                    <XCircle className="h-4 w-4 mr-1" />
                                                    Απόρριψη
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* Customer List */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div>
                        <CardTitle>Λίστα Πελατών</CardTitle>
                        <CardDescription>
                            Διαχειριστείτε τους πελάτες της επιχείρησής σας ανα ημέρα παράδοσης.
                        </CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" className="relative h-9 px-4 text-xs sm:text-sm" disabled={!wholesaler}>
                            <FileSpreadsheet className="mr-2 h-4 w-4" />
                            Εισαγωγή
                            <input
                                type="file"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                accept=".csv,.txt,.xls,.xlsx"
                                onChange={handleCsvUpload}
                                disabled={!wholesaler}
                            />
                        </Button>
                        <Button onClick={openDialogForNew} disabled={!wholesaler} className="h-9 px-4 text-xs sm:text-sm">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Νέος Πελάτης
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                   <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
                       <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
                           <TabsList className="bg-muted/30 p-1.5 rounded-2xl h-auto flex flex-wrap gap-1 justify-start border border-muted shadow-sm">
                               <TabsTrigger 
                                    value="all" 
                                    className="rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-200 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-primary/5"
                               >
                                   Όλοι
                               </TabsTrigger>
                               {DAYS_OF_WEEK.map(day => (
                                   <TabsTrigger 
                                        key={day} 
                                        value={day} 
                                        className="rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-200 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-primary/5"
                                   >
                                       {day}
                                   </TabsTrigger>
                               ))}
                           </TabsList>
                           <Button 
                                variant="outline" 
                                className="h-11 px-6 border-primary/20 hover:bg-primary/5 font-bold shadow-sm flex-shrink-0"
                                onClick={() => handleExportExcel(activeTab === 'all' ? undefined : activeTab)}
                                disabled={combinedLoading}
                           >
                               <Download className="mr-2 h-5 w-5 text-primary" />
                               Εξαγωγή {activeTab === 'all' ? 'Όλων των Πελατών' : activeTab}
                           </Button>
                       </div>

                       {activeTab !== 'all' && (
                            <div className="mb-6 space-y-3 animate-in fade-in slide-in-from-top-2">
                                <Button 
                                    className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl shadow-lg shadow-amber-500/20 gap-2 border-none transition-all active:scale-95"
                                    onClick={handleSendDeliveryNotification}
                                    disabled={isSendingNotifications || combinedLoading}
                                >
                                    {isSendingNotifications ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <Bell className="h-5 w-5" />
                                    )}
                                    Στείλε ειδοποίηση για Παραγγελία ({activeTab})
                                </Button>
                                
                                <Button 
                                    variant="outline"
                                    className="w-full h-12 border-blue-600 text-blue-600 hover:bg-blue-50 font-bold rounded-2xl shadow-sm gap-2 transition-all active:scale-95"
                                    onClick={() => setIsCustomNotifDialogOpen(true)}
                                    disabled={combinedLoading}
                                >
                                    <PlusCircle className="h-5 w-5" />
                                    Αποστολή Προσαρμοσμένου Μηνύματος ({activeTab})
                                </Button>

                                <p className="text-[10px] text-muted-foreground mt-2 text-center">
                                    Θα σταλεί άμεση ειδοποίηση σε όλους τους εγγεγραμμένους χρήστες των καταστημάτων της {activeTab}.
                                </p>
                            </div>
                       )}

                       {indexErrorLink && (
                            <Card className="mb-6 border-red-500 bg-red-500/10 animate-in zoom-in-95">
                                <CardHeader className="pb-2">
                                    <div className="flex items-center gap-2 text-red-600">
                                        <Bell className="h-5 w-5" />
                                        <CardTitle className="text-sm font-bold">Απαιτείται Ρύθμιση Βάσης Δεδομένων</CardTitle>
                                    </div>
                                    <CardDescription className="text-red-600/80">
                                        Για να λειτουργήσουν οι ειδοποιήσεις, πρέπει να δημιουργήσετε ένα ευρετήριο (Index) στο Firebase.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Button 
                                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold"
                                        onClick={() => window.open(indexErrorLink, '_blank')}
                                    >
                                        Δημιουργία Index Τώρα
                                    </Button>
                                    <p className="text-[10px] mt-2 text-center opacity-70">
                                        Το link περιέχει όλες τις απαραίτητες παραμέτρους αυτόματα.
                                    </p>
                                </CardContent>
                            </Card>
                       )}

                       <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Επωνυμία</TableHead>
                                    <TableHead>Υπεύθυνος</TableHead>
                                    <TableHead className="hidden sm:table-cell">Τηλέφωνο</TableHead>
                                    <TableHead className="hidden md:table-cell">Ημέρα Παράδοσης</TableHead>
                                    <TableHead className="text-right">Ενέργειες</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {combinedLoading && (
                                     <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                                        </TableCell>
                                    </TableRow>
                                )}
                                {!combinedLoading && customers
                                    .filter(c => activeTab === 'all' || c.deliveryDay === activeTab)
                                    .map((customer) => {
                                        const getCustomerMessages = () => {
                                            const messages: {id: string, title: string}[] = [];
                                            const uids = [customer.ownerId, ...(customer.managerUids || [])].filter(Boolean) as string[];
                                            
                                            uids.forEach(uid => {
                                                const userMessages = acknowledgedMessages.get(uid) || [];
                                                userMessages.forEach(msg => {
                                                    if (!messages.find(m => m.id === msg.id)) {
                                                        messages.push(msg);
                                                    }
                                                });
                                            });
                                            return messages;
                                        };

                                        const acknowledgedList = getCustomerMessages();

                                        return (
                                            <TableRow 
                                                key={customer.id} 
                                                className="cursor-pointer hover:bg-muted/50"
                                                onClick={(e) => {
                                                    if ((e.target as HTMLElement).closest('button')) return;
                                                    router.push(`/admin/customers/${customer.id}`);
                                                }}
                                            >
                                                <TableCell className="font-medium p-4">
                                                    <div className="flex flex-col gap-1.5">
                                                        <span className="text-base font-bold">{customer.businessName}</span>
                                                        
                                                        {acknowledgedList.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mt-1">
                                                                {acknowledgedList.map((msg) => (
                                                                    <Badge key={msg.id} variant="outline" className="text-green-700 border-green-200 bg-green-50/50 gap-1 py-0.5 px-2 text-[10px] font-medium transition-all hover:bg-green-100/50">
                                                                        <Check className="h-3 w-3 text-green-600" />
                                                                        <span className="opacity-70 mr-1 italic">Ενημερώθηκε για:</span>
                                                                        <span className="font-bold uppercase">{msg.title}</span>
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>{customer.ownerName}</TableCell>
                                                <TableCell className="hidden sm:table-cell text-muted-foreground">{customer.phone}</TableCell>
                                                <TableCell className="hidden md:table-cell">
                                                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10">
                                                        {customer.deliveryDay}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                            <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-muted font-bold">
                                                                <span className="sr-only">Open menu</span>
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="rounded-xl">
                                                            <DropdownMenuItem className="cursor-pointer font-bold" onClick={(e) => {
                                                                e.stopPropagation();
                                                                openDialogForEdit(customer);
                                                            }}>
                                                                Επεξεργασία
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem 
                                                                className="text-destructive cursor-pointer font-bold"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteCustomer(customer.id);
                                                                }}
                                                            >
                                                                Διαγραφή
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                }
                                {!combinedLoading && customers.filter(c => activeTab === 'all' || c.deliveryDay === activeTab).length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                            {activeTab === 'all' 
                                                ? 'Δεν έχετε προσθέσει ακόμα πελάτες.' 
                                                : `Δεν υπάρχουν πελάτες για την ${activeTab}.`}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                       </Table>
                   </Tabs>
                </CardContent>
            </Card>

             <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-md">
                     {isDialogOpen && (
                         <CustomerForm 
                            customer={editingCustomer}
                            onSave={handleSaveCustomer}
                            onCancel={() => {
                                setIsDialogOpen(false);
                                setEditingCustomer(null);
                            }}
                         />
                     )}
                </DialogContent>
            </Dialog>

            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Προεπισκόπηση Εισαγωγής Πελατών</DialogTitle>
                        <DialogDescription>
                            Βρέθηκαν {parsedCustomers.length} πελάτες στο αρχείο. Ελέγξτε και επιβεβαιώστε.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[400px] overflow-y-auto border rounded-md">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 sticky top-0">
                                <tr>
                                    <th className="p-2 text-left font-medium">Επωνυμία</th>
                                    <th className="p-2 text-left font-medium">Υπεύθυνος</th>
                                    <th className="p-2 text-left font-medium">Τηλ.</th>
                                    <th className="p-2 text-left font-medium">Ημέρα</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {parsedCustomers.map((c, i) => (
                                    <tr key={i} className="hover:bg-muted/30">
                                        <td className="p-2 font-medium">{c.businessName}</td>
                                        <td className="p-2">{c.ownerName || '-'}</td>
                                        <td className="p-2 text-xs">{c.phone || '-'}</td>
                                        <td className="p-2 text-xs">{c.deliveryDay}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setIsImportDialogOpen(false); setParsedCustomers([]); }}>Ακύρωση</Button>
                        <Button onClick={handleConfirmImport} disabled={isImporting}>
                            {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                            Εισαγωγή {parsedCustomers.length} Πελατών
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={isCustomNotifDialogOpen} onOpenChange={setIsCustomNotifDialogOpen}>
                <DialogContent className="sm:max-w-[500px] rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Bell className="h-5 w-5 text-blue-500" />
                            Αποστολή Μηνύματος ({activeTab})
                        </DialogTitle>
                        <DialogDescription>
                            Στείλτε μια προσαρμοσμένη ειδοποίηση σε όλους τους πελάτες της {activeTab}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="custom-title">Τίτλος</Label>
                            <Input 
                                id="custom-title" 
                                placeholder="π.χ. Αλλαγή Δρομολογίου" 
                                value={customNotifTitle}
                                onChange={(e) => setCustomNotifTitle(e.target.value)}
                                className="rounded-xl"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="custom-body">Μήνυμα</Label>
                            <Textarea 
                                id="custom-body" 
                                placeholder="π.χ. Οι παραγγελίες θα μεταφερθούν την άλλη Τρίτη λόγω αργίας." 
                                value={customNotifBody}
                                onChange={(e) => setCustomNotifBody(e.target.value)}
                                className="rounded-xl min-h-[120px]"
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsCustomNotifDialogOpen(false)} className="rounded-xl">
                            Ακύρωση
                        </Button>
                        <Button 
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl"
                            onClick={handleSendCustomNotification}
                            disabled={isSendingCustomNotif || !customNotifTitle || !customNotifBody}
                        >
                            {isSendingCustomNotif ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Αποστολή...
                                </>
                            ) : (
                                'Αποστολή τώρα'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
