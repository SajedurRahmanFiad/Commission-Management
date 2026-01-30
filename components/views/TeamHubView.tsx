import React, { useState, useEffect } from 'react';
import { AppState } from '../../types';
import { Icons } from '../../constants';
import { Button } from '../shared';

interface TeamHubViewProps {
  state: AppState;
  onCreate: (email: string, password: string) => void;
  onDelete: (id: string) => void;
  onSelectUser?: (id: string) => void;
}

const TeamHubView: React.FC<TeamHubViewProps> = ({ state, onCreate, onDelete, onSelectUser }) => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [search, setSearch] = useState('');
  const employees = state.users.filter(u => u.role === 'employee');
  const [displayEmployees, setDisplayEmployees] = useState(employees);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // show local list when search is empty
    if (!search.trim()) {
      setDisplayEmployees(state.users.filter(u => u.role === 'employee'));
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users?q=${encodeURIComponent(search)}&role=employee`);
        if (!mounted) return;
        if (res.ok) {
          const data = await res.json();
          setDisplayEmployees(data);
        } else {
          setDisplayEmployees([]);
        }
      } catch (e) {
        console.error('Employee search error', e);
        setDisplayEmployees([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }, 300);

    return () => { mounted = false; clearTimeout(id); };
  }, [search, state.users]);

  return (
    <div className="space-y-10 text-slate-900">
      <div className="bg-white p-8 rounded-[1rem] border border-slate-200 shadow-sm">
        <h3 className="text-xl font-bold text-slate-800 mb-4 tracking-tight">New Agent</h3>
        <form className="flex flex-col md:flex-row gap-5" onSubmit={e => { e.preventDefault(); onCreate(form.email, form.password); setForm({ email: '', password: '' }); }}>
          <input type="email" required placeholder="Email Address" className="flex-1 px-6 py-4 rounded-xl bg-slate-50 border border-slate-200 outline-none font-bold text-xs" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <input type="text" required placeholder="Password" className="flex-1 px-6 py-4 rounded-xl bg-slate-50 border border-slate-200 outline-none font-bold text-xs" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          <Button type="submit" variant="primary">Create</Button>
        </form>
      </div>
      <div className="flex items-center justify-between">
        <div className="w-full">
          <div className="relative">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search agents..." className="w-full px-4 pr-10 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none" />
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
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {displayEmployees.map(e => (
          <div key={e.id} className="bg-white p-8 rounded-[1rem] border border-slate-200 shadow-sm relative group hover:border-indigo-400 transition-all cursor-pointer" onClick={() => onSelectUser?.(e.id)}>
            <button
              onClick={(evt) => { evt.stopPropagation(); if (window.confirm('Remove this agent?')) onDelete(e.id); }}
              aria-label="Remove agent"
              title="Remove agent"
              className="absolute top-4 right-4 h-9 w-9 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-500 hover:bg-red-50 hover:text-red-500 transition-colors z-20"
            >
              <Icons.Trash />
            </button>
            <div className="flex items-center gap-5 mb-8">
              {e.avatar ? <img src={e.avatar} className="h-16 w-16 rounded-xl object-cover shadow-md" /> : <div className="h-16 w-16 bg-indigo-600 rounded-xl flex items-center justify-center text-2xl font-bold text-white uppercase">{e.email.charAt(0)}</div>}
              <div>
                <p className="font-bold text-slate-800 text-lg">{e.username || e.email.split('@')[0]}</p>
                <p className="text-[13px] font-bold text-slate-400">{e.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-50">
              <div className="bg-slate-50 p-4 rounded-xl text-center">
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Sales</p>
                <p className="text-xl font-bold text-indigo-600">{e.totalSalesCount || 0}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl text-center">
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Unpaid Balance</p>
                <p className="text-xl font-bold text-emerald-600">৳{e.wallet.toLocaleString()}</p>
              </div>
            </div>
          </div>
        ))}
        {displayEmployees.length === 0 && (
          <div className="col-span-full py-20 bg-slate-50 rounded-[1rem] border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300">
             <div className="mb-4 scale-150"><Icons.Users /></div>
             <p className="font-bold uppercase tracking-[0.3em] text-[10px]">No partners found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamHubView;
