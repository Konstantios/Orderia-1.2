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
    managerUids: string[];
}

export interface Wholesaler {
    id: string;
    companyName: string;
    email: string;
    ownerId: string;
    ownerName: string;
    adminUids: string[];
    taxId: string;
}

export interface CustomerInventoryItem {
  productId: string;
  storeId: string;
  currentStock: number;
  lastAction?: {
    type: 'in' | 'out' | 'counting';
    value: number;
  };
}

export interface StoreProductConfiguration {
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
  wholesalerId?: string;
  storeId?: string;
}

export interface WholesalerStockItem {
  productId: string;
  quantity: number;
  idealStock: number;
  wholesalerId: string;
  warehouseId: string;
  ownerId: string;
  adminUids: string[];
  lastAction?: {
    type: 'in' | 'out' | 'counting';
    value: number;
  };
}

export interface Warehouse {
  id: string;
  name: string;
  wholesalerId: string;
  ownerId: string;
  adminUids: string[];
}

export interface PostItNote {
    text: string;
    color: 'yellow' | 'blue' | 'green';
    createdAt: any; // Using `any` for serverTimestamp()
    wholesalerId: string;
    ownerId: string;
    adminUids: string[];
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
