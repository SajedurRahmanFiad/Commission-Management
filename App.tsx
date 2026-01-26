
import React, { useState, useEffect, useCallback } from 'react';
import { User, Sale, Role, AppState, AppNotification, Product, Announcement } from './types';
import { Icons, ADMIN_FEE_DEFAULT } from './constants';
import Layout from './components/Layout';
import { generateApprovalEmail } from './services/geminiService';

const STORAGE_KEY = 'commission_pro_super_v3';

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
    <div className={`fixed bottom-8 right-8 z-[100] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right-10 duration-300 font-bold ${styles[type]}`}>
      {type === 'success' && <Icons.Check />}
      <span>{message}</span>
      <button onClick={onClose} className="opacity-50 hover:opacity-100">✕</button>
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
        { id: '1', email: 'admin@system.com', password: 'admin', role: 'admin', wallet: 0, totalSalesCount: 0 }
      ],
      sales: [],
      products: [
        { id: 'p1', name: 'Premium Service A', adminShare: 400 },
        { id: 'p2', name: 'Starter Pack B', adminShare: 200 }
      ],
      announcements: [],
      adminWallet: 0,
      notifications: []
    };
  });

  const [activeTab, setActiveTab] = useState('dashboard');
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
      showToast('Welcome back!', 'success');
    } else {
      setLoginError('Invalid login details.');
    }
  };

  const handleLogout = () => {
    setState(prev => ({ ...prev, currentUser: null }));
    setActiveTab('dashboard');
    showToast('Logged out successfully');
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
      message: `Sale alert: ${state.currentUser.username || state.currentUser.email} added a sale for ${product.name}`,
      timestamp: new Date().toISOString(),
      read: false,
      type: 'sale'
    };

    setState(prev => ({
      ...prev,
      sales: [newSale, ...prev.sales],
      notifications: [notif, ...prev.notifications]
    }));
    showToast('Sale submitted for review!', 'success');
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
        adminWallet: prev.adminWallet + adminShare
      };
    });
    showToast('Sale completed successfully!', 'success');
  };

  const deleteEmployee = (id: string) => {
    if (window.confirm("Are you sure you want to remove this team member?")) {
      setState(prev => ({ ...prev, users: prev.users.filter(u => u.id !== id) }));
      showToast('Member removed from team', 'error');
    }
  };

  const addProduct = (name: string, adminShare: number) => {
    const newProduct = { id: Math.random().toString(), name, adminShare };
    setState(prev => ({ ...prev, products: [...prev.products, newProduct] }));
    showToast('Product added', 'success');
  };

  const addAnnouncement = (title: string, content: string) => {
    const newAnn = { id: Math.random().toString(), title, content, timestamp: new Date().toISOString() };
    const notif: AppNotification = {
      id: Math.random().toString(),
      message: `Important: New Announcement posted by Admin`,
      timestamp: new Date().toISOString(),
      read: false,
      type: 'announcement'
    };
    setState(prev => ({
      ...prev,
      announcements: [newAnn, ...prev.announcements],
      notifications: [notif, ...prev.notifications]
    }));
    showToast('Announcement posted!', 'info');
  };

  const updateProfile = (username: string, avatar: string) => {
    setState(prev => ({
      ...prev,
      currentUser: { ...prev.currentUser!, username, avatar },
      users: prev.users.map(u => u.id === prev.currentUser?.id ? { ...u, username, avatar } : u)
    }));
    showToast('Profile updated!', 'success');
  };

  if (!state.currentUser) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 border border-slate-200 animate-in fade-in zoom-in duration-300">
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-white text-4xl font-black mx-auto mb-6 shadow-2xl shadow-indigo-200">C</div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">CommishPro</h2>
            <p className="mt-2 text-slate-400 font-medium">Log in to your dashboard</p>
          </div>
          <form className="space-y-5" onSubmit={handleLogin}>
            {loginError && <p className="text-red-500 text-xs font-bold text-center bg-red-50 p-3 rounded-xl border border-red-100">{loginError}</p>}
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-500 uppercase ml-1">Email</label>
              <input type="email" required className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all" value={loginForm.email} onChange={e => setLoginForm({ ...loginForm, email: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-500 uppercase ml-1">Password</label>
              <input type="password" required className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all" value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} />
            </div>
            <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-100 font-black hover:bg-indigo-700 transition-all active:scale-95">Sign In</button>
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
      setActiveTab={setActiveTab}
      notifications={state.notifications}
      onClearNotifications={() => setState(p => ({ ...p, notifications: [] }))}
    >
      {activeTab === 'dashboard' && <DashboardView state={state} onApprove={approveSale} onCreateSale={createSale} />}
      {activeTab === 'products' && <ProductView state={state} onAdd={addProduct} />}
      {activeTab === 'employees' && state.currentUser.role === 'admin' && <TeamHubView state={state} onCreate={(e, p) => {
        const newUser: User = { id: Math.random().toString(36).substr(2, 9), email: e, password: p, role: 'employee', wallet: 0, totalSalesCount: 0 };
        setState(prev => ({ ...prev, users: [...prev.users, newUser] }));
        showToast('Member added!', 'success');
      }} onDelete={deleteEmployee} />}
      {activeTab === 'announcements' && <AnnouncementView state={state} onAdd={addAnnouncement} />}
      {activeTab === 'profile' && <ProfileView user={state.currentUser} onUpdate={updateProfile} />}

      {toasts.map(t => (
        <Toast key={t.id} message={t.message} type={t.type} onClose={() => setToasts(prev => prev.filter(x => x.id !== t.id))} />
      ))}
    </Layout>
  );
};

