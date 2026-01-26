
import React, { useState, useEffect, useCallback } from 'react';
import { User, Sale, Role, AppState } from './types';
import { ADMIN_FEE, Icons } from './constants';
import Layout from './components/Layout';
import { generateApprovalEmail } from './services/geminiService';

const STORAGE_KEY = 'commission_manager_data';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
    // Default initial state
    return {
      currentUser: null,
      users: [
        { id: '1', email: 'admin@system.com', password: 'admin', role: 'admin', wallet: 0, totalSalesCount: 0 }
      ],
      sales: [],
      adminWallet: 0,
    };
  });

  const [activeTab, setActiveTab] = useState('dashboard');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');
  
  // Persistence Effect
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

  const createEmployee = (email: string, password: string) => {
    if (state.users.find(u => u.email === email)) {
      alert('Email already exists!');
      return;
    }
    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      email,
      password,
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
    setState(prev => ({
      ...prev,
      sales: [newSale, ...prev.sales]
    }));
    alert('Sale created successfully and pending admin approval.');
  };

  const approveSale = async (saleId: string) => {
    const sale = state.sales.find(s => s.id === saleId);
    if (!sale || sale.status === 'approved') return;

    // Simulate sending email via Gemini
    const emailContent = await generateApprovalEmail(sale.customerEmail, sale.amount);
    console.log(`Simulated Email Sent to ${sale.customerEmail}:`, emailContent);

    setState(prev => {
      const updatedSales = prev.sales.map(s => 
        s.id === saleId ? { ...s, status: 'approved' as const, approvedAt: new Date().toISOString() } : s
      );
      
      const employeeCommission = sale.amount - ADMIN_FEE;
      
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
    
    alert(`Sale approved! Email confirmation generated and sent to customer.`);
  };

  if (!state.currentUser) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 space-y-8 border border-slate-200">
          <div className="text-center">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4 shadow-lg">C</div>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Commission Manager</h2>
            <p className="mt-2 text-slate-500">Sign in to your account to continue</p>
          </div>
          <form className="space-y-6" onSubmit={handleLogin}>
            {loginError && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg border border-red-100">{loginError}</p>}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
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
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                placeholder="••••••••"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              />
            </div>
            <button
              type="submit"
              className="w-full py-4 px-4 border border-transparent rounded-xl shadow-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 font-bold transition-all"
            >
              Sign In
            </button>
          </form>
          <div className="text-center text-xs text-slate-400">
            System defaults: admin@system.com / admin
          </div>
        </div>
      </div>
    );
  }

  return (
    <Layout
      userRole={state.currentUser.role}
      userEmail={state.currentUser.email}
      onLogout={handleLogout}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
    >
      {activeTab === 'dashboard' && <DashboardView state={state} />}
      {activeTab === 'sales' && <SalesView state={state} onCreateSale={createSale} onApproveSale={approveSale} />}
      {activeTab === 'employees' && state.currentUser.role === 'admin' && <EmployeeHubView state={state} onCreateEmployee={createEmployee} />}
    </Layout>
  );
};

// --- Sub-components (Views) ---

