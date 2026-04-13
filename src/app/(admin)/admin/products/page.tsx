'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle, Loader2 } from 'lucide-react';
import type { Product, Wholesaler } from '@/lib/types';
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
import { collection, query, where, doc, limit, writeBatch } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, getStorage } from "firebase/storage";
import Image from 'next/image';
import { Scan, Camera, Upload, Check, X, FileSpreadsheet } from 'lucide-react';

// Define BarcodeDetector for TypeScript
interface BarcodeDetector {
  new(options?: { formats: string[] }): BarcodeDetector;
  detect(image: ImageBitmapSource): Promise<{ rawValue: string }[]>;
}

declare global {
  interface Window {
    BarcodeDetector: BarcodeDetector;
  }
}

const ProductForm = ({ product, wholesaler, onSave, onCancel }: { product: Partial<WithId<Product>> | null; wholesaler: WithId<Wholesaler>; onSave: (productData: Omit<Product, 'id' | 'wholesalerOwnerId' | 'wholesalerAdminUids'>) => void; onCancel: () => void }) => {
    const [formData, setFormData] = useState<Partial<Product>>(product || { unit: 'τεμάχιο'});
    const [isScanning, setIsScanning] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const { toast } = useToast();
    const { firebaseApp } = useFirebase();
    const storage = getStorage(firebaseApp);
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const detectionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({...prev, [name]: value}));
    }
    
    const handleSelectChange = (value: 'κιβώτιο' | 'κιλό' | 'τεμάχιο') => {
        setFormData(prev => ({...prev, unit: value}));
    }

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !storage) return;

        setIsUploading(true);
        try {
            const storageRef = ref(storage, `products/${wholesaler.id}/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);
            setFormData(prev => ({...prev, imageUrl: downloadURL}));
            toast({ title: "Επιτυχής Μεταφόρτωση", description: "Η εικόνα του προϊόντος ανέβηκε σωστά." });
        } catch (error) {
            console.error("Error uploading image:", error);
            toast({ variant: "destructive", title: "Σφάλμα", description: "Αποτυχία μεταφόρτωσης της εικόνας." });
        } finally {
            setIsUploading(false);
        }
    }

    const playBeep = () => {
        const context = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (!context) return;
        try {
            const oscillator = context.createOscillator();
            const gainNode = context.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(context.destination);
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(600, context.currentTime);
            gainNode.gain.setValueAtTime(0.5, context.currentTime);
            oscillator.start();
            oscillator.stop(context.currentTime + 0.15);
        } catch(e) {
            console.error("Could not play beep", e)
        }
    };

    useEffect(() => {
        if (!isScanning) {
            if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
            return;
        }

        let stream: MediaStream | null = null;
        
        const startScan = async () => {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                toast({ variant: 'destructive', title: 'Σφάλμα Κάμερας', description: 'Η κάμερα δεν υποστηρίζεται.' });
                setIsScanning(false);
                return;
            }
            try {
                stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { 
                        facingMode: 'environment',
                        width: { ideal: 1920 },
                        height: { ideal: 1080 }
                    } 
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play();

                    if (!('BarcodeDetector' in window)) {
                        toast({ variant: 'destructive', title: 'Το σκανάρισμα δεν υποστηρίζεται', description: 'Παρακαλώ χρησιμοποιήστε Chrome.' });
                        setIsScanning(false);
                        return;
                    }

                    const barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code', 'ean_13', 'code_128', 'code_39', 'upc_a', 'upc_e'] });
                    
                    let isDetecting = false;
                    detectionIntervalRef.current = setInterval(async () => {
                        if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA || isDetecting) return;
                        try {
                            isDetecting = true;
                            const barcodes = await barcodeDetector.detect(videoRef.current);
                            if (barcodes.length > 0 && barcodes[0].rawValue) {
                                const code = barcodes[0].rawValue;
                                playBeep();
                                setFormData(prev => ({...prev, code}));
                                setIsScanning(false);
                                toast({ title: "Barcode Σκαναρίστηκε", description: `Κωδικός: ${code}` });
                            }
                        } catch (e) {
                            // ignore
                        } finally {
                            isDetecting = false;
                        }
                    }, 500);
                }
            } catch (error) {
                console.error('Error accessing camera:', error);
                toast({ variant: 'destructive', title: 'Σφάλμα', description: 'Αποτυχία πρόσβασης στην κάμερα.' });
                setIsScanning(false);
            }
        };

        startScan();

        return () => {
            if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
            if (stream) stream.getTracks().forEach(track => track.stop());
        };
    }, [isScanning, toast]);

    const handleStartScan = () => {
        setIsScanning(true);
    }

    const handleSubmit = () => {
        if (!formData.name || !formData.code || !formData.unit) {
            toast({
                variant: 'destructive',
                title: 'Ελλιπή Στοιχεία',
                description: 'Παρακαλώ συμπληρώστε όλα τα υποχρεωτικά πεδία.',
            });
            return;
        }

        const productToSave: Omit<Product, 'id' | 'wholesalerOwnerId' | 'wholesalerAdminUids'> & { wholesalerId: string; wholesalerOwnerId: string; wholesalerAdminUids: string[]; } = {
            name: formData.name,
            code: formData.code,
            unit: formData.unit,
            imageUrl: formData.imageUrl || `https://picsum.photos/seed/${formData.code}/400/300`,
            imageHint: formData.name.toLowerCase(),
            wholesalerId: wholesaler.id,
            wholesalerOwnerId: wholesaler.ownerId,
            wholesalerAdminUids: wholesaler.adminUids,
        };

        onSave(productToSave);
    }
    
    return (
        <>
            <DialogHeader>
                <DialogTitle>{product?.id ? 'Επεξεργασία Προϊόντος' : 'Νέο Προϊόν'}</DialogTitle>
                <DialogDescription>
                    {product?.id ? 'Επεξεργαστείτε τα στοιχεία του προϊόντος.' : 'Συμπληρώστε τα στοιχεία για το νέο προϊόν.'}
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                {isScanning && (
                    <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center overflow-hidden touch-none h-[100dvh] w-screen animate-in fade-in-0">
                        <video ref={videoRef} className="absolute inset-0 w-full h-full object-contain bg-black" autoPlay playsInline muted />
                        <canvas ref={canvasRef} className="hidden" />
                        
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                            {/* Ambient Darkening Overlay */}
                            <div className="absolute inset-0 bg-black/50"></div>
                            
                            {/* Futuristic Scanning HUD */}
                            <div className="relative w-11/12 max-w-sm aspect-square bg-transparent rounded-3xl border border-white/20 shadow-2xl overflow-hidden ring-4 ring-black/20 z-10 animate-in zoom-in-95 duration-500">
                                {/* Moving Laser Line */}
                                <div className="absolute top-0 left-0 right-0 h-1.5 bg-red-500 shadow-[0_0_20px_4px_rgba(239,68,68,0.7)] animate-scan-line z-20"></div>
                                
                                {/* Scanner Viewfinder Corners */}
                                <div className="absolute -top-1 -left-1 w-12 h-12 border-t-4 border-l-4 border-primary rounded-tl-2xl shadow-[0_0_15px_rgba(105,153,235,0.4)]"></div>
                                <div className="absolute -top-1 -right-1 w-12 h-12 border-t-4 border-r-4 border-primary rounded-tr-2xl shadow-[0_0_15px_rgba(105,153,235,0.4)]"></div>
                                <div className="absolute -bottom-1 -left-1 w-12 h-12 border-b-4 border-l-4 border-primary rounded-bl-2xl shadow-[0_0_15px_rgba(105,153,235,0.4)]"></div>
                                <div className="absolute -bottom-1 -right-1 w-12 h-12 border-b-4 border-r-4 border-primary rounded-br-2xl shadow-[0_0_15px_rgba(105,153,235,0.4)]"></div>
                                
                                {/* Cyberpunk HUD Labels */}
                                <div className="absolute top-6 left-1/2 -translate-x-1/2 text-[10px] font-black tracking-[0.3em] text-primary uppercase whitespace-nowrap drop-shadow-[0_0_10px_rgba(105,153,235,0.8)]">
                                   Product ID Scanner Active
                                </div>
                                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-black tracking-[0.2em] text-white/50 uppercase whitespace-nowrap">
                                   Align Barcode to Registry
                                </div>

                                {/* Grid Effect Overlay */}
                                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
                            </div>
                        </div>

                        <Button onClick={() => setIsScanning(false)} variant="ghost" size="icon" className="absolute top-4 right-4 z-[110] bg-black/50 rounded-full h-10 w-10">
                            <X className="h-6 w-6 text-white" />
                        </Button>
                    </div>
                )}
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Όνομα</Label>
                    <Input id="name" name="name" value={formData.name || ''} onChange={handleChange} className="col-span-3" />
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="code" className="text-right">Κωδικός</Label>
                    <div className="col-span-3 flex gap-2">
                        <Input id="code" name="code" value={formData.code || ''} onChange={handleChange} className="flex-1" />
                        <Button variant="outline" size="icon" onClick={handleStartScan} title="Σκανάρισμα Barcode">
                            <Scan className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="unit" className="text-right">Μονάδα</Label>
                    <Select onValueChange={handleSelectChange} defaultValue={formData.unit}>
                        <SelectTrigger className="col-span-3">
                            <SelectValue placeholder="Επιλέξτε μονάδα" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="τεμάχιο">Τεμάχιο</SelectItem>
                            <SelectItem value="κιβώτιο">Κιβώτιο</SelectItem>
                            <SelectItem value="κιλό">Κιλό</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid grid-cols-4 items-start gap-4">
                    <Label className="text-right pt-2">Εικόνα</Label>
                    <div className="col-span-3 space-y-4">
                        <div className="flex gap-2">
                            <Input id="imageUrl" name="imageUrl" value={formData.imageUrl || ''} onChange={handleChange} className="flex-1" placeholder="URL Εικόνας..."/>
                            <Label htmlFor="image-upload" className="cursor-pointer">
                                <Button variant="secondary" size="icon" asChild>
                                    <div>
                                        {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                        <input id="image-upload" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploading} />
                                    </div>
                                </Button>
                            </Label>
                        </div>
                        {formData.imageUrl && (
                             <div className="relative aspect-video w-full rounded-md overflow-hidden border">
                                <Image src={formData.imageUrl} alt="Προεπισκόπηση" fill className="object-cover" />
                             </div>
                        )}
                    </div>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={onCancel}>Ακύρωση</Button>
                <Button onClick={handleSubmit} disabled={isUploading}>Αποθήκευση</Button>
            </DialogFooter>
        </>
    );
};

