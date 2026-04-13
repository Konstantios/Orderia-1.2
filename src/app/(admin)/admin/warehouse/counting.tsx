'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Camera, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Product, WholesalerStockItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { PlaceHolderImages } from '@/lib/placeholder-images';

// Define BarcodeDetector for TypeScript
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

const getStockColor = (current: number, ideal: number) => {
    if (ideal === 0) return 'bg-muted/30';
    const ratio = current / ideal;
    if (ratio >= 0.8) {
      return 'bg-green-400/20 text-green-700 dark:text-green-400';
    }
    if (ratio >= 0.4) {
      return 'bg-yellow-400/20 text-yellow-700 dark:text-yellow-400';
    }
    return 'bg-destructive/20 text-destructive';
};

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

export function AdminWarehouseCounting({ products, stock, onSync }: { products: Product[]; stock: WholesalerStockItem[], onSync: (scannedItems: Record<string, number>) => void }) {
  const [isScanning, setIsScanning] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [scannedItems, setScannedItems] = useState<Record<string, number>>({});
  
  const [productForConfirmation, setProductForConfirmation] = useState<Product | null>(null);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const warehouseBg = PlaceHolderImages.find(img => img.id === 'warehouse-background');

  const handleSync = () => {
    onSync(scannedItems);
    setScannedItems({});
  };

  const inventoryData = useMemo(() => {
    // Index stock for O(1) lookup
    const stockMap = new Map<string, WholesalerStockItem>();
    stock.forEach(item => stockMap.set(item.productId, item));

    return products.map(p => {
      const stockItem = stockMap.get(p.id);
      const currentStock = stockItem?.quantity || 0;
      const idealStock = stockItem?.idealStock || 0;
      return { product: p, currentStock, idealStock };
    });
  }, [products, stock]);

  // Index products by code for O(1) lookup during scanning
  const productCodeMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach(p => map.set(p.code, p));
    return map;
  }, [products]);

  const handleConfirmScan = () => {
    if (!productForConfirmation) return;
    
    const product = productForConfirmation;

    setScannedItems(prev => ({
      ...prev,
      [product.id]: (prev[product.id] || 0) + 1,
    }));

    toast({ title: "Επιτυχής Καταμέτρηση!", description: `Προστέθηκε: ${product.name}` });

    const element = document.getElementById(`counting-product-${product.id}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    setProductForConfirmation(null);
    setLastScannedCode(null); // Allow scanning again
  };

  const handleCancelScan = () => {
    setProductForConfirmation(null);
    setLastScannedCode(null); // Allow scanning again
  };
  
  useEffect(() => {
    if (!isScanning) {
        if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
        return;
    }

    let stream: MediaStream | null = null;
    
    const startScan = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast({ variant: 'destructive', title: 'Σφάλμα Κάμερας', description: 'Η κάμερα δεν υποστηρίζεται σε αυτόν τον περιηγητή.' });
        setHasCameraPermission(false);
        setIsScanning(false);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        setHasCameraPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();

          if (!('BarcodeDetector' in window)) {
            toast({ variant: 'destructive', title: 'Το σκανάρισμα δεν υποστηρίζεται', description: 'Παρακαλώ χρησιμοποιήστε έναν σύγχρονο περιηγητή όπως το Chrome.' });
            setIsScanning(false);
            return;
          }

          const barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code', 'ean_13', 'code_128', 'code_39', 'upc_a', 'upc_e'] });
          
          let isDetecting = false;
          detectionIntervalRef.current = setInterval(async () => {
            if (productForConfirmation || !videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA || isDetecting) {
              return;
            }
            try {
              isDetecting = true;
              const barcodes = await barcodeDetector.detect(videoRef.current);
              if (barcodes.length > 0 && barcodes[0].rawValue) {
                const newScannedCode = barcodes[0].rawValue;
                if (newScannedCode !== lastScannedCode) {
                    setLastScannedCode(newScannedCode); // Prevent immediate re-scan of the same code
                    playBeep();
                    const product = productCodeMap.get(newScannedCode);
                    if (product) {
                        setProductForConfirmation(product);
                    } else {
                        toast({ variant: "destructive", title: "Άγνωστος Κωδικός", description: `Το προϊόν με κωδικό ${newScannedCode} δεν βρέθηκε.` });
                        setTimeout(() => setLastScannedCode(null), 2000); // Allow retry after 2s
                    }
                }
              }
            } catch (e) {
                // Barcode detection can fail on some frames, no need to log.
            } finally {
                isDetecting = false;
            }
          }, 500); // Slightly longer interval
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Άρνηση Πρόσβασης στην Κάμερα',
          description: 'Παρακαλώ επιτρέψτε την πρόσβαση στην κάμερα.',
        });
        setIsScanning(false);
      }
    };

    startScan();

    return () => {
      if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
      if (videoRef.current && videoRef.current.srcObject) {
        const currentStream = videoRef.current.srcObject as MediaStream;
        currentStream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, [isScanning, products, toast, productForConfirmation, lastScannedCode]);
  
  const totalScannedItems = Object.values(scannedItems).reduce((sum, count) => sum + count, 0);

  return (
    <div className="space-y-4">
      {isScanning && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center animate-in fade-in-0">
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" autoPlay playsInline muted />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
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
                   Auto-Detection Active
                </div>
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-black tracking-[0.2em] text-white/50 uppercase whitespace-nowrap">
                   Align Barcode Here
                </div>

                {/* Grid Effect Overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
            </div>
          </div>
          <Button onClick={() => setIsScanning(false)} variant="ghost" size="icon" className="absolute top-4 right-4 z-10 bg-black/50 rounded-full h-10 w-10">
            <X className="h-6 w-6" />
          </Button>
          {hasCameraPermission === false && (
            <Alert variant="destructive" className="absolute bottom-20 w-11/12 max-w-md">
              <AlertTitle>Απαιτείται Πρόσβαση στην Κάμερα</AlertTitle>
              <AlertDescription>Ενεργοποιήστε την πρόσβαση στην κάμερα από τις ρυθμίσεις του περιηγητή σας.</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <Card onClick={() => setIsScanning(true)} className="cursor-pointer bg-card overflow-hidden group">
        <div className="relative h-36">
          {warehouseBg && <Image src={warehouseBg.imageUrl} layout="fill" alt="Warehouse" className="object-cover transition-transform duration-300 group-hover:scale-105" data-ai-hint={warehouseBg.imageHint} />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent" />
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
            <div className="bg-accent/80 backdrop-blur-sm rounded-full p-3 border-2 border-accent-foreground/50 mb-2 transition-transform duration-300 group-hover:scale-110">
              <Camera className="h-6 w-6 text-accent-foreground" />
            </div>
            <h3 className="text-white font-bold text-xl drop-shadow-md">Σκανάρισμα Barcode</h3>
            <p className="text-white/80 text-sm drop-shadow-sm">Έναρξη εισαγωγής ειδών με ακρίβεια</p>
          </div>
        </div>
      </Card>
      
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Σύνολο Σαρωμένων Τεμαχίων</p>
            <p className="text-4xl font-bold">{totalScannedItems}</p>
          </div>
          <Button
            onClick={handleSync}
            variant="secondary"
            className="bg-primary/10 text-primary border border-primary/20 self-start h-auto px-2.5 py-0.5 rounded-full font-semibold text-xs hover:bg-primary/20"
          >
            <span className="relative flex h-2 w-2 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Ζωντανός Συγχρονισμός
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {inventoryData.map(({ product, currentStock, idealStock }) => {
          const scannedCount = scannedItems[product.id] || 0;
          return (
          <Card key={product.id} id={`counting-product-${product.id}`} className={cn("transition-all duration-300 bg-card/50", (scannedItems[product.id] || 0) > 0 && "ring-2 ring-accent ring-offset-2 ring-offset-background")}>
            <div className={cn("p-3")}>
              {currentStock <= idealStock / 3 && idealStock > 0 && <p className="text-xs font-bold uppercase text-destructive mb-1">Κρίσιμη Έλλειψη</p>}
              <p className="text-xs text-muted-foreground">SKU: {product.code}</p>
              <h4 className="font-semibold">{product.name}</h4>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-accent/20 p-2">
                  <p className="text-[11px] font-semibold uppercase text-accent/80">ΣΚΑΝΑΡ.</p>
                  <p className="text-2xl font-bold text-accent">{scannedCount}</p>
                </div>
                <div className={cn("rounded-lg p-2", getStockColor(currentStock, idealStock))}>
                  <p className="text-[11px] font-semibold uppercase">ΑΠΟΘΕΜΑ</p>
                  <p className="text-2xl font-bold">{currentStock}</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-2">
                  <p className="text-[11px] font-semibold uppercase text-muted-foreground">ΙΔΑΝΙΚΟ</p>
                  <p className="text-2xl font-bold">{idealStock}</p>
                </div>
              </div>
            </div>
          </Card>
        )})}
      </div>
      
      <Dialog open={!!productForConfirmation} onOpenChange={(open) => !open && handleCancelScan()}>
        <DialogContent>
            {productForConfirmation && (
            <>
                <DialogHeader>
                    <DialogTitle>Επιβεβαίωση Σάρωσης</DialogTitle>
                    <DialogDescription>
                        Το προϊόν βρέθηκε. Πατήστε "Επιβεβαίωση" για να αυξήσετε την καταμέτρηση.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex items-center gap-4 my-4 p-4 bg-muted/50 rounded-lg">
                    <Image 
                        src={productForConfirmation.imageUrl} 
                        alt={productForConfirmation.name} 
                        width={64} 
                        height={64} 
                        className="rounded-md object-cover"
                        data-ai-hint={productForConfirmation.imageHint}
                    />
                    <div>
                        <h3 className="font-semibold">{productForConfirmation.name}</h3>
                        <p className="text-sm text-muted-foreground">Κωδικός: {productForConfirmation.code}</p>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={handleCancelScan}>Ακύρωση</Button>
                    <Button onClick={handleConfirmScan}>Επιβεβαίωση</Button>
                </DialogFooter>
            </>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
