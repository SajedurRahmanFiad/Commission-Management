import React, { useState, useEffect } from 'react';
import { AppState, Product } from '../../types';
import { Icons } from '../../constants';
import { Button } from '../shared';
import Modal from '../shared/Modal';
import FloatingPlus from '../shared/FloatingPlus';

interface ProductListViewProps {
  state: AppState;
  isAdmin: boolean;
  onSelect: (id: string) => void;
  onAdd: (product: Partial<Product>) => void;
}

const ProductListView: React.FC<ProductListViewProps> = ({ state, isAdmin, onSelect, onAdd }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<any>({ name: '', share: '', desc: '', pricingModel: 'fixed', commissionPercent: '', mainImage: '' });

  const [query, setQuery] = useState('');
  const [displayProducts, setDisplayProducts] = useState<Product[]>(state.products || []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // reset to full list when query is empty or products change
    if (!query.trim()) setDisplayProducts(state.products);
  }, [state.products, query]);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setLoading(false); return; }
    let mounted = true;
    setLoading(true);
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?q=${encodeURIComponent(q)}`);
        if (!mounted) return;
        if (res.ok) {
          const data = await res.json();
          setDisplayProducts(data);
        } else {
          setDisplayProducts([]);
        }
      } catch (e) {
        console.error('Product search error', e);
        setDisplayProducts([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }, 300);
    return () => { mounted = false; clearTimeout(id); };
  }, [query]);

  const handleMainUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] as File | undefined;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((f: any) => ({ ...f, mainImage: reader.result as string }));
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4 w-full max-w-md relative">
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search products..." className="flex-1 px-4 pr-10 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none" />
          {loading ? (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.25" />
                <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              </svg>
            </div>
          ) : null}
        </div>
        {isAdmin && (
          <Button variant="primary" onClick={() => setShowAdd(true)} className="hidden md:inline-flex">Add Product</Button>
        )}
      </div>

      {/* Mobile-only floating add */}
      {isAdmin && <FloatingPlus onClick={() => setShowAdd(true)} ariaLabel="Add Product" />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {displayProducts.map(p => (
          <div key={p.id} onClick={() => onSelect(p.id)} className="bg-white rounded-[1rem] border border-slate-200 overflow-hidden hover:border-indigo-500 hover:shadow-xl transition-all cursor-pointer group">
            <div className="h-52 bg-slate-50 flex items-center justify-center text-slate-200 overflow-hidden">
              {p.mainImage ? <img src={p.mainImage} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" /> : <div className="p-16 opacity-30 scale-150"><Icons.Tag /></div>}
            </div>
            <div className="p-6">
              <h4 className="font-bold text-slate-800 text-md mb-2">{p.name}</h4>
              <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Pricing</p>
                  {p.pricingModel === 'commission' ? (
                    <span className="text-2xl font-bold text-indigo-600">{(p.commissionPercent || 0).toLocaleString()}%</span>
                  ) : (
                    <span className="text-2xl font-bold text-indigo-600">৳{(p.adminShare || 0).toLocaleString()}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {displayProducts.length === 0 && (
          <div className="col-span-full py-20 bg-slate-50 rounded-[1rem] border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300">
             <div className="mb-4 scale-150"><Icons.Tag /></div>
             <p className="font-bold uppercase tracking-[0.3em] text-[10px]">No products found</p>
          </div>
        )}
      </div>

      {showAdd && (
        <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="New Product" maxWidth="md">
          <form className="space-y-4" onSubmit={e => { 
            e.preventDefault(); 
            const payload: any = {
              name: form.name,
              description: form.desc,
              pricingModel: form.pricingModel,
              mainImage: form.mainImage
            };
            if (form.pricingModel === 'commission') {
              payload.commissionPercent = parseFloat(form.commissionPercent) || 0;
            } else {
              payload.adminShare = parseFloat(form.share) || 0;
            }
            onAdd(payload);
            setShowAdd(false); 
            setForm({ name: '', share: '', desc: '', pricingModel: 'fixed', commissionPercent: '', mainImage: '' }); 
          }}>
            <div>
              <div className="relative group rounded-xl overflow-hidden shadow-xl border border-slate-200 aspect-square w-40 sm:w-48 mx-auto">
                {form.mainImage ? (
                  <img src={form.mainImage} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-200"><Icons.Tag /></div>
                )}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button type="button" onClick={() => document.getElementById('new-main-up')?.click()} className="p-3 bg-white rounded-xl text-indigo-600 shadow-2xl scale-110 hover:scale-125 transition-transform"><Icons.Plus /></button>
                </div>
                <input id="new-main-up" type="file" className="hidden" onChange={handleMainUpload} />
              </div>
            </div>

            <input type="text" required placeholder="Product Name" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs font-bold text-slate-700 shadow-inner" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />

            <div>
              <select value={form.pricingModel} onChange={e => setForm({ ...form, pricingModel: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs font-bold text-slate-700 shadow-inner">
                <option value="fixed">Fixed Price</option>
                <option value="commission">Commission</option>
              </select>
              {form.pricingModel === 'commission' ? (
                <input type="number" min={0} max={100} step={0.1} required placeholder="Admin %" className="w-full mt-3 px-5 py-4 rounded-xl bg-slate-50 border border-slate-200 outline-none text-xs font-bold text-slate-700 shadow-inner" value={form.commissionPercent} onChange={e => setForm({ ...form, commissionPercent: e.target.value })} />
              ) : (
                <input type="number" required placeholder="Admin Price (৳)" className="w-full mt-3 px-5 py-4 rounded-xl bg-slate-50 border border-slate-200 outline-none text-xs font-bold text-slate-800 shadow-inner" value={form.share} onChange={e => setForm({ ...form, share: e.target.value })} />
              )}
            </div>

            <textarea placeholder="Product Details..." className="w-full h-24 px-5 py-4 rounded-xl bg-slate-50 border border-slate-200 outline-none resize-none text-xs font-bold text-slate-700 shadow-inner" value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })}></textarea> 

            <div className="flex gap-4 pt-6">
              <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-4 text-slate-400 font-bold uppercase text-[13px] tracking-widest">Cancel</button>
              <button className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold text-[13px] uppercase tracking-widest shadow-lg shadow-indigo-100">Create</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default ProductListView;
