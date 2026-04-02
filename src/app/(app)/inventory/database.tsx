'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import type { Product } from '@/lib/types';
import { Plus, Camera, ScanLine, X, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

// Define BarcodeDetector for TypeScript, as it's still experimental
interface BarcodeDetector {
  new(options?: { formats: string[] }): BarcodeDetector;
  detect(image: ImageBitmapSource): Promise<{ rawValue: string }[]>;
  getSupportedFormats(): Promise<string[]>;
}

declare global {
  interface Window {
    BarcodeDetector: BarcodeDetector;
  }
}


function AddProductDialog({ open, onOpenChange, onProductAdd }: { open: boolean, onOpenChange: (open: boolean) => void, onProductAdd: (product: Product) => void }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState<'photo' | 'barcode'>('photo');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  const resetForm = useCallback(() => {
    setName('');
    setCode('');
    setPhoto(null);
    setIsCameraOpen(false);
  }, []);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm();
    }
    onOpenChange(isOpen);
  }

  const handleBarcodeScanned = useCallback((scannedCode: string) => {
    setCode(scannedCode);
    setIsCameraOpen(false);
    toast({ title: "Επιτυχής Σάρωση Barcode!", description: `Κωδικός: ${scannedCode}` });
  }, [toast]);
  
  useEffect(() => {
    if (!isCameraOpen) return;

    let stream: MediaStream | null = null;
    let detectionInterval: ReturnType<typeof setInterval> | undefined;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();

          if (cameraMode === 'barcode') {
            if (!('BarcodeDetector' in window)) {
                toast({ variant: 'destructive', title: 'Το σκανάρισμα δεν υποστηρίζεται', description: 'Παρακαλώ χρησιμοποιήστε έναν σύγχρονο περιηγητή όπως το Chrome.' });
                setIsCameraOpen(false);
                return;
            }
            const barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code', 'ean_13', 'code_128', 'code_39', 'upc_a', 'upc_e'] });
            
            let isDetecting = false;
            detectionInterval = setInterval(async () => {
              if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA && !isDetecting) {
                try {
                  isDetecting = true;
                  const barcodes = await barcodeDetector.detect(videoRef.current);
                  if (barcodes.length > 0 && barcodes[0].rawValue) {
                    handleBarcodeScanned(barcodes[0].rawValue);
                  }
                } catch (e) { /* ignore */ } 
                finally { isDetecting = false; }
              }
            }, 300);
          }
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        toast({ variant: 'destructive', title: 'Σφάλμα Κάμερας', description: 'Ελέγξτε τις άδειες πρόσβασης.' });
        setIsCameraOpen(false);
      }
    };

    startCamera();

    return () => {
      if (detectionInterval) clearInterval(detectionInterval);
      stream?.getTracks().forEach(track => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [isCameraOpen, cameraMode, handleBarcodeScanned, toast]);

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0);
      setPhoto(canvas.toDataURL('image/jpeg'));
      setIsCameraOpen(false);
    }
  };

  const handleSave = () => {
    if (!name || !code) {
      toast({ variant: 'destructive', title: 'Ελλιπή Στοιχεία', description: 'Ο τίτλος και ο κωδικός είναι υποχρεωτικοί.' });
      return;
    }
    const newProduct: Product = {
      id: `p_${Date.now()}`,
      name,
      code,
      imageUrl: photo || 'https://picsum.photos/seed/newproduct/400/300',
      imageHint: 'new product',
      unit: 'τεμάχιο', // default
    };
    onProductAdd(newProduct);
    toast({ title: 'Επιτυχής Αποθήκευση', description: `Το προϊόν '${name}' προστέθηκε.` });
    handleOpenChange(false);
  };
  
  const openCamera = (mode: 'photo' | 'barcode') => {
    setCameraMode(mode);
    setIsCameraOpen(true);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        {isCameraOpen ? (
          <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center animate-in fade-in-0">
             <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" autoPlay playsInline muted />
             <canvas ref={canvasRef} className="hidden" />
              {cameraMode === 'barcode' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-11/12 max-w-sm aspect-[4/3] rounded-2xl border-4 border-dashed border-white/50 relative overflow-hidden">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-red-500/70 shadow-[0_0_10px_2px_theme(colors.red.500)] animate-scan-line"></div>
                    </div>
                </div>
              )}
             <Button onClick={() => setIsCameraOpen(false)} variant="ghost" size="icon" className="absolute top-4 right-4 z-10 bg-black/50 rounded-full h-10 w-10">
                <X className="h-6 w-6" />
             </Button>
             {cameraMode === 'photo' && (
                <Button onClick={takePhoto} size="lg" className="absolute bottom-10 z-10">
                    <Camera className="mr-2 h-5 w-5" />
                    Λήψη Φωτογραφίας
                </Button>
             )}
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Προσθήκη Νέου Προϊόντος</DialogTitle>
              <DialogDescription>
                Φωτογραφίστε το προϊόν, σκανάρετε το barcode, και συμπληρώστε τα στοιχεία.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Φωτογραφία Προϊόντος</Label>
                <div className="flex items-center gap-4">
                  {photo ? (
                    <Image src={photo} alt="Product preview" width={80} height={80} className="rounded-md object-cover" />
                  ) : (
                    <div className="w-20 h-20 bg-muted rounded-md flex items-center justify-center">
                      <Camera className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <Button variant="outline" onClick={() => openCamera('photo')}>
                    <Camera className="mr-2 h-4 w-4" />Λήψη
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-name">Τίτλος</Label>
                <Input id="product-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="π.χ. Κατεψυγμένη Πίτσα" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-code">Κωδικός / Barcode</Label>
                <div className="flex gap-2">
                  <Input id="product-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Σκανάρετε ή πληκτρολογήστε" />
                  <Button variant="outline" size="icon" onClick={() => openCamera('barcode')}>
                    <ScanLine className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="secondary">Ακύρωση</Button></DialogClose>
              <Button onClick={handleSave}><Save className="mr-2 h-4 w-4" />Αποθήκευση</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}


export function InventoryDatabase({ products: initialProducts }: { products: Product[] }) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  
  useEffect(() => {
    // This is where you would load products from localStorage
    const savedProducts = localStorage.getItem('inventory_database_products');
    if (savedProducts) {
      try {
        const parsed = JSON.parse(savedProducts);
        if(Array.isArray(parsed)) {
            setProducts(parsed);
        }
      } catch (e) {
          console.error("Failed to parse products from local storage", e);
      }
    }
  }, []);

  const addProduct = (newProduct: Product) => {
    const updatedProducts = [newProduct, ...products];
    setProducts(updatedProducts);
    // This is where you would save products to localStorage
    localStorage.setItem('inventory_database_products', JSON.stringify(updatedProducts));
  };
  
  return (
    <div className="space-y-4 pb-24">
      <Card>
        <CardHeader>
          <CardTitle>Βάση Δεδομένων Προϊόντων</CardTitle>
          <CardDescription>
            Τα προϊόντα που είναι διαθέσιμα για σάρωση και καταμέτρηση.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {products.length > 0 ? (
            <div className="space-y-3">
              {products.map(product => (
                <Card key={product.id} className="bg-card/50">
                  <div className="p-3 flex items-center gap-4">
                    <Image src={product.imageUrl} alt={product.name} width={64} height={64} className="rounded-md object-cover" data-ai-hint={product.imageHint} />
                    <div className="flex-1">
                      <h4 className="font-semibold">{product.name}</h4>
                      <p className="text-xs text-muted-foreground">SKU: {product.code}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Δεν υπάρχουν προϊόντα στη βάση δεδομένων σας.</p>
              <p className="text-sm">Πατήστε το '+' για να προσθέσετε το πρώτο σας προϊόν.</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Button
        onClick={() => setIsAddProductOpen(true)}
        className="fixed bottom-24 right-4 h-16 w-16 rounded-full shadow-lg z-20"
        size="icon"
      >
        <Plus className="h-8 w-8" />
        <span className="sr-only">Προσθήκη Νέου Προϊόντος</span>
      </Button>

      <AddProductDialog 
        open={isAddProductOpen}
        onOpenChange={setIsAddProductOpen}
        onProductAdd={addProduct}
      />
    </div>
  );
}
