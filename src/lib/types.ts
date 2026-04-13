export interface Product {
  id: string;
  code: string;
  name: string;
  imageUrl: string;
  imageHint: string;
  unit: 'κιβώτιο' | 'κιλό' | 'τεμάχιο';
  wholesalerId?: string;
  wholesalerOwnerId?: string;
  wholesalerAdminUids?: string[];
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

export interface Store {
    id: string;
    businessName: string;
    ownerName: string;
    taxId?: string;
    phone: string;
    phone2?: string;
    email: string;
    address: string;
    googleMapsLink?: string;
    deliveryDay: string;
    ownerId?: string;
    managerUids?: string[];
    logoUrl?: string;
}

export interface SupplierStoreConnection {
    id: string;
    wholesalerId: string;
    storeId: string;
    isActive: boolean;
    connectionDate: any;
}


export interface Wholesaler {
    id: string;
    companyName: string;
    email: string;
    ownerId: string;
    ownerName: string;
    adminUids: string[];
    taxId: string;
    description?: string;
    logoUrl?: string;
}

export interface CustomerInventoryItem {
  productId: string;
  storeId: string;
  currentStock: number;
  ownerId: string;
  managerUids: string[];
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
  ownerId: string;
  managerUids: string[];
}

export interface OrderItem {
  productId: string;
  quantity: number;
}

export interface Order {
  id: string;
  customerName: string;
  date: any;
  deliveryDate?: any;
  items: OrderItem[];
  status: 'Εκκρεμής' | 'Ολοκληρωμένη' | 'Απεσταλμένη';
  notes?: string;
  supplierNotes?: string;
  wholesalerId?: string;
  storeId?: string;
  memberUids?: string[];
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
  recipientUid: string;
  wholesalerId: string;
  wholesalerName: string;
  type: 'order_reminder' | 'system';
  createdAt: any;
}

export interface JoinRequest {
  id: string;
  requesterUid: string;
  businessId: string;
  businessName: string;
  businessType: 'store' | 'wholesaler';
  requesterName: string;
  requesterEmail: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}
