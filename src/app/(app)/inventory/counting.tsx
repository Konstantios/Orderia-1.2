'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Camera, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Product, Customer } from '@/lib/types';
import { cn } from '@/lib/utils';
import { PlaceHolderImages } from '@/lib/placeholder-images';

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

export function InventoryCounting({ products, customer }: { products: Product[]; customer: Customer }) {
  const [isScanning, setIsScanning] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
  
  // Mock inventory data for display. In a real app, this would be managed state.
  const inventoryData = customer.products.map(cp => {
    const product = products.find(p => p.id === cp.productId)!;
    const idealStock = cp.idealStock;
    const currentStock = Math.floor(Math.random() * (idealStock + 5)); // Random stock for demo
    const suggestion = Math.max(0, idealStock - currentStock);
    return { product, idealStock, currentStock, suggestion };
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();
  const warehouseBg = PlaceHolderImages.find(img => img.id === 'warehouse-background');

  const handleScanSuccess = useCallback((scannedCode: string) => {
    const product = products.find(p => p.code === scannedCode);
    setIsScanning(false);
    if (product) {
      setScannedProduct(product);
      toast({ title: "Επιτυχής Σάρωση!", description: `Σαρώθηκε: ${product.name}` });

      const element = document.getElementById(`counting-product-${product.id}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });

      setTimeout(() => setScannedProduct(null), 3000);
    } else {
      toast({ variant: "destructive", title: "Άγνωστος Κωδικός", description: `Το προϊόν με κωδικό ${scannedCode} δεν βρέθηκε.` });
    }
  }, [products, toast]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let detectionInterval: ReturnType<typeof setInterval>;

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

          detectionInterval = setInterval(async () => {
            if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
              try {
                const barcodes = await barcodeDetector.detect(videoRef.current);
                if (barcodes.length > 0 && barcodes[0].rawValue) {
                  handleScanSuccess(barcodes[0].rawValue);
                }
              } catch (e) {
                console.error('Barcode detection error:', e);
                clearInterval(detectionInterval);
              }
            }
          }, 500);
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

    const stopScan = () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const currentStream = videoRef.current.srcObject as MediaStream;
        currentStream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      if (detectionInterval) {
        clearInterval(detectionInterval);
      }
    };

    if (isScanning) {
      startScan();
    }

    return () => {
      stopScan();
    };
  }, [isScanning, toast, handleScanSuccess]);
  
  return (
    <div className="space-y-4">
      {isScanning && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center animate-in fade-in-0">
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" autoPlay playsInline muted />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-11/12 max-w-sm aspect-[4/3] rounded-2xl border-4 border-dashed border-white/50 relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-red-500/70 shadow-[0_0_10px_2px_theme(colors.red.500)] animate-scan-line"></div>
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
      
      <div className="flex justify-between items-center py-2">
        <div>
          <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Πυρήνας Αποθεμάτων</h4>
          <p className="text-xs text-muted-foreground">Τηλεμετρία και αναπλήρωση σε πραγματικό χρόνο</p>
        </div>
        <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
          <span className="relative flex h-2 w-2 mr-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
          Ζωντανός Συγχρονισμός
        </Badge>
      </div>

      <div className="space-y-3">
        {inventoryData.map(({ product, currentStock, idealStock, suggestion }) => (
          <Card key={product.id} id={`counting-product-${product.id}`} className={cn("transition-all duration-300 bg-card/50", scannedProduct?.id === product.id && "ring-2 ring-accent ring-offset-2 ring-offset-background")}>
            <div className={cn("p-3", currentStock === 0 && "bg-destructive/10 rounded-lg")}>
              {currentStock === 0 && <p className="text-xs font-bold uppercase text-destructive mb-1">Κρίσιμη Έλλειψη</p>}
              <p className="text-xs text-muted-foreground">SKU: {product.code}</p>
              <h4 className="font-semibold">{product.name}</h4>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className={cn("rounded-lg p-2", currentStock === 0 ? 'bg-destructive/20 text-destructive' : 'bg-muted/30')}>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">ΑΠΟΘΕΜΑ</p>
                  <p className="text-2xl font-bold">{currentStock}</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">ΙΔΑΝΙΚΟ</p>
                  <p className="text-2xl font-bold">{idealStock}</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">ΠΡΟΤΑΣΗ</p>
                  <p className="text-2xl font-bold text-accent">+{suggestion}</p>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