// --- View Components ---

const DashboardView: React.FC<{ state: AppState; onApprove: (id: string) => void; onCreateSale: (e: string, p: string, a: number, pr: string, m: any) => void }> = ({ state, onApprove, onCreateSale }) => {
  const [showModal, setShowModal] = useState(false);
  const isEmployee = state.currentUser?.role === 'employee';
  const currentUserData = state.users.find(u => u.id === state.currentUser?.id);
  const displaySales = isEmployee ? state.sales.filter(s => s.employeeId === state.currentUser?.id) : state.sales;

  const [formData, setFormData] = useState({ email: '', phone: '', amount: '', productId: '', method: 'bKash' as any });

  const stats = isEmployee ? [
    { label: 'Your Earnings', val: `৳${currentUserData?.wallet.toLocaleString()}`, color: 'text-emerald-500', icon: Icons.Wallet },
    { label: 'Sales Done', val: currentUserData?.totalSalesCount || 0, color: 'text-indigo-500', icon: Icons.Check },
    { label: 'Waiting', val: displaySales.filter(s => s.status === 'pending').length, color: 'text-amber-500', icon: Icons.Dashboard }
  ] : [
    { label: 'Total Revenue', val: `৳${state.adminWallet.toLocaleString()}`, color: 'text-emerald-500', icon: Icons.Wallet },
    { label: 'Sales Count', val: state.sales.length, color: 'text-indigo-500', icon: Icons.Sales },
    { label: 'Pending Task', val: state.sales.filter(s => s.status === 'pending').length, color: 'text-amber-500', icon: Icons.Bell }
  ];

  return (
    <div className="space-y-10">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Main Hub</h2>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Operational Overview</p>
        </div>
        <button onClick={() => setShowModal(true)} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2 active:scale-95">
          <Icons.Plus /> Add New Sale
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((s, i) => (
          <div key={i} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-6">
            <div className={`p-4 rounded-2xl bg-slate-50 ${s.color}`}><s.icon /></div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
              <h3 className="text-3xl font-black text-slate-800 tracking-tight">{s.val}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
          <h3 className="text-lg font-black text-slate-800">Sales Records</h3>
          <span className="px-3 py-1 bg-white rounded-lg text-[10px] font-black text-slate-400 border border-slate-100">{displaySales.length} Total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/30">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Agent</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Payment</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Product</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                {!isEmployee && <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {displaySales.map(sale => (
                <tr key={sale.id} className="hover:bg-indigo-50/30 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-slate-800">{sale.employeeEmail.split('@')[0]}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">ID: {sale.employeeId}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <span className="px-3 py-1 bg-slate-100 rounded-lg text-[10px] font-black text-slate-600">{sale.paymentMethod}</span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-700">{sale.customerEmail}</span>
                      <span className="text-[11px] font-medium text-slate-400">{sale.customerPhone}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-sm font-bold text-slate-800">{sale.productName}</span>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-base font-black text-indigo-600">৳{sale.amount}</span>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2 ${sale.status === 'completed' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-amber-100 text-amber-700 border border-amber-200 animate-pulse'}`}>
                      {sale.status === 'completed' && <Icons.Check />}
                      {sale.status}
                    </span>
                  </td>
                  {!isEmployee && (
                    <td className="px-8 py-6 text-right">
                      {sale.status === 'pending' ? (
                        <button onClick={() => onApprove(sale.id)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-lg hover:bg-indigo-700 transition-all active:scale-90">Verify</button>
                      ) : <span className="text-xs font-black text-emerald-500 uppercase">Verified</span>}
                    </td>
                  )}
                </tr>
              ))}
              {displaySales.length === 0 && (
                <tr><td colSpan={10} className="p-20 text-center italic text-slate-300 font-bold">No records to display</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-xl rounded-3xl p-10 shadow-2xl animate-in zoom-in duration-300">
            <h4 className="text-2xl font-black text-slate-900 mb-8 flex items-center gap-3">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><Icons.Plus /></div>
              Enter Sale Details
            </h4>
            <form className="grid grid-cols-1 md:grid-cols-2 gap-6" onSubmit={e => {
              e.preventDefault();
              onCreateSale(formData.email, formData.phone, parseFloat(formData.amount), formData.productId, formData.method);
              setShowModal(false);
              setFormData({ email: '', phone: '', amount: '', productId: '', method: 'bKash' });
            }}>
              <div className="md:col-span-2 space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Customer Email</label>
                <input type="email" required className="w-full px-5 py-3.5 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white outline-none" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                <input type="text" required className="w-full px-5 py-3.5 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white outline-none" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sale Amount</label>
                <input type="number" required className="w-full px-5 py-3.5 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white outline-none font-bold" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Product</label>
                <select required className="w-full px-5 py-3.5 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white outline-none font-bold" value={formData.productId} onChange={e => setFormData({ ...formData, productId: e.target.value })}>
                  <option value="">- Pick One -</option>
                  {state.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Payment via</label>
                <select required className="w-full px-5 py-3.5 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white outline-none font-bold" value={formData.method} onChange={e => setFormData({ ...formData, method: e.target.value as any })}>
                  <option value="bKash">bKash</option>
                  <option value="Nagad">Nagad</option>
                  <option value="Rocket">Rocket</option>
                </select>
              </div>
              <div className="md:col-span-2 pt-6 flex gap-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 text-slate-400 font-bold hover:bg-slate-50 rounded-2xl transition-all">Cancel</button>
                <button type="submit" className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 active:scale-95 transition-all">Record Transaction</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const ProductView: React.FC<{ state: AppState; onAdd: (n: string, s: number) => void }> = ({ state, onAdd }) => {
  const isAdmin = state.currentUser?.role === 'admin';
  const [form, setForm] = useState({ name: '', share: '' });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
      {isAdmin && (
        <div className="lg:col-span-1">
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm sticky top-10">
            <h3 className="text-2xl font-black mb-8">Catalog Management</h3>
            <form className="space-y-5" onSubmit={e => { e.preventDefault(); onAdd(form.name, parseFloat(form.share)); setForm({ name: '', share: '' }); }}>
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase ml-1">Product Name</label>
                <input type="text" required placeholder="Ex: Unlimited Storage" className="w-full px-5 py-3.5 rounded-xl bg-slate-50 border border-slate-100 focus:bg-white outline-none" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase ml-1">Admin Share (BDT)</label>
                <input type="number" required placeholder="400" className="w-full px-5 py-3.5 rounded-xl bg-slate-50 border border-slate-100 focus:bg-white outline-none font-bold" value={form.share} onChange={e => setForm({ ...form, share: e.target.value })} />
              </div>
              <button className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black shadow-lg shadow-indigo-50 hover:bg-indigo-700 transition-all">Update Catalog</button>
            </form>
          </div>
        </div>
      )}
      <div className={`${isAdmin ? 'lg:col-span-2' : 'lg:col-span-3'} grid grid-cols-1 md:grid-cols-2 gap-6`}>
        {state.products.map(p => (
          <div key={p.id} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex justify-between items-center group hover:border-indigo-200 transition-all">
            <div>
              <h4 className="text-xl font-black text-slate-800">{p.name}</h4>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Item ID: {p.id}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Company Share</p>
              <span className="text-2xl font-black text-indigo-600">৳{p.adminShare}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const TeamHubView: React.FC<{ state: AppState; onCreate: (e: string, p: string) => void; onDelete: (id: string) => void }> = ({ state, onCreate, onDelete }) => {
  const [form, setForm] = useState({ email: '', password: '' });
  const employees = state.users.filter(u => u.role === 'employee');

  return (
    <div className="space-y-10">
      <div className="bg-white p-10 rounded-3xl border border-slate-100 shadow-sm">
        <h3 className="text-2xl font-black text-slate-800 mb-8">Onboard Team</h3>
        <form className="flex flex-col md:flex-row gap-6" onSubmit={e => { e.preventDefault(); onCreate(form.email, form.password); setForm({ email: '', password: '' }); }}>
          <div className="flex-1 space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
            <input type="email" required placeholder="member@company.com" className="w-full px-5 py-3.5 rounded-xl bg-slate-50 border border-slate-100 focus:bg-white outline-none" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
            <input type="text" required placeholder="Permanent Password" className="w-full px-5 py-3.5 rounded-xl bg-slate-50 border border-slate-100 focus:bg-white outline-none font-bold" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>
          <button className="md:w-64 mt-5 md:mt-0 py-4 bg-indigo-600 text-white rounded-xl font-black shadow-xl shadow-indigo-50 active:scale-95 transition-all">Add to Workspace</button>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {employees.map(e => (
          <div key={e.id} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative group hover:shadow-xl transition-all">
            <button onClick={() => onDelete(e.id)} className="absolute top-6 right-6 p-2 text-slate-200 hover:text-red-500 transition-colors"><Icons.Trash /></button>
            <div className="flex items-center gap-5 mb-8">
              {e.avatar ? <img src={e.avatar} className="h-16 w-16 rounded-2xl object-cover shadow-lg" /> : <div className="h-16 w-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-2xl font-black text-indigo-600">{e.email.charAt(0).toUpperCase()}</div>}
              <div className="overflow-hidden">
                <p className="text-lg font-black text-slate-800 truncate">{e.username || e.email}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{e.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-slate-50 pt-6">
              <div className="bg-slate-50/50 p-4 rounded-2xl text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Sales Done</p>
                <p className="text-xl font-black text-indigo-600">{e.totalSalesCount}</p>
              </div>
              <div className="bg-slate-50/50 p-4 rounded-2xl text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Net Earnings</p>
                <p className="text-xl font-black text-emerald-600">৳{e.wallet.toLocaleString()}</p>
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
    <div className="max-w-4xl mx-auto space-y-10">
      {isAdmin && (
        <div className="bg-white p-10 rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="text-2xl font-black mb-8">Post Announcement</h3>
          <form className="space-y-6" onSubmit={e => { e.preventDefault(); onAdd(form.title, form.content); setForm({ title: '', content: '' }); }}>
            <input type="text" required placeholder="Announcement Subject" className="w-full px-6 py-4 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white outline-none font-black" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            <textarea required placeholder="Write your message here..." className="w-full h-40 px-6 py-4 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white outline-none font-medium resize-none" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}></textarea>
            <button className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 active:scale-95 transition-all flex items-center justify-center gap-3">
              <Icons.Speakerphone /> Broadcast to Team
            </button>
          </form>
        </div>
      )}

      <div className="space-y-6">
        {state.announcements.map(a => (
          <div key={a.id} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm border-l-8 border-l-indigo-600">
            <div className="flex justify-between items-start mb-4">
              <h4 className="text-xl font-black text-slate-900">{a.title}</h4>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(a.timestamp).toLocaleDateString()}</span>
            </div>
            <p className="text-slate-600 leading-relaxed font-medium">{a.content}</p>
          </div>
        ))}
        {state.announcements.length === 0 && <div className="text-center py-20 italic text-slate-400 font-bold">No announcements yet.</div>}
      </div>
    </div>
  );
};

const ProfileView: React.FC<{ user: User; onUpdate: (u: string, a: string) => void }> = ({ user, onUpdate }) => {
  const [username, setUsername] = useState(user.username || '');
  const [avatar, setAvatar] = useState(user.avatar || '');

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setAvatar(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-[40px] p-12 shadow-sm border border-slate-100">
      <div className="flex flex-col items-center mb-12">
        <div className="relative group cursor-pointer w-40 h-40 mb-6" onClick={() => document.getElementById('avatar-input')?.click()}>
          {avatar ? (
            <img src={avatar} className="w-full h-full rounded-[48px] object-cover ring-8 ring-indigo-50 shadow-2xl" />
          ) : (
            <div className="w-full h-full bg-indigo-600 rounded-[48px] flex items-center justify-center text-white text-5xl font-black shadow-2xl shadow-indigo-100">
              {username.charAt(0) || user.email.charAt(0)}
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 rounded-[48px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all backdrop-blur-[2px]">
            <Icons.Plus />
          </div>
          <input type="file" id="avatar-input" className="hidden" accept="image/*" onChange={handleAvatarChange} />
        </div>
        <h3 className="text-2xl font-black text-slate-900 tracking-tight">Identity & Profile</h3>
      </div>

      <div className="space-y-6">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Login Email (Read Only)</label>
          <div className="px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-400 font-bold italic">{user.email}</div>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Display Username</label>
          <input type="text" className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-50 outline-none font-bold" value={username} onChange={e => setUsername(e.target.value)} placeholder="How others see you" />
        </div>
        <button onClick={() => onUpdate(username, avatar)} className="w-full py-5 bg-indigo-600 text-white rounded-3xl font-black shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95">Save Identity</button>
      </div>
    </div>
  );
};

export default App;
