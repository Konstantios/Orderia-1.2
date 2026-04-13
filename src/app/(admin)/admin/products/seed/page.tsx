'use client';

import { useEffect, useState } from 'react';
import { useFirebase, useCollection, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import { collection, query, where, addDoc, getDocs, limit } from 'firebase/firestore';
import { products as demoProducts } from '@/lib/data';
import type { Wholesaler, Product, Store } from '@/lib/types';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function SeedPage() {
    const { user, firestore } = useFirebase();
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const wholesalerQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, 'wholesalers'), where('adminUids', 'array-contains', user.uid), limit(1));
    }, [user, firestore]);
    const { data: wholesalers } = useCollection<Wholesaler>(wholesalerQuery);

    const seed = async () => {
        if (!firestore || !wholesalers?.[0] || !user) {
            setStatus('error');
            setMessage('No wholesaler found for this user or not logged in.');
            return;
        }

        const wholesaler = wholesalers[0];
        console.log("Seeding started for Wholesaler:", wholesaler.id);
        console.log("Wholesaler Data:", JSON.stringify(wholesaler));
        console.log("Current User UID:", user.uid);
        console.log("Wholesaler Admin UIDs:", wholesaler.adminUids);
        console.log("Is User in Admin UIDs?", (wholesaler.adminUids as string[] || []).includes(user.uid));
        
        setStatus('loading');

        try {
            // 1. Seed Products
            console.log("Step 1: Seeding products...");
            const productsColRef = collection(firestore, 'wholesalers', wholesaler.id, 'products');
            const existingProductsSnap = await getDocs(productsColRef);
            console.log("Found existing products:", existingProductsSnap.size);
            
            if (existingProductsSnap.empty) {
                for (const p of demoProducts) {
                    const productData: Omit<Product, 'id'> = {
                        name: p.name,
                        code: p.code,
                        unit: p.unit,
                        imageUrl: p.imageUrl,
                        imageHint: p.imageHint,
                        wholesalerId: wholesaler.id,
                        wholesalerOwnerId: wholesaler.ownerId,
                        wholesalerAdminUids: wholesaler.adminUids,
                    };
                    await addDoc(productsColRef, productData);
                }
                setMessage('Demo products seeded.');
                console.log("Products seeded successfully.");
            } else {
                setMessage('Products exist.');
            }

            // 2. Ensure a Store exists and is linked
            console.log("Step 2: Checking for stores...");
            let storesQuery = query(collection(firestore, 'stores'), where('wholesalerIds', 'array-contains', wholesaler.id), limit(1));
            let storesSnap = await getDocs(storesQuery);
            
            let storeId = '';
            let storeDoc: any = null;

            if (storesSnap.empty) {
                console.log("No store found. Creating one...");
                const newStoreData = {
                    businessName: "Taste Bakery (Test)",
                    ownerName: "Γιώργος Πελάτης",
                    email: "store-customer@frozenfoods.gr",
                    taxId: "123456789",
                    phone: "2101234567",
                    address: "Λεωφόρος Αθηνών 123",
                    deliveryDay: "Τρίτη",
                    wholesalerIds: [wholesaler.id],
                    ownerId: '',
                    managerUids: []
                };
                const storeRef = await addDoc(collection(firestore, "stores"), newStoreData);
                storeId = storeRef.id;
                storeDoc = newStoreData;
                console.log("Store created with ID:", storeId);
                
                // Create connection
                console.log("Creating connection...");
                await addDoc(collection(firestore, "supplierStoreConnections"), {
                    wholesalerId: wholesaler.id,
                    storeId: storeId,
                    isActive: true,
                    connectionDate: new Date().toISOString(),
                    wholesalerOwnerId: wholesaler.ownerId,
                    wholesalerAdminUids: wholesaler.adminUids
                });
                setMessage(prev => prev + ' Created & linked new store.');
                console.log("Connection created.");
            } else {
                storeId = storesSnap.docs[0].id;
                storeDoc = storesSnap.docs[0].data();
                console.log("Found existing store:", storeId);
                setMessage(prev => prev + ' Found existing linked store.');
            }
            
            // 3. Link 3 products
            console.log("Step 3: Linking products to store...");
            const newProductsSnap = await getDocs(productsColRef);
            const productsToLink = newProductsSnap.docs.slice(0, 3);
            
            const configsColRef = collection(firestore, 'stores', storeId, 'productConfigurations');
            for (const pDoc of productsToLink) {
                const existingConfigQuery = query(configsColRef, where('productId', '==', pDoc.id));
                const existingConfigSnap = await getDocs(existingConfigQuery);
                
                if (existingConfigSnap.empty) {
                    console.log("Linking product:", pDoc.id);
                    await addDoc(configsColRef, {
                        productId: pDoc.id,
                        storeId: storeId,
                        idealStock: 0,
                        isActive: true,
                        ownerId: storeDoc.ownerId || '',
                        managerUids: storeDoc.managerUids || []
                    });
                }
            }
            setMessage(prev => prev + ' Linked 3 products.');
            console.log("Seeding complete.");

            setStatus('success');
        } catch (error: any) {
            console.error("Seeding failed:", error);
            setStatus('error');
            let errorDetail = error.message;
            if (error.code) errorDetail = `[${error.code}] ${error.message}`;
            setMessage('Seeding failed. Check console for details. Error: ' + errorDetail);
        }
    };

    const injectRealProducts = async () => {
        if (!firestore || !wholesalers || wholesalers.length === 0) return;
        setStatus('loading');
        setMessage('Starting real product injection...');
        try {
            const wholesaler = wholesalers[0];
            const productsColRef = collection(firestore, `wholesalers/${wholesaler.id}/products`);
            
            const realProducts = [
                { name: "Κατεψυγμένη Πίτσα Special 8-τεμ", sku: "ORD-0045", description: "", price: 5.50, category: "Κατεψυγμένα" },
                { name: "Κρουασάν Βουτύρου (Κούτα)", sku: "ORD-0082", description: "", price: 12.00, category: "Αρτοσκευάσματα" },
                { name: "Μπουγάτσα Θεσσαλονίκης", sku: "ORD-0114", description: "", price: 3.50, category: "Κατεψυγμένα" },
                { name: "Τυροπιτάκια Κουρού (Συσκ.)", sku: "ORD-0021", description: "", price: 4.20, category: "Κατεψυγμένα" },
            ];

            const createdProductIds = [];
            for (const p of realProducts) {
                const docRef = await addDoc(productsColRef, {
                    name: p.name,
                    sku: p.sku,
                    code: p.sku,
                    description: p.description,
                    price: p.price,
                    category: p.category,
                    imageUrl: "https://picsum.photos/seed/frozen/100/100",
                    imageHint: "Frozen products packaging",
                    isActive: true,
                    ownerId: wholesaler.ownerId || '',
                    createdAt: new Date().toISOString()
                });
                createdProductIds.push(docRef.id);
            }
            setMessage(prev => prev + ' Created 4 real products.');

            // Find all stores connected to this wholesaler
            const storesRef = collection(firestore, 'stores');
            const qStores = query(storesRef, where("wholesalerIds", "array-contains", wholesaler.id));
            const storesSnap = await getDocs(qStores);

            for (const storeDoc of storesSnap.docs) {
                const storeId = storeDoc.id;
                const sData = storeDoc.data();
                const configsColRef = collection(firestore, 'stores', storeId, 'productConfigurations');
                
                for (const pid of createdProductIds) {
                    await addDoc(configsColRef, {
                        productId: pid,
                        storeId: storeId,
                        idealStock: 0,
                        isActive: true,
                        ownerId: sData.ownerId || '',
                        managerUids: sData.managerUids || []
                    });
                }
            }
            setMessage(prev => prev + ' And linked them to all stores!');
            setStatus('success');
        } catch (error: any) {
             console.error("Injection failed:", error);
             setStatus('error');
             setMessage('Failed: ' + error.message);
        }
    };


    const fixImages = async () => {
        if (!firestore || !wholesalers || wholesalers.length === 0) return;
        setStatus('loading');
        setMessage('Fixing missing images...');
        try {
            const wholesaler = wholesalers[0];
            const productsColRef = collection(firestore, `wholesalers/${wholesaler.id}/products`);
            const snaps = await getDocs(productsColRef);
            for (const d of snaps.docs) {
                const data = d.data();
                if (!data.imageUrl || data.imageUrl === "") {
                    await setDocumentNonBlocking(d.ref, { imageUrl: "https://picsum.photos/seed/" + d.id + "/100/100", imageHint: "Product" }, { merge: true });
                }
            }
            setStatus('success');
            setMessage('Fixed all missing images!');
        } catch (e: any) {
             setStatus('error');
             setMessage('Failed: ' + e.message);
        }
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center space-y-6">
            <h1 className="text-2xl font-bold">Data Seeder</h1>
            <p className="max-w-md text-muted-foreground">
                This page will seed the 6 demo products into your wholesaler account and link 3 of them to your first customer store.
            </p>
            
            {status === 'idle' && (
                <div className="flex flex-col space-y-4 items-center">
                    <div className="flex space-x-4">
                        <button 
                            onClick={seed}
                            disabled={!wholesalers?.[0]}
                            className="px-6 py-2 bg-secondary text-secondary-foreground rounded-md disabled:opacity-50"
                        >
                            Start Dummy Seeding
                        </button>
                        <button 
                            onClick={injectRealProducts}
                            disabled={!wholesalers?.[0]}
                            className="px-6 py-2 bg-primary text-primary-foreground font-bold rounded-md disabled:opacity-50"
                        >
                            Προσθήκη Πραγματικών Προϊόντων
                        </button>
                    </div>
                    <button 
                        onClick={fixImages}
                        disabled={!wholesalers?.[0]}
                        className="px-6 py-2 bg-destructive/10 text-destructive rounded-md disabled:opacity-50 text-sm"
                    >
                        Επιδιόρθωση Εικόνων (Fix Crashes)
                    </button>
                </div>
            )}

            {status === 'loading' && (
                <div className="flex items-center space-x-2 text-primary">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span>Seeding in progress...</span>
                </div>
            )}

            {status === 'success' && (
                <div className="flex flex-col items-center space-y-2 text-green-600">
                    <CheckCircle2 className="h-12 w-12" />
                    <span className="font-semibold">Success!</span>
                    <p className="text-sm text-muted-foreground">{message}</p>
                </div>
            )}

            {status === 'error' && (
                <div className="flex flex-col items-center space-y-2 text-destructive">
                    <AlertCircle className="h-12 w-12" />
                    <span className="font-semibold">Error</span>
                    <p className="text-sm">{message}</p>
                </div>
            )}
        </div>
    );
}
