
import React, { useState, useEffect, useCallback } from 'react';
import { User, Sale, Role, AppState, AppNotification, Product, Announcement, WithdrawRequest } from './types';
import { Icons, ADMIN_FEE_DEFAULT } from './constants';
import Layout, { formatDateTime } from './components/Layout';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    currentUser: null,
    users: [],
    sales: [],
    products: [],
    announcements: [],
    withdrawRequests: [],
    adminWallet: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'info' | 'error' }[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'info' | 'error' = 'info') => {
    setToasts(prev => [...prev, { id: Math.random().toString(), message, type }]);
  }, []);

  // Sync data from DB on mount
  const refreshData = useCallback(async () => {
    try {
      const res = await fetch('/api/backend');
      const data = await res.json();
      if (data.success) {
        setState(prev => ({
          ...prev,
          ...data.payload,
          currentUser: prev.currentUser 
            ? data.payload.users.find((u: any) => u.id === prev.currentUser?.id) 
            : null
        }));
      }
    } catch (err) {
      console.error("Failed to sync with MariaDB", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = state.users.find(u => u.email === loginForm.email && u.password === loginForm.password);
    if (user) {
      setState(prev => ({ ...prev, currentUser: user }));
      showToast('Authentication Successful', 'success');
    } else {
      setLoginError('Invalid credentials.');
    }
  };

  const handleLogout = () => {
    setState(prev => ({ ...prev, currentUser: null }));
    setActiveTab('dashboard');
    showToast('Logged out');
  };

  const syncStateWithDb = async (action: string, payload: any) => {
    try {
      const res = await fetch('/api/backend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload })
      });
      const data = await res.json();
      if (data.success) {
        await refreshData();
        return true;
      }
      showToast(data.error || 'Update failed', 'error');
      return false;
    } catch (err) {
      showToast('Network error', 'error');
      return false;
    }
  };

  const createSale = async (customerEmail: string, customerPhone: string, amount: number, productId: string, paymentMethod: 'bKash' | 'Nagad' | 'Rocket') => {
    if (!state.currentUser) return;
    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    const newSale = {
      id: Math.random().toString(36).substr(2, 9),
      employeeId: state.currentUser.id,
      employeeEmail: state.currentUser.email,
      customerEmail,
      customerPhone,
      amount,
      productId,
      productName: product.name,
      paymentMethod,
      status: 'pending' as const,
      timestamp: new Date().toISOString()
    };

    const success = await syncStateWithDb('CREATE_SALE', newSale);
    if (success) showToast('Sale reported to MariaDB', 'success');
  };

  const approveSale = async (saleId: string) => {
    const success = await syncStateWithDb('APPROVE_SALE', { saleId });
    if (success) showToast('Sale verified and funds moved', 'success');
  };

  const requestWithdraw = async (amount: number, method: 'bKash' | 'Nagad' | 'Rocket', accountNumber: string) => {
    const newReq = {
      id: Math.random().toString(36).substr(2, 9),
      employeeId: state.currentUser?.id,
      employeeEmail: state.currentUser?.email,
      amount,
      method,
      accountNumber,
      status: 'pending' as const,
      timestamp: new Date().toISOString()
    };

    const success = await syncStateWithDb('REQUEST_WITHDRAW', newReq);
    if (success) showToast('Withdrawal queued in DB', 'success');
  };

  const completeWithdraw = async (id: string) => {
    const success = await syncStateWithDb('COMPLETE_WITHDRAW', { id });
    if (success) showToast('Payout complete', 'success');
  };

  const addAnnouncement = async (title: string, content: string) => {
    const payload = { id: Math.random().toString(), title, content, timestamp: new Date().toISOString() };
    const success = await syncStateWithDb('ADD_ANNOUNCEMENT', payload);
    if (success) showToast('Broadcast published', 'info');
  };

  const manageProduct = async (id: string | null, product: Partial<Product> | null) => {
    if (!id && product) {
      const newP = { id: Math.random().toString(36).substr(2, 9), ...product, gallery: product.gallery || [] };
      const success = await syncStateWithDb('ADD_PRODUCT', newP);
      if (success) showToast('Product stored in MariaDB', 'success');
    } else if (id && product) {
      const success = await syncStateWithDb('UPDATE_PRODUCT', { id, ...product });
      if (success) showToast('Product updated', 'success');
    } else if (id && !product) {
      if (window.confirm("Delete this product?")) {
        const success = await syncStateWithDb('DELETE_PRODUCT', { id });
        if (success) {
          setSelectedProductId(null);
          showToast('Product removed', 'error');
        }
      }
    }
  };

  const updateProfile = async (username: string, avatar: string, paymentAccounts: any) => {
    const success = await syncStateWithDb('UPDATE_PROFILE', { userId: state.currentUser?.id, username, avatar, paymentAccounts });
    if (success) showToast('Profile synced', 'success');
  };

  const clearNotifications = async () => {
    await syncStateWithDb('CLEAR_NOTIFICATIONS', { userId: state.currentUser?.id });
  };

  if (isLoading) {
    return <div className="h-screen flex items-center justify-center bg-slate-50 text-indigo-600 font-bold">Synchronizing MariaDB...</div>;
  }

  if (!state.currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 p-8 md:p-10 animate-in fade-in zoom-in slide-in-from-bottom-5 duration-500">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold mx-auto mb-6 shadow-lg shadow-indigo-200">C</div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">CommishPro</h2>
            <p className="text-sm text-slate-400 mt-2 font-medium">MariaDB Secure Access</p>
          </div>
          <form className="space-y-5" onSubmit={handleLogin}>
            {loginError && <div className="text-red-500 text-xs text-center font-bold bg-red-50 p-3 rounded-xl border border-red-100">{loginError}</div>}
            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-2 uppercase tracking-wider">Access Email</label>
              <input type="email" required className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none transition-all duration-200" value={loginForm.email} onChange={e => setLoginForm({ ...loginForm, email: e.target.value })} />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-2 uppercase tracking-wider">Security Key</label>
              <input type="password" required className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none transition-all duration-200" value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} />
            </div>
            <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-100 mt-2">Sign In</button>
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
        {activeTab === 'employees' && state.currentUser.role === 'admin' && <TeamHubView state={state} onCreate={async (e, p) => {
          const newUser = { id: Math.random().toString(36).substr(2, 9), email: e, password: p, role: 'employee' as const, wallet: 0, totalSalesCount: 0, notifications: [] };
          await syncStateWithDb('ADD_EMPLOYEE', newUser);
        }} onDelete={async (id) => {
           if(window.confirm("Remove employee from MariaDB?")) {
             await syncStateWithDb('DELETE_EMPLOYEE', { id });
           }
        }} />}
        {activeTab === 'announcements' && <AnnouncementView state={state} onAdd={addAnnouncement} />}
        {activeTab === 'profile' && <ProfileView user={state.currentUser} onUpdate={updateProfile} />}
      </div>

      {/* FIXED: Added a container and implementation for Toast notifications */}
      <div className="fixed bottom-0 right-0 p-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map(t => (
          <Toast key={t.id} message={t.message} type={t.type} onClose={() => setToasts(prev => prev.filter(x => x.id !== t.id))} />
        ))}
      </div>
    </Layout>
  );
};

