
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User, Sale, Role, AppState, AppNotification, Product, Announcement, WithdrawRequest } from './types';
import { Icons, ADMIN_FEE_DEFAULT } from './constants';
import Layout, { formatDateTime } from './components/Layout';
import { fetchDatabaseState, appendSale, appendWithdrawal, appendAnnouncement, updateUser, updateSale, updateProducts, uploadFile, updateWithdrawal, updateAnnouncement, deleteAnnouncement, login } from './services/databaseService';
import { DashboardView, SalesView, ProductListView, ProductDetailView, WithdrawView, TeamHubView, UserDetailView, AnnouncementView, ProfileView } from './components/views';
import { calculateBadgeCounts } from './services/notificationBadgeService';

// --- Local Database Constants ---
const DB_VERSION = 'v2.1';
const STORAGE_KEY = `commishpro_db_${DB_VERSION}`;

/**
 * SEED_DATA: This is the initial state of your app.
 * If you want to change the "hardcoded" products for NEW users, edit them here.
 * Once a user has opened the app, they can edit these via the UI.
 */
const SEED_DATA: Omit<AppState, 'currentUser'> = {
  users: [
    {
      id: '1',
      email: 'admin@system.com',
      password: 'admin',
      role: 'admin',
      wallet: 0,
      totalSalesCount: 0,
      notifications: [],
      username: 'System Admin'
    }
  ],
  products: [
    {
      id: 'p1',
      name: 'Premium Subscription1',
      pricingModel: 'fixed',
      adminShare: 400,
      description: 'Full access to all premium platform features and priority support.',
      gallery: []
    },
    {
      id: 'p2',
      name: 'Enterprise License1',
      pricingModel: 'fixed',
      adminShare: 1500,
      description: 'Corporate-grade license for teams with unlimited seats.',
      gallery: []
    }
  ],
  sales: [],
  announcements: [],
  withdrawRequests: [],
  adminWallet: 0,
};

// --- Toast Component ---
const Toast: React.FC<{ message: string; type: 'success' | 'info' | 'error'; onClose: () => void }> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-red-600' : 'bg-indigo-600';

  return (
    <div className={`${bgColor} text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-right-full duration-300 pointer-events-auto border border-white/10`}>
      <div className="flex-1 font-bold text-sm tracking-tight">{message}</div>
      <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
        <Icons.X />
      </button>
    </div>
  );
};

