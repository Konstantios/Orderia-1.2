import type { Product, Customer, Order, CustomerInventoryItem, WholesalerStockItem, AdminDashboardData, Notification } from './types';
import { PlaceHolderImages } from './placeholder-images';

function getImage(id: string) {
  const image = PlaceHolderImages.find(img => img.id === id);
  return image ? { url: image.imageUrl, hint: image.imageHint } : { url: 'https://picsum.photos/seed/placeholder/400/300', hint: 'food product' };
}

export const products: Product[] = [
  { id: 'p1', code: '1012', name: 'Κρουασάν Βουτύρου', imageUrl: getImage('croissant').url, imageHint: getImage('croissant').hint },
  { id: 'p2', code: '1018', name: 'Πιροσκί Τυριού', imageUrl: getImage('piroski').url, imageHint: getImage('piroski').hint },
  { id: 'p3', code: '1020', name: 'Ζύμη Πίτσας', imageUrl: getImage('pizza-dough').url, imageHint: getImage('pizza-dough').hint },
  { id: 'p4', code: '1022', name: 'Μπουγάτσα Κρέμα', imageUrl: getImage('bougatsa').url, imageHint: getImage('bougatsa').hint },
  { id: 'p5', code: '1030', name: 'Σπανακόπιτα', imageUrl: getImage('spinach-pie').url, imageHint: getImage('spinach-pie').hint },
  { id: 'p6', code: '1035', name: 'Λουκανικοπιτάκι', imageUrl: getImage('sausage-roll').url, imageHint: getImage('sausage-roll').hint },
];

export const customers: Customer[] = [
  {
    id: 'c1',
    name: 'Φούρνος "Η Γεύση"',
    email: 'demo@bakery.com',
    products: [
      { productId: 'p1', idealStock: 10 },
      { productId: 'p2', idealStock: 8 },
      { productId: 'p5', idealStock: 12 },
    ],
  },
  {
    id: 'c2',
    name: 'Snack Bar "Το Γρήγορο"',
    email: 'contact@snackbar.gr',
    products: [
      { productId: 'p2', idealStock: 15 },
      { productId: 'p3', idealStock: 5 },
      { productId: 'p6', idealStock: 20 },
    ],
  },
  {
    id: 'c3',
    name: 'Ζαχαροπλαστείο "Ο Γλυκός Πειρασμός"',
    email: 'orders@glykos.gr',
    products: [
      { productId: 'p1', idealStock: 20 },
      { productId: 'p4', idealStock: 15 },
    ],
  },
];

export const customerInventory: CustomerInventoryItem[] = [
  { productId: 'p1', currentStock: 3 },
  { productId: 'p2', currentStock: 1 },
  { productId: 'p5', currentStock: 5 },
];

export const orderHistory: Order[] = [
  {
    id: 'o1',
    date: '2023-10-18T10:00:00Z',
    items: [{ productId: 'p1', quantity: 7 }, { productId: 'p2', quantity: 7 }, { productId: 'p5', quantity: 8 }],
    status: 'Completed',
    notes: 'Παράδοση πριν τις 08:00',
  },
  {
    id: 'o2',
    date: '2023-10-11T10:00:00Z',
    items: [{ productId: 'p1', quantity: 8 }, { productId: 'p2', quantity: 5 }],
    status: 'Completed',
  },
  {
    id: 'o3',
    date: '2023-10-04T10:00:00Z',
    items: [{ productId: 'p1', quantity: 5 }, { productId: 'p2', quantity: 8 }, { productId: 'p5', quantity: 6 }],
    status: 'Completed',
  },
];

export const wholesalerStock: WholesalerStockItem[] = [
    { productId: 'p1', quantity: 150 },
    { productId: 'p2', quantity: 200 },
    { productId: 'p3', quantity: 80 },
    { productId: 'p4', quantity: 120 },
    { productId: 'p5', quantity: 180 },
    { productId: 'p6', quantity: 250 },
];

export const adminDashboardData: AdminDashboardData = {
    todayOrders: 5,
    pendingOrders: 2,
    lowStockItems: 1,
    newCustomers: 3,
};

export const notifications: Notification[] = [
  { id: 'n1', title: 'Reminder: Weekly Order', description: 'Please place your weekly order by 5 PM today.', date: new Date().toISOString(), read: false },
  { id: 'n2', title: 'Order #O2 Confirmed', description: 'Your order has been confirmed and will be delivered tomorrow.', date: '2023-10-11T11:00:00Z', read: true },
  { id: 'n3', title: 'New Product Available', description: 'Check out the new Sausage Rolls in our product list!', date: '2023-10-09T09:00:00Z', read: true },
];
