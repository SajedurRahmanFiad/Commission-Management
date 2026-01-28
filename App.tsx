
import React, { useState, useEffect, useCallback } from 'react';
import { User, Sale, Role, AppState, AppNotification, Product, Announcement, WithdrawRequest } from './types';
import { Icons, ADMIN_FEE_DEFAULT } from './constants';
import Layout, { formatDateTime } from './components/Layout';

const STORAGE_KEY = 'commission_pro_local_v1';

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
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
    return {
      currentUser: null,
      users: [
        { 
          id: '1', 
          email: 'admin@system.com', 
          password: 'admin', 
          role: 'admin', 
          wallet: 0, 
          totalSalesCount: 0, 
          notifications: [] 
        }
      ],
      sales: [],
      products: [
        { id: 'p1', name: 'Elite Digital Suite', adminShare: 400, description: 'Complete access to our digital tools.', gallery: [] },
        { id: 'p2', name: 'Founder License', adminShare: 1200, description: 'Exclusive membership for early partners.', gallery: [] }
      ],
      announcements: [],
      withdrawRequests: [],
      adminWallet: 0,
    };
  });

  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'info' | 'error' }[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'info' | 'error' = 'info') => {
    setToasts(prev => [...prev, { id: Math.random().toString(), message, type }]);
  }, []);

  // Persist state to local storage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = state.users.find(u => u.email === loginForm.email && u.password === loginForm.password);
    if (user) {
      setState(prev => ({ ...prev, currentUser: user }));
      showToast('Logged in successfully', 'success');
    } else {
      setLoginError('Invalid credentials.');
    }
  };

  const handleLogout = () => {
    setState(prev => ({ ...prev, currentUser: null }));
    setActiveTab('dashboard');
    setSelectedProductId(null);
    showToast('Logged out');
  };

  const addNotificationToUser = (userId: string, notif: AppNotification) => {
    setState(prev => ({
      ...prev,
      users: prev.users.map(u => u.id === userId ? { ...u, notifications: [...u.notifications, notif] } : u),
      currentUser: prev.currentUser?.id === userId ? { ...prev.currentUser, notifications: [...prev.currentUser.notifications, notif] } : prev.currentUser
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

    setState(prev => ({ ...prev, sales: [newSale, ...prev.sales] }));
    
    const admin = state.users.find(u => u.role === 'admin');
    if (admin) {
      addNotificationToUser(admin.id, {
        id: Math.random().toString(),
        message: `Sale alert: ${state.currentUser.username || state.currentUser.email} added ${product.name}`,
        timestamp: new Date().toISOString(),
        read: false,
        type: 'sale'
      });
    }
    showToast('Sale submitted', 'success');
  };

  const approveSale = (saleId: string) => {
    setState(prev => {
      const sale = prev.sales.find(s => s.id === saleId);
      if (!sale || sale.status === 'completed') return prev;

      const product = prev.products.find(p => p.id === sale.productId);
      const adminShare = product ? product.adminShare : ADMIN_FEE_DEFAULT;
      const employeeCommission = sale.amount - adminShare;

      const updatedSales = prev.sales.map(s => s.id === saleId ? { ...s, status: 'completed' as const, approvedAt: new Date().toISOString() } : s);
      const updatedUsers = prev.users.map(u => u.id === sale.employeeId ? { ...u, wallet: u.wallet + employeeCommission, totalSalesCount: u.totalSalesCount + 1 } : u);

      return {
        ...prev,
        sales: updatedSales,
        users: updatedUsers,
        adminWallet: prev.adminWallet + adminShare,
        currentUser: prev.currentUser?.id === sale.employeeId ? { ...prev.currentUser, wallet: prev.currentUser.wallet + employeeCommission, totalSalesCount: prev.currentUser.totalSalesCount + 1 } : prev.currentUser
      };
    });
    showToast('Sale approved', 'success');
  };

  const requestWithdraw = (amount: number, method: 'bKash' | 'Nagad' | 'Rocket', accountNumber: string) => {
    if (!state.currentUser || state.currentUser.wallet < amount) {
      showToast('Insufficient balance!', 'error');
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

    const admin = state.users.find(u => u.role === 'admin');
    if (admin) {
      addNotificationToUser(admin.id, {
        id: Math.random().toString(),
        message: `Withdraw Request: ৳${amount} from ${state.currentUser.email}`,
        timestamp: new Date().toISOString(),
        read: false,
        type: 'withdraw'
      });
    }
    showToast('Withdrawal requested', 'success');
  };

  const completeWithdraw = (id: string) => {
    setState(prev => ({
      ...prev,
      withdrawRequests: prev.withdrawRequests.map(r => r.id === id ? { ...r, status: 'completed' } : r)
    }));
    showToast('Payment completed', 'success');
  };

  const addAnnouncement = (title: string, content: string) => {
    const newAnn = { id: Math.random().toString(), title, content, timestamp: new Date().toISOString() };
    const notif: AppNotification = {
      id: Math.random().toString(),
      message: `Announcement: ${title}`,
      timestamp: new Date().toISOString(),
      read: false,
      type: 'announcement'
    };

    setState(prev => ({ ...prev, announcements: [newAnn, ...prev.announcements] }));
    state.users.forEach(u => addNotificationToUser(u.id, notif));
    showToast('Announcement posted', 'info');
  };

  const manageProduct = (id: string | null, product: Partial<Product> | null) => {
    if (!id && product) {
      const newP = { id: Math.random().toString(36).substr(2, 9), name: product.name!, adminShare: product.adminShare!, description: product.description || '', gallery: product.gallery || [], mainImage: product.mainImage };
      setState(prev => ({ ...prev, products: [...prev.products, newP] }));
      showToast('Product added', 'success');
    } else if (id && product) {
      setState(prev => ({ ...prev, products: prev.products.map(p => p.id === id ? { ...p, ...product } : p) }));
      showToast('Product updated', 'success');
    } else if (id && !product) {
      if (window.confirm("Delete this product?")) {
        setState(prev => ({ ...prev, products: prev.products.filter(p => p.id !== id) }));
        setSelectedProductId(null);
        showToast('Product deleted', 'error');
      }
    }
  };

  const updateProfile = (username: string, avatar: string, paymentAccounts: any) => {
    setState(prev => ({
      ...prev,
      currentUser: { ...prev.currentUser!, username, avatar, paymentAccounts },
      users: prev.users.map(u => u.id === prev.currentUser?.id ? { ...u, username, avatar, paymentAccounts } : u)
    }));
    showToast('Profile updated', 'success');
  };

  const clearNotifications = () => {
    if (!state.currentUser) return;
    setState(prev => ({
      ...prev,
      users: prev.users.map(u => u.id === prev.currentUser?.id ? { ...u, notifications: u.notifications.map(n => ({ ...n, read: true })) } : u),
      currentUser: { ...prev.currentUser!, notifications: prev.currentUser!.notifications.map(n => ({ ...n, read: true })) }
    }));
  };

  if (!state.currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-slate-200 p-10 animate-in fade-in zoom-in duration-300">
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-3xl font-bold mx-auto mb-6">C</div>
            <h2 className="text-2xl font-bold text-slate-800">CommishPro</h2>
            <p className="text-sm text-slate-400 mt-1">Sign in to your account</p>
          </div>
          <form className="space-y-6" onSubmit={handleLogin}>
            {loginError && <p className="text-red-500 text-xs text-center font-medium">{loginError}</p>}
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-2 uppercase tracking-wide">Email</label>
              <input type="email" required className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 outline-none transition-all" value={loginForm.email} onChange={e => setLoginForm({ ...loginForm, email: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-2 uppercase tracking-wide">Password</label>
              <input type="password" required className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 outline-none transition-all" value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} />
            </div>
            <button type="submit" className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all">Sign In</button>
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
    >
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
        {activeTab === 'dashboard' && <DashboardView state={state} onApprove={approveSale} onCreateSale={createSale} />}
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
          showToast('Team member added', 'success');
        }} onDelete={(id) => {
          if (window.confirm("Delete this member?")) {
            setState(prev => ({ ...prev, users: prev.users.filter(u => u.id !== id) }));
          }
        }} />}
        {activeTab === 'announcements' && <AnnouncementView state={state} onAdd={addAnnouncement} />}
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

const DashboardView: React.FC<{ state: AppState; onApprove: (id: string) => void; onCreateSale: (e: string, p: string, a: number, pr: string, m: any) => void }> = ({ state, onApprove, onCreateSale }) => {
  const [showModal, setShowModal] = useState(false);
  const isEmployee = state.currentUser?.role === 'employee';
  const displaySales = isEmployee ? state.sales.filter(s => s.employeeId === state.currentUser?.id) : state.sales;

  const [formData, setFormData] = useState({ email: '', phone: '', amount: '', productId: '', method: 'bKash' as any });

  const stats = isEmployee ? [
    { label: 'Net Wallet', val: `৳${state.currentUser?.wallet.toLocaleString()}`, color: 'text-emerald-600', icon: Icons.Wallet },
    { label: 'Sales Done', val: state.currentUser?.totalSalesCount || 0, color: 'text-indigo-600', icon: Icons.Check },
    { label: 'Pending', val: displaySales.filter(s => s.status === 'pending').length, color: 'text-amber-600', icon: Icons.Dashboard }
  ] : [
    { label: 'Total Volume', val: `৳${state.adminWallet.toLocaleString()}`, color: 'text-emerald-600', icon: Icons.Wallet },
    { label: 'Transactions', val: state.sales.length, color: 'text-indigo-600', icon: Icons.Sales },
    { label: 'Approvals', val: state.sales.filter(s => s.status === 'pending').length, color: 'text-amber-600', icon: Icons.Bell }
  ];

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-xl md:text-2xl font-bold text-slate-800">Overview</h2>
        <button onClick={() => setShowModal(true)} className="px-4 md:px-5 py-2 md:py-2.5 bg-indigo-600 text-white rounded-xl font-semibold shadow-sm hover:bg-indigo-700 transition-all flex items-center gap-2 text-sm">
          <Icons.Plus /> New Sale
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {stats.map((s, i) => (
          <div key={i} className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 flex items-center gap-4 md:gap-5 shadow-sm">
            <div className={`p-2.5 md:p-3 rounded-xl bg-slate-50 ${s.color}`}><s.icon /></div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{s.label}</p>
              <h3 className="text-lg md:text-xl font-bold text-slate-800">{s.val}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Sales</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-white border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Origin</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Gateway</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Client</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Amount</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Status</th>
                {!isEmployee && <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displaySales.map(sale => (
                <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-xs font-semibold text-slate-700">{sale.employeeEmail?.split('@')[0]}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">{sale.paymentMethod}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-slate-700">{sale.customerEmail}</span>
                      <span className="text-[10px] text-slate-400">{formatDateTime(sale.timestamp)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-indigo-600 text-center">৳{sale.amount}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase ${sale.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                      {sale.status}
                    </span>
                  </td>
                  {!isEmployee && (
                    <td className="px-6 py-4 text-right">
                      {sale.status === 'pending' ? (
                        <button onClick={() => onApprove(sale.id)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold hover:bg-indigo-700">Approve</button>
                      ) : <span className="text-[10px] font-bold text-emerald-500 uppercase">Verified</span>}
                    </td>
                  )}
                </tr>
              ))}
              {displaySales.length === 0 && (
                <tr><td colSpan={10} className="p-12 text-center text-slate-400 text-sm font-medium italic font-sans">No transactions recorded yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl p-6 md:p-8 shadow-xl animate-in zoom-in duration-200">
            <h4 className="text-lg font-bold text-slate-800 mb-6">Record New Sale</h4>
            <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={e => {
              e.preventDefault();
              onCreateSale(formData.email, formData.phone, parseFloat(formData.amount), formData.productId, formData.method);
              setShowModal(false);
              setFormData({ email: '', phone: '', amount: '', productId: '', method: 'bKash' });
            }}>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-slate-500 block mb-1">Customer Email</label>
                <input type="email" required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Phone Number</label>
                <input type="text" required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Amount</label>
                <input type="number" required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-slate-500 block mb-1">Product</label>
                <select required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none" value={formData.productId} onChange={e => setFormData({ ...formData, productId: e.target.value })}>
                  <option value="">Select Product</option>
                  {state.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-slate-500 block mb-1">Method</label>
                <select required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none" value={formData.method} onChange={e => setFormData({ ...formData, method: e.target.value as any })}>
                  <option value="bKash">bKash</option>
                  <option value="Nagad">Nagad</option>
                  <option value="Rocket">Rocket</option>
                </select>
              </div>
              <div className="md:col-span-2 pt-4 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 text-slate-400 font-semibold text-sm">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm">Submit Sale</button>
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
    <div className="space-y-6 md:space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-xl md:text-2xl font-bold text-slate-800">Products</h2>
        {isAdmin && (
          <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold text-sm">
            Add Product
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {state.products.map(p => (
          <div key={p.id} onClick={() => onSelect(p.id)} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-indigo-400 transition-all cursor-pointer shadow-sm group">
            <div className="h-40 md:h-48 bg-slate-50 flex items-center justify-center text-slate-300">
              {p.mainImage ? <img src={p.mainImage} className="w-full h-full object-cover" /> : <Icons.Tag />}
            </div>
            <div className="p-4 md:p-6">
              <h4 className="font-bold text-slate-800 text-sm md:text-base">{p.name}</h4>
              <p className="text-xs text-slate-400 mt-1 line-clamp-1">{p.description}</p>
              <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Share</p>
                <span className="text-base md:text-lg font-bold text-indigo-600">৳{p.adminShare}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl p-8 shadow-xl animate-in zoom-in duration-200">
            <h3 className="text-lg font-bold mb-6">New Product</h3>
            <form className="space-y-4" onSubmit={e => { e.preventDefault(); onAdd({ name: form.name, adminShare: parseFloat(form.share), description: form.desc }); setShowAdd(false); setForm({ name: '', share: '', desc: '' }); }}>
              <input type="text" required placeholder="Name" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <input type="number" required placeholder="Admin Fee" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none" value={form.share} onChange={e => setForm({ ...form, share: e.target.value })} />
              <textarea placeholder="Description" className="w-full h-24 px-4 py-2.5 rounded-xl border border-slate-200 outline-none resize-none" value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })}></textarea>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-3 text-slate-400 font-semibold">Cancel</button>
                <button className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold">Add</button>
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
    const files = e.target.files;
    if (!files) return;

    if (type === 'main') {
      const reader = new FileReader();
      reader.onload = () => onUpdate({ mainImage: reader.result as string });
      reader.readAsDataURL(files[0]);
    } else {
      const newImgs: string[] = [];
      Array.from(files).forEach((f: any) => {
        const reader = new FileReader();
        reader.onload = () => {
          newImgs.push(reader.result as string);
          if (newImgs.length === files.length) {
            onUpdate({ gallery: [...(product.gallery || []), ...newImgs] });
          }
        };
        reader.readAsDataURL(f);
      });
    }
  };

  const downloadImage = (data: string, name: string) => {
    const link = document.createElement('a');
    link.href = data;
    link.download = `${name}.png`;
    link.click();
  };

  return (
    <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex flex-col lg:flex-row">
        <div className="lg:w-2/5 p-6 md:p-8 bg-slate-50/50 border-b lg:border-r lg:border-b-0 border-slate-100">
          <div className="relative group rounded-xl overflow-hidden shadow-sm border border-slate-200 aspect-square max-w-[400px] mx-auto">
            {product.mainImage ? <img src={product.mainImage} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-200"><Icons.Tag /></div>}
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
              {product.mainImage && <button onClick={() => downloadImage(product.mainImage!, 'main')} className="p-2 bg-white rounded-lg text-indigo-600"><Icons.Download /></button>}
              {isAdmin && <button onClick={() => document.getElementById('main-up')?.click()} className="p-2 bg-white rounded-lg text-indigo-600"><Icons.Plus /></button>}
            </div>
            <input id="main-up" type="file" className="hidden" onChange={(e) => handleImgUpload(e, 'main')} />
          </div>
          <div className="grid grid-cols-4 gap-2 md:gap-3 mt-4 max-w-[400px] mx-auto">
            {product.gallery?.map((img, i) => (
              <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 group">
                <img src={img} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                  <button onClick={() => downloadImage(img, `g-${i}`)} className="p-1 bg-white rounded text-indigo-600 scale-75"><Icons.Download /></button>
                  {isAdmin && <button onClick={() => onUpdate({ gallery: product.gallery.filter((_, idx) => idx !== i) })} className="p-1 bg-red-500 rounded text-white scale-75"><Icons.Trash /></button>}
                </div>
              </div>
            ))}
            {isAdmin && <button onClick={() => document.getElementById('gal-up')?.click()} className="aspect-square rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-slate-300 hover:border-indigo-400 transition-all"><Icons.Plus /></button>}
            <input id="gal-up" type="file" multiple className="hidden" onChange={(e) => handleImgUpload(e, 'gallery')} />
          </div>
        </div>
        <div className="lg:w-3/5 p-6 md:p-8 relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-slate-300 hover:text-slate-800 transition-colors p-2">✕</button>
          <div className="space-y-6">
            <div>
              {editing ? <input type="text" className="text-xl md:text-2xl font-bold text-slate-800 border-b border-indigo-500 outline-none w-full" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /> : <h2 className="text-xl md:text-2xl font-bold text-slate-800">{product.name}</h2>}
              <div className="flex items-center gap-3 mt-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase">ID: {product.id}</span>
                {isAdmin && !editing && <button onClick={() => setEditing(true)} className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"><Icons.Pencil /></button>}
              </div>
            </div>
            <div>
              <h5 className="text-[10px] font-bold text-slate-400 uppercase mb-2">Description</h5>
              {editing ? <textarea className="w-full h-32 px-4 py-2 rounded-xl bg-slate-50 border outline-none text-sm" value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })} /> : <p className="text-sm text-slate-600 leading-relaxed">{product.description || "No description."}</p>}
            </div>
            <div className="p-4 md:p-6 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Admin Share</p>
                {editing ? <input type="number" className="text-xl font-bold text-indigo-600 bg-transparent outline-none w-24" value={form.share} onChange={e => setForm({ ...form, share: e.target.value })} /> : <h3 className="text-xl font-bold text-indigo-600">৳{product.adminShare}</h3>}
              </div>
              <Icons.Wallet />
            </div>
            {editing && (
              <div className="flex gap-3">
                <button onClick={() => { setEditing(false); onUpdate({ name: form.name, adminShare: parseFloat(form.share), description: form.desc }); }} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm">Save Changes</button>
                <button onClick={onDelete} className="p-3 text-red-500 hover:bg-red-50 rounded-xl"><Icons.Trash /></button>
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
  const displayRequests = isEmployee ? state.withdrawRequests.filter(r => r.employeeId === state.currentUser?.id) : state.withdrawRequests;

  const canWithdraw = form.amount && parseFloat(form.amount) >= 200 && parseFloat(form.amount) <= (state.currentUser?.wallet || 0) && !!currentAccountNum;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
      {isEmployee && (
        <div className="lg:col-span-1">
          <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm sticky top-4 md:top-8">
            <h3 className="text-lg font-bold mb-4 md:mb-6">Withdraw</h3>
            <div className="mb-4 md:mb-6 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Balance</p>
              <h4 className="text-xl font-bold text-emerald-700">৳{state.currentUser?.wallet.toLocaleString()}</h4>
              <p className="text-[9px] font-medium text-slate-400 mt-2 uppercase tracking-wide">Min Withdraw: ৳200</p>
            </div>
            <form className="space-y-4" onSubmit={e => { e.preventDefault(); onWithdraw(parseFloat(form.amount), form.method, currentAccountNum); setForm({ ...form, amount: '' }); }}>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Amount</label>
                <input type="number" required min="200" className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border outline-none font-bold" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Gateway</label>
                <select className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border outline-none font-medium" value={form.method} onChange={e => setForm({ ...form, method: e.target.value as any })}>
                  <option value="bKash">bKash</option>
                  <option value="Nagad">Nagad</option>
                  <option value="Rocket">Rocket</option>
                </select>
              </div>
              {!currentAccountNum && (
                <p className="text-[10px] text-red-500 font-medium">Please set your {form.method} number in My Profile.</p>
              )}
              <button disabled={!canWithdraw} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold disabled:bg-slate-200 disabled:text-slate-500 transition-all">Submit Request</button>
            </form>
          </div>
        </div>
      )}
      <div className={`${isEmployee ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm`}>
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead>
              <tr className="bg-white border-b border-slate-100">
                {!isEmployee && <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">Partner</th>}
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase text-center">Amount</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase text-center">Gateway</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">Account</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase text-center">Status</th>
                {!isEmployee && <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayRequests.map(r => (
                <tr key={r.id} className="text-xs hover:bg-slate-50 transition-colors">
                  {!isEmployee && <td className="px-6 py-4 font-semibold">{r.employeeEmail?.split('@')[0]}</td>}
                  <td className="px-6 py-4 font-bold text-indigo-600 text-center">৳{r.amount}</td>
                  <td className="px-6 py-4 uppercase text-center">{r.method}</td>
                  <td className="px-6 py-4 font-mono text-slate-500">
                    <div className="flex flex-col">
                      <span>{r.accountNumber}</span>
                      <span className="text-[9px] text-slate-300">{formatDateTime(r.timestamp)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded-lg font-bold uppercase text-[9px] ${r.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{r.status}</span>
                  </td>
                  {!isEmployee && (
                    <td className="px-6 py-4 text-right">
                      {r.status === 'pending' ? <button onClick={() => onComplete(r.id)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-bold text-[9px] uppercase">Mark Paid</button> : <span className="text-emerald-500 font-bold uppercase text-[9px]">Settled</span>}
                    </td>
                  )}
                </tr>
              ))}
              {displayRequests.length === 0 && (
                <tr><td colSpan={10} className="p-12 text-center text-slate-400 font-medium text-xs uppercase tracking-widest italic">No financial movements found</td></tr>
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
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const employees = state.users.filter(u => u.role === 'employee');

  if (selectedEmployeeId) {
    const emp = state.users.find(u => u.id === selectedEmployeeId);
    const empSales = state.sales.filter(s => s.employeeId === selectedEmployeeId);
    const empWithdraws = state.withdrawRequests.filter(r => r.employeeId === selectedEmployeeId);

    return (
      <div className="space-y-6 md:space-y-8 animate-in slide-in-from-right duration-300">
        <button onClick={() => setSelectedEmployeeId(null)} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors">
          &larr; Back to Team List
        </button>
        <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm flex flex-col md:flex-row items-center gap-6">
          {emp?.avatar ? <img src={emp.avatar} className="h-20 w-20 rounded-xl object-cover" /> : <div className="h-20 w-20 bg-indigo-600 rounded-xl flex items-center justify-center text-2xl font-bold text-white uppercase">{emp?.email.charAt(0)}</div>}
          <div className="text-center md:text-left">
            <h3 className="text-xl md:text-2xl font-bold text-slate-800">{emp?.username || emp?.email.split('@')[0]}</h3>
            <p className="text-sm text-slate-400">{emp?.email}</p>
          </div>
          <div className="md:ml-auto flex gap-3 md:gap-4 w-full md:w-auto">
             <div className="flex-1 md:flex-none bg-slate-50 px-4 md:px-6 py-3 md:py-4 rounded-xl text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Balance</p>
                <p className="text-base md:text-lg font-bold text-emerald-600">৳{emp?.wallet.toLocaleString()}</p>
             </div>
             <div className="flex-1 md:flex-none bg-slate-50 px-4 md:px-6 py-3 md:py-4 rounded-xl text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Sales</p>
                <p className="text-base md:text-lg font-bold text-indigo-600">{emp?.totalSalesCount}</p>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sale History</h4>
            </div>
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-left">
                <tbody className="divide-y divide-slate-100">
                  {empSales.map(s => (
                    <tr key={s.id} className="text-xs hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium">
                        <div className="flex flex-col">
                           <span>{s.productName}</span>
                           <span className="text-[9px] text-slate-400">{formatDateTime(s.timestamp)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold">৳{s.amount}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] uppercase font-bold ${s.status === 'completed' ? 'text-emerald-600 bg-emerald-50' : 'text-amber-600 bg-amber-50'}`}>{s.status}</span>
                      </td>
                    </tr>
                  ))}
                  {empSales.length === 0 && <tr><td className="p-8 text-center text-slate-400 italic">No sales found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Withdraw History</h4>
            </div>
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-left">
                <tbody className="divide-y divide-slate-100">
                  {empWithdraws.map(w => (
                    <tr key={w.id} className="text-xs hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium">
                        <div className="flex flex-col">
                           <span className="uppercase">{w.method}</span>
                           <span className="text-[9px] text-slate-400">{formatDateTime(w.timestamp)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold">৳{w.amount}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] uppercase font-bold ${w.status === 'completed' ? 'text-emerald-600 bg-emerald-50' : 'text-amber-600 bg-amber-50'}`}>{w.status}</span>
                      </td>
                    </tr>
                  ))}
                  {empWithdraws.length === 0 && <tr><td className="p-8 text-center text-slate-400 italic">No payouts yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-6">Add Team Member</h3>
        <form className="flex flex-col md:flex-row gap-4" onSubmit={e => { e.preventDefault(); onCreate(form.email, form.password); setForm({ email: '', password: '' }); }}>
          <div className="flex-1">
            <input type="email" required placeholder="Email" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="flex-1">
            <input type="text" required placeholder="Password" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>
          <button className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm">Add Member</button>
        </form>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {employees.map(e => (
          <div key={e.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative group transition-all hover:border-indigo-400 cursor-pointer" onClick={() => setSelectedEmployeeId(e.id)}>
            <button onClick={(event) => { event.stopPropagation(); onDelete(e.id); }} className="absolute top-4 right-4 text-slate-200 hover:text-red-500 transition-colors z-10 p-2"><Icons.Trash /></button>
            <div className="flex items-center gap-4 mb-6">
              {e.avatar ? <img src={e.avatar} className="h-12 w-12 rounded-xl object-cover shadow-sm" /> : <div className="h-12 w-12 bg-indigo-600 rounded-xl flex items-center justify-center text-lg font-bold text-white uppercase">{e.email.charAt(0)}</div>}
              <div>
                <p className="font-bold text-slate-800">{e.username || e.email.split('@')[0]}</p>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">{e.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-slate-50 pt-4">
              <div className="bg-slate-50 p-3 rounded-xl text-center">
                <p className="text-[8px] font-bold text-slate-400 uppercase mb-1">Sales</p>
                <p className="text-sm font-bold text-indigo-600">{e.totalSalesCount}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl text-center">
                <p className="text-[8px] font-bold text-slate-400 uppercase mb-1">Balance</p>
                <p className="text-sm font-bold text-emerald-600">৳{e.wallet.toLocaleString()}</p>
              </div>
            </div>
            <div className="mt-4 text-[9px] font-bold text-indigo-600 uppercase text-center opacity-0 group-hover:opacity-100 transition-opacity">
              View Analytics & History
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const AnnouncementView: React.FC<{ state: AppState; onAdd: (t: string, c: string) => void }> = ({ state, onAdd }) => {
  const isAdmin = state.currentUser?.role === 'admin';
  const [form, setForm] = useState({ title: '', content: '' });

  return (
    <div className="max-w-3xl mx-auto space-y-6 md:space-y-8">
      {isAdmin && (
        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold mb-4 md:mb-6">Global Broadcast</h3>
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); onAdd(form.title, form.content); setForm({ title: '', content: '' }); }}>
            <input type="text" required placeholder="Subject" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none font-semibold shadow-sm" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            <textarea required placeholder="Message content..." className="w-full h-32 px-4 py-2.5 rounded-xl border border-slate-200 outline-none resize-none text-sm shadow-sm" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}></textarea>
            <button className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-95">
              <Icons.Speakerphone /> Post Announcement
            </button>
          </form>
        </div>
      )}
      <div className="space-y-4">
        {state.announcements.slice().reverse().map(a => (
          <div key={a.id} className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-indigo-600 group hover:shadow-md transition-all">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-bold text-slate-800 text-sm md:text-base">{a.title}</h4>
              <span className="text-[9px] font-bold text-slate-400 uppercase">{formatDateTime(a.timestamp)}</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{a.content}</p>
          </div>
        ))}
        {state.announcements.length === 0 && <div className="text-center py-12 text-slate-300 font-medium italic text-sm">Station Silence</div>}
      </div>
    </div>
  );
};

const ProfileView: React.FC<{ user: User; onUpdate: (u: string, a: string, p: any) => void }> = ({ user, onUpdate }) => {
  const [username, setUsername] = useState(user.username || '');
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [paymentAccounts, setPaymentAccounts] = useState(user.paymentAccounts || { bKash: '', Nagad: '', Rocket: '' });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 300) {
        alert('Image too large! Please choose a file smaller than 300KB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setAvatar(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl p-6 md:p-10 shadow-sm border border-slate-200 flex flex-col items-center">
        <div className="relative group cursor-pointer w-28 h-28 md:w-32 md:h-32 mb-6" onClick={() => document.getElementById('av-up')?.click()}>
          {avatar ? <img src={avatar} className="w-full h-full rounded-2xl object-cover ring-4 ring-slate-50 shadow-md" /> : <div className="w-full h-full bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-4xl font-bold">{username.charAt(0) || user.email.charAt(0)}</div>}
          <div className="absolute inset-0 bg-black/20 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all backdrop-blur-[1px]"><Icons.Plus /></div>
          <input type="file" id="av-up" className="hidden" accept="image/*" onChange={handleAvatarChange} />
        </div>
        <div className="w-full space-y-4">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Verified Email</label>
            <div className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-400 text-xs truncate">{user.email}</div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Username</label>
            <input type="text" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none font-semibold text-sm shadow-sm focus:border-indigo-500 transition-colors" value={username} onChange={e => setUsername(e.target.value)} />
          </div>
        </div>
      </div>
      {user.role === 'employee' && (
        <div className="bg-white rounded-2xl p-6 md:p-10 shadow-sm border border-slate-200">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-6 border-b border-slate-50 pb-2">Payment Gateways</h3>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">bKash Account</label>
              <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold shadow-inner" placeholder="017XXXXXXXX" value={paymentAccounts.bKash} onChange={e => setPaymentAccounts({ ...paymentAccounts, bKash: e.target.value })} />
            </div>
            <div>
              <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Nagad Account</label>
              <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold shadow-inner" placeholder="017XXXXXXXX" value={paymentAccounts.Nagad} onChange={e => setPaymentAccounts({ ...paymentAccounts, Nagad: e.target.value })} />
            </div>
            <div>
              <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Rocket Account</label>
              <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-semibold shadow-inner" placeholder="017XXXXXXXX" value={paymentAccounts.Rocket} onChange={e => setPaymentAccounts({ ...paymentAccounts, Rocket: e.target.value })} />
            </div>
          </div>
        </div>
      )}
      <button onClick={() => onUpdate(username, avatar, paymentAccounts)} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold transition-all shadow-md active:scale-[0.98] hover:bg-indigo-700">Update Profile</button>
    </div>
  );
};

export default App;
