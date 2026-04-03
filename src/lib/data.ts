import type { Product, Customer, Order, CustomerInventoryItem, WholesalerStockItem, AdminDashboardData, Notification, AdminCustomer } from './types';
import { PlaceHolderImages } from './placeholder-images';

function getImage(id: string) {
  const image = PlaceHolderImages.find(img => img.id === id);
  return image ? { url: image.imageUrl, hint: image.imageHint } : { url: 'https://picsum.photos/seed/placeholder/400/300', hint: 'food product' };
}

// Updated products to match the screenshot
export const products: Product[] = [
  { id: 'p1', code: 'ORD-0045', name: 'Κατεψυγμένη Πίτσα Special 8-τεμ', imageUrl: getImage('special-pizza').url, imageHint: getImage('special-pizza').hint, unit: 'κιβώτιο' },
  { id: 'p2', code: 'ORD-0082', name: 'Κρουασάν Βουτύρου (Κούτα)', imageUrl: getImage('croissant').url, imageHint: getImage('croissant').hint, unit: 'κιβώτιο' },
  { id: 'p3', code: 'ORD-0114', name: 'Μπουγάτσα Θεσσαλονίκης', imageUrl: getImage('bougatsa-thess').url, imageHint: getImage('bougatsa-thess').hint, unit: 'κιλό' },
  { id: 'p4', code: 'ORD-0021', name: 'Τυροπιτάκια Κουρού (Συσκ.)', imageUrl: getImage('kourou-pie').url, imageHint: getImage('kourou-pie').hint, unit: 'κιλό' },
  // Keep some old ones for other parts of the app to not break
  { id: 'p5', code: '1030', name: 'Σπανακόπιτα', imageUrl: getImage('spinach-pie').url, imageHint: getImage('spinach-pie').hint, unit: 'τεμάχιο' },
  { id: 'p6', code: '1035', name: 'Λουκανικοπιτάκι', imageUrl: getImage('sausage-roll').url, imageHint: getImage('sausage-roll').hint, unit: 'τεμάχιο' },
];

export const customers: Customer[] = [
  {
    id: 'c1',
    name: 'Frozen Foods', // Renamed to match supplier in screenshot
    email: 'demo@bakery.com',
    products: [
      { productId: 'p1', idealStock: 30 }, // Pizza
      { productId: 'p2', idealStock: 25 }, // Croissant
      { productId: 'p3', idealStock: 40 }, // Bougatsa
      { productId: 'p4', idealStock: 20 }, // Kourou
      { productId: 'p5', idealStock: 12 }, // Spanakopita, keep for other pages
    ],
  },
  {
    id: 'c2',
    name: 'Snack Bar "Το Γρήγορο"',
    email: 'contact@snackbar.gr',
    products: [
      { productId: 'p6', idealStock: 20 },
    ],
  },
  {
    id: 'c3',
    name: 'Ζαχαροπλαστείο "Ο Γλυκός Πειρασμός"',
    email: 'orders@glykos.gr',
    products: [
      { productId: 'p2', idealStock: 20 },
    ],
  },
];

export const adminCustomers: AdminCustomer[] = [
  {
    id: 'cust-1',
    companyName: 'Φούρνος "Η Γεύση"',
    vatNumber: '123456789',
    phone1: '2101234567',
    address: 'Αριστοτέλους 1, 10432, Αθήνα',
    googleMapsLink: 'https://maps.app.goo.gl/12345',
    deliveryDay: 'Τρίτη',
    contactName: 'Νίκος Γεωργίου'
  },
  {
    id: 'cust-2',
    companyName: 'Snack Bar "Το Γρήγορο"',
    vatNumber: '987654321',
    phone1: '2109876543',
    phone2: '6971234567',
    address: 'Πατησίων 100, 11257, Αθήνα',
    googleMapsLink: 'https://maps.app.goo.gl/67890',
    deliveryDay: 'Δευτέρα',
    contactName: 'Μαρία Παπαδάκη'
  },
  {
    id: 'cust-3',
    companyName: 'Ζαχαροπλαστείο "Ο Γλυκός Πειρασμός"',
    vatNumber: '112233445',
    phone1: '2105555555',
    address: 'Πλατεία Συντάγματος 5, 10563, Αθήνα',
    googleMapsLink: 'https://maps.app.goo.gl/abcde',
    deliveryDay: 'Πέμπτη',
    contactName: 'Ελένη Κώστα'
  }
];

