
export interface StockLog {
  id: string;
  timestamp: string;
  type: 'RESTOCK' | 'SALE' | 'ADJUSTMENT' | 'INITIAL';
  amount: number;
  balance: number;
  reason?: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  buyPrice: number;
  marginPercent: number;
  sellPrice: number;
  stock: number;
  minStock: number;
  description: string;
  lastRestocked: string;
  stockHistory: StockLog[];
}

export interface Customer {
  id: string;
  name: string;
  address: string;
  phone: string;
  email?: string;
}

export interface SaleItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
  returnedQuantity?: number;
}

export interface Sale {
  id: string;
  timestamp: string;
  customerName?: string;
  customerAddress?: string;
  customerPhone?: string;
  items: SaleItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: 'Cash' | 'Card' | 'Transfer';
  processedBy?: string; // Track which user made the sale
}

export enum UserRole {
  ADMIN = 'ADMIN',
  SALESPERSON = 'SALESPERSON'
}

export interface User {
  id: string;
  username: string;
  role: UserRole;
  fullName: string;
}

export enum View {
  DASHBOARD = 'DASHBOARD',
  INVENTORY = 'INVENTORY',
  POS = 'POS',
  REPORTS = 'REPORTS',
  HISTORY = 'HISTORY',
  CUSTOMERS = 'CUSTOMERS'
}
