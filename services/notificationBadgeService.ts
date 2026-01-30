import { User, Sale, WithdrawRequest, Announcement, Role } from '../types';

/**
 * Badge counts for different tabs based on user role
 */
export interface BadgeCounts {
  sales: number;
  withdraw: number;
  announcements: number;
}

/**
 * Calculate badge counts based on user role and current data
 * - Admins: See pending sales and incomplete withdrawals
 * - Employees: See unseen announcements
 */
export const calculateBadgeCounts = (
  userRole: Role,
  userId: string | undefined,
  sales: Sale[],
  withdrawRequests: WithdrawRequest[],
  announcements: Announcement[]
): BadgeCounts => {
  const counts: BadgeCounts = {
    sales: 0,
    withdraw: 0,
    announcements: 0,
  };

  if (userRole === 'admin') {
    // Admins see count of pending sales
    counts.sales = sales.filter(s => s.status === 'pending').length;
    
    // Admins see count of incomplete withdrawals
    counts.withdraw = withdrawRequests.filter(w => w.status === 'pending').length;
  } else if (userRole === 'employee' && userId) {
    // Employees see count of unseen announcements
    counts.announcements = announcements.filter(a => !a.seenBy?.includes(userId)).length;
  }

  return counts;
};

/**
 * Check if there are any pending items to show badges
 */
export const hasPendingItems = (
  userRole: Role,
  userId: string | undefined,
  sales: Sale[],
  withdrawRequests: WithdrawRequest[],
  announcements: Announcement[]
): boolean => {
  const counts = calculateBadgeCounts(userRole, userId, sales, withdrawRequests, announcements);
  
  if (userRole === 'admin') {
    return counts.sales > 0 || counts.withdraw > 0;
  } else if (userRole === 'employee') {
    return counts.announcements > 0;
  }
  
  return false;
};
