import React, { useState, useEffect } from 'react';
import { AppState, Sale } from '../../types';
import { Icons } from '../../constants';
import { formatDateTime } from '../Layout';
import { Button } from '../shared';
import Modal from '../shared/Modal';
import FloatingPlus from '../shared/FloatingPlus';
import { searchSales } from '../../services/databaseService';

interface SalesViewProps {
  state: AppState;
  onApprove: (id: string) => void;
  displaySales: Sale[];
  onCreateSale: (email: string, phone: string, amount: number, productId: string, method: any) => void;
}

const SalesView: React.FC<SalesViewProps> = ({ state, onApprove, displaySales, onCreateSale }) => {
  const isEmployee = state.currentUser?.role === 'employee';
  const isAdmin = state.currentUser?.role === 'admin';
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ email: '', phone: '', amount: '', productId: '', method: 'bKash' as any });

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [localSales, setLocalSales] = useState<Sale[]>(displaySales);

  useEffect(() => { if (!query.trim()) setLocalSales(displaySales); }, [displaySales, query]);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setLoading(false); return; }
    let mounted = true;
    setLoading(true);
    const id = setTimeout(async () => {
      try {
        const data = await searchSales(q);
        if (!mounted) return;
        setLocalSales(data);
      } catch (e) {
        console.error('Sales search error', e);
        setLocalSales([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }, 300);
    return () => { mounted = false; clearTimeout(id); };
  }, [query]);

  const getAgentName = (id?: string, email?: string) => {
    const user = state.users.find(u => u.id === id) || state.users.find(u => u.email === email);
    if (user) return user.username || user.email.split('@')[0];
    return email ? email.split('@')[0] : '—';
  }; 

  return (
    <div className="space-y-4">


      {/* Mobile-only floating add */}
      <FloatingPlus onClick={() => setShowModal(true)} ariaLabel="Add Sale" />

      <div className="bg-white rounded-[1rem] border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">All Sales</h3>
          <span className="text-xs font-bold text-indigo-600">Total Records: {displaySales.length}</span>
        </div>
        <div className="px-6 py-4 border-b border-slate-100 bg-white flex items-center justify-between gap-4">
          <div className="flex-1 relative">
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search sales... (email, phone, product, agent)" className="w-full px-4 pr-10 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none" />
            {loading ? (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.25" />
                  <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                </svg>
              </div>
            ) : null}
          </div>
          <div className="flex-none hidden md:block">
            <Button variant="primary" onClick={() => setShowModal(true)} className="flex items-center gap-2">
              <Icons.Plus /> Add Sale
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[850px]">
            <thead>
              <tr className="bg-gray-100 border-b border-slate-100">
                {!isEmployee && <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase">Agent</th>}
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase">Customer</th>
                {(isEmployee || isAdmin) && <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase">Product</th>}
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 text-center uppercase">Amount</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 text-center uppercase">Received amount</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 text-center uppercase">Paid by</th>
                {/* Status column removed — action column will show status when applicable */}
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase text-right w-28">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {localSales.map(sale => {
                const product = state.products.find(p => p.id === sale.productId);
                let receivedAmount = sale.amount;
                if (product?.pricingModel === 'fixed') {
                  const adminShare = product.adminShare || 0;
                  receivedAmount = Math.max(0, sale.amount - adminShare);
                } else if (product?.pricingModel === 'commission') {
                  const percent = product.commissionPercent || 0;
                  const adminShare = (percent / 100) * sale.amount;
                  receivedAmount = Math.max(0, sale.amount - adminShare);
                }

                return (
                  <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors">
                    {!isEmployee && <td className="px-6 py-3 text-xs font-bold text-slate-700">{getAgentName(sale.employeeId, sale.employeeEmail)}</td>}
                    <td className="px-6 py-3">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-700">{sale.customerPhone}</span>
                        <span className="text-xs font-bold text-slate-700 hover:pointer"><a href={`mailto:${sale.customerEmail}`}>{sale.customerEmail}</a></span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase mt-1">{formatDateTime(sale.timestamp)}</span>
                      </div>
                    </td>
                    {(isEmployee || isAdmin) && <td className="px-6 py-3 text-xs font-bold text-slate-700">{sale.productName || product?.name || '—'}</td>} 
                    {/* Show total amount */}
                    <td className="px-6 py-3 text-sm font-bold text-slate-800 text-center">৳{(Number(sale.amount) || 0).toLocaleString()}</td>
                    {/* Received amount: visible after approval (for admins show adminShare, for employees show employee share) */}
                    {(() => {
                      // Compute admin vs employee shares
                      let adminShare = 0;
                      let employeeShare = Number(sale.amount) || 0;
                      if (product?.pricingModel === 'fixed') {
                        adminShare = product.adminShare || 0;
                        employeeShare = Math.max(0, (Number(sale.amount) || 0) - adminShare);
                      } else if (product?.pricingModel === 'commission') {
                        const percent = product.commissionPercent || 0;
                        adminShare = Math.round(((percent || 0) / 100) * (Number(sale.amount) || 0));
                        employeeShare = Math.max(0, (Number(sale.amount) || 0) - adminShare);
                      }
                      const received = isAdmin ? adminShare : employeeShare;
                      return <td className="px-6 py-3 text-sm font-bold text-slate-800 text-center">{sale.status === 'pending' ? <span className="text-slate-400">—</span> : <>৳{received.toLocaleString()}</>}</td>;
                    })()}
                    <td className="px-6 py-3 text-center">
                      <span
                          className={`text-[10px] font-bold px-3 py-1.5 rounded-lg ${
                          sale.paymentMethod === 'bKash'
                              ? 'bg-pink-50 text-pink-600'
                              : sale.paymentMethod === 'Nagad'
                              ? 'bg-orange-50 text-orange-600'
                              : sale.paymentMethod === 'Rocket'
                              ? 'bg-purple-50 text-purple-600'
                              : ''
                          }`}
                        >
                          {sale.paymentMethod}
                        </span>
                      </td>
                    <td className="px-6 py-3 text-right w-28">
                      {sale.status === 'pending' ? (
                        !isEmployee ? (
                          <button
                            title="Approve"
                            onClick={() => onApprove(sale.id)}
                            className="h-8 w-8 rounded-full flex items-center justify-center bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-100 transition-colors"
                          >
                            <Icons.Check />
                          </button>
                        ) : (
                          <span className="px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase bg-amber-50 text-amber-600">Pending</span>
                        )
                      ) : (
                        <span className="px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase bg-emerald-50 text-emerald-600">Verified</span>
                      )}
                    </td>
                  </tr>
                );
              })}     
              {localSales.length === 0 && (
                <tr><td colSpan={isEmployee ? 6 : 7} className="p-20 text-center text-slate-300 font-bold uppercase tracking-widest text-sm italic font-sans">No Sales Records</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New Sale" maxWidth="md">
          <form className="space-y-4" onSubmit={e => {
            e.preventDefault();
            onCreateSale(formData.email, formData.phone, parseFloat(formData.amount), formData.productId, formData.method);
            setShowModal(false);
            setFormData({ email: '', phone: '', amount: '', productId: '', method: 'bKash' });
          }}>
            <select required className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-xs font-bold text-slate-700 shadow-inner" value={formData.productId} onChange={e => setFormData({ ...formData, productId: e.target.value })}>
              <option value="">Choose Product...</option>
              {state.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="email" required placeholder="Customer Email" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-xs font-bold text-slate-700 shadow-inner" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
            <input type="text" required placeholder="Customer Phone" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-xs font-bold text-slate-700 shadow-inner" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
            <input type="number" required placeholder="Paid Amount (৳)" className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none text-xs font-bold text-slate-800 shadow-inner" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
            <select required className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-xs font-bold text-slate-700 shadow-inner" value={formData.method} onChange={e => setFormData({ ...formData, method: e.target.value as any })}>
              <option value="bKash">bKash</option>
              <option value="Nagad">Nagad</option>
              <option value="Rocket">Rocket</option>
            </select>
            <div className="flex gap-4 pt-6">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 text-slate-400 font-bold uppercase text-[13px] tracking-widest">Cancel</button>
              <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold text-[13px] uppercase tracking-widest shadow-lg shadow-indigo-100">Confirm</button>
            </div>
          </form> 
        </Modal>
      )}
    </div>
  );
};

export default SalesView;
