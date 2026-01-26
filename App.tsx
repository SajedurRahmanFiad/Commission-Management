
import React, { useState, useEffect, useCallback } from 'react';
import { User, Sale, Role, AppState, AppNotification, Product, Announcement, WithdrawRequest } from './types';
import { Icons, ADMIN_FEE_DEFAULT } from './constants';
import Layout from './components/Layout';
import { generateApprovalEmail } from './services/geminiService';

const STORAGE_KEY = 'commission_pro_super_v4_final';

// --- Toast Component ---
const Toast: React.FC<{ message: string; type: 'success' | 'info' | 'error'; onClose: () => void }> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const styles = {
    success: 'bg-emerald-600 text-white',
    info: 'bg-indigo-600 text-white',
    error: 'bg-red-600 text-white'
  };

  return (
    <div className={`fixed bottom-10 right-10 z-[100] px-8 py-5 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.2)] flex items-center gap-4 animate-in slide-in-from-bottom-5 duration-400 font-black text-sm ${styles[type]}`}>
      {type === 'success' && <Icons.Check />}
      <span>{message}</span>
      <button onClick={onClose} className="ml-4 p-1 hover:bg-white/20 rounded-full transition-colors">✕</button>
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
        { id: '1', email: 'admin@system.com', password: 'admin', role: 'admin', wallet: 0, totalSalesCount: 0, notifications: [] }
      ],
      sales: [],
      products: [
        { id: 'p1', name: 'Elite Digital Suite', adminShare: 400, description: 'Complete access to our digital tools and resources.', gallery: [] },
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

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = state.users.find(u => u.email === loginForm.email && u.password === loginForm.password);
    if (user) {
      setState(prev => ({ ...prev, currentUser: user }));
      showToast('Session started!', 'success');
    } else {
      setLoginError('Invalid credentials provided.');
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

    const notif: AppNotification = {
      id: Math.random().toString(),
      message: `Sale alert: ${state.currentUser.username || state.currentUser.email} added ${product.name}`,
      timestamp: new Date().toISOString(),
      read: false,
      type: 'sale'
    };

    setState(prev => ({ ...prev, sales: [newSale, ...prev.sales] }));
    const admin = state.users.find(u => u.role === 'admin');
    if (admin) addNotificationToUser(admin.id, notif);
    
    showToast('Sale queued for verification', 'success');
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
    showToast('Sale Verified & Commission Sent', 'success');
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

    const notif: AppNotification = {
      id: Math.random().toString(),
      message: `Withdraw Request: ৳${amount} via ${method} from ${state.currentUser.email}`,
      timestamp: new Date().toISOString(),
      read: false,
      type: 'withdraw'
    };

    const admin = state.users.find(u => u.role === 'admin');
    if (admin) addNotificationToUser(admin.id, notif);

    showToast('Withdrawal request sent!', 'success');
  };

  const completeWithdraw = (id: string) => {
    setState(prev => ({
      ...prev,
      withdrawRequests: prev.withdrawRequests.map(r => r.id === id ? { ...r, status: 'completed' } : r)
    }));
    showToast('Withdrawal marked as completed', 'success');
  };

  const addAnnouncement = (title: string, content: string) => {
    const newAnn = { id: Math.random().toString(), title, content, timestamp: new Date().toISOString() };
    const notif: AppNotification = {
      id: Math.random().toString(),
      message: `Important: ${title}`,
      timestamp: new Date().toISOString(),
      read: false,
      type: 'announcement'
    };

    setState(prev => ({ ...prev, announcements: [newAnn, ...prev.announcements] }));
    state.users.forEach(u => addNotificationToUser(u.id, notif));
    showToast('Announcement broadcasted', 'info');
  };

  const manageProduct = (id: string | null, product: Partial<Product> | null) => {
    if (!id && product) {
      // Create
      const newP = { id: Math.random().toString(36).substr(2, 9), name: product.name!, adminShare: product.adminShare!, description: product.description || '', gallery: product.gallery || [] };
      setState(prev => ({ ...prev, products: [...prev.products, newP] }));
      showToast('Product added', 'success');
    } else if (id && product) {
      // Edit
      setState(prev => ({ ...prev, products: prev.products.map(p => p.id === id ? { ...p, ...product } : p) }));
      showToast('Product updated', 'success');
    } else if (id && !product) {
      // Delete
      if (window.confirm("Remove this product?")) {
        setState(prev => ({ ...prev, products: prev.products.filter(p => p.id !== id) }));
        setSelectedProductId(null);
        showToast('Product removed', 'error');
      }
    }
  };

  const updateProfile = (username: string, avatar: string, paymentAccounts: any) => {
    setState(prev => ({
      ...prev,
      currentUser: { ...prev.currentUser!, username, avatar, paymentAccounts },
      users: prev.users.map(u => u.id === prev.currentUser?.id ? { ...u, username, avatar, paymentAccounts } : u)
    }));
    showToast('Identity updated!', 'success');
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
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-white rounded-[3rem] shadow-[0_40px_100px_rgba(0,0,0,0.1)] p-12 border border-slate-200 animate-in fade-in zoom-in duration-500">
          <div className="text-center mb-12">
            <div className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center text-white text-5xl font-black mx-auto mb-8 shadow-[0_20px_50px_rgba(79,70,229,0.3)]">C</div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter">CommishPro</h2>
            <p className="mt-2 text-slate-400 font-bold uppercase text-[11px] tracking-widest">Enterprise Dashboard</p>
          </div>
          <form className="space-y-6" onSubmit={handleLogin}>
            {loginError && <p className="text-red-500 text-xs font-black text-center bg-red-50 p-4 rounded-2xl border border-red-100">{loginError}</p>}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Email Access</label>
              <input type="email" required className="w-full px-6 py-5 rounded-3xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-8 focus:ring-indigo-50 outline-none transition-all font-bold" value={loginForm.email} onChange={e => setLoginForm({ ...loginForm, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Security Key</label>
              <input type="password" required className="w-full px-6 py-5 rounded-3xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-8 focus:ring-indigo-50 outline-none transition-all font-bold" value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} />
            </div>
            <button type="submit" className="w-full py-6 bg-indigo-600 text-white rounded-[2rem] shadow-2xl shadow-indigo-100 font-black text-lg hover:bg-indigo-700 transition-all active:scale-95">Verify & Enter</button>
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
        showToast('Member added!', 'success');
      }} onDelete={(id) => setState(p => ({ ...p, users: p.users.filter(u => u.id !== id) }))} />}
      {activeTab === 'announcements' && <AnnouncementView state={state} onAdd={addAnnouncement} />}
      {activeTab === 'profile' && <ProfileView user={state.currentUser} onUpdate={updateProfile} />}

      {toasts.map(t => (
        <Toast key={t.id} message={t.message} type={t.type} onClose={() => setToasts(prev => prev.filter(x => x.id !== t.id))} />
      ))}
    </Layout>
  );
};

