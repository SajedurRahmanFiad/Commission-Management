
export type Role = 'admin' | 'employee';

export interface User {
  id: string;
  email: string;
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

export interface AppState {
  currentUser: User | null;
  users: User[];
  sales: Sale[];
  adminWallet: number;
}