// --- Toast Component Fix ---
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
        <h2 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight">Command Center</h2>
        <button onClick={() => setShowModal(true)} className="px-4 md:px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold shadow-md shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2 text-sm">
          <Icons.Plus /> New Transaction
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {stats.map((s, i) => (
          <div key={i} className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 flex items-center gap-4 md:gap-5 shadow-sm hover:shadow-md transition-shadow">
            <div className={`p-2.5 md:p-3 rounded-xl bg-slate-50 ${s.color}`}><s.icon /></div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{s.label}</p>
              <h3 className="text-lg md:text-xl font-bold text-slate-800 tracking-tight">{s.val}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Transaction Log</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-white border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Origin</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Gateway</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Client</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Amount</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Status</th>
                {!isEmployee && <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Verification</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displaySales.map(sale => (
                <tr key={sale.id} className="hover:bg-slate-50 transition-colors duration-150">
                  <td className="px-6 py-4 text-xs font-semibold text-slate-700">{sale.employeeEmail.split('@')[0]}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md uppercase">{sale.paymentMethod}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-slate-700">{sale.customerEmail}</span>
                      <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(sale.timestamp)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-indigo-600 text-center">৳{sale.amount}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase ${sale.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                      {sale.status}
                    </span>
                  </td>
                  {!isEmployee && (
                    <td className="px-6 py-4 text-right">
                      {sale.status === 'pending' ? (
                        <button onClick={() => onApprove(sale.id)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold hover:bg-indigo-700 active:scale-95 transition-all">Confirm</button>
                      ) : <span className="text-[10px] font-bold text-emerald-500 uppercase flex items-center justify-end gap-1"><Icons.Check /> Done</span>}
                    </td>
                  )}
                </tr>
              ))}
              {displaySales.length === 0 && (
                <tr><td colSpan={10} className="p-16 text-center text-slate-300 text-sm font-medium italic font-sans">No transactions recorded in MariaDB</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-300">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setShowModal(false)}></div>
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 md:p-8 shadow-2xl relative z-10 animate-in zoom-in-95 duration-300 ease-out">
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-lg font-bold text-slate-800">Record Transaction</h4>
              <button onClick={() => setShowModal(false)} className="text-slate-400 p-2 hover:bg-slate-50 rounded-xl transition-all"><Icons.X /></button>
            </div>
            <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={e => {
              e.preventDefault();
              onCreateSale(formData.email, formData.phone, parseFloat(formData.amount), formData.productId, formData.method);
              setShowModal(false);
              setFormData({ email: '', phone: '', amount: '', productId: '', method: 'bKash' });
            }}>
              <div className="md:col-span-2">
                <label className="text-[11px] font-bold text-slate-500 block mb-1 uppercase tracking-wide">Client Email</label>
                <input type="email" required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-500 transition-colors" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1 uppercase tracking-wide">Mobile Number</label>
                <input type="text" required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-500 transition-colors" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1 uppercase tracking-wide">Gross Amount</label>
                <input type="number" required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-500 transition-colors font-bold" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="text-[11px] font-bold text-slate-500 block mb-1 uppercase tracking-wide">Product Catalog</label>
                <select required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-500 transition-colors" value={formData.productId} onChange={e => setFormData({ ...formData, productId: e.target.value })}>
                  <option value="">Select an asset...</option>
                  {state.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-[11px] font-bold text-slate-500 block mb-1 uppercase tracking-wide">Transfer Method</label>
                <select required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-500 transition-colors" value={formData.method} onChange={e => setFormData({ ...formData, method: e.target.value as any })}>
                  <option value="bKash">bKash</option>
                  <option value="Nagad">Nagad</option>
                  <option value="Rocket">Rocket</option>
                </select>
              </div>
              <div className="md:col-span-2 pt-4 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 text-slate-400 font-bold text-sm hover:bg-slate-50 rounded-xl transition-all">Discard</button>
                <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-100">Finalize Sale</button>
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
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight">Product Catalog</h2>
        {isAdmin && (
          <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-md shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all">
            Add Asset
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {state.products.map(p => (
          <div key={p.id} onClick={() => onSelect(p.id)} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-indigo-400 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-xl group">
            <div className="h-44 md:h-52 bg-slate-50 flex items-center justify-center text-slate-300 relative overflow-hidden">
              {p.mainImage ? (
                <img src={p.mainImage} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              ) : (
                <Icons.Tag />
              )}
            </div>
            <div className="p-5">
              <h4 className="font-bold text-slate-800 text-sm md:text-base group-hover:text-indigo-600 transition-colors">{p.name}</h4>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2 min-h-[2.5em] leading-relaxed">{p.description || "No description provided."}</p>
              <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Share</p>
                <span className="text-base md:text-lg font-bold text-indigo-600 tracking-tight">৳{p.adminShare}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setShowAdd(false)}></div>
          <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl relative z-10 animate-in zoom-in-95 duration-300 ease-out">
            <h3 className="text-lg font-bold mb-6">Create New Listing</h3>
            <form className="space-y-4" onSubmit={e => { e.preventDefault(); onAdd({ name: form.name, adminShare: parseFloat(form.share), description: form.desc }); setShowAdd(false); setForm({ name: '', share: '', desc: '' }); }}>
              <input type="text" required placeholder="Asset Title" className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none focus:bg-white focus:border-indigo-500 transition-all" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <input type="number" required placeholder="Admin Fee (BDT)" className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none focus:bg-white focus:border-indigo-500 transition-all font-bold" value={form.share} onChange={e => setForm({ ...form, share: e.target.value })} />
              <textarea placeholder="Describe the item..." className="w-full h-32 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none resize-none text-sm focus:bg-white focus:border-indigo-500 transition-all" value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })}></textarea>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-3 text-slate-400 font-bold hover:bg-slate-50 rounded-xl transition-all">Cancel</button>
                <button className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 active:scale-95 transition-all">Add Product</button>
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
    <div className="max-w-5xl mx-auto bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-6 fade-in duration-500 ease-out">
      <div className="flex flex-col lg:flex-row">
        <div className="lg:w-2/5 p-6 md:p-8 bg-slate-50/50 border-b lg:border-r lg:border-b-0 border-slate-100">
          <div className="relative group rounded-2xl overflow-hidden shadow-md border border-slate-200 aspect-square max-w-[400px] mx-auto bg-white">
            {product.mainImage ? <img src={product.mainImage} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-200"><Icons.Tag /></div>}
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3">
              {product.mainImage && <button onClick={() => downloadImage(product.mainImage!, 'main')} className="p-3 bg-white rounded-xl text-indigo-600 shadow-xl active:scale-90 transition-all"><Icons.Download /></button>}
              {isAdmin && <button onClick={() => document.getElementById('main-up')?.click()} className="p-3 bg-white rounded-xl text-indigo-600 shadow-xl active:scale-90 transition-all"><Icons.Plus /></button>}
            </div>
            <input id="main-up" type="file" className="hidden" onChange={(e) => handleImgUpload(e, 'main')} />
          </div>
          <div className="grid grid-cols-4 gap-2 md:gap-3 mt-4 max-w-[400px] mx-auto">
            {product.gallery?.map((img, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 group bg-white shadow-sm">
                <img src={img} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-1">
                  <button onClick={() => downloadImage(img, `g-${i}`)} className="p-1.5 bg-white rounded-lg text-indigo-600 scale-90 active:scale-100"><Icons.Download /></button>
                  {isAdmin && <button onClick={() => onUpdate({ gallery: product.gallery.filter((_, idx) => idx !== i) })} className="p-1.5 bg-red-500 rounded-lg text-white scale-90 active:scale-100"><Icons.Trash /></button>}
                </div>
              </div>
            ))}
            {isAdmin && <button onClick={() => document.getElementById('gal-up')?.click()} className="aspect-square rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-slate-300 hover:border-indigo-400 hover:text-indigo-600 bg-white transition-all shadow-sm">
              <Icons.Plus />
            </button>}
            <input id="gal-up" type="file" multiple className="hidden" onChange={(e) => handleImgUpload(e, 'gallery')} />
          </div>
        </div>
        <div className="lg:w-3/5 p-6 md:p-10 relative">
          <button onClick={onClose} className="absolute top-4 right-4 md:top-8 md:right-8 text-slate-300 hover:text-slate-800 transition-all p-3 hover:bg-slate-50 rounded-2xl">✕</button>
          <div className="space-y-8">
            <div>
              {editing ? <input type="text" className="text-xl md:text-2xl font-bold text-slate-800 border-b-2 border-indigo-500 outline-none w-full bg-slate-50 px-2 py-1 rounded-t-lg" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /> : <h2 className="text-xl md:text-3xl font-bold text-slate-800 tracking-tight">{product.name}</h2>}
              <div className="flex items-center gap-3 mt-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-1 rounded-md">Serial: {product.id}</span>
                {isAdmin && !editing && <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded-md transition-all uppercase"><Icons.Pencil /> Edit Asset</button>}
              </div>
            </div>
            <div>
              <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Item Intelligence</h5>
              {editing ? <textarea className="w-full h-32 px-4 py-3 rounded-xl bg-slate-50 border outline-none text-sm focus:bg-white transition-all" value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })} /> : <p className="text-sm md:text-base text-slate-600 leading-relaxed font-medium italic border-l-4 border-slate-100 pl-4">{product.description || "No supplemental details provided."}</p>}
            </div>
            <div className="p-6 md:p-8 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex justify-between items-center group transition-all hover:bg-indigo-50">
              <div>
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1.5">Internal Share</p>
                {editing ? <input type="number" className="text-2xl font-bold text-indigo-600 bg-transparent outline-none w-32 border-b border-indigo-200" value={form.share} onChange={e => setForm({ ...form, share: e.target.value })} /> : <h3 className="text-2xl md:text-3xl font-bold text-indigo-600 tracking-tight group-hover:scale-105 transition-transform">৳{product.adminShare}</h3>}
              </div>
              <div className="p-4 bg-white rounded-2xl shadow-sm group-hover:shadow-md transition-all text-indigo-600"><Icons.Wallet /></div>
            </div>
            {editing && (
              <div className="flex gap-4 pt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <button onClick={() => { setEditing(false); onUpdate({ name: form.name, adminShare: parseFloat(form.share), description: form.desc }); }} className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-100 active:scale-95 transition-all">Save Intelligence</button>
                <button onClick={onDelete} className="p-4 text-red-500 hover:bg-red-50 rounded-xl transition-all border border-red-100 shadow-sm"><Icons.Trash /></button>
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {isEmployee && (
        <div className="lg:col-span-1">
          <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm sticky top-4 md:top-8 transition-shadow hover:shadow-md">
            <h3 className="text-lg font-bold mb-6 tracking-tight">Cashing Out</h3>
            <div className="mb-6 p-5 bg-emerald-50 rounded-2xl border border-emerald-100">
              <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1 tracking-wider">Available Balance</p>
              <h4 className="text-2xl font-bold text-emerald-700 tracking-tight">৳{state.currentUser?.wallet.toLocaleString()}</h4>
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-emerald-100/50">
                <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-wide">Minimum: ৳200</p>
              </div>
            </div>
            <form className="space-y-4" onSubmit={e => { e.preventDefault(); onWithdraw(parseFloat(form.amount), form.method, currentAccountNum); setForm({ ...form, amount: '' }); }}>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1 uppercase tracking-wide">Transfer Amount</label>
                <input type="number" required min="200" className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none font-bold focus:bg-white focus:border-indigo-500 transition-all" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1 uppercase tracking-wide">Wallet Gateway</label>
                <select className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none font-bold focus:bg-white focus:border-indigo-500 transition-all appearance-none cursor-pointer" value={form.method} onChange={e => setForm({ ...form, method: e.target.value as any })}>
                  <option value="bKash">bKash</option>
                  <option value="Nagad">Nagad</option>
                  <option value="Rocket">Rocket</option>
                </select>
              </div>
              {!currentAccountNum && (
                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-[10px] font-bold border border-red-100 animate-pulse">
                  Setup your {form.method} number in My Profile.
                </div>
              )}
              <button disabled={!canWithdraw} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold disabled:bg-slate-200 disabled:text-slate-400 shadow-lg shadow-indigo-100 active:scale-95 transition-all mt-4">Initiate Payout</button>
            </form>
          </div>
        </div>
      )}
      <div className={`${isEmployee ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm`}>
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Withdrawal History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead>
              <tr className="bg-white border-b border-slate-100">
                {!isEmployee && <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Partner</th>}
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase text-center tracking-wider">Amount</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase text-center tracking-wider">Gateway</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Account Data</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase text-center tracking-wider">Status</th>
                {!isEmployee && <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase text-right tracking-wider">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayRequests.map(r => (
                <tr key={r.id} className="text-xs hover:bg-slate-50 transition-colors duration-200">
                  {!isEmployee && <td className="px-6 py-4 font-bold text-slate-800">{r.employeeEmail.split('@')[0]}</td>}
                  <td className="px-6 py-4 font-bold text-indigo-600 text-center">৳{r.amount}</td>
                  <td className="px-6 py-4 uppercase text-center font-bold text-slate-500">{r.method}</td>
                  <td className="px-6 py-4 font-mono text-slate-600">
                    <div className="flex flex-col">
                      <span className="font-bold">{r.accountNumber}</span>
                      <span className="text-[9px] text-slate-300 font-sans mt-0.5">{formatDateTime(r.timestamp)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2.5 py-1 rounded-lg font-bold uppercase text-[9px] border ${r.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>{r.status}</span>
                  </td>
                  {!isEmployee && (
                    <td className="px-6 py-4 text-right">
                      {r.status === 'pending' ? <button onClick={() => onComplete(r.id)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-[9px] uppercase shadow-md active:scale-95 hover:bg-indigo-700 transition-all">Mark Settled</button> : <span className="text-emerald-500 font-bold uppercase text-[9px] flex items-center justify-end gap-1"><Icons.Check /> Paid</span>}
                    </td>
                  )}
                </tr>
              ))}
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
    
    return (
      <div className="space-y-6 md:space-y-8 animate-in slide-in-from-right-4 duration-500 ease-out">
        <button onClick={() => setSelectedEmployeeId(null)} className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-indigo-600 transition-all p-2 hover:bg-white rounded-xl shadow-sm border border-transparent hover:border-indigo-100">
          <span className="text-lg">←</span> Back to Team Overview
        </button>
        <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-10 shadow-lg flex flex-col md:flex-row items-center gap-8 border-l-8 border-l-indigo-600 transition-shadow hover:shadow-xl">
          {emp?.avatar ? (
            <img src={emp.avatar} className="h-24 w-24 rounded-2xl object-cover shadow-lg ring-4 ring-indigo-50" />
          ) : (
            <div className="h-24 w-24 bg-indigo-600 rounded-2xl flex items-center justify-center text-3xl font-bold text-white uppercase shadow-xl shadow-indigo-100">
              {emp?.email.charAt(0)}
            </div>
          )}
          <div className="text-center md:text-left">
            <h3 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">{emp?.username || emp?.email.split('@')[0]}</h3>
            <p className="text-sm font-medium text-slate-400 mt-1">{emp?.email}</p>
          </div>
          <div className="md:ml-auto flex gap-4 md:gap-6 w-full md:w-auto">
             <div className="flex-1 md:flex-none bg-slate-50 px-6 py-5 rounded-2xl text-center shadow-inner border border-slate-100">
                <p className="text-[11px] font-bold text-slate-400 uppercase mb-1.5 tracking-wider">Current Wallet</p>
                <p className="text-xl md:text-2xl font-bold text-emerald-600 tracking-tight">৳{emp?.wallet.toLocaleString()}</p>
             </div>
             <div className="flex-1 md:flex-none bg-slate-50 px-6 py-5 rounded-2xl text-center shadow-inner border border-slate-100">
                <p className="text-[11px] font-bold text-slate-400 uppercase mb-1.5 tracking-wider">Total Output</p>
                <p className="text-xl md:text-2xl font-bold text-indigo-600 tracking-tight">{emp?.totalSalesCount}</p>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Sale Intelligence</h4>
            </div>
            <div className="max-h-96 overflow-y-auto scrollbar-hide">
              <table className="w-full text-left">
                <tbody className="divide-y divide-slate-100">
                  {empSales.map(s => (
                    <tr key={s.id} className="text-xs hover:bg-slate-50 transition-colors duration-150">
                      <td className="px-6 py-4 font-bold text-slate-700">
                        <div className="flex flex-col">
                           <span className="truncate max-w-[150px]">{s.productName}</span>
                           <span className="text-[9px] text-slate-300 font-medium uppercase mt-0.5">{formatDateTime(s.timestamp)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-indigo-600 text-center">৳{s.amount}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] uppercase font-bold border ${s.status === 'completed' ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-amber-600 bg-amber-50 border-amber-100'}`}>{s.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm border-t-8 border-t-indigo-600">
        <h3 className="text-lg font-bold text-slate-800 mb-6 tracking-tight">Onboard Member</h3>
        <form className="flex flex-col md:flex-row gap-4" onSubmit={e => { e.preventDefault(); onCreate(form.email, form.password); setForm({ email: '', password: '' }); }}>
          <div className="flex-1">
            <input type="email" required placeholder="Employee Email" className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none focus:bg-white focus:border-indigo-500 transition-all font-medium" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="flex-1">
            <input type="text" required placeholder="Access Key" className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none focus:bg-white focus:border-indigo-500 transition-all font-medium" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>
          <button className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-md active:scale-95 transition-all">Add Member</button>
        </form>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {employees.map(e => (
          <div key={e.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative group transition-all duration-300 hover:border-indigo-400 cursor-pointer hover:shadow-xl hover:-translate-y-1" onClick={() => setSelectedEmployeeId(e.id)}>
            <button onClick={(event) => { event.stopPropagation(); onDelete(e.id); }} className="absolute top-4 right-4 text-slate-200 hover:text-red-500 transition-colors z-10 p-2 hover:bg-red-50 rounded-xl"><Icons.Trash /></button>
            <div className="flex items-center gap-4 mb-6">
              {e.avatar ? <img src={e.avatar} className="h-14 w-14 rounded-xl object-cover shadow-sm ring-2 ring-indigo-50" /> : <div className="h-14 w-14 bg-indigo-600 rounded-xl flex items-center justify-center text-xl font-bold text-white uppercase shadow-lg shadow-indigo-100">{e.email.charAt(0)}</div>}
              <div className="overflow-hidden">
                <p className="font-bold text-slate-800 truncate tracking-tight">{e.username || e.email.split('@')[0]}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{e.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-slate-50 pt-5">
              <div className="bg-slate-50 p-3 rounded-xl text-center shadow-inner">
                <p className="text-[8px] font-bold text-slate-400 uppercase mb-1 tracking-wider">Output</p>
                <p className="text-base font-bold text-indigo-600 tracking-tight">{e.totalSalesCount}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl text-center shadow-inner">
                <p className="text-[8px] font-bold text-slate-400 uppercase mb-1 tracking-wider">Balance</p>
                <p className="text-base font-bold text-emerald-600 tracking-tight">৳{e.wallet.toLocaleString()}</p>
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
    <div className="max-w-3xl mx-auto space-y-6 md:space-y-8 animate-in fade-in duration-500">
      {isAdmin && (
        <div className="bg-white p-6 md:p-10 rounded-3xl border border-slate-200 shadow-lg border-t-8 border-t-indigo-600">
          <h3 className="text-xl font-bold mb-8 tracking-tight flex items-center gap-3">
             <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><Icons.Speakerphone /></div>
             Global Broadcast
          </h3>
          <form className="space-y-5" onSubmit={e => { e.preventDefault(); onAdd(form.title, form.content); setForm({ title: '', content: '' }); }}>
            <div>
               <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Subject Line</label>
               <input type="text" required placeholder="Urgent: System Update..." className="w-full px-5 py-3 rounded-xl border border-slate-200 outline-none font-bold shadow-sm focus:border-indigo-500 transition-all bg-slate-50 focus:bg-white" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
               <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Broadcast Message</label>
               <textarea required placeholder="Compose your message to the team..." className="w-full h-40 px-5 py-4 rounded-2xl border border-slate-200 outline-none resize-none text-sm shadow-sm focus:border-indigo-500 transition-all leading-relaxed bg-slate-50 focus:bg-white font-medium" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}></textarea>
            </div>
            <button className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-3 shadow-xl shadow-indigo-100 active:scale-[0.98] transition-all hover:bg-indigo-700">
              Publish Announcement
            </button>
          </form>
        </div>
      )}
      <div className="space-y-5">
        {state.announcements.slice().reverse().map(a => (
          <div key={a.id} className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm border-l-[6px] border-l-indigo-600 group hover:shadow-md transition-all animate-in slide-in-from-bottom-2 duration-300">
            <div className="flex justify-between items-start mb-4">
              <h4 className="font-bold text-slate-800 text-base md:text-lg tracking-tight group-hover:text-indigo-600 transition-colors">{a.title}</h4>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md uppercase tracking-wider">{formatDateTime(a.timestamp)}</span>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap font-medium">{a.content}</p>
          </div>
        ))}
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
    <div className="max-w-2xl mx-auto space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <div className="bg-white rounded-3xl p-8 md:p-12 shadow-xl border border-slate-200 flex flex-col items-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600"></div>
        <div className="relative group cursor-pointer w-32 h-32 md:w-36 md:h-36 mb-8 active:scale-95 transition-all" onClick={() => document.getElementById('av-up')?.click()}>
          {avatar ? (
            <img src={avatar} className="w-full h-full rounded-3xl object-cover ring-4 ring-white shadow-2xl transition-transform duration-500 group-hover:scale-105" />
          ) : (
            <div className="w-full h-full bg-indigo-600 rounded-3xl flex items-center justify-center text-white text-5xl font-bold shadow-2xl shadow-indigo-100">
               {username.charAt(0) || user.email.charAt(0)}
            </div>
          )}
          <div className="absolute inset-0 bg-indigo-600/40 rounded-3xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-[2px]">
            <div className="bg-white p-2 rounded-lg text-indigo-600 shadow-lg"><Icons.Plus /></div>
          </div>
          <input type="file" id="av-up" className="hidden" accept="image/*" onChange={handleAvatarChange} />
        </div>
        <div className="w-full space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase block mb-2 tracking-widest ml-1">Secure Email</label>
              <div className="px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-400 text-xs font-bold truncate shadow-inner">{user.email}</div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase block mb-2 tracking-widest ml-1">Workspace Alias</label>
              <input type="text" className="w-full px-5 py-3 bg-white border border-slate-200 rounded-xl outline-none font-bold text-sm shadow-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all" value={username} onChange={e => setUsername(e.target.value)} placeholder="User ID" />
            </div>
          </div>
        </div>
      </div>
      
      {user.role === 'employee' && (
        <div className="bg-white rounded-3xl p-8 md:p-10 shadow-lg border border-slate-200">
          <h3 className="text-[12px] font-bold text-slate-800 uppercase tracking-[0.2em] mb-8 border-b border-slate-100 pb-4 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
            Financial Gateways
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1">bKash</label>
              <input type="text" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold shadow-inner" placeholder="01XXXXXXXXX" value={paymentAccounts.bKash} onChange={e => setPaymentAccounts({ ...paymentAccounts, bKash: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1">Nagad</label>
              <input type="text" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold shadow-inner" placeholder="01XXXXXXXXX" value={paymentAccounts.Nagad} onChange={e => setPaymentAccounts({ ...paymentAccounts, Nagad: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1">Rocket</label>
              <input type="text" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold shadow-inner" placeholder="01XXXXXXXXX" value={paymentAccounts.Rocket} onChange={e => setPaymentAccounts({ ...paymentAccounts, Rocket: e.target.value })} />
            </div>
          </div>
        </div>
      )}
      
      <button 
        onClick={() => onUpdate(username, avatar, paymentAccounts)} 
        className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-indigo-100 active:scale-[0.98] hover:bg-indigo-700 transition-all duration-300"
      >
        Synchronize MariaDB Profile
      </button>
    </div>
  );
};

export default App;
