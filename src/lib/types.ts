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

export interface Store {
    id: string;
    businessName: string;
    ownerName: string;
    taxId: string;
    phone: string;
    email: string;
    address: string;
    ownerId: string;
}

export interface CustomerInventoryItem {
  id: string;
  productId: string;
  storeId: string;
  currentStock: number;
  lastAction?: {
    type: 'in' | 'out' | 'counting';
    value: number;
  };
}

export interface StoreProductConfiguration {
  id: string;
  storeId: string;
  productId: string;
  idealStock: number;
  defaultOrderQuantity?: number;
  customPrice?: number;
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
  id: string;
  productId: string;
  quantity: number;
  idealStock: number;
  lastAction?: {
    type: 'in' | 'out' | 'counting';
    value: number;
  };
}

export interface Warehouse {
  id: string;
  name: string;
  wholesalerId: string;
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
