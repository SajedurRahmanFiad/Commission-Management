
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User, Sale, Role, AppState, AppNotification, Product, Announcement, WithdrawRequest } from './types';
import { Icons, ADMIN_FEE_DEFAULT } from './constants';
import Layout, { formatDateTime } from './components/Layout';

// --- Local Database Constants ---
const STORAGE_KEY = 'commishpro_v2_db';

const INITIAL_DATA: Omit<AppState, 'currentUser'> = {
  users: [
    {
      id: 'admin-1',
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
      name: 'Elite Digital Suite',
      adminShare: 400,
      description: 'Complete access to our digital tools and premium assets.',
      gallery: []
    },
    {
      id: 'p2',
      name: 'Founder License',
      adminShare: 1200,
      description: 'Exclusive membership for early partners and strategic stakeholders.',
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
    <div className={`${bgColor} text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-right-full duration-300 pointer-events-auto`}>
      <div className="flex-1 font-bold text-sm tracking-tight">{message}</div>
      <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
        <Icons.X />
      </button>
    </div>
  );
};

const App: React.FC = () => {
  // --- Initialize State from LocalStorage ---
  const [state, setState] = useState<AppState>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return { ...parsed, currentUser: null };
        } catch (e) {
          console.error("Failed to parse storage", e);
        }
      }
    }
    return { ...INITIAL_DATA, currentUser: null } as AppState;
  });

  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'info' | 'error' }[]>([]);

  // Persist every change (except currentUser) to LocalStorage
  useEffect(() => {
    const { currentUser, ...persistenceData } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistenceData));
  }, [state]);

  const showToast = useCallback((message: string, type: 'success' | 'info' | 'error' = 'info') => {
    setToasts(prev => [...prev, { id: Math.random().toString(), message, type }]);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const emailInput = loginForm.email.trim().toLowerCase();
    const passwordInput = loginForm.password.trim();

    const user = state.users.find(u => 
      u.email.toLowerCase() === emailInput && 
      u.password === passwordInput
    );

    if (user) {
      setState(prev => ({ ...prev, currentUser: user }));
      setLoginError('');
      showToast(`Signed in as ${user.username || user.email}`, 'success');
    } else {
      setLoginError('Authentication failed. Check your credentials.');
    }
  };

  const handleLogout = () => {
    setState(prev => ({ ...prev, currentUser: null }));
    setActiveTab('dashboard');
    setSelectedProductId(null);
    showToast('Signed out');
  };

  // --- Core Business Logic (Client-Side DB Updates) ---

  const addNotificationToUser = (userId: string, notif: AppNotification) => {
    setState(prev => ({
      ...prev,
      users: prev.users.map(u => u.id === userId ? { ...u, notifications: [notif, ...(u.notifications || [])] } : u)
    }));
  };

  const createSale = (customerEmail: string, customerPhone: string, amount: number, productId: string, paymentMethod: 'bKash' | 'Nagad' | 'Rocket') => {
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

    setState(prev => ({
      ...prev,
      sales: [newSale, ...prev.sales]
    }));

    // Notify Admins of the new sale
    state.users.filter(u => u.role === 'admin').forEach(admin => {
      addNotificationToUser(admin.id, {
        id: Math.random().toString(),
        message: `Sale verification required: ${state.currentUser?.email.split('@')[0]}`,
        timestamp: new Date().toISOString(),
        read: false,
        type: 'sale'
      });
    });

    showToast('Sale submitted for verification', 'success');
  };

  const approveSale = (saleId: string) => {
    const sale = state.sales.find(s => s.id === saleId);
    if (!sale || sale.status === 'completed') return;

    const product = state.products.find(p => p.id === sale.productId);
    const adminShare = product ? product.adminShare : ADMIN_FEE_DEFAULT;
    const employeeCommission = sale.amount - adminShare;

    setState(prev => {
      const updatedSales = prev.sales.map(s => s.id === saleId ? { ...s, status: 'completed' as const, approvedAt: new Date().toISOString() } : s);
      const updatedUsers = prev.users.map(u => {
        if (u.id === sale.employeeId) {
          return { ...u, wallet: u.wallet + employeeCommission, totalSalesCount: (u.totalSalesCount || 0) + 1 };
        }
        return u;
      });

      // Recalculate Admin Wallet Total
      const newAdminWallet = updatedSales
        .filter(s => s.status === 'completed')
        .reduce((acc, s) => {
          const p = prev.products.find(prod => prod.id === s.productId);
          return acc + (p ? p.adminShare : 0);
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

    showToast('Transaction verified. Balance updated.', 'success');
  };

  const requestWithdraw = (amount: number, method: 'bKash' | 'Nagad' | 'Rocket', accountNumber: string) => {
    if (!state.currentUser || state.currentUser.wallet < amount) {
      showToast('Insufficient funds', 'error');
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

    setState(prev => ({
      ...prev,
      withdrawRequests: [newReq, ...prev.withdrawRequests],
      users: prev.users.map(u => u.id === prev.currentUser?.id ? { ...u, wallet: u.wallet - amount } : u),
      currentUser: { ...prev.currentUser!, wallet: prev.currentUser!.wallet - amount }
    }));

    showToast('Cashout request queued', 'success');
  };

  const completeWithdraw = (id: string) => {
    setState(prev => ({
      ...prev,
      withdrawRequests: prev.withdrawRequests.map(r => r.id === id ? { ...r, status: 'completed' as const } : r)
    }));
    showToast('Payment marked as complete', 'success');
  };

  const manageProduct = (id: string | null, data: Partial<Product> | null) => {
    if (!id && data) {
      const newP: Product = { 
        id: Math.random().toString(36).substr(2, 9), 
        name: data.name!, 
        adminShare: data.adminShare!, 
        description: data.description || '', 
        gallery: [], 
        mainImage: data.mainImage 
      };
      setState(prev => ({ ...prev, products: [...prev.products, newP] }));
      showToast('Product added to inventory', 'success');
    } else if (id && data) {
      setState(prev => ({ ...prev, products: prev.products.map(p => p.id === id ? { ...p, ...data } : p) }));
      showToast('Product updated successfully', 'success');
    } else if (id && !data) {
      if (window.confirm("Permanently remove this product?")) {
        setState(prev => ({ ...prev, products: prev.products.filter(p => p.id !== id) }));
        setSelectedProductId(null);
        showToast('Product deleted', 'error');
      }
    }
  };

  const updateProfile = (username: string, avatar: string, paymentAccounts: any) => {
    if (!state.currentUser) return;
    setState(prev => ({
      ...prev,
      users: prev.users.map(u => u.id === prev.currentUser?.id ? { ...u, username, avatar, paymentAccounts } : u),
      currentUser: { ...prev.currentUser!, username, avatar, paymentAccounts }
    }));
    showToast('Profile saved', 'success');
  };

  const clearNotifications = () => {
    if (!state.currentUser) return;
    const updatedNotifs = (state.currentUser.notifications || []).map(n => ({ ...n, read: true }));
    setState(prev => ({
      ...prev,
      users: prev.users.map(u => u.id === prev.currentUser?.id ? { ...u, notifications: updatedNotifs } : u),
      currentUser: { ...prev.currentUser!, notifications: updatedNotifs }
    }));
  };

  // --- Views ---

  const isEmployee = state.currentUser?.role === 'employee';
  const displaySales = useMemo(() => isEmployee ? state.sales.filter(s => s.employeeId === state.currentUser?.id) : state.sales, [state.sales, state.currentUser, isEmployee]);

  if (!state.currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-slate-200 p-12 animate-in fade-in zoom-in duration-300">
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-4xl font-black mx-auto mb-6 shadow-xl shadow-indigo-100">C</div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">CommishPro</h2>
            <p className="text-slate-400 mt-2 font-medium">Manage your team's commissions</p>
          </div>
          <form className="space-y-6" onSubmit={handleLogin}>
            {loginError && <p className="text-red-500 text-xs text-center font-bold bg-red-50 py-3 rounded-xl border border-red-100">{loginError}</p>}
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Email Address</label>
                <input type="email" required className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 outline-none transition-all font-medium text-slate-700" value={loginForm.email} onChange={e => setLoginForm({ ...loginForm, email: e.target.value })} placeholder="admin@system.com" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Password</label>
                <input type="password" required className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 outline-none transition-all font-medium text-slate-700" value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} placeholder="••••••••" />
              </div>
            </div>
            <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-[0.98]">Sign Into Dashboard</button>
          </form>
          <div className="mt-8 text-center">
            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em]">Default Admin: admin@system.com / admin</p>
          </div>
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
    >
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {activeTab === 'dashboard' && <DashboardView state={state} onApprove={approveSale} onCreateSale={createSale} displaySales={displaySales} />}
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
        {activeTab === 'withdraw' && <WithdrawView state={state} onWithdraw={requestWithdraw} onComplete={completeWithdraw} />}
        {activeTab === 'employees' && state.currentUser.role === 'admin' && <TeamHubView state={state} onCreate={(e, p) => {
          const newUser: User = { id: Math.random().toString(36).substr(2, 9), email: e, password: p, role: 'employee', wallet: 0, totalSalesCount: 0, notifications: [] };
          setState(prev => ({ ...prev, users: [...prev.users, newUser] }));
          showToast('New partner added', 'success');
        }} onDelete={(id) => {
          if (window.confirm("Remove this partner?")) {
            setState(prev => ({ ...prev, users: prev.users.filter(u => u.id !== id) }));
            showToast('Partner removed', 'error');
          }
        }} />}
        {activeTab === 'announcements' && <AnnouncementView state={state} onAdd={(t, c) => {
          const newAnn = { id: Math.random().toString(), title: t, content: c, timestamp: new Date().toISOString() };
          setState(prev => ({ ...prev, announcements: [newAnn, ...prev.announcements] }));
          state.users.forEach(u => addNotificationToUser(u.id, { id: Math.random().toString(), message: `New Update: ${t}`, timestamp: new Date().toISOString(), read: false, type: 'announcement' }));
          showToast('Announcement posted', 'info');
        }} />}
        {activeTab === 'profile' && <ProfileView user={state.currentUser} onUpdate={updateProfile} />}
      </div>

      <div className="fixed bottom-0 right-0 p-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map(t => (
          <Toast key={t.id} message={t.message} type={t.type} onClose={() => setToasts(prev => prev.filter(x => x.id !== t.id))} />
        ))}
      </div>
    </Layout>
  );
};

// --- Sub Views ---

const DashboardView: React.FC<{ state: AppState; onApprove: (id: string) => void; onCreateSale: (e: string, p: string, a: number, pr: string, m: any) => void, displaySales: Sale[] }> = ({ state, onApprove, onCreateSale, displaySales }) => {
  const [showModal, setShowModal] = useState(false);
  const isEmployee = state.currentUser?.role === 'employee';
  const [formData, setFormData] = useState({ email: '', phone: '', amount: '', productId: '', method: 'bKash' as any });

  const stats = useMemo(() => isEmployee ? [
    { label: 'My Wallet', val: `৳${state.currentUser?.wallet.toLocaleString()}`, color: 'text-emerald-600', icon: Icons.Wallet },
    { label: 'Verified Deals', val: state.currentUser?.totalSalesCount || 0, color: 'text-indigo-600', icon: Icons.Check },
    { label: 'Awaiting Verification', val: displaySales.filter(s => s.status === 'pending').length, color: 'text-amber-600', icon: Icons.Dashboard }
  ] : [
    { label: 'System Profits', val: `৳${state.adminWallet.toLocaleString()}`, color: 'text-emerald-600', icon: Icons.Wallet },
    { label: 'Total Volume', val: state.sales.length, color: 'text-indigo-600', icon: Icons.Sales },
    { label: 'Action Required', val: state.sales.filter(s => s.status === 'pending').length, color: 'text-amber-600', icon: Icons.Bell }
  ], [state, isEmployee, displaySales]);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Dashboard Overview</h2>
          <p className="text-slate-400 text-sm font-medium">Real-time performance metrics</p>
        </div>
        {isEmployee && (
          <button onClick={() => setShowModal(true)} className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2 text-sm">
            <Icons.Plus /> Log Transaction
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((s, i) => (
          <div key={i} className="bg-white p-8 rounded-3xl border border-slate-200 flex items-center gap-6 shadow-sm">
            <div className={`p-4 rounded-2xl bg-slate-50 ${s.color} shadow-inner`}><s.icon /></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
              <h3 className="text-2xl font-black text-slate-800">{s.val}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Transaction Records</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead>
              <tr className="bg-white border-b border-slate-100">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Origin</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Gateway</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Client Identity</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Value</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                {!isEmployee && <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Settlement</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displaySales.map(sale => (
                <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-5 text-xs font-bold text-slate-700">{sale.employeeEmail?.split('@')[0]}</td>
                  <td className="px-8 py-5 text-center">
                    <span className="text-[10px] font-black text-indigo-500 uppercase bg-indigo-50 px-3 py-1.5 rounded-lg">{sale.paymentMethod}</span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-700">{sale.customerEmail}</span>
                      <span className="text-[9px] text-slate-400 font-bold uppercase mt-1">{formatDateTime(sale.timestamp)}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-sm font-black text-slate-800 text-center">৳{sale.amount.toLocaleString()}</td>
                  <td className="px-8 py-5 text-center">
                    <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${sale.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                      {sale.status}
                    </span>
                  </td>
                  {!isEmployee && (
                    <td className="px-8 py-5 text-right">
                      {sale.status === 'pending' ? (
                        <button onClick={() => onApprove(sale.id)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black tracking-widest uppercase hover:bg-indigo-700 shadow-md">Approve Deal</button>
                      ) : <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Verified</span>}
                    </td>
                  )}
                </tr>
              ))}
              {displaySales.length === 0 && (
                <tr><td colSpan={10} className="p-20 text-center text-slate-300 font-bold uppercase tracking-widest text-sm">No Ledger History</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] p-12 shadow-2xl animate-in zoom-in duration-300">
            <h4 className="text-2xl font-black text-slate-800 mb-8 tracking-tight">Log New Transaction</h4>
            <form className="space-y-6" onSubmit={e => {
              e.preventDefault();
              onCreateSale(formData.email, formData.phone, parseFloat(formData.amount), formData.productId, formData.method);
              setShowModal(false);
              setFormData({ email: '', phone: '', amount: '', productId: '', method: 'bKash' });
            }}>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Customer Email</label>
                <input type="email" required className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none font-medium text-slate-700" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Customer Phone</label>
                  <input type="text" required className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none font-medium text-slate-700" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Total Amount (৳)</label>
                  <input type="number" required className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none font-black text-slate-800" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Product Category</label>
                <select required className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none font-bold text-slate-700 appearance-none" value={formData.productId} onChange={e => setFormData({ ...formData, productId: e.target.value })}>
                  <option value="">Select Category...</option>
                  {state.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Payment Method</label>
                <select required className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none font-bold text-slate-700 appearance-none" value={formData.method} onChange={e => setFormData({ ...formData, method: e.target.value as any })}>
                  <option value="bKash">bKash</option>
                  <option value="Nagad">Nagad</option>
                  <option value="Rocket">Rocket</option>
                </select>
              </div>
              <div className="pt-8 flex gap-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 text-slate-400 font-bold tracking-widest uppercase text-xs">Dismiss</button>
                <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-100">Submit Sale</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const ProductListView: React.FC<{ state: AppState; isAdmin: boolean; onSelect: (id: string) => void; onAdd: (p: any) => void }> = ({ state, isAdmin, onSelect, onAdd }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', share: '', desc: '' });

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Active Inventory</h2>
          <p className="text-slate-400 text-sm font-medium">Manage categories and commission splits</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowAdd(true)} className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm shadow-xl shadow-indigo-100">Add New Category</button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {state.products.map(p => (
          <div key={p.id} onClick={() => onSelect(p.id)} className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden hover:border-indigo-500 hover:shadow-xl transition-all cursor-pointer group">
            <div className="h-52 bg-slate-50 flex items-center justify-center text-slate-200">
              {p.mainImage ? <img src={p.mainImage} className="w-full h-full object-cover" /> : <div className="p-16 opacity-30 scale-150"><Icons.Tag /></div>}
            </div>
            <div className="p-8">
              <h4 className="font-black text-slate-800 text-lg mb-2">{p.name}</h4>
              <p className="text-sm text-slate-400 font-medium leading-relaxed line-clamp-2">{p.description}</p>
              <div className="mt-8 pt-8 border-t border-slate-100 flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">System Fee</p>
                  <span className="text-2xl font-black text-indigo-600">৳{p.adminShare.toLocaleString()}</span>
                </div>
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <Icons.Plus />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in duration-300">
            <h3 className="text-xl font-black text-slate-800 mb-8">Configure New Category</h3>
            <form className="space-y-4" onSubmit={e => { 
              e.preventDefault(); 
              onAdd({ name: form.name, adminShare: parseFloat(form.share), description: form.desc }); 
              setShowAdd(false); 
              setForm({ name: '', share: '', desc: '' }); 
            }}>
              <input type="text" required placeholder="Category Name" className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none font-bold text-slate-700" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <input type="number" required placeholder="System Revenue Share (৳)" className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none font-black text-slate-800" value={form.share} onChange={e => setForm({ ...form, share: e.target.value })} />
              <textarea placeholder="Category Summary..." className="w-full h-32 px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none resize-none text-sm font-medium" value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })}></textarea>
              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-4 text-slate-400 font-bold uppercase text-[10px] tracking-widest">Cancel</button>
                <button className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100">Deploy Category</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const ProductDetailView: React.FC<{ product: Product; isAdmin: boolean; onClose: () => void; onUpdate: (p: any) => void; onDelete: () => void }> = ({ product, isAdmin, onClose, onUpdate, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: product.name, share: product.adminShare.toString(), desc: product.description });

  const handleImgUpload = (e: any, type: 'main' | 'gallery') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (type === 'main') onUpdate({ mainImage: reader.result as string });
      else onUpdate({ gallery: [...(product.gallery || []), reader.result as string] });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="max-w-6xl mx-auto bg-white rounded-[3rem] shadow-2xl border border-slate-200 overflow-hidden">
      <div className="flex flex-col lg:flex-row">
        <div className="lg:w-2/5 p-12 bg-slate-50 border-r border-slate-100">
          <div className="relative group rounded-3xl overflow-hidden shadow-xl border border-slate-200 aspect-square w-full mb-8">
            {product.mainImage ? <img src={product.mainImage} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-200"><Icons.Tag /></div>}
            {isAdmin && (
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                 <button onClick={() => document.getElementById('main-up')?.click()} className="p-4 bg-white rounded-2xl text-indigo-600 shadow-2xl scale-125 transition-transform hover:scale-150"><Icons.Plus /></button>
              </div>
            )}
            <input id="main-up" type="file" className="hidden" onChange={(e) => handleImgUpload(e, 'main')} />
          </div>
          <div className="grid grid-cols-4 gap-3">
            {(product.gallery || []).map((img, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 group">
                <img src={img} className="w-full h-full object-cover" />
                {isAdmin && <button onClick={() => onUpdate({ gallery: product.gallery.filter((_, idx) => idx !== i) })} className="absolute inset-0 bg-red-500/80 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white"><Icons.Trash /></button>}
              </div>
            ))}
            {isAdmin && <button onClick={() => document.getElementById('gal-up')?.click()} className="aspect-square rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:border-indigo-400 hover:text-indigo-400 transition-all"><Icons.Plus /></button>}
            <input id="gal-up" type="file" className="hidden" onChange={(e) => handleImgUpload(e, 'gallery')} />
          </div>
        </div>
        <div className="lg:w-3/5 p-16 relative">
          <button onClick={onClose} className="absolute top-10 right-10 text-slate-300 hover:text-slate-900 transition-colors p-2 text-xl">✕</button>
          <div className="space-y-10">
            <div>
              {editing ? <input className="text-4xl font-black border-b-4 border-indigo-600 w-full outline-none text-slate-800" value={form.name} onChange={e => setForm({...form, name: e.target.value})} /> : <h2 className="text-4xl font-black text-slate-800 tracking-tight">{product.name}</h2>}
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Service Briefing</p>
              {editing ? <textarea className="w-full h-40 p-6 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-medium text-slate-700" value={form.desc} onChange={e => setForm({...form, desc: e.target.value})} /> : <p className="text-slate-600 leading-relaxed text-lg font-medium">{product.description || "No classification details provided for this inventory category."}</p>}
            </div>
            <div className="p-10 bg-indigo-50/50 rounded-[2rem] flex justify-between items-center border border-indigo-100 shadow-inner">
               <div>
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Network Revenue Retention</p>
                  {editing ? <input type="number" className="text-4xl font-black text-indigo-700 outline-none w-48 bg-transparent" value={form.share} onChange={e => setForm({...form, share: e.target.value})} /> : <h3 className="text-4xl font-black text-indigo-700">৳{product.adminShare.toLocaleString()}</h3>}
               </div>
               <div className="p-5 bg-white rounded-2xl shadow-sm text-indigo-600"><Icons.Wallet /></div>
            </div>
            {isAdmin && (
              <div className="flex gap-4 pt-6">
                {editing ? (
                  <button onClick={() => { setEditing(false); onUpdate({ name: form.name, adminShare: parseFloat(form.share), description: form.desc }); }} className="flex-1 py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-100">Commit Changes</button>
                ) : (
                  <button onClick={() => setEditing(true)} className="flex-1 py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-slate-200">Modify Category</button>
                )}
                {editing && <button onClick={onDelete} className="p-5 bg-red-50 text-red-500 rounded-2xl hover:bg-red-100 transition-colors"><Icons.Trash /></button>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const WithdrawView: React.FC<{ state: AppState; onWithdraw: (a: number, m: any, n: string) => void; onComplete: (id: string) => void }> = ({ state, onWithdraw, onComplete }) => {
  const isEmployee = state.currentUser?.role === 'employee';
  const [form, setForm] = useState({ amount: '', method: 'bKash' as any });
  const currentAccounts = state.currentUser?.paymentAccounts || {};
  const currentAccountNum = currentAccounts[form.method as keyof typeof currentAccounts] || '';
  const displayRequests = useMemo(() => isEmployee ? state.withdrawRequests.filter(r => r.employeeId === state.currentUser?.id) : state.withdrawRequests, [state.withdrawRequests, state.currentUser, isEmployee]);

  const canWithdraw = form.amount && parseFloat(form.amount) >= 200 && parseFloat(form.amount) <= (state.currentUser?.wallet || 0) && !!currentAccountNum;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
      {isEmployee && (
        <div className="lg:col-span-1">
          <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm sticky top-8">
            <h3 className="text-xl font-black text-slate-800 mb-8 tracking-tight">Funds Settlement</h3>
            <div className="mb-8 p-8 bg-emerald-50 rounded-3xl border border-emerald-100 shadow-inner">
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Liquid Balance</p>
              <h4 className="text-4xl font-black text-emerald-700">৳{state.currentUser?.wallet.toLocaleString()}</h4>
            </div>
            <form className="space-y-6" onSubmit={e => { e.preventDefault(); onWithdraw(parseFloat(form.amount), form.method, currentAccountNum); setForm({ ...form, amount: '' }); }}>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Settlement Amount</label>
                <input type="number" required min="200" className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none font-black text-slate-800 text-lg" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
                <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase tracking-wider text-center">Threshold: ৳200</p>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Preferred Method</label>
                <select className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none font-bold text-slate-700" value={form.method} onChange={e => setForm({ ...form, method: e.target.value as any })}>
                  <option value="bKash">bKash</option>
                  <option value="Nagad">Nagad</option>
                  <option value="Rocket">Rocket</option>
                </select>
              </div>
              {!currentAccountNum ? (
                <div className="p-4 bg-amber-50 text-amber-700 rounded-xl text-[10px] font-bold leading-relaxed border border-amber-100">
                  CRITICAL: No active account linked for {form.method}. Synchronize in "My Profile" to proceed.
                </div>
              ) : (
                <div className="p-4 bg-slate-50 text-slate-400 rounded-xl text-[10px] font-bold text-center border border-slate-100 uppercase tracking-widest">
                  Pay To: <span className="text-slate-800 font-black">{currentAccountNum}</span>
                </div>
              )}
              <button disabled={!canWithdraw} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs disabled:bg-slate-100 disabled:text-slate-300 transition-all shadow-xl shadow-indigo-100 active:scale-95">Verify & Submit Request</button>
            </form>
          </div>
        </div>
      )}
      <div className={`${isEmployee ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm`}>
        <div className="px-10 py-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Financial Ledger History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[750px]">
            <thead>
              <tr className="bg-white border-b border-slate-100">
                {!isEmployee && <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Partner</th>}
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Net Value</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Type</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Account Details</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                {!isEmployee && <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Settlement</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayRequests.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                  {!isEmployee && <td className="px-10 py-6 font-bold text-xs text-slate-700">{r.employeeEmail?.split('@')[0]}</td>}
                  <td className="px-10 py-6 font-black text-indigo-600 text-center text-sm">৳{r.amount.toLocaleString()}</td>
                  <td className="px-10 py-6 text-center">
                    <span className="text-[10px] font-black text-slate-500 uppercase bg-slate-100 px-3 py-1.5 rounded-lg">{r.method}</span>
                  </td>
                  <td className="px-10 py-6 font-mono text-slate-500">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold">{r.accountNumber}</span>
                      <span className="text-[9px] text-slate-300 font-bold uppercase mt-1">{formatDateTime(r.timestamp)}</span>
                    </div>
                  </td>
                  <td className="px-10 py-6 text-center">
                    <span className={`px-4 py-1.5 rounded-xl font-black uppercase text-[9px] tracking-widest ${r.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{r.status}</span>
                  </td>
                  {!isEmployee && (
                    <td className="px-10 py-6 text-right">
                      {r.status === 'pending' ? <button onClick={() => onComplete(r.id)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-md">Execute Payout</button> : <span className="text-emerald-500 font-black uppercase text-[9px] tracking-widest">Finalized</span>}
                    </td>
                  )}
                </tr>
              ))}
              {displayRequests.length === 0 && (
                <tr><td colSpan={10} className="p-24 text-center text-slate-300 font-bold uppercase tracking-widest text-sm">No Payout Records Found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const TeamHubView: React.FC<{ state: AppState; onCreate: (e: string, p: string) => void; onDelete: (id: string) => void }> = ({ state, onCreate, onDelete }) => {
  const [form, setForm] = useState({ email: '', password: '' });
  const employees = state.users.filter(u => u.role === 'employee');

  return (
    <div className="space-y-10">
      <div className="bg-white p-12 rounded-[3rem] border border-slate-200 shadow-sm">
        <h3 className="text-2xl font-black text-slate-800 mb-8 tracking-tight">Onboard Network Partner</h3>
        <form className="flex flex-col md:flex-row gap-5" onSubmit={e => { e.preventDefault(); onCreate(form.email, form.password); setForm({ email: '', password: '' }); }}>
          <input type="email" required placeholder="Partner Email Address" className="flex-1 px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none font-medium" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <input type="text" required placeholder="Initial Access Token" className="flex-1 px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none font-medium" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          <button className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-100">Activate Partner</button>
        </form>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {employees.map(e => (
          <div key={e.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative group hover:border-indigo-400 transition-all">
            <button onClick={() => onDelete(e.id)} className="absolute top-6 right-6 text-slate-200 hover:text-red-500 transition-colors p-2"><Icons.Trash /></button>
            <div className="flex items-center gap-5 mb-8">
              {e.avatar ? <img src={e.avatar} className="h-16 w-16 rounded-2xl object-cover shadow-md" /> : <div className="h-16 w-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-2xl font-black text-white uppercase">{e.email.charAt(0)}</div>}
              <div>
                <p className="font-black text-slate-800 text-lg">{e.username || e.email.split('@')[0]}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{e.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-50">
              <div className="bg-slate-50 p-4 rounded-2xl text-center">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Sales</p>
                <p className="text-xl font-black text-indigo-600">{e.totalSalesCount || 0}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl text-center">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Liability</p>
                <p className="text-xl font-black text-emerald-600">৳{e.wallet.toLocaleString()}</p>
              </div>
            </div>
          </div>
        ))}
        {employees.length === 0 && (
          <div className="col-span-full py-20 bg-slate-50 rounded-[3rem] border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
             <div className="mb-4 scale-150"><Icons.Users /></div>
             <p className="font-black uppercase tracking-[0.3em] text-[10px]">No Network Partners Linked</p>
          </div>
        )}
      </div>
    </div>
  );
};

const AnnouncementView: React.FC<{ state: AppState; onAdd: (t: string, c: string) => void }> = ({ state, onAdd }) => {
  const isAdmin = state.currentUser?.role === 'admin';
  const [form, setForm] = useState({ title: '', content: '' });

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      {isAdmin && (
        <div className="bg-white p-12 rounded-[3rem] border border-slate-200 shadow-sm">
          <h3 className="text-2xl font-black text-slate-800 mb-8 tracking-tight">Global Broadcast Dispatch</h3>
          <form className="space-y-5" onSubmit={e => { e.preventDefault(); onAdd(form.title, form.content); setForm({ title: '', content: '' }); }}>
            <input type="text" required placeholder="Subject Headline" className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none font-black text-slate-800" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            <textarea required placeholder="Detailed operational update..." className="w-full h-48 px-6 py-5 rounded-2xl bg-slate-50 border border-slate-200 outline-none resize-none text-sm font-medium leading-relaxed" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}></textarea>
            <button className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 shadow-xl shadow-indigo-100 active:scale-[0.98]">
              <Icons.Speakerphone /> Synchronize Broadcast
            </button>
          </form>
        </div>
      )}
      <div className="space-y-6">
        {state.announcements.map(a => (
          <div key={a.id} className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm border-l-8 border-l-indigo-600 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center mb-5">
              <h4 className="font-black text-slate-800 text-lg tracking-tight">{a.title}</h4>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{formatDateTime(a.timestamp)}</span>
            </div>
            <p className="text-sm text-slate-600 leading-loose whitespace-pre-wrap font-medium">{a.content}</p>
          </div>
        ))}
        {state.announcements.length === 0 && <div className="text-center py-24 text-slate-300 font-black uppercase tracking-[0.3em] text-[10px]">Station Silence</div>}
      </div>
    </div>
  );
};

const ProfileView: React.FC<{ user: User; onUpdate: (u: string, a: string, p: any) => void }> = ({ user, onUpdate }) => {
  const [username, setUsername] = useState(user.username || '');
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [paymentAccounts, setPaymentAccounts] = useState(user.paymentAccounts || { bKash: '', Nagad: '', Rocket: '' });

  return (
    <div className="max-w-3xl mx-auto space-y-10">
      <div className="bg-white rounded-[3rem] p-16 shadow-sm border border-slate-200 flex flex-col items-center">
        <div className="relative group cursor-pointer w-40 h-40 mb-10 shadow-2xl rounded-[2.5rem] overflow-hidden border-4 border-white" onClick={() => document.getElementById('av-up')?.click()}>
          {avatar ? <img src={avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-indigo-600 flex items-center justify-center text-white text-5xl font-black uppercase tracking-tighter">{username.charAt(0) || user.email.charAt(0)}</div>}
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm">
            <span className="text-white text-[10px] font-black uppercase tracking-widest">Update Photo</span>
          </div>
          <input type="file" id="av-up" className="hidden" accept="image/*" onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onloadend = () => setAvatar(reader.result as string);
              reader.readAsDataURL(file);
            }
          }} />
        </div>
        <div className="w-full space-y-8">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase block mb-2 px-1 tracking-widest">Identity Display Name</label>
            <input className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-black text-slate-800 text-lg focus:border-indigo-500 transition-all" value={username} onChange={e => setUsername(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {['bKash', 'Nagad', 'Rocket'].map(method => (
              <div key={method}>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-2 px-1 tracking-widest">{method} Link</label>
                <input className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs font-black text-slate-700 shadow-inner" placeholder="017XXXXXXXX" value={paymentAccounts[method as keyof typeof paymentAccounts] || ''} onChange={e => setPaymentAccounts({...paymentAccounts, [method]: e.target.value})} />
              </div>
            ))}
          </div>
          <button onClick={() => onUpdate(username, avatar, paymentAccounts)} className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-indigo-100 active:scale-[0.98] transition-all">Synchronize Settings</button>
        </div>
      </div>
    </div>
  );
};

export default App;
