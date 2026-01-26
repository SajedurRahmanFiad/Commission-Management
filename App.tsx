
import React, { useState, useEffect } from 'react';
import { User, Sale, Role, AppState, AppNotification } from './types';
import { ADMIN_FEE, Icons } from './constants';
import Layout from './components/Layout';
import { generateApprovalEmail } from './services/geminiService';

const STORAGE_KEY = 'commission_manager_pro_v2';

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
      adminWallet: 0,
      notifications: []
    };
  });

  const [activeTab, setActiveTab] = useState('dashboard');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = state.users.find(u => u.email === loginForm.email && u.password === loginForm.password);
    if (user) {
      setState(prev => ({ ...prev, currentUser: user }));
      setLoginError('');
    } else {
      setLoginError('Invalid credentials. Check your email and password.');
    }
  };

  const handleLogout = () => {
    setState(prev => ({ ...prev, currentUser: null }));
    setActiveTab('dashboard');
  };

  const updateProfile = (username: string, avatar: string) => {
    if (!state.currentUser) return;
    setState(prev => ({
      ...prev,
      currentUser: { ...prev.currentUser!, username, avatar },
      users: prev.users.map(u => u.id === prev.currentUser?.id ? { ...u, username, avatar } : u)
    }));
    alert('Profile updated successfully!');
  };

  const createEmployee = (email: string, password: string) => {
    if (state.users.find(u => u.email === email)) {
      alert('Email already exists!');
      return;
    }
    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      email,
      password, // Now explicitly treated as the permanent password
      role: 'employee',
      wallet: 0,
      totalSalesCount: 0
    };
    setState(prev => ({ ...prev, users: [...prev.users, newUser] }));
  };

  const createSale = (customerEmail: string, customerPhone: string, amount: number) => {
    if (!state.currentUser) return;
    const newSale: Sale = {
      id: Math.random().toString(36).substr(2, 9),
      employeeId: state.currentUser.id,
      employeeEmail: state.currentUser.email,
      customerEmail,
      customerPhone,
      amount,
      status: 'pending',
      timestamp: new Date().toISOString()
    };

    const isEmployee = state.currentUser.role === 'employee';
    const notification: AppNotification | null = isEmployee ? {
      id: Math.random().toString(36).substr(2, 9),
      message: `New sale created by ${state.currentUser.username || state.currentUser.email} for BDT ${amount}`,
      timestamp: new Date().toISOString(),
      read: false
    } : null;

    setState(prev => ({
      ...prev,
      sales: [newSale, ...prev.sales],
      notifications: notification ? [notification, ...prev.notifications] : prev.notifications
    }));
    alert('Transaction recorded and pending approval.');
  };

  const approveSale = async (saleId: string) => {
    // Correctly using functional state to ensure all calculated fields use the latest snapshot
    setState(prev => {
      const sale = prev.sales.find(s => s.id === saleId);
      if (!sale || sale.status === 'approved') return prev;

      const employeeCommission = sale.amount - ADMIN_FEE;
      
      const updatedSales = prev.sales.map(s => 
        s.id === saleId ? { ...s, status: 'approved' as const, approvedAt: new Date().toISOString() } : s
      );
      
      const updatedUsers = prev.users.map(u => {
        if (u.id === sale.employeeId) {
          return {
            ...u,
            wallet: u.wallet + employeeCommission,
            totalSalesCount: u.totalSalesCount + 1
          };
        }
        return u;
      });

      return {
        ...prev,
        sales: updatedSales,
        users: updatedUsers,
        adminWallet: prev.adminWallet + ADMIN_FEE
      };
    });

    // Handle email generation separately without blocking state update
    const sale = state.sales.find(s => s.id === saleId);
    if (sale) {
      generateApprovalEmail(sale.customerEmail, sale.amount).then(content => {
        console.log(`Email content generated for ${sale.customerEmail}:`, content);
      });
    }
  };

  const clearNotifications = () => {
    setState(prev => ({ ...prev, notifications: [] }));
  };

  if (!state.currentUser) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 space-y-8 border border-slate-200">
          <div className="text-center">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4 shadow-lg">C</div>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Commission Pro</h2>
            <p className="mt-2 text-slate-500">Log in to your workspace</p>
          </div>
          <form className="space-y-6" onSubmit={handleLogin}>
            {loginError && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg border border-red-100">{loginError}</p>}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="you@company.com"
                value={loginForm.email}
                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Password</label>
              <input
                type="password"
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="••••••••"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              />
            </div>
            <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-xl shadow-md font-bold hover:bg-indigo-700 transition-all">
              Sign In
            </button>
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
    >
      {activeTab === 'dashboard' && <DashboardView state={state} onClearNotifications={clearNotifications} setActiveTab={setActiveTab} />}
      {activeTab === 'sales' && <SalesView state={state} onCreateSale={createSale} onApproveSale={approveSale} />}
      {activeTab === 'employees' && state.currentUser.role === 'admin' && <EmployeeHubView state={state} onCreateEmployee={createEmployee} />}
      {activeTab === 'profile' && <ProfileView user={state.currentUser} onUpdate={updateProfile} />}
    </Layout>
  );
};

