
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
export type WithdrawStatus = 'pending' | 'completed' | 'declined';

export interface Product {
  id: string;
  name: string;
  // Pricing model for product: 'fixed' = fixed admin amount; 'commission' = percentage of sale
  pricingModel?: 'fixed' | 'commission';
  // For fixed price model: adminShare is the fixed amount admin receives per sale
  adminShare?: number;
  // For commission model: commissionPercent is the percentage (0-100) the admin receives per sale
  commissionPercent?: number;
  description: string;
  mainImage?: string;
  gallery: string[];
  emailContent?: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  timestamp: string;
  seenBy?: string[]; // Array of user IDs who have seen this announcement
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