const DashboardView: React.FC<{ state: AppState }> = ({ state }) => {
  const isEmployee = state.currentUser?.role === 'employee';
  const currentUserData = state.users.find(u => u.id === state.currentUser?.id);

  const stats = isEmployee ? [
    { label: 'Total Earnings', value: `BDT ${currentUserData?.wallet.toLocaleString()}`, icon: Icons.Wallet, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Orders Created', value: currentUserData?.totalSalesCount || 0, icon: Icons.Sales, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Pending Approval', value: state.sales.filter(s => s.employeeId === state.currentUser?.id && s.status === 'pending').length, icon: Icons.Dashboard, color: 'text-amber-600', bg: 'bg-amber-50' },
  ] : [
    { label: 'Admin Wallet', value: `BDT ${state.adminWallet.toLocaleString()}`, icon: Icons.Wallet, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Total Platform Sales', value: state.sales.length, icon: Icons.Sales, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Pending Approvals', value: state.sales.filter(s => s.status === 'pending').length, icon: Icons.Dashboard, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Active Employees', value: state.users.filter(u => u.role === 'employee').length, icon: Icons.Users, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-5">
            <div className={`p-4 rounded-xl ${stat.bg} ${stat.color}`}>
              <stat.icon />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">{stat.label}</p>
              <h3 className="text-2xl font-bold text-slate-800">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">Recent Activity</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Customer</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Amount</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.sales.slice(0, 5).map(sale => (
                <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-slate-700">{sale.customerEmail}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 font-semibold">BDT {sale.amount}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                      sale.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {sale.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-400">
                    {new Date(sale.timestamp).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {state.sales.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">No sales recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const SalesView: React.FC<{
  state: AppState;
  onCreateSale: (email: string, phone: string, amount: number) => void;
  onApproveSale: (id: string) => void;
}> = ({ state, onCreateSale, onApproveSale }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ customerEmail: '', customerPhone: '', amount: '' });

  const isEmployee = state.currentUser?.role === 'employee';
  const displaySales = isEmployee 
    ? state.sales.filter(s => s.employeeId === state.currentUser?.id) 
    : state.sales;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateSale(formData.customerEmail, formData.customerPhone, parseFloat(formData.amount));
    setIsModalOpen(false);
    setFormData({ customerEmail: '', customerPhone: '', amount: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-slate-800">Transactions</h3>
          <p className="text-sm text-slate-500">History of all platform sales and commissions</p>
        </div>
        {isEmployee && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all active:scale-95"
          >
            <Icons.Plus /> Create New Sale
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Reference</th>
                {!isEmployee && <th className="px-6 py-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Agent</th>}
                <th className="px-6 py-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Mobile Banking</th>
                <th className="px-6 py-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Status</th>
                {!isEmployee && <th className="px-6 py-5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displaySales.map(sale => (
                <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-xs font-mono text-slate-400">#{sale.id}</td>
                  {!isEmployee && (
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-700">{sale.employeeEmail.split('@')[0]}</span>
                        <span className="text-[10px] text-slate-400">Agent ID: {sale.employeeId}</span>
                      </div>
                    </td>
                  )}
                  <td className="px-6 py-4 text-sm text-slate-700">{sale.customerEmail}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{sale.customerPhone}</td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-800">BDT {sale.amount}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                      sale.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {sale.status === 'approved' && <Icons.Check />}
                      {sale.status}
                    </span>
                  </td>
                  {!isEmployee && (
                    <td className="px-6 py-4 text-right">
                      {sale.status === 'pending' ? (
                        <button 
                          onClick={() => onApproveSale(sale.id)}
                          className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm"
                        >
                          Approve
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium italic">Verified</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {displaySales.length === 0 && (
                <tr>
                  <td colSpan={isEmployee ? 6 : 7} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center opacity-40">
                      <Icons.Sales />
                      <p className="mt-2 font-medium text-slate-500">No records found matching your criteria</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Sale Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
              <h4 className="text-xl font-bold text-slate-800">Record New Sale</h4>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Customer Email</label>
                <input
                  type="email"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  placeholder="customer@example.com"
                  value={formData.customerEmail}
                  onChange={e => setFormData({ ...formData, customerEmail: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Customer Phone (Mobile Banking)</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  placeholder="01XXXXXXX"
                  value={formData.customerPhone}
                  onChange={e => setFormData({ ...formData, customerPhone: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Amount (BDT)</label>
                <input
                  type="number"
                  required
                  min={ADMIN_FEE + 1}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  placeholder="e.g. 1500"
                  value={formData.amount}
                  onChange={e => setFormData({ ...formData, amount: e.target.value })}
                />
                <p className="text-[10px] text-slate-400 mt-1 italic">Note: Admin fee (BDT {ADMIN_FEE}) will be deducted from this amount.</p>
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-100 transition-all"
                >
                  Submit Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const EmployeeHubView: React.FC<{
  state: AppState;
  onCreateEmployee: (email: string, pass: string) => void;
}> = ({ state, onCreateEmployee }) => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const employees = state.users.filter(u => u.role === 'employee');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateEmployee(formData.email, formData.password);
    setFormData({ email: '', password: '' });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-8">
          <h3 className="text-xl font-bold text-slate-800 mb-2">Onboard Agent</h3>
          <p className="text-sm text-slate-500 mb-6">Create credentials for new team members.</p>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Employee Email</label>
              <input
                type="email"
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                placeholder="agent@company.com"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Temporary Password</label>
              <input
                type="text"
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                placeholder="••••••••"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
            <button 
              type="submit"
              className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-50 transition-all active:scale-[0.98]"
            >
              Add Employee
            </button>
          </form>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-6">
        <h3 className="text-xl font-bold text-slate-800">Team Roster</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {employees.map(emp => (
            <div key={emp.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-lg">
                  {emp.email.charAt(0).toUpperCase()}
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-bold text-slate-800 truncate">{emp.email}</p>
                  <p className="text-xs text-slate-400">Agent ID: {emp.id}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-auto">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Total Sales</p>
                  <p className="text-lg font-bold text-indigo-600">{emp.totalSalesCount}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Commission</p>
                  <p className="text-lg font-bold text-emerald-600">৳{emp.wallet.toLocaleString()}</p>
                </div>
              </div>
            </div>
          ))}
          {employees.length === 0 && (
            <div className="col-span-2 py-12 text-center bg-white rounded-2xl border border-dashed border-slate-300">
              <p className="text-slate-400 italic">No employees onboarded yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
