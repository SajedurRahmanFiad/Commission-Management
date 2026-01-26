
export type Role = 'admin' | 'employee';

export interface User {
  id: string;
  email: string;
  username?: string;
  avatar?: string;
  password?: string;
  role: Role;
  wallet: number;
  totalSalesCount: number;
  notifications: AppNotification[];
  paymentAccounts?: {
    bKash?: string;
    Nagad?: string;
    Rocket?: string;
  };
}

export type SaleStatus = 'pending' | 'completed';
export type WithdrawStatus = 'pending' | 'completed';

export interface Product {
  id: string;
  name: string;
  adminShare: number;
  description: string;
  mainImage?: string;
  gallery: string[];
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  timestamp: string;
}

export interface Sale {
  id: string;
  employeeId: string;
  employeeEmail: string;
  customerEmail: string;
  customerPhone: string;
  amount: number;
  productId: string;
  productName: string;
  paymentMethod: 'bKash' | 'Nagad' | 'Rocket';
  status: SaleStatus;
  timestamp: string;
  approvedAt?: string;
}

export interface WithdrawRequest {
  id: string;
  employeeId: string;
  employeeEmail: string;
  amount: number;
  method: 'bKash' | 'Nagad' | 'Rocket';
  accountNumber: string;
  status: WithdrawStatus;
  timestamp: string;
}

export interface AppNotification {
  id: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'sale' | 'announcement' | 'withdraw';
}

export interface AppState {
  currentUser: User | null;
  users: User[];
  sales: Sale[];
  products: Product[];
  announcements: Announcement[];
  withdrawRequests: WithdrawRequest[];
  adminWallet: number;
}