const App: React.FC = () => {
  // --- State Initialization with LocalStorage ---
  const [state, setState] = useState<AppState>(() => {
    // Initialize from seed; merge with saved data and restore logged-in user
    let initialState = { ...SEED_DATA, currentUser: null } as AppState;
    
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Do NOT restore the full `users` array from localStorage - prefer the database as authoritative
        // Restore only lightweight persisted pieces (sales, announcements, withdrawRequests, adminWallet)
        if (parsed.sales && Array.isArray(parsed.sales)) initialState.sales = parsed.sales;
        if (parsed.announcements && Array.isArray(parsed.announcements)) initialState.announcements = parsed.announcements;
        if (parsed.withdrawRequests && Array.isArray(parsed.withdrawRequests)) initialState.withdrawRequests = parsed.withdrawRequests;

        // Preserve saved currentUserId so we can reconcile with DB on first fetch
        const savedId = parsed?.currentUserId;
        if (savedId) {
          // set a placeholder currentUser with only id so UI knows there's a session pending reconciliation
          initialState.currentUser = { id: savedId } as any;
          console.log('✓ Restored currentUserId from localStorage (will reconcile with DB):', savedId);
        }
      }
    } catch (e) {
      console.error('Failed to restore from localStorage during init:', e);
    }
    
    return initialState;
  });

  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'info' | 'error' }[]>([]);
  const [isLoadingDatabase, setIsLoadingDatabase] = useState(true);

  // Date filter for views (all | today | 7d | 30d | custom)
  const [dateFilter, setDateFilter] = useState<{ type: 'all' | 'today' | '7d' | '30d' | 'custom'; from?: string; to?: string }>({ type: 'all' });
  
  // Track locally marked announcements as seen to prevent polling overwrites
  // This is a Map of announcementId -> Set of userIds who have seen it locally
  const localAnnouncementSeenRef = React.useRef<Map<string, Set<string>>>(new Map());
  
  // Track current user ID for use in polling
  const currentUserIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    currentUserIdRef.current = state.currentUser?.id || null;
  }, [state.currentUser?.id]);

  // Track withdrawals that are pending reconciliation to avoid poll overwrites
  const pendingWithdrawalsRef = React.useRef<Set<string>>(new Set());

  // Normalize user object from DB: map snake_case payout/fields to camelCase and populate paymentAccounts
  const normalizeUser = (u: any) => {
    if (!u) return u;
    const bkash = u.bkash_number || u.bkashNumber || '';
    const nagad = u.nagad_number || u.nagadNumber || '';
    const rocket = u.rocket_number || u.rocketNumber || '';
    const totalSales = u.total_sales_count !== undefined ? u.total_sales_count : (u.totalSalesCount !== undefined ? u.totalSalesCount : u.totalSalesCount);
    return {
      ...u,
      bkashNumber: bkash,
      nagadNumber: nagad,
      rocketNumber: rocket,
      totalSalesCount: totalSales || 0,
      paymentAccounts: { bKash: bkash, Nagad: nagad, Rocket: rocket }
    };
  };

  // Normalize product row from DB (snake_case) to UI-friendly camelCase
  const normalizeProduct = (p: any) => {
    if (!p) return p;
    // gallery may be stored as jsonb or array
    const gallery = Array.isArray(p.gallery) ? p.gallery : (p.gallery ? (typeof p.gallery === 'string' ? (() => {
      try { return JSON.parse(p.gallery); } catch { return []; }
    })() : p.gallery) : []);

    return {
      ...p,
      pricingModel: p.pricing_model || p.pricingModel || 'fixed',
      adminShare: p.admin_share !== undefined ? Number(p.admin_share) : (p.adminShare ?? 0),
      commissionPercent: p.commission_percent !== undefined ? Number(p.commission_percent) : (p.commissionPercent ?? undefined),
      gallery,
      mainImage: p.main_image || p.mainImage || undefined
    };
  };

  // Normalize sale row from DB (snake_case) to UI-friendly camelCase
  const normalizeSale = (s: any) => {
    if (!s) return s;
    return {
      ...s,
      id: s.id,
      employeeId: s.employee_id || s.employeeId || s.employee,
      employeeEmail: s.employee_email || s.employeeEmail || '',
      customerEmail: s.customer_email || s.customerEmail || '',
      customerPhone: s.customer_phone || s.customerPhone || '',
      productId: s.product_id || s.productId || '',
      productName: s.product_name || s.productName || '',
      amount: s.amount !== undefined ? Number(s.amount) : (s.amount || 0),
      paymentMethod: s.payment_method || s.paymentMethod || s.paymentType || 'bKash',
      status: s.status || 'pending',
      timestamp: s.timestamp || s.created_at || new Date().toISOString(),
      approvedAt: s.approved_at || s.approvedAt || undefined
    };
  };

  // Fetch data from database files on app load
  useEffect(() => {
    const initializeDatabase = async () => {
      try {
        const dbData = await fetchDatabaseState();
        
        if (dbData) {
          // Try to restore the saved user ID or saved user email and reconcile with DB data
          let restoredUser: any = null;
          let savedUserObj: any = null;
          try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
              const parsed = JSON.parse(saved);
              const savedId = parsed?.currentUserId;
              if (parsed?.users && Array.isArray(parsed.users) && savedId) savedUserObj = parsed.users.find((u: any) => u.id === savedId) || null;

              if (savedId && dbData.users) {
                restoredUser = dbData.users.map(normalizeUser).find((u: any) => u.id === savedId) || null;
              }

              // Fallback: if we had a saved user object with an email, try to match by email in DB
              if (!restoredUser && savedUserObj && savedUserObj.email && dbData.users) {
                restoredUser = dbData.users.map(normalizeUser).find((u: any) => (u.email || '').toLowerCase() === (savedUserObj.email || '').toLowerCase()) || null;
              }

              if (restoredUser) console.log('✓ User session updated from fresh DB data:', restoredUser.id || restoredUser.email);
            }
          } catch (e) {
            console.error('Error restoring user session:', e);
          }

          // Merge database data with local state, preferring DB users as authoritative
          setState(prev => {
            const freshUsers = dbData.users && Array.isArray(dbData.users) ? dbData.users.map(normalizeUser) : prev.users;

            // If we didn't find a restored user above, but prev.currentUser exists, try matching it in freshUsers by id or email
            let updatedCurrentUser = restoredUser || null;
            if (!updatedCurrentUser && prev.currentUser && freshUsers && Array.isArray(freshUsers)) {
              updatedCurrentUser = freshUsers.find((u: any) => u.id === prev.currentUser?.id || (prev.currentUser?.email && (u.email || '').toLowerCase() === (prev.currentUser.email || '').toLowerCase())) || null;
            }

            // Preserve local avatar if DB row lacks it
            if (updatedCurrentUser && prev.currentUser?.avatar && (!updatedCurrentUser.avatar || updatedCurrentUser.avatar === '')) {
              updatedCurrentUser = { ...updatedCurrentUser, avatar: prev.currentUser.avatar };
            }

            return {
              ...prev,
              users: freshUsers,
              sales: dbData.sales && Array.isArray(dbData.sales) ? dbData.sales.map(normalizeSale).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) : prev.sales,
              products: Array.isArray(dbData.products) ? dbData.products.map(normalizeProduct) : prev.products,
              announcements: dbData.announcements && Array.isArray(dbData.announcements) ? dbData.announcements.map((a: any) => ({ ...a, seenBy: a.seen_by || a.seenBy || [] })).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) : prev.announcements,
              withdrawRequests: dbData.withdrawRequests && Array.isArray(dbData.withdrawRequests) ? dbData.withdrawRequests.map(normalizeWithdraw).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) : prev.withdrawRequests,
              adminWallet: typeof dbData.adminWallet === 'number' ? dbData.adminWallet : prev.adminWallet,
              currentUser: updatedCurrentUser || null,
            };
          });
          console.log('Database initialized from server files');
          console.log('Fetched products (raw):', dbData.products);
          console.log('Fetched products (normalized):', Array.isArray(dbData.products) ? dbData.products.map(normalizeProduct) : dbData.products);
          console.log('Fetched sales (raw):', dbData.sales);
          console.log('Fetched sales (normalized):', Array.isArray(dbData.sales) ? dbData.sales.map(normalizeSale) : dbData.sales);
        }
      } catch (error) {
        console.error('Failed to fetch database state:', error);
      } finally {
        setIsLoadingDatabase(false);
      }
    };

    initializeDatabase();
  }, []); // Only run once on mount

  // Persistent sync to localStorage on every state change (include only minimal state; do not persist users array)
  useEffect(() => {
    const toSave: any = {
      currentUserId: state.currentUser?.id || null,
      sales: state.sales,
      announcements: state.announcements,
      withdrawRequests: state.withdrawRequests
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.error('Failed to write app state to localStorage', e);
    }
  }, [state.sales, state.announcements, state.withdrawRequests, state.adminWallet, state.currentUser?.id]);

  // Real-time polling for database updates (every 5 seconds)
  // Merges local seen status with fetched data to prevent polling overwrites
  useEffect(() => {
    if (!state.currentUser) {
      localAnnouncementSeenRef.current.clear();
      return;
    }

    const poll = async () => {
      try {
        const dbData = await fetchDatabaseState();
        if (!dbData) return;

        // Sync database seenBy data into local tracking
        if (dbData.announcements && Array.isArray(dbData.announcements)) {
          const currentUserId = currentUserIdRef.current;
          dbData.announcements.forEach(ann => {
            if (ann.seenBy && currentUserId && ann.seenBy.includes(currentUserId)) {
              const seenSet = localAnnouncementSeenRef.current.get(ann.id) || new Set();
              seenSet.add(currentUserId);
              localAnnouncementSeenRef.current.set(ann.id, seenSet);
            }
          });
        }

        // Merge local "seen" status with fetched announcements
        const mergedAnnouncements = (dbData.announcements || []).map(ann => {
          const localSeen = localAnnouncementSeenRef.current.get(ann.id);
          if (localSeen && localSeen.size > 0) {
            const seenBySet = new Set(ann.seenBy || []);
            localSeen.forEach(userId => seenBySet.add(userId));
            return {
              ...ann,
              seenBy: Array.from(seenBySet)
            };
          }
          return ann;
        });

        setState(prev => {
          // Get the fresh user data from the database
          const freshUsersRaw = dbData.users && Array.isArray(dbData.users) && dbData.users.length > 0 ? dbData.users : prev.users;
          // Prefer local avatar values when DB returns empty avatar to avoid visual flicker and accidental loss
          const freshUsers = freshUsersRaw.map((u: any) => {
            const normalized = normalizeUser(u);
            const prevUser = prev.users.find((pu: any) => pu.id === normalized.id);
            if (prevUser && prevUser.avatar && (!normalized.avatar || normalized.avatar === '')) {
              return { ...normalized, avatar: prevUser.avatar };
            }
            return normalized;
          });

          // If there's a current user, find and update it from the fresh data
          let updatedCurrentUser = prev.currentUser;
          if (prev.currentUser && freshUsers.length > 0) {
            const freshCurrentUser = freshUsers.find(u => u.id === prev.currentUser!.id);
            if (freshCurrentUser) {
              // Preserve local avatar if DB missing it
              if ((!freshCurrentUser.avatar || freshCurrentUser.avatar === '') && prev.currentUser?.avatar) {
                updatedCurrentUser = { ...freshCurrentUser, avatar: prev.currentUser.avatar };
              } else {
                updatedCurrentUser = freshCurrentUser;
              }
            }
          }

          return {
            ...prev,
            sales: dbData.sales && Array.isArray(dbData.sales) ? dbData.sales.map(normalizeSale).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) : prev.sales,
            announcements: (mergedAnnouncements || []).map((a: any) => ({ ...a, seenBy: a.seen_by || a.seenBy || [] })).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
            withdrawRequests: (() => {
              if (!dbData.withdrawRequests || !Array.isArray(dbData.withdrawRequests)) return prev.withdrawRequests;
              const normalized = dbData.withdrawRequests.map(normalizeWithdraw).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
              const pending = pendingWithdrawalsRef.current;
              const prevMap = new Map(prev.withdrawRequests.map((r: any) => [r.id, r]));
              // Prefer optimistic rows for pending IDs
              let merged = normalized.map((w: any) => (pending.has(w.id) && prevMap.has(w.id) ? prevMap.get(w.id) : w));
              // Include any prev entries not present in normalized (temporary IDs) at the top
              const missingPrev = prev.withdrawRequests.filter((r: any) => !normalized.some((n: any) => n.id === r.id));
              if (missingPrev.length) merged = [...missingPrev, ...merged];
              return merged;
            })(),
            users: freshUsers,
            products: Array.isArray(dbData.products) ? dbData.products.map(normalizeProduct) : prev.products,
            adminWallet: typeof dbData.adminWallet === 'number' ? dbData.adminWallet : prev.adminWallet,
            currentUser: updatedCurrentUser,
          }; 
        });
      } catch (error) {
        console.error('Error polling database:', error);
      }
    };

    const pollInterval = setInterval(poll, 5000);
    return () => clearInterval(pollInterval);
  }, [state.currentUser?.id]);

  const showToast = useCallback((message: string, type: 'success' | 'info' | 'error' = 'info') => {
    setToasts(prev => [...prev, { id: Math.random().toString(), message, type }]);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const emailInput = loginForm.email.trim();
    const passwordInput = loginForm.password.trim();

    try {
      const user = await login(emailInput, passwordInput);
      if (user) {
        // Ensure users list contains the user
        setState(prev => ({ ...prev, users: prev.users.some(u => u.id === user.id) ? prev.users : [...prev.users, user], currentUser: user }));
        setLoginForm({ email: '', password: '' });
        showToast('Authentication Successful', 'success');
      } else {
        setLoginError('Invalid email or password.');
      }
    } catch (err) {
      console.error('Login failed', err);
      setLoginError('Login failed.');
    }
  };

  const handleLogout = () => {
    setState(prev => ({ ...prev, currentUser: null }));
    setActiveTab('dashboard');
    setSelectedProductId(null);
    showToast('Session Ended');
  };

  // --- Logic Helpers ---

  const addNotificationToUser = (userId: string, notif: AppNotification) => {
    setState(prev => {
      const updatedUsers = prev.users.map(u => 
        u.id === userId 
          ? { ...u, notifications: [notif, ...(u.notifications || [])] } 
          : u
      );
      return {
        ...prev,
        users: updatedUsers,
        currentUser: prev.currentUser?.id === userId 
          ? updatedUsers.find(u => u.id === userId) || null 
          : prev.currentUser
      };
    });
  };

  const createSale = async (customerEmail: string, customerPhone: string, amount: number, productId: string, paymentMethod: 'bKash' | 'Nagad' | 'Rocket') => {
    if (!state.currentUser) return;
    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    const newSale: Sale = {
      id: Math.random().toString(36).substr(2, 9),
      employeeId: state.currentUser.id,
      employeeEmail: state.currentUser.email,
      customerEmail,
      customerPhone,
      amount,
      productId,
      productName: product.name,
      paymentMethod,
      status: 'pending',
      timestamp: new Date().toISOString()
    };

    // Update local state optimistically
    setState(prev => ({ ...prev, sales: [newSale, ...prev.sales] }));

    // Append to database file
    const res = await appendSale(newSale);

    // Helper to reconcile a stored row with our optimistic sale
    const reconcileWithStored = async (stored: any) => {
      if (!stored) return false;
      const normalizedStored = normalizeSale(stored);
      setState(prev => {
        // Replace optimistic placeholder with canonical stored row
        let updated = prev.sales.map(s => s.id === newSale.id ? { ...s, ...normalizedStored, id: normalizedStored.id } : s);
        // Move reconciled sale to the front
        const idx = updated.findIndex((s: any) => s.id === normalizedStored.id);
        if (idx > -1) {
          const [item] = updated.splice(idx, 1);
          updated.unshift(item);
        }
        // Ensure global sort newest-first
        updated = updated.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return { ...prev, sales: updated };
      });
      return true;
    };

    // If server returned a canonical stored row, reconcile immediately
    if (res.ok && res.stored && res.stored.id) {
      await reconcileWithStored(res.stored);
    } else {
      // Try an immediate reconciliation by fetching the latest DB state before reverting
      try {
        const dbState = await fetchDatabaseState();
        if (dbState && Array.isArray(dbState.sales)) {
          const match = dbState.sales.map(normalizeSale).find((s: any) =>
            s.productId === newSale.productId &&
            s.amount === newSale.amount &&
            (s.employeeId === newSale.employeeId || (s.employeeEmail || '').toLowerCase() === (newSale.employeeEmail || '').toLowerCase()) &&
            (s.customerEmail || '') === (newSale.customerEmail || '') &&
            (s.customerPhone || '') === (newSale.customerPhone || '') &&
            Math.abs(new Date(s.timestamp).getTime() - new Date(newSale.timestamp).getTime()) < 5000
          );

          if (match) {
            // Replace temp with canonical match and move it to the front
            setState(prev => {
              let updated = prev.sales.map(s => s.id === newSale.id ? { ...s, ...match, id: match.id } : s);
              const idx = updated.findIndex((s: any) => s.id === match.id);
              if (idx > -1) {
                const [item] = updated.splice(idx, 1);
                updated.unshift(item);
              }
              updated = updated.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
              return { ...prev, sales: updated };
            });
            showToast('Sale saved (reconciled with server)', 'success');
            return;
          }
        }
      } catch (e) {
        console.warn('Error during immediate reconciliation:', e);
      }

      // If append failed and we couldn't reconcile, revert optimistic update
      if (!res.ok) {
        setState(prev => ({ ...prev, sales: prev.sales.filter(s => s.id !== newSale.id) }));
        showToast('Failed to persist sale to server', 'error');
        console.error('Append sale failed response:', res.body);
        return;
      }
    }

    // Notify admins
    state.users.filter(u => u.role === 'admin').forEach(admin => {
      addNotificationToUser(admin.id, {
        id: Math.random().toString(),
        message: `New Sale Request from ${state.currentUser?.email.split('@')[0]}`,
        timestamp: new Date().toISOString(),
        read: false,
        type: 'sale'
      });
    });

    showToast('Sale logged for review', 'success');
  };

  const approveSale = async (saleId: string) => {
    const sale = state.sales.find(s => s.id === saleId);
    if (!sale || sale.status === 'completed') return;

    const product = state.products.find(p => p.id === sale.productId);
    let adminShare = ADMIN_FEE_DEFAULT;
    if (product) {
      if (product.pricingModel === 'commission') {
        adminShare = Math.round((sale.amount * (product.commissionPercent || 0)) / 100);
      } else {
        adminShare = product.adminShare ?? ADMIN_FEE_DEFAULT;
      }
    }
    // Clamp to prevent negative employee commission
    adminShare = Math.max(0, Math.min(adminShare, sale.amount));
    const employeeCommission = sale.amount - adminShare;

    // Create updated sale object
    const updatedSale = { ...sale, status: 'completed' as const, approvedAt: new Date().toISOString() };

    setState(prev => {
      const updatedSales = prev.sales.map(s => s.id === saleId ? updatedSale : s);
      const updatedUsers = prev.users.map(u => {
        if (u.id === sale.employeeId) {
          return { ...u, wallet: u.wallet + employeeCommission, totalSalesCount: (u.totalSalesCount || 0) + 1 };
        }
        return u;
      });

      const newAdminWallet = updatedSales
        .filter(s => s.status === 'completed')
        .reduce((acc, s) => {
          const prod = prev.products.find(p => p.id === s.productId);
          if (!prod) return acc;
          if (prod.pricingModel === 'commission') return acc + Math.round((s.amount * (prod.commissionPercent || 0)) / 100);
          return acc + (prod.adminShare || ADMIN_FEE_DEFAULT);
        }, 0);

      return {
        ...prev,
        sales: updatedSales,
        users: updatedUsers,
        adminWallet: newAdminWallet,
        currentUser: prev.currentUser?.id === sale.employeeId 
          ? updatedUsers.find(u => u.id === sale.employeeId) || null 
          : prev.currentUser
      };
    });

    // Sync updated sale to database
    await updateSale(updatedSale);

    // Update employee user in database
    const employeeUser = state.users.find(u => u.id === sale.employeeId);
    if (employeeUser) {
      const updatedEmployee = {
        ...employeeUser,
        wallet: employeeUser.wallet + employeeCommission,
        totalSalesCount: (employeeUser.totalSalesCount || 0) + 1
      };
      await updateUser(updatedEmployee);
    }

    // Update admin user's wallet in database
    const adminUser = state.users.find(u => u.role === 'admin');
    if (adminUser) {
      const updatedAdmin = {
        ...adminUser,
        wallet: adminUser.wallet + adminShare
      };
      await updateUser(updatedAdmin);
    }

    showToast('Transaction finalized', 'success');
  };

  const requestWithdraw = async (amount: number, method: 'bKash' | 'Nagad' | 'Rocket', accountNumber: string) => {
    if (!state.currentUser || state.currentUser.wallet < amount) {
      showToast('Insufficient balance', 'error');
      return;
    }

    const newReq: WithdrawRequest = {
      id: Math.random().toString(36).substr(2, 9),
      employeeId: state.currentUser.id,
      employeeEmail: state.currentUser.email,
      amount,
      method,
      accountNumber,
      status: 'pending',
      timestamp: new Date().toISOString()
    };

    // Update local state
    const updatedUser = { ...state.currentUser, wallet: state.currentUser.wallet - amount };
    setState(prev => ({
      ...prev,
      withdrawRequests: [newReq, ...prev.withdrawRequests],
      users: prev.users.map(u => u.id === prev.currentUser?.id ? updatedUser : u),
      currentUser: updatedUser
    }));

    // Append to database
    const res = await appendWithdrawal(newReq as any);
    if (res && res.ok && res.stored) {
      const normalized = normalizeWithdraw(res.stored);
      setState(prev => ({
        ...prev,
        withdrawRequests: prev.withdrawRequests.map(r => r.id === newReq.id ? normalized : r)
      }));
    } else if (!res || !res.ok) {
      // If append failed, revert local change and refund wallet
      setState(prev => ({
        ...prev,
        withdrawRequests: prev.withdrawRequests.filter(r => r.id !== newReq.id),
        users: prev.users.map(u => u.id === updatedUser.id ? { ...u, wallet: u.wallet + amount } : u),
        currentUser: prev.currentUser?.id === updatedUser.id ? { ...prev.currentUser, wallet: prev.currentUser.wallet + amount } : prev.currentUser
      }));
      showToast('Failed to initiate withdrawal', 'error');
      return;
    }

    await updateUser(updatedUser);

    showToast('Withdrawal initiated', 'success');
  };

  const normalizeWithdraw = (w: any) => {
    if (!w) return w;
    return {
      ...w,
      employeeId: w.employee_id || w.employeeId || w.employee,
      employeeEmail: w.employee_email || w.employeeEmail || '',
      accountNumber: w.account_number || w.accountNumber || '',
      amount: w.amount !== undefined ? Number(w.amount) : (w.amount || 0),
      method: w.method || 'bKash',
      status: w.status || 'pending',
      timestamp: w.timestamp || new Date().toISOString()
    };
  };

  // Try to reconcile a single withdrawal with the database: poll a few times until we see the expected status
  const reconcileWithdrawal = async (id: string, expectedStatus: string, attempts = 4) => {
    const delays = [200, 500, 1000, 2000];
    const pending = pendingWithdrawalsRef.current;
    for (let i = 0; i < attempts; i++) {
      try {
        const dbState = await fetchDatabaseState();
        if (dbState && Array.isArray(dbState.withdrawRequests)) {
          const found = dbState.withdrawRequests.find((r: any) => r.id === id);
          if (found && found.status === expectedStatus) {
            // canonical row found — clear pending and apply server state
            pending.delete(id);
            setState(prev => ({ ...prev, withdrawRequests: dbState.withdrawRequests.map(normalizeWithdraw).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) }));
            return true;
          }
        }
      } catch (e) {
        console.warn('reconcileWithdrawal fetch failed:', e);
      }
      await new Promise(res => setTimeout(res, delays[Math.min(i, delays.length - 1)]));
    }

    // After attempts failed, remove from pending and fallback to canonical DB state
    pending.delete(id);
    try {
      const dbState = await fetchDatabaseState();
      if (dbState && Array.isArray(dbState.withdrawRequests)) {
        setState(prev => ({ ...prev, withdrawRequests: dbState.withdrawRequests.map(normalizeWithdraw).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) }));
      }
    } catch (e) {
      console.warn('Failed to fetch DB state after reconciliation attempts:', e);
    }

    return false;
  }; 

  const completeWithdraw = async (id: string) => {
    const withdrawRequest = state.withdrawRequests.find(r => r.id === id);
    if (!withdrawRequest) return;

    const updatedRequest = { ...withdrawRequest, status: 'completed' as const };
    
    setState(prev => ({
      ...prev,
      withdrawRequests: prev.withdrawRequests.map(r => r.id === id ? updatedRequest : r)
    }));

    // Update in database
    // Mark this id as pending to prevent poll overwrites
    pendingWithdrawalsRef.current.add(id);
    const res = await updateWithdrawal(updatedRequest as any);
    if (res && res.ok && res.stored) {
      const normalized = normalizeWithdraw(res.stored);
      // Server returned canonical row — replace and clear pending
      setState(prev => ({
        ...prev,
        withdrawRequests: prev.withdrawRequests.map(r => r.id === normalized.id ? normalized : (r.id === id ? normalized : r))
      }));
      pendingWithdrawalsRef.current.delete(normalized.id);
    } else if (res && res.ok) {
      // If server acknowledged but didn't return stored row, try to reconcile the single withdrawal with the server state
      await reconcileWithdrawal(id, 'completed');
    }
    
    showToast('Payment settled', 'success');
  };

  const declineWithdraw = async (id: string) => {
    const withdrawRequest = state.withdrawRequests.find(r => r.id === id);
    if (!withdrawRequest) return;

    // Mark request as declined
    const updatedRequest = { ...withdrawRequest, status: 'declined' as const };

    // Return amount to employee wallet
    const employee = state.users.find(u => u.id === withdrawRequest.employeeId);
    let updatedUsers = state.users;
    let updatedCurrentUser = state.currentUser;

    if (employee) {
      const updatedEmployee = { ...employee, wallet: employee.wallet + withdrawRequest.amount };
      updatedUsers = state.users.map(u => u.id === updatedEmployee.id ? updatedEmployee : u);
      if (state.currentUser?.id === updatedEmployee.id) updatedCurrentUser = updatedEmployee;
      // Sync to database
      await updateUser(updatedEmployee);
    }

    setState(prev => ({
      ...prev,
      withdrawRequests: prev.withdrawRequests.map(r => r.id === id ? updatedRequest : r),
      users: updatedUsers,
      currentUser: updatedCurrentUser
    }));

    // Mark pending to prevent poll overwrites
    pendingWithdrawalsRef.current.add(id);
    const res = await updateWithdrawal(updatedRequest as any);
    if (res && res.ok && res.stored) {
      const normalized = normalizeWithdraw(res.stored);
      setState(prev => ({
        ...prev,
        withdrawRequests: prev.withdrawRequests.map(r => r.id === normalized.id ? normalized : (r.id === id ? normalized : r))
      }));
      pendingWithdrawalsRef.current.delete(normalized.id);
    } else if (res && res.ok) {
      // If server acknowledged but didn't return stored row, try to reconcile the single withdrawal with the server state
      await reconcileWithdrawal(id, 'declined');
    }

    showToast('Withdrawal declined; funds returned to employee', 'success');
  };

  const manageProduct = async (id: string | null, data: Partial<Product> | null) => {
    if (!id && data) {
      const prevProducts = state.products;
      const newP: Product = { 
        id: Math.random().toString(36).substr(2, 9), 
        name: data.name!, 
        adminShare: data.adminShare ?? 0, 
        commissionPercent: data.commissionPercent,
        pricingModel: data.pricingModel || 'fixed',
        description: data.description || '', 
        gallery: data.gallery || [], 
        mainImage: data.mainImage 
      };
      const updatedProducts = [...prevProducts, newP];
      setState(prev => ({ ...prev, products: updatedProducts }));
      // Sync to database with the updated list
      const ok = await updateProducts(updatedProducts);
      if (!ok) {
        // Revert local state
        setState(prev => ({ ...prev, products: prev.products.filter(p => p.id !== newP.id) }));
        showToast('Failed to add product to database', 'error');
        return;
      }
      showToast('The product has been added', 'success');
    } else if (id && data) {
      const prevProducts = state.products;
      const updatedProducts = prevProducts.map(p => p.id === id ? { ...p, ...data } : p);
      setState(prev => ({ ...prev, products: updatedProducts }));
      // Sync to database
      const ok = await updateProducts(updatedProducts);
      if (!ok) {
        // Revert local state
        setState(prev => ({ ...prev, products: prevProducts }));
        showToast('Failed to update product on server', 'error');
        return;
      }
      showToast('Product updated', 'success');
    } else if (id && !data) {
      if (window.confirm("Delete this product?")) {
        const prevProducts = state.products;
        const updatedProducts = prevProducts.filter(p => p.id !== id);
        setState(prev => ({ ...prev, products: updatedProducts }));
        // Sync to database
        const ok = await updateProducts(updatedProducts);
        if (!ok) {
          // Revert local state
          setState(prev => ({ ...prev, products: prevProducts }));
          setSelectedProductId(null);
          showToast('Failed to remove product from server', 'error');
          return;
        }
        setSelectedProductId(null);
        showToast('The product has been removed', 'error');
      }
    }
  };

  const updateProfile = async (username: string, avatar: string, paymentAccounts: any) => {
    if (!state.currentUser) return;

    // Flatten paymentAccounts into top-level fields to match server expectations
    const payload: any = {
      ...state.currentUser,
      username,
      avatar,
    };

    if (paymentAccounts) {
      if (paymentAccounts.bKash !== undefined) payload.bkashNumber = paymentAccounts.bKash;
      if (paymentAccounts.Nagad !== undefined) payload.nagadNumber = paymentAccounts.Nagad;
      if (paymentAccounts.Rocket !== undefined) payload.rocketNumber = paymentAccounts.Rocket;
    }

    // Update local state with flattened keys for currentUser
    const updatedUser = {
      ...payload,
      // keep old field names for display compatibility
      paymentAccounts
    };

    setState(prev => {
      const updatedUsers = prev.users.map(u => u.id === prev.currentUser?.id ? updatedUser : u);
      return {
        ...prev,
        users: updatedUsers,
        currentUser: updatedUsers.find(u => u.id === prev.currentUser?.id) || null
      };
    });

    // Sync to database
    const res = await updateUser(payload);
    if (!res) {
      showToast('Failed to update account on server', 'error');
      return;
    }

    // If server returned a stored row, reconcile avatar/ui with canonical DB value
    if (res.stored && res.stored.avatar) {
      // Update local state to reflect canonical DB avatar (public URL)
      setState(prev => {
        const updatedUsers = prev.users.map(u => u.id === prev.currentUser?.id ? { ...u, avatar: res.stored.avatar } : u);
        return { ...prev, users: updatedUsers, currentUser: updatedUsers.find(u => u.id === prev.currentUser?.id) || null };
      });
    }

    if (res.droppedColumns && res.droppedColumns.includes('password')) {
      showToast('Account updated but password not stored in DB (missing column).', 'warning');
    } else {
      showToast('Your account has been updated', 'success');
    }
  };

  const clearNotifications = async () => {
    if (!state.currentUser) return;
    const updatedNotifs = (state.currentUser.notifications || []).map(n => ({ ...n, read: true }));
    const updatedUser = { ...state.currentUser, notifications: updatedNotifs };
    setState(prev => {
      const updatedUsers = prev.users.map(u => u.id === prev.currentUser?.id ? updatedUser : u);
      return {
        ...prev,
        users: updatedUsers,
        currentUser: updatedUsers.find(u => u.id === prev.currentUser?.id) || null
      };
    });
    // Sync to database
    await updateUser(updatedUser);
  };

  // --- Layout logic ---
  const isEmployee = state.currentUser?.role === 'employee';
  const applyDateFilter = (items: any[], getTs: (it: any) => string) => {
    if (!dateFilter || dateFilter.type === 'all') return items;
    const now = Date.now();
    if (dateFilter.type === 'today') {
      const today = new Date();
      const isSameDay = (iso: string) => {
        const d = new Date(iso);
        return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
      };
      return items.filter(i => isSameDay(getTs(i)));
    }
    if (dateFilter.type === '7d') {
      const cutoff = now - 7 * 24 * 60 * 60 * 1000;
      return items.filter(i => new Date(getTs(i)).getTime() >= cutoff);
    }
    if (dateFilter.type === '30d') {
      const cutoff = now - 30 * 24 * 60 * 60 * 1000;
      return items.filter(i => new Date(getTs(i)).getTime() >= cutoff);
    }
    if (dateFilter.type === 'custom' && dateFilter.from) {
      const from = new Date(dateFilter.from).getTime();
      const to = dateFilter.to ? new Date(dateFilter.to).getTime() : Date.now();
      return items.filter(i => {
        const t = new Date(getTs(i)).getTime();
        return t >= from && t <= to;
      });
    }
    return items;
  };

  const displaySales = useMemo(() => {
    const base = isEmployee ? state.sales.filter(s => s.employeeId === state.currentUser?.id) : state.sales;
    return applyDateFilter(base, s => s.timestamp);
  }, [state.sales, state.currentUser, isEmployee, dateFilter]);

  // Calculate badge counts for tabs based on user role
  const badgeCounts = useMemo(() => {
    if (!state.currentUser) {
      return { sales: 0, withdraw: 0, announcements: 0 };
    }
    return calculateBadgeCounts(
      state.currentUser.role,
      state.currentUser.id,
      state.sales,
      state.withdrawRequests,
      state.announcements
    );
  }, [state.currentUser, state.sales, state.withdrawRequests, state.announcements]);

  if (!state.currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-white rounded-[2rem] shadow-2xl border border-slate-200 p-12 animate-in fade-in zoom-in duration-300">
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-4xl font-bold mx-auto mb-6 shadow-xl shadow-indigo-100">S</div>
            <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Sales Panel</h2>
            <p className="text-slate-400 mt-2 font-medium">Internal Sales & Wallet Portal</p>
          </div>
          <form className="space-y-6" onSubmit={handleLogin}>
            {loginError && <p className="text-red-500 text-xs text-center font-bold bg-red-50 py-3 rounded-xl border border-red-100">{loginError}</p>}
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">Email Address</label>
                <input type="email" required className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 outline-none transition-all font-medium text-slate-700" value={loginForm.email} onChange={e => setLoginForm({ ...loginForm, email: e.target.value })} placeholder="admin@system.com" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">Password</label>
                <input type="password" required className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 outline-none transition-all font-medium text-slate-700" value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} placeholder="••••••••" />
              </div>
            </div>
            <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-[0.98]">Enter</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <Layout
      currentUser={state.currentUser}
      onLogout={handleLogout}
      activeTab={activeTab}
      setActiveTab={(t) => { setActiveTab(t); setSelectedProductId(null); }}
      onClearNotifications={clearNotifications}
      badgeCounts={badgeCounts}
      contentKey={selectedProductId ?? selectedUserId}
      dateFilter={dateFilter}
      onDateFilterChange={setDateFilter}
    >
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto">
        {activeTab === 'dashboard' && <DashboardView state={state} isLoading={isLoadingDatabase} onApprove={approveSale} onCreateSale={createSale} displaySales={displaySales} />}
        {activeTab === 'sales' && <SalesView state={state} onApprove={approveSale} displaySales={displaySales} onCreateSale={createSale} />}
        {activeTab === 'products' && (
          selectedProductId ? (
            <ProductDetailView 
              product={state.products.find(p => p.id === selectedProductId)!} 
              isAdmin={state.currentUser.role === 'admin'} 
              onClose={() => setSelectedProductId(null)} 
              onUpdate={(p) => manageProduct(selectedProductId, p)}
              onDelete={() => manageProduct(selectedProductId, null)}
            />
          ) : (
            <ProductListView 
              state={state} 
              isAdmin={state.currentUser.role === 'admin'} 
              onSelect={setSelectedProductId} 
              onAdd={(p) => manageProduct(null, p)} 
            />
          )
        )}
        {activeTab === 'withdraw' && <WithdrawView state={state} onWithdraw={requestWithdraw} onComplete={completeWithdraw} onDecline={declineWithdraw} dateFilter={dateFilter} pendingIds={[...pendingWithdrawalsRef.current]} /> }
        {activeTab === 'employees' && state.currentUser.role === 'admin' && (
          selectedUserId ? (
            <UserDetailView 
              user={state.users.find(u => u.id === selectedUserId)!} 
              onClose={() => setSelectedUserId(null)} 
              onUpdate={updateProfile}
              uploadFile={uploadFile}
              onDelete={async (id) => {
                if (window.confirm("Remove partner?")) {
                  setState(prev => ({ ...prev, users: prev.users.filter(u => u.id !== id) }));
                  // Note: You might want to add a DELETE_USER action to the backend for proper deletion
                  showToast('Partner Deleted', 'error');
                  setSelectedUserId(null);
                }
              }}
            />
          ) : (
            <TeamHubView 
              state={state} 
              onCreate={async (e, p) => {
                const tempId = Math.random().toString(36).substr(2, 9);
                const newUser: User = { id: tempId, email: e, password: p, role: 'employee', wallet: 0, totalSalesCount: 0, notifications: [] };
                setState(prev => ({ ...prev, users: [...prev.users, newUser] }));
                // Sync to database
                const res = await updateUser(newUser);
                if (!res || !res.success) {
                  // Revert local state
                  setState(prev => ({ ...prev, users: prev.users.filter(u => u.id !== tempId) }));
                  showToast('Failed to onboard partner (server error). Check console for details.', 'error');
                  return;
                }

                // If server generated a real id (e.g., replacing non-UUID temp id), update local state
                if (res.id && res.id !== tempId) {
                  setState(prev => ({
                    ...prev,
                    users: prev.users.map(u => u.id === tempId ? { ...u, id: res.id } : u)
                  }));
                }

                if (res.droppedColumns && Array.isArray(res.droppedColumns) && res.droppedColumns.includes('password')) {
                  showToast('Partner created but password not stored (missing DB column). Agent cannot login until password column exists or Supabase Auth is used.', 'warning');
                } else {
                  showToast('Partner Onboarded', 'success');
                }
              }}
              onDelete={async (id) => {
                if (window.confirm("Remove partner?")) {
                  setState(prev => ({ ...prev, users: prev.users.filter(u => u.id !== id) }));
                  // Note: You might want to add a DELETE_USER action to the backend for proper deletion
                  showToast('Partner Deleted', 'error');
                }
              }}
              onSelectUser={setSelectedUserId}
            />
          )
        )}
        {activeTab === 'announcements' && <AnnouncementView 
          state={state} 
          dateFilter={dateFilter}
          onAdd={async (t, c) => {
            const newAnn = { id: Math.random().toString(), title: t, content: c, timestamp: new Date().toISOString(), seenBy: [] };
            setState(prev => ({ ...prev, announcements: [newAnn, ...prev.announcements] }));
            // Sync to database and reconcile returned stored row (if present)
            const res = await appendAnnouncement(newAnn as any);
            if (res && res.ok && res.stored) {
              const stored = res.stored;
              // Normalize seen_by -> seenBy
              const normalized = { ...stored, seenBy: stored.seen_by || stored.seenBy || [] };
              setState(prev => ({ ...prev, announcements: prev.announcements.map(a => a.id === newAnn.id ? normalized : a).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) }));
            } else if (!res || !res.ok) {
              // append failed — revert and inform
              setState(prev => ({ ...prev, announcements: prev.announcements.filter(a => a.id !== newAnn.id) }));
              showToast('Failed to publish broadcast', 'error');
              return;
            } else {
              // Acknowledged but no stored row returned — fetch DB to reconcile
              try {
                const db = await fetchDatabaseState();
                if (db && Array.isArray(db.announcements)) {
                  setState(prev => ({ ...prev, announcements: db.announcements.map((a: any) => ({ ...a, seenBy: a.seen_by || a.seenBy || [] })).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) }));
                }
              } catch (e) {
                console.warn('Failed to reconcile announcements after append:', e);
              }
            }

            state.users.forEach(u => addNotificationToUser(u.id, { id: Math.random().toString(), message: `New Broadcast: ${t}`, timestamp: new Date().toISOString(), read: false, type: 'announcement' }));
            showToast('Broadcast Published', 'info');
          }}
          onEdit={async (announcementId, newTitle, newContent) => {
            const announcement = state.announcements.find(a => a.id === announcementId);
            if (announcement) {
              const updated = { ...announcement, title: newTitle, content: newContent };
              setState(prev => ({
                ...prev,
                announcements: prev.announcements.map(a => a.id === announcementId ? updated : a)
              }));
              const res = await updateAnnouncement(updated);
              if (res && res.ok && res.stored) {
                const stored = res.stored;
                const normalized = { ...stored, seenBy: stored.seen_by || stored.seenBy || [] };
                setState(prev => ({ ...prev, announcements: prev.announcements.map(a => a.id === announcementId ? normalized : a).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) }));
              } else if (!res || !res.ok) {
                // Revert local optimistic edit if update failed
                const db = await fetchDatabaseState();
                if (db && Array.isArray(db.announcements)) {
                  setState(prev => ({ ...prev, announcements: db.announcements.map((a: any) => ({ ...a, seenBy: a.seen_by || a.seenBy || [] })).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) }));
                }
                showToast('Failed to update broadcast', 'error');
                return;
              } else {
                // Acknowledged but no stored row returned — fetch DB to reconcile
                try {
                  const db = await fetchDatabaseState();
                  if (db && Array.isArray(db.announcements)) {
                    setState(prev => ({ ...prev, announcements: db.announcements.map((a: any) => ({ ...a, seenBy: a.seen_by || a.seenBy || [] })).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) }));
                  }
                } catch (e) {
                  console.warn('Failed to reconcile announcements after update:', e);
                }
                showToast('Broadcast Updated', 'success');
              }
            }
          }}
          onDelete={async (announcementId) => {
            setState(prev => ({
              ...prev,
              announcements: prev.announcements.filter(a => a.id !== announcementId)
            }));
            await deleteAnnouncement(announcementId);
            showToast('Broadcast Deleted', 'info');
          }}
          onMarkSeen={(announcementId) => {
            // Track locally that this announcement was seen by this user
            // This prevents polling from overwriting the update before database persists
            if (state.currentUser) {
              const seenSet = localAnnouncementSeenRef.current.get(announcementId) || new Set();
              seenSet.add(state.currentUser.id);
              localAnnouncementSeenRef.current.set(announcementId, seenSet);
            }
            
            setState(prev => ({
              ...prev,
              announcements: prev.announcements.map(a => 
                a.id === announcementId && state.currentUser
                  ? { ...a, seenBy: [...(a.seenBy || []), state.currentUser.id] }
                  : a
              )
            }));
          }}
        />}
        {activeTab === 'profile' && <ProfileView user={state.currentUser} onUpdate={updateProfile} uploadFile={uploadFile} />}
      </div>

      <div className="fixed bottom-0 right-0 p-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map(t => (
          <Toast key={t.id} message={t.message} type={t.type} onClose={() => setToasts(prev => prev.filter(x => x.id !== t.id))} />
        ))}
      </div>
    </Layout>
  );
};

export default App;
