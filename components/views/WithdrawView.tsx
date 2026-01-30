import React, { useState, useMemo, useEffect } from 'react';
import { AppState, WithdrawRequest } from '../../types';
import { Icons } from '../../constants';
import { formatDateTime } from '../Layout';
import { Button } from '../shared';
import Modal from '../shared/Modal';
import FloatingPlus from '../shared/FloatingPlus';
import { searchWithdrawals } from '../../services/databaseService';

interface WithdrawViewProps {
  state: AppState;
  onWithdraw: (amount: number, method: any, accountNumber: string) => void;
  onComplete: (id: string) => void;
  onDecline: (id: string) => void;
  dateFilter?: { type: 'all' | 'today' | '7d' | '30d' | 'custom'; from?: string; to?: string };
}

const WithdrawView: React.FC<WithdrawViewProps> = ({ state, onWithdraw, onComplete, onDecline, dateFilter }) => {
  const isEmployee = state.currentUser?.role === 'employee';
  const [form, setForm] = useState({ amount: '', method: 'bKash' as any });
  const [showRequestModal, setShowRequestModal] = useState(false);
  const currentAccounts = state.currentUser?.paymentAccounts || {};

  const getAgentName = (id?: string, email?: string) => {
    const user = state.users.find(u => u.id === id) || state.users.find(u => u.email === email);
    if (user) return user.username || user.email.split('@')[0];
    return email ? email.split('@')[0] : '—';
  }; 
  const currentAccountNum = currentAccounts[form.method as keyof typeof currentAccounts] || '';
  const displayRequests = useMemo(() => {
    const base = isEmployee ? state.withdrawRequests.filter(r => r.employeeId === state.currentUser?.id) : state.withdrawRequests;
    if (!dateFilter || dateFilter.type === 'all') return base;
    const now = Date.now();
    if (dateFilter.type === 'today') {
      const today = new Date();
      return base.filter(r => {
        const d = new Date(r.timestamp);
        return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
      });
    }
    if (dateFilter.type === '7d') {
      const cutoff = now - 7 * 24 * 60 * 60 * 1000;
      return base.filter(r => new Date(r.timestamp).getTime() >= cutoff);
    }
    if (dateFilter.type === '30d') {
      const cutoff = now - 30 * 24 * 60 * 60 * 1000;
      return base.filter(r => new Date(r.timestamp).getTime() >= cutoff);
    }
    if (dateFilter.type === 'custom' && dateFilter.from) {
      const from = new Date(dateFilter.from).getTime();
      const to = dateFilter.to ? new Date(dateFilter.to).getTime() : Date.now();
      return base.filter(r => {
        const t = new Date(r.timestamp).getTime();
        return t >= from && t <= to;
      });
    }
    return base;
  }, [state.withdrawRequests, state.currentUser, isEmployee, dateFilter]);

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [displayRequestsLocal, setDisplayRequestsLocal] = useState(displayRequests);

  useEffect(() => { if (!query.trim()) setDisplayRequestsLocal(displayRequests); }, [displayRequests, query]);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setLoading(false); return; }
    let mounted = true;
    setLoading(true);
    const id = setTimeout(async () => {
      try {
        const data = await searchWithdrawals(q);
        if (!mounted) return;
        // if employee scope, filter locally by employee id
        const filtered = isEmployee ? data.filter((r: any) => r.employeeId === state.currentUser?.id) : data;
        setDisplayRequestsLocal(filtered);
      } catch (e) {
        console.error('Withdrawals search error', e);
        setDisplayRequestsLocal([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }, 300);
    return () => { mounted = false; clearTimeout(id); };
  }, [query, state.currentUser, isEmployee]);

  const canWithdraw = form.amount && parseFloat(form.amount) >= 200 && parseFloat(form.amount) <= (state.currentUser?.wallet || 0) && !!currentAccountNum;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-slate-900">
      {isEmployee && (
        <div className="lg:col-span-1 hidden lg:block">
          <div className="bg-white p-10 rounded-[1rem] border border-slate-200 shadow-sm sticky top-8">
            <h3 className="text-xl font-bold text-slate-800 mb-8 tracking-tight">Request for a payout</h3>
            <div className="mb-8 p-8 bg-emerald-50 rounded-xl border border-emerald-100 shadow-inner">
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Available Funds</p>
              <h4 className="text-4xl font-bold text-emerald-700">৳{state.currentUser?.wallet.toLocaleString()}</h4>
            </div>
            <form className="space-y-6" onSubmit={e => { e.preventDefault(); onWithdraw(parseFloat(form.amount), form.method, currentAccountNum); setForm({ ...form, amount: '' }); }}>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">Amount to Withdraw</label>
                <input type="number" required min="200" className="w-full px-5 py-4 rounded-xl bg-slate-50 border border-slate-200 outline-none font-bold text-slate-800 text-lg" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
                <p className="text-[11px] text-slate-400 mt-2 font-bold tracking-wider text-center">Minimum: ৳200</p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">Get paid by</label>
                <select className="w-full px-5 py-4 rounded-xl bg-slate-50 border border-slate-200 outline-none font-bold text-slate-700" value={form.method} onChange={e => setForm({ ...form, method: e.target.value as any })}>
                  <option value="bKash">bKash</option>
                  <option value="Nagad">Nagad</option>
                  <option value="Rocket">Rocket</option>
                </select>
              </div>
              {!currentAccountNum ? (
                <div className="p-4 bg-amber-50 text-amber-700 rounded-xl text-[10px] font-bold leading-relaxed border border-amber-100">
                  ⚠️ No linked {form.method} number found. Update your "My Profile" to proceed.
                </div>
              ) : (
                <div className="p-4 bg-slate-50 text-slate-400 rounded-xl text-[10px] font-bold text-center border border-slate-100 uppercase tracking-widest">
                  Account: <span className="text-slate-800 font-bold">{currentAccountNum}</span>
                </div>
              )}
              <Button type="submit" disabled={!canWithdraw} variant="primary" className="w-full">Request</Button>
            </form>
          </div>
        </div>
      )}

      {/* Mobile: floating button to open request modal */}
      {isEmployee && <FloatingPlus onClick={() => setShowRequestModal(true)} ariaLabel="Request Payout" />}

      {/* Modal copy of the withdraw form for mobile */}
      {showRequestModal && (
        <Modal isOpen={showRequestModal} onClose={() => setShowRequestModal(false)} title="Request for a payout" maxWidth="md">
          <div className="mb-8 p-4 bg-emerald-50 rounded-xl border border-emerald-100 shadow-inner">
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Available Funds</p>
            <h4 className="text-3xl font-bold text-emerald-700">৳{state.currentUser?.wallet.toLocaleString()}</h4>
          </div>
          <form className="space-y-6" onSubmit={e => { e.preventDefault(); onWithdraw(parseFloat(form.amount), form.method, currentAccountNum); setForm({ ...form, amount: '' }); setShowRequestModal(false); }}>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">Amount to Withdraw</label>
              <input type="number" required min="200" className="w-full px-5 py-4 rounded-xl bg-slate-50 border border-slate-200 outline-none text-xs font-bold text-slate-800 shadow-inner" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
              <p className="text-[11px] text-slate-400 mt-2 font-bold tracking-wider text-center">Minimum: ৳200</p>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">Get paid by</label>
              <select className="w-full px-5 py-4 rounded-xl bg-slate-50 border border-slate-200 outline-none text-xs font-bold text-slate-700 shadow-inner" value={form.method} onChange={e => setForm({ ...form, method: e.target.value as any })}>
                <option value="bKash">bKash</option>
                <option value="Nagad">Nagad</option>
                <option value="Rocket">Rocket</option>
              </select>
            </div>

            {!currentAccountNum ? (
              <div className="p-4 bg-amber-50 text-amber-700 rounded-xl text-[10px] font-bold leading-relaxed border border-amber-100">
                ⚠️ No linked {form.method} number found. Update your "My Profile" to proceed.
              </div>
            ) : (
              <div className="p-4 bg-slate-50 text-slate-400 rounded-xl text-[10px] font-bold text-center border border-slate-100 uppercase tracking-widest">
                Account: <span className="text-slate-800 font-bold">{currentAccountNum}</span>
              </div>
            )}

            <div className="flex gap-4 pt-6">
              <button type="button" onClick={() => setShowRequestModal(false)} className="flex-1 py-4 text-slate-400 font-bold uppercase text-[13px] tracking-widest">Cancel</button>
              <Button type="submit" disabled={!canWithdraw} variant="primary" className="flex-1">Request</Button>
            </div>
          </form>
        </Modal>
      )}
      <div className={`${isEmployee ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white rounded-[1rem] border border-slate-200 overflow-hidden shadow-sm`}>
        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Withdrawal Requests</h3>
        </div>
        <div className="px-6 py-4 border-b border-slate-100 bg-white">
          <div className="relative w-full">
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search withdrawals... (account, agent, amount, status)" className="w-full px-4 pr-10 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none" />
            {loading ? (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.25" />
                  <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                </svg>
              </div>
            ) : null}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[750px]">
            <thead>
              <tr className="bg-gray-100 border-b border-slate-100">
                {!isEmployee && <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase">Agent</th>}
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase text-center">Amount</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase text-center">Gateway</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase">Target Account</th>
                {/* Status column removed — action column will show status when applicable */}
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayRequestsLocal.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                  {!isEmployee && <td className="px-6 py-3 font-bold text-xs text-slate-700">{getAgentName(r.employeeId, r.employeeEmail)}</td>}
                  <td className="px-6 py-3 font-bold text-indigo-600 text-center text-sm">৳{r.amount.toLocaleString()}</td>
                  <td className="px-6 py-3 text-center">
                    <span
                        className={`text-[10px] font-bold px-3 py-1.5 rounded-lg ${
                        r.method === 'bKash'
                            ? 'bg-pink-50 text-pink-600'
                            : r.method === 'Nagad'
                            ? 'bg-orange-50 text-orange-600'
                            : r.method === 'Rocket'
                            ? 'bg-purple-50 text-purple-600'
                            : ''
                        }`}
                      >
                        {r.method}
                      </span>
                    </td>
                  <td className="px-6 py-3">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold">{r.accountNumber}</span>
                      <span className="text-[9px] text-slate-400 font-bold uppercase mt-1">{formatDateTime(r.timestamp)}</span>
                    </div>
                  </td>

                  {!isEmployee && (
                    <td className="px-6 py-3 text-right">
                      {r.status === 'pending' ? (
                        <div className="flex items-center justify-end gap-3">
                          <button
                            title="Decline"
                            onClick={() => { if (window.confirm('Decline this withdrawal request?')) onDecline(r.id); }}
                            className="h-8 w-8 rounded-full flex items-center justify-center border border-slate-100 text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <Icons.X />
                          </button>
                          <button
                            title="Mark as Paid"
                            onClick={() => onComplete(r.id)}
                            className="h-8 w-8 rounded-full flex items-center justify-center bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-100 transition-colors"
                          >
                            <Icons.Check />
                          </button>
                        </div>
                      ) : r.status === 'completed' ? (
                        <span className="text-emerald-500 font-bold uppercase text-[9px] tracking-widest px-4">Paid</span>
                      ) : (
                        <span className="text-red-500 font-bold uppercase text-[9px] tracking-widest px-4">Declined</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {displayRequestsLocal.length === 0 && (
                <tr><td colSpan={6} className="p-20 text-center text-slate-300 font-bold uppercase tracking-widest text-sm italic font-sans">No Payout Records</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default WithdrawView;
