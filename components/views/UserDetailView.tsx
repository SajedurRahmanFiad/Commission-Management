import React, { useState } from 'react';
import { User } from '../../types';
import { Icons } from '../../constants';
import { Button } from '../shared';

interface UserDetailViewProps {
  user: User;
  onClose: () => void;
  onUpdate: (username: string, avatar: string, paymentAccounts: any) => void;
  uploadFile?: (file: File, type: string) => Promise<string | null>;
  onDelete?: (id: string) => void;
}

const UserDetailView: React.FC<UserDetailViewProps> = ({ user, onClose, onUpdate, uploadFile, onDelete }) => {
  // Read-only details for agents; editing removed intentionally
  const displayName = user.username || user.email.split('@')[0];

  return (
    <div className="space-y-8 pb-20 sm:pb-0">
      <div className="flex items-center justify-between">
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 flex items-center gap-2 font-bold text-sm uppercase tracking-widest"><Icons.ArrowLeft /> Back</button>
        {onDelete && (
          <button
            onClick={() => { if (confirm('Remove partner?')) { onDelete(user.id); onClose(); } }}
            aria-label="Remove agent"
            title="Remove agent"
            className="py-2 px-3 rounded-xl bg-red-50 text-red-600 font-bold flex items-center gap-2 hover:bg-red-100"
          >
            <Icons.Trash /> Remove
          </button>
        )}
      </div>

      <div className="bg-white p-6 sm:p-8 lg:p-12 rounded-[1rem] border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-6">
          <div className="flex items-center gap-6">
            <div className="h-24 w-24 rounded-xl overflow-hidden shadow-md">
              {user.avatar ? <img src={user.avatar} className="h-full w-full object-cover" /> : <div className="h-full w-full bg-indigo-600 flex items-center justify-center text-4xl font-bold text-white uppercase">{user.email.charAt(0)}</div>}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">{displayName}</h2>
              <p className="text-slate-500 font-medium mt-2">{user.email}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-slate-50 p-4 sm:p-6 rounded-xl">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Total Sales</p>
            <p className="text-xl font-bold text-indigo-600">{user.totalSalesCount || 0}</p>
          </div>
          <div className="bg-slate-50 p-4 sm:p-6 rounded-xl">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Wallet Balance</p>
            <p className="text-xl font-bold text-emerald-600">৳{user.wallet.toLocaleString()}</p>
          </div>
          <div className="bg-slate-50 p-4 sm:p-6 rounded-xl">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Status</p>
            <p className="text-xl font-bold text-blue-600">Active</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDetailView;
