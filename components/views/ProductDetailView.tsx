import React, { useState } from 'react';
import { Product } from '../../types';
import { Icons } from '../../constants';
import { Button } from '../shared';

interface ProductDetailViewProps {
  product: Product;
  isAdmin: boolean;
  onClose: () => void;
  onUpdate: (updates: Partial<Product>) => void;
  onDelete: () => void;
}

const ProductDetailView: React.FC<ProductDetailViewProps> = ({ product, isAdmin, onClose, onUpdate, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({ name: product.name, share: (product.adminShare||0).toString(), desc: product.description, pricingModel: product.pricingModel || 'fixed', commissionPercent: (product.commissionPercent||'') });
  const [gallery, setGallery] = useState<string[]>(product.gallery || []);

  const handleImgUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'main' | 'gallery') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (type === 'main') onUpdate({ mainImage: reader.result as string });
      else {
        const updatedGallery = [...gallery, reader.result as string];
        setGallery(updatedGallery);
        onUpdate({ gallery: updatedGallery });
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="max-w-6xl mx-auto bg-white rounded-[1rem] shadow-2xl border border-slate-200 overflow-hidden text-slate-900 pb-20 sm:pb-0">
      <div className="flex flex-col lg:flex-row">
        <div className="lg:w-2/5 p-6 sm:p-8 lg:p-12 bg-slate-50 lg:border-r border-slate-100">
          <div className="relative group rounded-xl overflow-hidden shadow-xl border border-slate-200 aspect-square w-full mb-8">
            {product.mainImage ? <img src={product.mainImage} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-200"><Icons.Tag /></div>}
            {isAdmin && (
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                 <button onClick={() => document.getElementById('main-up')?.click()} className="p-4 bg-white rounded-2xl text-indigo-600 shadow-2xl scale-110 hover:scale-125 transition-transform"><Icons.Plus /></button>
              </div>
            )}
            <input id="main-up" type="file" className="hidden" onChange={(e) => handleImgUpload(e, 'main')} />
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3">
            {gallery.map((img, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 group">
                <img src={img} className="w-full h-full object-cover" />
                {isAdmin && <button onClick={() => {
                  const updated = gallery.filter((_, idx) => idx !== i);
                  setGallery(updated);
                  onUpdate({ gallery: updated });
                }} className="absolute inset-0 bg-red-500/80 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"><Icons.Trash /></button>}
              </div>
            ))}
            {isAdmin && <button onClick={() => document.getElementById('gal-up')?.click()} className="aspect-square rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:border-indigo-400 hover:text-indigo-400 transition-all"><Icons.Plus /></button>}
            <input id="gal-up" type="file" className="hidden" onChange={(e) => handleImgUpload(e, 'gallery')} />
          </div>
        </div>
        <div className="lg:w-3/5 p-6 sm:p-6 lg:p-12 relative">
          <button onClick={onClose} className="absolute top-4 right-4 sm:top-10 sm:right-10 text-slate-300 hover:text-slate-900 transition-colors p-2 text-xl">✕</button>
          <div className="space-y-5">
            <div>
              {editing ? <input className="text-2xl sm:text-2xl lg:text-2xl font-bold border-b-2 border-indigo-200 w-full outline-none text-slate-800" value={form.name} onChange={e => setForm({...form, name: e.target.value})} /> : <h2 className="text-2xl sm:text-2xl lg:text-2xl font-bold text-slate-800 tracking-tight">{product.name}</h2>}
            </div>
            <div>
              {editing ? <textarea className="w-full h-24 sm:h-32 lg:h-40 p-4 sm:p-6 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-slate-700" value={form.desc} onChange={e => setForm({...form, desc: e.target.value})} /> : <p className="text-slate-600 text-sm leading-relaxed">{product.description || "No specific briefing available for this product."}</p>}
            </div>
            <div className="p-4 sm:p-5 bg-indigo-50/50 rounded-[1rem] flex flex-col sm:flex-row justify-between items-start sm:items-center border border-indigo-100 shadow-inner gap-4">
               <div>
                  <p className="text-[12px] font-bold text-indigo-400 uppercase mb-1">Pricing</p>
                  {editing ? (
                    <div className="flex gap-3 items-center">
                      <select value={form.pricingModel} onChange={e => setForm({...form, pricingModel: e.target.value})} className="px-4 py-2 rounded-2xl bg-white border">
                        <option value="fixed">Fixed Price</option>
                        <option value="commission">Commission</option>
                      </select>
                      {form.pricingModel === 'commission' ? (
                        <input type="number" min={0} max={100} step={0.1} className="text-xl font-bold text-indigo-700 outline-none w-32 bg-transparent" value={form.commissionPercent} onChange={e => setForm({...form, commissionPercent: e.target.value})} placeholder="Admin %" />
                      ) : (
                        <input type="number" className="text-xl font-bold text-indigo-700 outline-none w-32 bg-transparent" value={form.share} onChange={e => setForm({...form, share: e.target.value})} placeholder="৳ Admin" />
                      )}
                    </div>
                  ) : (
                    product.pricingModel === 'commission' ? <h3 className="text-xl font-bold text-indigo-700">{(product.commissionPercent||0)}%</h3> : <h3 className="text-xl font-bold text-indigo-700">৳{(product.adminShare||0).toLocaleString()}</h3>
                  )}
               </div>
               <div className="hidden sm:flex p-5 bg-white rounded-2xl shadow-sm text-indigo-600 items-center justify-center"><Icons.Wallet /></div>
            </div>
            {isAdmin && (
              <div className="flex flex-col sm:flex-row gap-4 pt-6">
                {editing ? (
                  <Button variant="primary" onClick={() => { setEditing(false); const payload: any = { name: form.name, description: form.desc, pricingModel: form.pricingModel };
                      if (form.pricingModel === 'commission') payload.commissionPercent = parseFloat(form.commissionPercent) || 0;
                      else payload.adminShare = parseFloat(form.share) || 0;
                      onUpdate(payload); }} className="w-full sm:flex-1">Save Changes</Button>
                ) : (
                  <Button variant="secondary" onClick={() => setEditing(true)} className="w-full sm:flex-1">Edit</Button>
                )}
                {editing && <Button variant="danger" onClick={onDelete} className="w-full sm:w-auto flex items-center justify-center"><Icons.Trash /></Button>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailView;