export default function AdminProductsPage() {
    const { user, firestore } = useFirebase();
    const { toast } = useToast();

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Partial<WithId<Product>> | null>(null);

    const wholesalerQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, 'wholesalers'), where('adminUids', 'array-contains', user.uid), limit(1));
    }, [user, firestore]);
    const { data: wholesalers, isLoading: isLoadingWholesalers } = useCollection<Wholesaler>(wholesalerQuery);
    const wholesaler = wholesalers?.[0];

    const productsQuery = useMemoFirebase(() => {
        if (!firestore || !wholesaler) return null;
        return collection(firestore, 'wholesalers', wholesaler.id, 'products');
    }, [firestore, wholesaler]);
    const { data: products, isLoading: isLoadingProducts } = useCollection<Product>(productsQuery);

    const handleSaveProduct = (productData: Omit<Product, 'id'>) => {
        if (!firestore || !wholesaler) return;
        
        if (editingProduct?.id) { // Editing existing
            const productRef = doc(firestore, 'wholesalers', wholesaler.id, 'products', editingProduct.id);
            updateDocumentNonBlocking(productRef, productData);
            toast({ title: "Επιτυχής Ενημέρωση", description: `Το προϊόν '${productData.name}' ενημερώθηκε.` });
        } else { // Adding new
            const productsColRef = collection(firestore, 'wholesalers', wholesaler.id, 'products');
            addDocumentNonBlocking(productsColRef, productData);
            toast({ title: "Επιτυχής Καταχώρηση", description: `Το προϊόν '${productData.name}' προστέθηκε.` });
        }
        setIsDialogOpen(false);
        setEditingProduct(null);
    }
    
    const handleDeleteProduct = (productId: string) => {
        if (!firestore || !wholesaler) return;
        const product = products?.find(p => p.id === productId);
        if (!product) return;

        const productRef = doc(firestore, 'wholesalers', wholesaler.id, 'products', productId);
        deleteDocumentNonBlocking(productRef);
        toast({
            variant: 'destructive',
            title: "Επιτυχής Διαγραφή",
            description: `Το προϊόν '${product?.name}' διαγράφηκε.`
        });
    }

    const openDialogForEdit = (product: WithId<Product>) => {
        setEditingProduct(product);
        setIsDialogOpen(true);
    }
    
    const openDialogForNew = () => {
        setEditingProduct({});
        setIsDialogOpen(true);
    }
    
    const isLoading = isLoadingWholesalers || isLoadingProducts;

    // --- CSV Import ---
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [parsedProducts, setParsedProducts] = useState<Array<{ code: string; name: string; piecesPerBox: string }>>([]);
    const [isImporting, setIsImporting] = useState(false);

    const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            if (!text) return;

            const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
            const results: Array<{ code: string; name: string; piecesPerBox: string }> = [];

            for (const line of lines) {
                // Support both comma and semicolon delimiters
                const delimiter = line.includes(';') ? ';' : ',';
                const parts = line.split(delimiter).map(p => p.trim().replace(/^"|"$/g, ''));

                if (parts.length < 2) continue;

                const code = parts[0];
                const name = parts[1];
                const piecesPerBox = parts[2] || '';

                // Skip header row
                if (code.toLowerCase() === 'κωδικός' || code.toLowerCase() === 'code' || code.toLowerCase() === 'kwdikos') continue;

                if (code && name) {
                    results.push({ code, name, piecesPerBox });
                }
            }

            if (results.length === 0) {
                toast({ variant: 'destructive', title: 'Κενό Αρχείο', description: 'Δεν βρέθηκαν προϊόντα στο αρχείο.' });
                return;
            }

            setParsedProducts(results);
            setIsImportDialogOpen(true);
        };
        reader.readAsText(file);
        // Reset file input so re-selecting same file works
        e.target.value = '';
    };

    const handleConfirmImport = async () => {
        if (!firestore || !wholesaler || parsedProducts.length === 0) return;
        setIsImporting(true);

        try {
            const batch = writeBatch(firestore);
            const productsColRef = collection(firestore, 'wholesalers', wholesaler.id, 'products');

            parsedProducts.forEach(p => {
                const newDocRef = doc(productsColRef);
                batch.set(newDocRef, {
                    name: p.name,
                    code: p.code,
                    unit: 'κιβώτιο',
                    piecesPerBox: parseInt(p.piecesPerBox) || 0,
                    imageUrl: `https://picsum.photos/seed/${p.code}/400/300`,
                    imageHint: p.name.toLowerCase(),
                    wholesalerId: wholesaler.id,
                    wholesalerOwnerId: wholesaler.ownerId,
                    wholesalerAdminUids: wholesaler.adminUids,
                });
            });

            await batch.commit();
            toast({ title: 'Επιτυχής Εισαγωγή', description: `Προστέθηκαν ${parsedProducts.length} προϊόντα.` });
            setIsImportDialogOpen(false);
            setParsedProducts([]);
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Σφάλμα', description: 'Αποτυχία εισαγωγής προϊόντων.' });
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-lg font-semibold md:text-2xl">Προϊόντα</h1>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Λίστα Προϊόντων</CardTitle>
                        <CardDescription>
                            Διαχειριστείτε τα προϊόντα που προσφέρετε.
                        </CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" className="relative" disabled={!wholesaler}>
                            <FileSpreadsheet className="mr-2 h-4 w-4" />
                            Εισαγωγή Excel
                            <input
                                type="file"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                accept=".csv,.txt,.xls,.xlsx"
                                onChange={handleCsvUpload}
                                disabled={!wholesaler}
                            />
                        </Button>
                        <Button onClick={openDialogForNew} disabled={!wholesaler}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Προσθήκη Προϊόντος
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                   <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[80px]">Εικόνα</TableHead>
                                <TableHead>Όνομα</TableHead>
                                <TableHead className="hidden sm:table-cell">Κωδικός</TableHead>
                                <TableHead className="hidden md:table-cell">Μονάδα</TableHead>
                                <TableHead className="text-right">Ενέργειες</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto"/>
                                    </TableCell>
                                </TableRow>
                            )}
                            {!isLoading && products?.map((product) => (
                                <TableRow key={product.id}>
                                    <TableCell>
                                        <Image src={product.imageUrl} alt={product.name} width={40} height={40} className="rounded-sm object-cover" />
                                    </TableCell>
                                    <TableCell className="font-medium">{product.name}</TableCell>
                                    <TableCell className="hidden sm:table-cell text-muted-foreground">{product.code}</TableCell>
                                    <TableCell className="hidden md:table-cell">{product.unit}</TableCell>
                                    <TableCell className="text-right">
                                         <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => openDialogForEdit(product)}>
                                                    Επεξεργασία
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteProduct(product.id)}>
                                                    Διαγραφή
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {!isLoading && products?.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                        Δεν έχετε προσθέσει ακόμα προϊόντα.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                   </Table>
                </CardContent>
            </Card>

             <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-md">
                     {isDialogOpen && wholesaler && (
                         <ProductForm 
                            product={editingProduct}
                            wholesaler={wholesaler}
                            onSave={handleSaveProduct}
                            onCancel={() => {
                                setIsDialogOpen(false);
                                setEditingProduct(null);
                            }}
                         />
                     )}
                </DialogContent>
            </Dialog>

            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Προεπισκόπηση Εισαγωγής</DialogTitle>
                        <DialogDescription>
                            Βρέθηκαν {parsedProducts.length} προϊόντα στο αρχείο. Ελέγξτε και επιβεβαιώστε.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[400px] overflow-y-auto border rounded-md">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 sticky top-0">
                                <tr>
                                    <th className="p-2 text-left font-medium">Κωδικός</th>
                                    <th className="p-2 text-left font-medium">Όνομα</th>
                                    <th className="p-2 text-left font-medium">Τεμ/Κιβ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {parsedProducts.map((p, i) => (
                                    <tr key={i} className="hover:bg-muted/30">
                                        <td className="p-2 font-mono text-xs">{p.code}</td>
                                        <td className="p-2">{p.name}</td>
                                        <td className="p-2 text-center">{p.piecesPerBox || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setIsImportDialogOpen(false); setParsedProducts([]); }}>Ακύρωση</Button>
                        <Button onClick={handleConfirmImport} disabled={isImporting}>
                            {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                            Εισαγωγή {parsedProducts.length} Προϊόντων
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
