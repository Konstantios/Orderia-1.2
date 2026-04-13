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
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
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

    const startCamera = async () => {
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

          if (cameraMode === 'barcode') {
            if (!('BarcodeDetector' in window)) {
                toast({ variant: 'destructive', title: 'Το σκανάρισμα δεν υποστηρίζεται', description: 'Παρακαλώ χρησιμοποιήστε έναν σύγχρονο περιηγητή όπως το Chrome.' });
                setIsCameraOpen(false);
                return;
            }
            const barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code', 'ean_13', 'code_128', 'code_39', 'upc_a', 'upc_e'] });
            
            let isDetecting = false;
            detectionIntervalRef.current = setInterval(async () => {
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
      if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
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
    <>
      <Dialog open={open && !isCameraOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
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
        </DialogContent>
      </Dialog>

      {isCameraOpen && (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center overflow-hidden touch-none h-[100dvh] w-screen animate-in fade-in-0">
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-contain bg-black" autoPlay playsInline muted />
          <canvas ref={canvasRef} className="hidden" />
          
          {cameraMode === 'barcode' ? (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              {/* Ambient Darkening Overlay */}
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"></div>
              
              {/* Futuristic Scanning HUD */}
              <div className="relative w-11/12 max-w-sm aspect-square bg-white/5 backdrop-blur-[2px] rounded-3xl border border-white/10 shadow-2xl overflow-hidden ring-4 ring-black/20 z-10 animate-in zoom-in-95 duration-500">
                  {/* Moving Laser Line */}
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-red-500 shadow-[0_0_20px_4px_rgba(239,68,68,0.7)] animate-scan-line z-20"></div>
                  
                  {/* Scanner Viewfinder Corners */}
                  <div className="absolute -top-1 -left-1 w-12 h-12 border-t-4 border-l-4 border-primary rounded-tl-2xl shadow-[0_0_15px_rgba(105,153,235,0.4)]"></div>
                  <div className="absolute -top-1 -right-1 w-12 h-12 border-t-4 border-r-4 border-primary rounded-tr-2xl shadow-[0_0_15px_rgba(105,153,235,0.4)]"></div>
                  <div className="absolute -bottom-1 -left-1 w-12 h-12 border-b-4 border-l-4 border-primary rounded-bl-2xl shadow-[0_0_15px_rgba(105,153,235,0.4)]"></div>
                  <div className="absolute -bottom-1 -right-1 w-12 h-12 border-b-4 border-r-4 border-primary rounded-br-2xl shadow-[0_0_15px_rgba(105,153,235,0.4)]"></div>
                  
                  {/* Cyberpunk HUD Labels */}
                  <div className="absolute top-6 left-1/2 -translate-x-1/2 text-[10px] font-black tracking-[0.3em] text-primary uppercase whitespace-nowrap drop-shadow-[0_0_10px_rgba(105,153,235,0.8)]">
                     Barcode Capture Active
                  </div>
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-black tracking-[0.2em] text-white/50 uppercase whitespace-nowrap">
                     Align Barcode Here
                  </div>

                  {/* Grid Effect Overlay */}
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="w-11/12 max-w-sm aspect-square rounded-3xl border-2 border-white/20 relative overflow-hidden">
                    <div className="absolute inset-0 border-[60px] border-black/20"></div>
                </div>
            </div>
          )}

          <Button onClick={() => setIsCameraOpen(false)} variant="ghost" size="icon" className="absolute top-4 right-4 z-[110] bg-black/50 rounded-full h-10 w-10">
            <X className="h-6 w-6 text-white" />
          </Button>
          
          {cameraMode === 'photo' && (
             <Button onClick={takePhoto} size="lg" className="absolute bottom-10 z-[110] bg-primary hover:bg-primary/90 text-white font-bold h-14 px-8 rounded-2xl shadow-xl shadow-primary/20">
                 <Camera className="mr-3 h-6 w-6" />
                 Λήψη Φωτογραφίας
             </Button>
          )}
        </div>
      )}
    </>
  );
}


export function InventoryDatabase({ products: initialProducts }: { products: Product[] }) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
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
                <Card key={product.id} className="bg-card/50 cursor-pointer hover:bg-card/70" onClick={() => setSelectedProduct(product)}>
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

      <Dialog open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <DialogContent>
          {selectedProduct && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedProduct.name}</DialogTitle>
                <DialogDescription>SKU: {selectedProduct.code}</DialogDescription>
              </DialogHeader>
              <div className="flex justify-center p-4 bg-white rounded-md my-4">
                <Image
                  src={`https://barcode.tec-it.com/barcode.ashx?data=${selectedProduct.code}&code=Code128&dpi=96`}
                  alt={`Barcode for ${selectedProduct.name}`}
                  width={300}
                  height={100}
                  className="object-contain"
                />
              </div>
              <DialogFooter>
                  <DialogClose asChild>
                      <Button type="button" variant="secondary">Κλείσιμο</Button>
                  </DialogClose>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
