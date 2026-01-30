import React, { useState } from 'react';
import { User } from '../../types';
import { Button } from '../shared';

interface ProfileViewProps {
  user: User;
  onUpdate: (username: string, avatar: string, paymentAccounts: any) => void;
  uploadFile?: (file: File, type: string) => Promise<string | null>;
}

const ProfileView: React.FC<ProfileViewProps> = ({ user, onUpdate, uploadFile }) => {
  const [username, setUsername] = useState(user.username || '');
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [paymentAccounts, setPaymentAccounts] = useState(user.paymentAccounts || { bKash: '', Nagad: '', Rocket: '' });
  const [uploading, setUploading] = useState(false);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && uploadFile) {
      setUploading(true);
      const filePath = await uploadFile(file, 'avatar');
      setUploading(false);
      if (filePath) {
        setAvatar(filePath);
      } else {
        alert('Failed to upload avatar');
      }
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-10 text-slate-900">
      <div className="bg-white rounded-[1rem] p-8 md:p-16 shadow-sm border border-slate-200 flex flex-col items-center">
        <div className="relative group cursor-pointer w-40 h-40 mb-10 shadow-2xl rounded-[1rem] overflow-hidden border-4 border-white" onClick={() => !uploading && document.getElementById('av-up')?.click()}>
          {avatar ? <img src={avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-indigo-600 flex items-center justify-center text-white text-5xl font-bold uppercase tracking-tighter">{username.charAt(0) || user.email.charAt(0)}</div>}
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm">
            <span className="text-white text-[10px] font-bold uppercase tracking-widest">{uploading ? 'Uploading...' : 'Update Photo'}</span>
          </div>
          <input type="file" id="av-up" className="hidden" accept="image/*" onChange={handleAvatarChange} disabled={uploading} />
        </div>
        <div className="w-full space-y-8">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2 px-1 tracking-widest">Full Name</label>
            <input className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs font-bold text-slate-700 shadow-inner" value={username} onChange={e => setUsername(e.target.value)} />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2 px-1 tracking-widest">Email</label>
            <input className="w-full px-5 py-4 bg-slate-100 border border-slate-200 rounded-xl outline-none text-xs font-bold text-slate-700 shadow-inner" value={user.email} disabled />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2 px-1 tracking-widest">Wallet</label>
            <div className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800">৳{(user.wallet || 0).toLocaleString()}</div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {['bKash', 'Nagad', 'Rocket'].map(method => (
                <div key={method}>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2 px-1 tracking-widest">{method} Account</label>
                  <input className="w-full px-5 py-4 bg-white border border-slate-200 rounded-xl outline-none text-xs font-bold text-slate-700 shadow-inner" placeholder="01XXXXXXXXX" value={paymentAccounts[method as keyof typeof paymentAccounts] || ''} onChange={e => setPaymentAccounts({...paymentAccounts, [method]: e.target.value})} />
                </div>
              ))}
            </div>
          </div>
          <Button variant="primary" onClick={() => onUpdate(username, avatar, paymentAccounts)} disabled={uploading} className="w-full">{uploading ? 'Saving...' : 'Save'}</Button>
        </div>
      </div>
    </div>
  );
};

export default ProfileView;
