
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
}

export type SaleStatus = 'pending' | 'approved';

export interface Sale {
  id: string;
  employeeId: string;
  employeeEmail: string;
  customerEmail: string;
  customerPhone: string;
  amount: number;
  status: SaleStatus;
  timestamp: string;
  approvedAt?: string;
}

export interface AppNotification {
  id: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export interface AppState {
  currentUser: User | null;
  users: User[];
  sales: Sale[];
  adminWallet: number;
  notifications: AppNotification[];
}