// Updated inventory to match the screenshot
export const customerInventory: CustomerInventoryItem[] = [
  { productId: 'p1', currentStock: 5, lastAction: { type: 'καταμέτρηση', value: 5 } },   // Pizza
  { productId: 'p2', currentStock: 12, lastAction: { type: 'είσοδος', value: 10 } },  // Croissant
  { productId: 'p3', currentStock: 38, lastAction: { type: 'έξοδος', value: 2 } },  // Bougatsa
  { productId: 'p4', currentStock: 18 },  // Kourou
  { productId: 'p5', currentStock: 5, lastAction: { type: 'καταμέτρηση', value: 5 } },   // Spanakopita, keep for other pages
];

export const orderHistory: Order[] = [
  {
    id: 'o1',
    customerName: 'Φούρνος "Η Γεύση"',
    date: '2023-10-18T10:00:00Z',
    items: [{ productId: 'p2', quantity: 7 }, { productId: 'p5', quantity: 8 }],
    status: 'Ολοκληρωμένη',
    notes: 'Παράδοση πριν τις 08:00',
  },
  {
    id: 'o2',
    customerName: 'Φούρνος "Η Γεύση"',
    date: '2023-10-11T10:00:00Z',
    items: [{ productId: 'p2', quantity: 5 }],
    status: 'Ολοκληρωμένη',
  },
  {
    id: 'o3',
    customerName: 'Φούρνος "Η Γεύση"',
    date: '2023-10-04T10:00:00Z',
    items: [{ productId: 'p2', quantity: 8 }, { productId: 'p5', quantity: 6 }],
    status: 'Ολοκληρωμένη',
  },
];

const today = new Date();
const yesterday = new Date();
yesterday.setDate(today.getDate() - 1);

export const adminOrders: Order[] = [
    {
        id: 'ORD-001',
        customerName: 'Φούρνος "Η Γεύση"',
        date: today.toISOString(),
        items: [
            { productId: 'p1', quantity: 5 },
            { productId: 'p3', quantity: 10 },
        ],
        status: 'Εκκρεμής',
        notes: 'Παράδοση κοντά στην πλαϊνή είσοδο παρακαλώ.'
    },
    {
        id: 'ORD-002',
        customerName: 'Snack Bar "Το Γρήγορο"',
        date: today.toISOString(),
        items: [
            { productId: 'p6', quantity: 15 },
        ],
        status: 'Εκκρεμής',
    },
    {
        id: 'ORD-003',
        customerName: 'Φούρνος "Η Γεύση"',
        date: yesterday.toISOString(),
        items: [
            { productId: 'p2', quantity: 8 },
            { productId: 'p4', quantity: 12 },
        ],
        status: 'Απεσταλμένη',
        supplierNotes: 'Ο οδηγός ενημερώθηκε για την αλλαγή ώρας.'
    },
    {
        id: 'ORD-004',
        customerName: 'Ζαχαροπλαστείο "Ο Γλυκός Πειρασμός"',
        date: yesterday.toISOString(),
        items: [
            { productId: 'p2', quantity: 20 },
        ],
        status: 'Ολοκληρωμένη',
    },
];


export const wholesalerStock: WholesalerStockItem[] = [
    { productId: 'p1', quantity: 150, idealStock: 100 },
    { productId: 'p2', quantity: 200, idealStock: 150 },
    { productId: 'p3', quantity: 80, idealStock: 100 },
    { productId: 'p4', quantity: 120, idealStock: 100 },
    { productId: 'p5', quantity: 180, idealStock: 150 },
    { productId: 'p6', quantity: 250, idealStock: 200 },
];

export const adminDashboardData: AdminDashboardData = {
    todayOrders: 5,
    pendingOrders: 2,
    lowStockItems: 1,
    newCustomers: 3,
};

export const notifications: Notification[] = [
  { id: 'n1', title: 'Υπενθύμιση: Εβδομαδιαία Παραγγελία', description: 'Παρακαλούμε υποβάλετε την εβδομαδιαία παραγγελία σας μέχρι τις 5 μ.μ. σήμερα.', date: new Date().toISOString(), read: false },
  { id: 'n2', title: 'Η Παραγγελία #O2 Επιβεβαιώθηκε', description: 'Η παραγγελία σας έχει επιβεβαιωθεί και θα παραδοθεί αύριο.', date: '2023-10-11T11:00:00Z', read: true },
  { id: 'n3', title: 'Νέο Προϊόν Διαθέσιμο', description: 'Δείτε τα νέα Λουκανικοπιτάκια στη λίστα προϊόντων μας!', date: '2023-10-09T09:00:00Z', read: true },
];
