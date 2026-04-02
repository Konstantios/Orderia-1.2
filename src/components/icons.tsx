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
};

export type Icon = keyof typeof Icons;
