import type { LucideProps } from 'lucide-react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  History,
  Warehouse,
  Users,
  FileText,
  Bell,
  ScanLine,
  Plus,
  Minus,
  Truck,
} from 'lucide-react';

export const Icons = {
  dashboard: LayoutDashboard,
  newOrder: ShoppingCart,
  inventory: Package,
  history: History,
  warehouse: Warehouse,
  customers: Users,
  reports: FileText,
  notifications: Bell,
  scan: ScanLine,
  plus: Plus,
  minus: Minus,
  suppliers: Truck,
  team: Users,
};

export type Icon = keyof typeof Icons;
