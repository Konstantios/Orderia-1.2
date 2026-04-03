export interface Product {
  id: string;
  code: string;
  name: string;
  imageUrl: string;
  imageHint: string;
  unit: 'κιβώτιο' | 'κιλό' | 'τεμάχιο';
}

export interface CustomerProduct {
  productId: string;
  idealStock: number;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  products: CustomerProduct[];
}

export interface AdminCustomer {
  id: string;
  companyName: string;
  vatNumber: string;
  phone1: string;
  phone2?: string;
  address: string;
  googleMapsLink?: string;
  deliveryDay: string;
  contactName: string;
}

export interface CustomerInventoryItem {
  productId: string;
  currentStock: number;
  lastAction?: {
    type: 'είσοδος' | 'έξοδος' | 'καταμέτρηση';
    value: number;
  };
}

export interface OrderItem {
  productId: string;
  quantity: number;
}

export interface Order {
  id: string;
  customerName: string;
  date: string;
  items: OrderItem[];
  status: 'Εκκρεμής' | 'Ολοκληρωμένη' | 'Απεσταλμένη';
  notes?: string;
  supplierNotes?: string;
}

export interface WholesalerStockItem {
  productId: string;
  quantity: number;
  idealStock: number;
  lastAction?: {
    type: 'είσοδος' | 'έξοδος' | 'καταμέτρηση';
    value: number;
  };
}

export interface AdminDashboardData {
  todayOrders: number;
  pendingOrders: number;
  lowStockItems: number;
  newCustomers: number;
}

export interface Notification {
  id: string;
  title: string;
  description: string;
  date: string;
  read: boolean;
}