// --- Sub-components ---

const DashboardView: React.FC<{ state: AppState; onClearNotifications: () => void; setActiveTab: (t: string) => void }> = ({ state, onClearNotifications, setActiveTab }) => {
  const isEmployee = state.currentUser?.role === 'employee';
  const currentUserData = state.users.find(u => u.id === state.currentUser?.id);

  const stats = isEmployee ? [
    { label: 'My Earnings', value: `৳${currentUserData?.wallet.toLocaleString()}`, icon: Icons.Wallet, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Total Orders', value: currentUserData?.totalSalesCount || 0, icon: Icons.Sales, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Wait Approval', value: state.sales.filter(s => s.employeeId === state.currentUser?.id && s.status === 'pending').length, icon: Icons.Dashboard, color: 'text-amber-600', bg: 'bg-amber-50' },
  ] : [
    { label: 'Admin Wallet', value: `৳${state.adminWallet.toLocaleString()}`, icon: Icons.Wallet, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Platform Sales', value: state.sales.length, icon: Icons.Sales, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Pending Task', value: state.sales.filter(s => s.status === 'pending').length, icon: Icons.Dashboard, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Active Members', value: state.users.filter(u => u.role === 'employee').length, icon: Icons.Users, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold text-slate-800">Welcome, {state.currentUser?.username || state.currentUser?.email}</h3>
        {isEmployee && (
          <button 
            onClick={() => setActiveTab('sales')}
            className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all active:scale-95"
          >
            <Icons.Plus /> Quick Add Sale
          </button>
        )}
      </div>

      {!isEmployee && state.notifications.length > 0 && (
        <div className="bg-indigo-600 rounded-2xl p-6 text-white relative overflow-hidden shadow-xl">
          <div className="relative z-10 flex justify-between items-center">
            <div>
              <h4 className="text-xl font-bold flex items-center gap-2">
                <Icons.Bell /> Recent Team Alerts
              </h4>
              <p className="mt-1 opacity-90">There are {state.notifications.length} new activities from your team members.</p>
            </div>
            <button onClick={onClearNotifications} className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-bold transition-all">
              Clear All
            </button>
          </div>
          <div className="mt-4 space-y-2 max-h-40 overflow-y-auto pr-2">
            {state.notifications.map(n => (
              <div key={n.id} className="bg-white/10 p-3 rounded-lg text-sm flex justify-between items-center">
                <span>{n.message}</span>
                <span className="text-[10px] opacity-60">{new Date(n.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-5">
            <div className={`p-4 rounded-xl ${stat.bg} ${stat.color}`}><stat.icon /></div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
              <h3 className="text-2xl font-black text-slate-800">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100"><h3 className="font-bold text-slate-800">Recent Transactions</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Customer Email</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Amount</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {state.sales.slice(0, 5).map(sale => (
                <tr key={sale.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-slate-700 font-medium">{sale.customerEmail}</td>
                  <td className="px-6 py-4 font-bold text-indigo-600">৳{sale.amount}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${sale.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{sale.status}</span>
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-right">{new Date(sale.timestamp).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const SalesView: React.FC<{ state: AppState; onCreateSale: (e: string, p: string, a: number) => void; onApproveSale: (id: string) => void }> = ({ state, onCreateSale, onApproveSale }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ customerEmail: '', customerPhone: '', amount: '' });

  const isEmployee = state.currentUser?.role === 'employee';
  const displaySales = isEmployee ? state.sales.filter(s => s.employeeId === state.currentUser?.id) : state.sales;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateSale(formData.customerEmail, formData.customerPhone, parseFloat(formData.amount));
    setIsModalOpen(false);
    setFormData({ customerEmail: '', customerPhone: '', amount: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><h3 className="text-xl font-bold text-slate-800">History & Management</h3></div>
        <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-lg">
          <Icons.Plus /> Add New Sale
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {!isEmployee && <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase">Agent</th>}
              <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase">Customer</th>
              <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase text-center">Banking Mobile</th>
              <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase">Amount</th>
              <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase text-center">Verification</th>
              {!isEmployee && <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase text-right">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displaySales.map(sale => (
              <tr key={sale.id} className="hover:bg-slate-50">
                {!isEmployee && <td className="px-6 py-4 text-sm font-medium text-slate-700">{sale.employeeEmail.split('@')[0]}</td>}
                <td className="px-6 py-4 text-sm text-slate-700">{sale.customerEmail}</td>
                <td className="px-6 py-4 text-sm text-slate-600 text-center">{sale.customerPhone}</td>
                <td className="px-6 py-4 text-sm font-bold">৳{sale.amount}</td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase inline-flex items-center gap-1 ${sale.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {sale.status === 'approved' && <Icons.Check />}{sale.status}
                  </span>
                </td>
                {!isEmployee && (
                  <td className="px-6 py-4 text-right">
                    {sale.status === 'pending' ? (
                      <button onClick={() => onApproveSale(sale.id)} className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-md">Approve</button>
                    ) : <span className="text-xs text-slate-400 font-medium">Done</span>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <h4 className="text-xl font-bold mb-6">Enter Payment Details</h4>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="email" required placeholder="Customer Email" className="w-full px-4 py-2.5 border rounded-xl" value={formData.customerEmail} onChange={e => setFormData({ ...formData, customerEmail: e.target.value })} />
              <input type="text" required placeholder="Mobile Number (Banking)" className="w-full px-4 py-2.5 border rounded-xl" value={formData.customerPhone} onChange={e => setFormData({ ...formData, customerPhone: e.target.value })} />
              <input type="number" required min={ADMIN_FEE+1} placeholder="Sale Amount" className="w-full px-4 py-2.5 border rounded-xl" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
              <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all">Submit Sale</button>
              <button type="button" onClick={() => setIsModalOpen(false)} className="w-full py-2 text-slate-400 font-medium">Cancel</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const EmployeeHubView: React.FC<{ state: AppState; onCreateEmployee: (e: string, p: string) => void }> = ({ state, onCreateEmployee }) => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const employees = state.users.filter(u => u.role === 'employee');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1">
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <h3 className="text-xl font-bold mb-6 text-slate-800">Add Team Member</h3>
          <form onSubmit={e => { e.preventDefault(); onCreateEmployee(formData.email, formData.password); setFormData({ email: '', password: '' }); }} className="space-y-4">
            <input type="email" required placeholder="Email" className="w-full px-4 py-2.5 border rounded-xl" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
            <input type="text" required placeholder="Permanent Password" className="w-full px-4 py-2.5 border rounded-xl" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
            <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-md">Add to Team</button>
          </form>
        </div>
      </div>
      <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {employees.map(emp => (
          <div key={emp.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              {emp.avatar ? <img src={emp.avatar} className="h-10 w-10 rounded-full object-cover" /> : <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center font-bold">{emp.email.charAt(0).toUpperCase()}</div>}
              <div><p className="font-bold text-slate-800">{emp.username || emp.email}</p><p className="text-[10px] text-slate-400">UID: {emp.id}</p></div>
            </div>
            <div className="flex justify-between border-t pt-3 mt-3">
              <div className="text-center flex-1 border-r"><p className="text-[10px] font-bold text-slate-400 uppercase">Sales</p><p className="font-black text-indigo-600">{emp.totalSalesCount}</p></div>
              <div className="text-center flex-1"><p className="text-[10px] font-bold text-slate-400 uppercase">Earned</p><p className="font-black text-emerald-600">৳{emp.wallet.toLocaleString()}</p></div>
            </div>
          </div>
        ))}
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
    <div className="max-w-xl mx-auto bg-white rounded-3xl shadow-sm border p-8">
      <h3 className="text-2xl font-black text-slate-800 mb-8">Personal Details</h3>
      <div className="space-y-8">
        <div className="flex flex-col items-center gap-4">
          <div className="relative group cursor-pointer" onClick={() => document.getElementById('avatar-upload')?.click()}>
            {avatar ? <img src={avatar} className="h-32 w-32 rounded-3xl object-cover ring-4 ring-indigo-50" /> : <div className="h-32 w-32 bg-indigo-50 rounded-3xl flex items-center justify-center text-indigo-600 text-4xl font-black">{username.charAt(0) || user.email.charAt(0)}</div>}
            <div className="absolute inset-0 bg-black/40 rounded-3xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Icons.Plus />
            </div>
          </div>
          <input type="file" id="avatar-upload" className="hidden" accept="image/*" onChange={handleAvatarChange} />
          <p className="text-sm font-medium text-slate-400">Click to change picture</p>
        </div>
        <div className="space-y-4">
          <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Email Address (Login)</label><div className="px-4 py-3 bg-slate-50 border rounded-xl text-slate-400 font-medium">{user.email}</div></div>
          <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">User Handle / Name</label><input type="text" placeholder="e.g. John Doe" className="w-full px-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" value={username} onChange={e => setUsername(e.target.value)} /></div>
          <button onClick={() => onUpdate(username, avatar)} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all">Save Changes</button>
        </div>
      </div>
    </div>
  );
};

export default App;