// --- Sub Views ---

const DashboardView: React.FC<{ state: AppState; onApprove: (id: string) => void; onCreateSale: (e: string, p: string, a: number, pr: string, m: any) => void }> = ({ state, onApprove, onCreateSale }) => {
  const [showModal, setShowModal] = useState(false);
  const isEmployee = state.currentUser?.role === 'employee';
  const currentUserData = state.users.find(u => u.id === state.currentUser?.id);
  const displaySales = isEmployee ? state.sales.filter(s => s.employeeId === state.currentUser?.id) : state.sales;

  const [formData, setFormData] = useState({ email: '', phone: '', amount: '', productId: '', method: 'bKash' as any });

  const stats = isEmployee ? [
    { label: 'Net Wallet', val: `৳${currentUserData?.wallet.toLocaleString()}`, color: 'text-emerald-500', icon: Icons.Wallet },
    { label: 'Sales Done', val: currentUserData?.totalSalesCount || 0, color: 'text-indigo-500', icon: Icons.Check },
    { label: 'Queue', val: displaySales.filter(s => s.status === 'pending').length, color: 'text-amber-500', icon: Icons.Dashboard }
  ] : [
    { label: 'Total Volume', val: `৳${state.adminWallet.toLocaleString()}`, color: 'text-emerald-500', icon: Icons.Wallet },
    { label: 'Transactions', val: state.sales.length, color: 'text-indigo-500', icon: Icons.Sales },
    { label: 'Approvals', val: state.sales.filter(s => s.status === 'pending').length, color: 'text-amber-500', icon: Icons.Bell }
  ];

  return (
    <div className="space-y-12">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Command Center</h2>
          <p className="text-slate-400 font-black uppercase text-[10px] tracking-[0.2em] mt-2">Real-time Performance Metrics</p>
        </div>
        <button onClick={() => setShowModal(true)} className="px-10 py-5 bg-indigo-600 text-white rounded-[2rem] font-black shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-3 active:scale-95">
          <Icons.Plus /> New Transaction
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {stats.map((s, i) => (
          <div key={i} className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex items-center gap-8 group hover:shadow-2xl transition-all hover:border-indigo-100">
            <div className={`p-5 rounded-[1.5rem] bg-slate-50 ${s.color} transition-all group-hover:bg-indigo-50 group-hover:scale-110`}><s.icon /></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{s.label}</p>
              <h3 className="text-4xl font-black text-slate-800 tracking-tighter">{s.val}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden border-b-8 border-b-indigo-500">
        <div className="p-10 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
          <h3 className="text-xl font-black text-slate-800 tracking-tight">Ledger Records</h3>
          <span className="px-4 py-2 bg-white rounded-2xl text-[10px] font-black text-slate-400 border border-slate-100 uppercase tracking-widest">{displaySales.length} Entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/30">
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Origin</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Gateway</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Client</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Item</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                {!isEmployee && <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Verification</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {displaySales.map(sale => (
                <tr key={sale.id} className="hover:bg-indigo-50/20 transition-colors group">
                  <td className="px-10 py-8">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-slate-800">{sale.employeeEmail.split('@')[0]}</span>
                      <span className="text-[10px] font-bold text-slate-400 tracking-tighter uppercase opacity-60">ID: {sale.id}</span>
                    </div>
                  </td>
                  <td className="px-10 py-8 text-center">
                    <span className="px-4 py-1.5 bg-slate-100 rounded-xl text-[10px] font-black text-slate-600 uppercase tracking-widest">{sale.paymentMethod}</span>
                  </td>
                  <td className="px-10 py-8">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-700">{sale.customerEmail}</span>
                      <span className="text-[11px] font-black text-slate-300 tracking-tighter">{sale.customerPhone}</span>
                    </div>
                  </td>
                  <td className="px-10 py-8">
                    <span className="text-sm font-bold text-slate-800">{sale.productName}</span>
                  </td>
                  <td className="px-10 py-8">
                    <span className="text-lg font-black text-indigo-600">৳{sale.amount}</span>
                  </td>
                  <td className="px-10 py-8 text-center">
                    <span className={`px-4 py-2 rounded-[1rem] text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2 border-2 ${sale.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100 animate-pulse'}`}>
                      {sale.status === 'completed' && <Icons.Check />}
                      {sale.status}
                    </span>
                  </td>
                  {!isEmployee && (
                    <td className="px-10 py-8 text-right">
                      {sale.status === 'pending' ? (
                        <button onClick={() => onApprove(sale.id)} className="px-6 py-2.5 bg-indigo-600 text-white rounded-2xl text-[11px] font-black shadow-xl hover:bg-indigo-700 transition-all active:scale-90 uppercase tracking-widest">Confirm</button>
                      ) : <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1 justify-end"><Icons.Check /> Done</span>}
                    </td>
                  )}
                </tr>
              ))}
              {displaySales.length === 0 && (
                <tr><td colSpan={10} className="p-32 text-center italic text-slate-300 font-bold uppercase tracking-widest text-[11px]">Zero Records Found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-slate-900/70 backdrop-blur-xl">
          <div className="bg-white w-full max-w-2xl rounded-[3.5rem] p-12 shadow-2xl animate-in zoom-in slide-in-from-bottom-10 duration-500">
            <h4 className="text-3xl font-black text-slate-900 mb-10 flex items-center gap-4">
              <div className="p-3 bg-indigo-600 text-white rounded-3xl shadow-xl"><Icons.Plus /></div>
              Submit Transaction
            </h4>
            <form className="grid grid-cols-1 md:grid-cols-2 gap-8" onSubmit={e => {
              e.preventDefault();
              onCreateSale(formData.email, formData.phone, parseFloat(formData.amount), formData.productId, formData.method);
              setShowModal(false);
              setFormData({ email: '', phone: '', amount: '', productId: '', method: 'bKash' });
            }}>
              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Customer Email</label>
                <input type="email" required className="w-full px-7 py-5 rounded-3xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-8 focus:ring-indigo-50 outline-none font-bold" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Payment Number</label>
                <input type="text" required className="w-full px-7 py-5 rounded-3xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-8 focus:ring-indigo-50 outline-none font-bold" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Gross Amount (BDT)</label>
                <input type="number" required className="w-full px-7 py-5 rounded-3xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-8 focus:ring-indigo-50 outline-none font-black text-lg" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Product Category</label>
                <select required className="w-full px-7 py-5 rounded-3xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-8 focus:ring-indigo-50 outline-none font-bold appearance-none" value={formData.productId} onChange={e => setFormData({ ...formData, productId: e.target.value })}>
                  <option value="">Choose Product</option>
                  {state.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Wallet Gateway</label>
                <select required className="w-full px-7 py-5 rounded-3xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-8 focus:ring-indigo-50 outline-none font-bold appearance-none" value={formData.method} onChange={e => setFormData({ ...formData, method: e.target.value as any })}>
                  <option value="bKash">bKash</option>
                  <option value="Nagad">Nagad</option>
                  <option value="Rocket">Rocket</option>
                </select>
              </div>
              <div className="md:col-span-2 pt-8 flex gap-6">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-6 text-slate-400 font-black uppercase tracking-widest text-xs hover:bg-slate-50 rounded-[2rem] transition-all">Discard</button>
                <button type="submit" className="flex-[2] py-6 bg-indigo-600 text-white rounded-[2rem] font-black text-lg shadow-[0_20px_50px_rgba(79,70,229,0.3)] active:scale-95 transition-all">Finalize & Submit</button>
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
    <div className="space-y-12">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Product Inventory</h2>
          <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest mt-2">Available Assets & Services</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowAdd(true)} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl hover:bg-indigo-700 transition-all flex items-center gap-2">
            <Icons.Plus /> Add Product
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {state.products.map(p => (
          <div key={p.id} onClick={() => onSelect(p.id)} className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden group hover:shadow-[0_40px_100px_rgba(0,0,0,0.1)] transition-all cursor-pointer hover:-translate-y-2 border-b-4 border-b-transparent hover:border-b-indigo-500">
            <div className="h-64 bg-slate-50 relative overflow-hidden">
              {p.mainImage ? (
                <img src={p.mainImage} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-indigo-100 group-hover:text-indigo-200 transition-colors">
                  <Icons.Tag />
                </div>
              )}
              <div className="absolute top-6 left-6 px-4 py-2 bg-indigo-600/90 backdrop-blur-sm text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl">
                Asset #{p.id.slice(0, 4)}
              </div>
            </div>
            <div className="p-8">
              <h4 className="text-xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{p.name}</h4>
              <p className="text-sm font-medium text-slate-400 line-clamp-2 mt-2 leading-relaxed">{p.description}</p>
              <div className="mt-8 pt-6 border-t border-slate-50 flex justify-between items-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Admin Share</p>
                <span className="text-2xl font-black text-indigo-600 group-hover:scale-110 transition-transform">৳{p.adminShare}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-xl rounded-[3rem] p-12 shadow-2xl animate-in zoom-in duration-300">
            <h3 className="text-2xl font-black mb-8">New Product Listing</h3>
            <form className="space-y-6" onSubmit={e => { e.preventDefault(); onAdd({ name: form.name, adminShare: parseFloat(form.share), description: form.desc }); setShowAdd(false); setForm({ name: '', share: '', desc: '' }); }}>
              <input type="text" required placeholder="Asset Name" className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:bg-white" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <input type="number" required placeholder="Admin Fee (BDT)" className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:bg-white font-bold" value={form.share} onChange={e => setForm({ ...form, share: e.target.value })} />
              <textarea placeholder="Description..." className="w-full h-32 px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:bg-white font-medium resize-none" value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })}></textarea>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-4 text-slate-400 font-bold">Cancel</button>
                <button className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg">Save Asset</button>
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
    <div className="max-w-6xl mx-auto bg-white rounded-[4rem] shadow-sm border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-10 duration-500">
      <div className="flex flex-col lg:flex-row">
        {/* Gallery Section */}
        <div className="lg:w-1/2 p-12 bg-slate-50/50 space-y-8">
          <div className="relative group rounded-[3rem] overflow-hidden shadow-2xl border-4 border-white aspect-square">
            {product.mainImage ? (
              <img src={product.mainImage} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-200"><Icons.Tag /></div>
            )}
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
              {product.mainImage && (
                <button onClick={() => downloadImage(product.mainImage!, 'main-asset')} className="p-4 bg-white rounded-full text-indigo-600 shadow-xl hover:scale-110 transition-all"><Icons.Download /></button>
              )}
              {isAdmin && (
                <button onClick={() => document.getElementById('main-img-up')?.click()} className="p-4 bg-white rounded-full text-indigo-600 shadow-xl hover:scale-110 transition-all"><Icons.Plus /></button>
              )}
            </div>
            <input id="main-img-up" type="file" className="hidden" onChange={(e) => handleImgUpload(e, 'main')} />
          </div>

          <div className="grid grid-cols-4 gap-4">
            {product.gallery?.map((img, i) => (
              <div key={i} className="relative aspect-square rounded-2xl overflow-hidden group border-2 border-white shadow-sm">
                <img src={img} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button onClick={() => downloadImage(img, `gallery-${i}`)} className="p-2 bg-white rounded-lg text-indigo-600 scale-75 hover:scale-100 transition-all"><Icons.Download /></button>
                  {isAdmin && (
                    <button onClick={() => onUpdate({ gallery: product.gallery.filter((_, idx) => idx !== i) })} className="p-2 bg-red-500 rounded-lg text-white scale-75 hover:scale-100 transition-all"><Icons.Trash /></button>
                  )}
                </div>
              </div>
            ))}
            {isAdmin && (
              <button onClick={() => document.getElementById('gallery-up')?.click()} className="aspect-square rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-300 hover:border-indigo-500 hover:text-indigo-500 transition-all">
                <Icons.Plus />
              </button>
            )}
            <input id="gallery-up" type="file" multiple className="hidden" onChange={(e) => handleImgUpload(e, 'gallery')} />
          </div>
        </div>

        {/* Content Section */}
        <div className="lg:w-1/2 p-16 space-y-10 relative">
          <button onClick={onClose} className="absolute top-10 right-10 text-slate-300 hover:text-slate-900 transition-colors">✕</button>
          
          <div className="space-y-6">
            <div className="flex justify-between items-start">
              {editing ? (
                <input type="text" className="text-3xl font-black text-slate-900 border-b-2 border-indigo-600 outline-none w-full mr-10" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              ) : (
                <h2 className="text-4xl font-black text-slate-900 tracking-tighter">{product.name}</h2>
              )}
              {isAdmin && !editing && <button onClick={() => setEditing(true)} className="p-2 text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-all"><Icons.Pencil /></button>}
            </div>

            <div className="flex items-center gap-4">
              <span className="px-5 py-2 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg">Company Verified</span>
              <span className="text-sm font-black text-slate-300 uppercase tracking-widest">UID: {product.id}</span>
            </div>
          </div>

          <div className="space-y-4">
            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Product Intelligence</h5>
            {editing ? (
              <textarea className="w-full h-48 px-6 py-4 rounded-3xl bg-slate-50 border outline-none font-medium resize-none" value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })}></textarea>
            ) : (
              <p className="text-lg font-medium text-slate-600 leading-relaxed italic border-l-4 border-slate-100 pl-6">{product.description || "No description provided for this asset."}</p>
            )}
          </div>

          <div className="p-10 bg-indigo-50/50 rounded-[3rem] border border-indigo-100 flex justify-between items-center group">
            <div>
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Internal Administration Share</p>
              {editing ? (
                <input type="number" className="text-4xl font-black text-indigo-600 bg-transparent outline-none w-32" value={form.share} onChange={e => setForm({ ...form, share: e.target.value })} />
              ) : (
                <h3 className="text-5xl font-black text-indigo-600 tracking-tighter group-hover:scale-105 transition-transform">৳{product.adminShare}</h3>
              )}
            </div>
            <div className="p-6 bg-white rounded-3xl shadow-xl text-indigo-600"><Icons.Wallet /></div>
          </div>

          {editing && (
            <div className="flex gap-4 pt-4">
              <button onClick={() => { setEditing(false); onUpdate({ name: form.name, adminShare: parseFloat(form.share), description: form.desc }); }} className="flex-1 py-5 bg-indigo-600 text-white rounded-[2rem] font-black shadow-xl">Apply Updates</button>
              <button onClick={onDelete} className="px-6 text-red-500 font-black"><Icons.Trash /></button>
            </div>
          )}
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
      {isEmployee && (
        <div className="lg:col-span-1">
          <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm sticky top-12">
            <h3 className="text-2xl font-black text-slate-800 mb-8">Initiate Withdrawal</h3>
            <div className="mb-8 p-6 bg-emerald-50 rounded-3xl border border-emerald-100">
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Available to cash out</p>
              <h4 className="text-3xl font-black text-emerald-700">৳{state.currentUser?.wallet.toLocaleString()}</h4>
            </div>
            <form className="space-y-6" onSubmit={e => { e.preventDefault(); if(!currentAccountNum) { alert(`Please set up your ${form.method} number in settings first!`); return; } onWithdraw(parseFloat(form.amount), form.method, currentAccountNum); setForm({ ...form, amount: '' }); }}>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Withdraw Amount</label>
                <input type="number" required max={state.currentUser?.wallet} className="w-full px-6 py-4 rounded-2xl bg-slate-50 border outline-none font-black text-lg" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Transfer Gateway</label>
                <select className="w-full px-6 py-4 rounded-2xl bg-slate-50 border outline-none font-bold" value={form.method} onChange={e => setForm({ ...form, method: e.target.value as any })}>
                  <option value="bKash">bKash</option>
                  <option value="Nagad">Nagad</option>
                  <option value="Rocket">Rocket</option>
                </select>
              </div>
              {currentAccountNum ? (
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest text-center italic">Funds will go to: {currentAccountNum}</p>
              ) : (
                <p className="text-[10px] font-black text-red-400 uppercase tracking-widest text-center italic">Gateway not configured! Check profile.</p>
              )}
              <button disabled={!form.amount || parseFloat(form.amount) <= 0 || !currentAccountNum} className="w-full py-5 bg-indigo-600 text-white rounded-3xl font-black shadow-xl disabled:bg-slate-200 disabled:shadow-none transition-all active:scale-95">Confirm Request</button>
            </form>
          </div>
        </div>
      )}

      <div className={`${isEmployee ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden`}>
        <div className="p-8 border-b border-slate-50 flex justify-between items-center">
          <h3 className="font-black text-slate-800 tracking-tight">Withdrawal Requests</h3>
          <Icons.Cash />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                {!isEmployee && <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase">Partner</th>}
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase">Amount</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase">Gateway</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase">Account</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase">Status</th>
                {!isEmployee && <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {displayRequests.map(r => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  {!isEmployee && <td className="px-8 py-6 text-sm font-black text-slate-800">{r.employeeEmail.split('@')[0]}</td>}
                  <td className="px-8 py-6 font-black text-indigo-600">৳{r.amount}</td>
                  <td className="px-8 py-6 text-xs font-bold uppercase">{r.method}</td>
                  <td className="px-8 py-6 text-xs font-black text-slate-400">{r.accountNumber}</td>
                  <td className="px-8 py-6">
                    <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase ${r.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700 animate-pulse'}`}>{r.status}</span>
                  </td>
                  {!isEmployee && (
                    <td className="px-8 py-6 text-right">
                      {r.status === 'pending' ? <button onClick={() => onComplete(r.id)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-indigo-700 transition-all">Mark Paid</button> : <span className="text-[10px] font-black text-emerald-500 uppercase">Settled</span>}
                    </td>
                  )}
                </tr>
              ))}
              {displayRequests.length === 0 && (
                <tr><td colSpan={10} className="p-20 text-center italic text-slate-300 font-bold uppercase tracking-widest text-[10px]">No payout requests</td></tr>
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
    <div className="space-y-12">
      <div className="bg-white p-12 rounded-[3.5rem] border border-slate-100 shadow-sm border-b-8 border-b-indigo-600">
        <h3 className="text-3xl font-black text-slate-900 mb-10 tracking-tighter">Team Integration</h3>
        <form className="flex flex-col md:flex-row gap-8" onSubmit={e => { e.preventDefault(); onCreate(form.email, form.password); setForm({ email: '', password: '' }); }}>
          <div className="flex-1 space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Access Email</label>
            <input type="email" required placeholder="partner@enterprise.com" className="w-full px-7 py-5 rounded-3xl bg-slate-50 border outline-none focus:bg-white focus:ring-8 focus:ring-indigo-50 transition-all font-bold" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="flex-1 space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Master Password</label>
            <input type="text" required placeholder="Permanent Pin" className="w-full px-7 py-5 rounded-3xl bg-slate-50 border outline-none focus:bg-white focus:ring-8 focus:ring-indigo-50 transition-all font-black" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>
          <button className="md:w-72 mt-6 md:mt-0 py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-lg shadow-2xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all self-end">Add Member</button>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {employees.map(e => (
          <div key={e.id} className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm relative group hover:shadow-2xl transition-all border-b-4 border-b-transparent hover:border-b-red-500">
            <button onClick={() => onDelete(e.id)} className="absolute top-10 right-10 p-3 text-slate-100 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"><Icons.Trash /></button>
            <div className="flex items-center gap-6 mb-10">
              {e.avatar ? <img src={e.avatar} className="h-20 w-20 rounded-[2rem] object-cover shadow-xl ring-4 ring-indigo-50" /> : <div className="h-20 w-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-3xl font-black text-white shadow-2xl shadow-indigo-100">{e.email.charAt(0).toUpperCase()}</div>}
              <div className="overflow-hidden">
                <p className="text-xl font-black text-slate-900 truncate tracking-tight">{e.username || e.email.split('@')[0]}</p>
                <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest truncate mt-1">{e.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6 border-t border-slate-50 pt-8">
              <div className="bg-slate-50/80 p-5 rounded-3xl text-center group-hover:bg-indigo-50/50 transition-colors">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Lifetime Sales</p>
                <p className="text-2xl font-black text-indigo-600">{e.totalSalesCount}</p>
              </div>
              <div className="bg-slate-50/80 p-5 rounded-3xl text-center group-hover:bg-emerald-50/50 transition-colors">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Earned Share</p>
                <p className="text-2xl font-black text-emerald-600">৳{e.wallet.toLocaleString()}</p>
              </div>
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
    <div className="max-w-4xl mx-auto space-y-12">
      {isAdmin && (
        <div className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-sm border-t-8 border-t-emerald-500">
          <h3 className="text-3xl font-black mb-10 tracking-tighter">Global Broadcast</h3>
          <form className="space-y-8" onSubmit={e => { e.preventDefault(); onAdd(form.title, form.content); setForm({ title: '', content: '' }); }}>
            <input type="text" required placeholder="Headline..." className="w-full px-8 py-5 rounded-3xl border border-slate-100 bg-slate-50 focus:bg-white outline-none font-black text-xl tracking-tight" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            <textarea required placeholder="Compose your detailed message to the team..." className="w-full h-48 px-8 py-5 rounded-3xl border border-slate-100 bg-slate-50 focus:bg-white outline-none font-medium resize-none text-lg leading-relaxed" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}></textarea>
            <button className="w-full py-6 bg-emerald-600 text-white rounded-[2rem] font-black shadow-[0_20px_50px_rgba(16,185,129,0.3)] hover:bg-emerald-700 transition-all flex items-center justify-center gap-4 active:scale-95 text-xl tracking-tighter">
              <Icons.Speakerphone /> Publish Announcement
            </button>
          </form>
        </div>
      )}

      <div className="space-y-8">
        {state.announcements.slice().reverse().map(a => (
          <div key={a.id} className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm border-l-[12px] border-l-indigo-600 group hover:shadow-2xl transition-all">
            <div className="flex justify-between items-start mb-6">
              <h4 className="text-2xl font-black text-slate-900 tracking-tighter">{a.title}</h4>
              <span className="px-4 py-1.5 bg-slate-50 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{new Date(a.timestamp).toLocaleDateString()}</span>
            </div>
            <p className="text-slate-600 leading-relaxed font-medium text-lg whitespace-pre-wrap">{a.content}</p>
          </div>
        ))}
        {state.announcements.length === 0 && <div className="text-center py-32 italic text-slate-400 font-bold uppercase tracking-widest text-[11px] opacity-50">Station Silence</div>}
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
      const reader = new FileReader();
      reader.onloadend = () => setAvatar(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div className="bg-white rounded-[4rem] p-16 shadow-sm border border-slate-100 flex flex-col md:flex-row gap-16">
        <div className="flex flex-col items-center">
          <div className="relative group cursor-pointer w-48 h-48 mb-8" onClick={() => document.getElementById('avatar-input-final')?.click()}>
            {avatar ? (
              <img src={avatar} className="w-full h-full rounded-[3.5rem] object-cover ring-[12px] ring-indigo-50 shadow-2xl transition-transform duration-500 group-hover:scale-105" />
            ) : (
              <div className="w-full h-full bg-indigo-600 rounded-[3.5rem] flex items-center justify-center text-white text-6xl font-black shadow-2xl shadow-indigo-100">
                {username.charAt(0) || user.email.charAt(0)}
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 rounded-[3.5rem] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all backdrop-blur-[2px]">
              <div className="p-3 bg-white/20 rounded-full text-white"><Icons.Plus /></div>
            </div>
            <input type="file" id="avatar-input-final" className="hidden" accept="image/*" onChange={handleAvatarChange} />
          </div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tighter">Profile Image</h3>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Personal Identity</p>
        </div>

        <div className="flex-1 space-y-8">
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter mb-4">Identity Details</h3>
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Verified Email</label>
              <div className="px-8 py-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-slate-400 font-bold italic shadow-inner">{user.email}</div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Display Username</label>
              <input type="text" className="w-full px-8 py-5 bg-white border border-slate-200 rounded-[2rem] focus:ring-[16px] focus:ring-indigo-50 outline-none font-black text-xl transition-all shadow-sm" value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" />
            </div>
          </div>
        </div>
      </div>

      {user.role === 'employee' && (
        <div className="bg-white rounded-[4rem] p-16 shadow-sm border border-slate-100">
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter mb-10">Payment Gateways</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">bKash Account</label>
              <input type="text" className="w-full px-7 py-5 bg-slate-50 border border-slate-100 rounded-2xl font-bold focus:bg-white transition-all outline-none" placeholder="01XXX..." value={paymentAccounts.bKash} onChange={e => setPaymentAccounts({ ...paymentAccounts, bKash: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Nagad Account</label>
              <input type="text" className="w-full px-7 py-5 bg-slate-50 border border-slate-100 rounded-2xl font-bold focus:bg-white transition-all outline-none" placeholder="01XXX..." value={paymentAccounts.Nagad} onChange={e => setPaymentAccounts({ ...paymentAccounts, Nagad: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Rocket Account</label>
              <input type="text" className="w-full px-7 py-5 bg-slate-50 border border-slate-100 rounded-2xl font-bold focus:bg-white transition-all outline-none" placeholder="01XXX..." value={paymentAccounts.Rocket} onChange={e => setPaymentAccounts({ ...paymentAccounts, Rocket: e.target.value })} />
            </div>
          </div>
        </div>
      )}

      <button onClick={() => onUpdate(username, avatar, paymentAccounts)} className="w-full py-8 bg-indigo-600 text-white rounded-[2.5rem] font-black text-2xl shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 tracking-tighter">Save Workspace Identity</button>
    </div>
  );
};

export default App;
