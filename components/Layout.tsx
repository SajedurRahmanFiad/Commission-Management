
import React, { useState } from 'react';
import { Icons } from '../constants';
import { Role, User, AppNotification } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentUser: User;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onClearNotifications: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, currentUser, onLogout, activeTab, setActiveTab, onClearNotifications }) => {
  const userRole = currentUser.role;
  const displayName = currentUser.username || currentUser.email;
  const [showNotif, setShowNotif] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Icons.Dashboard },
    { id: 'products', label: 'Products', icon: Icons.Tag },
    ...(userRole === 'admin' ? [{ id: 'employees', label: 'Team Hub', icon: Icons.Users }] : []),
    { id: 'withdraw', label: 'Withdraw', icon: Icons.Cash },
    { id: 'announcements', label: 'Announcements', icon: Icons.Speakerphone },
    { id: 'profile', label: 'My Profile', icon: Icons.UserCircle },
  ];

  const notifications = currentUser.notifications || [];
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shadow-sm">
        <div className="p-8">
          <h1 className="text-2xl font-black text-indigo-600 flex items-center gap-3 tracking-tighter">
            <span className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">C</span>
            COMMISH<span className="text-slate-400">PRO</span>
          </h1>
        </div>

        <nav className="flex-1 px-5 space-y-1.5 mt-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3.5 px-5 py-3.5 rounded-2xl text-[13px] font-black transition-all ${
                activeTab === item.id
                  ? 'bg-indigo-600 text-white shadow-2xl shadow-indigo-200'
                  : 'text-slate-500 hover:bg-indigo-50 hover:text-indigo-600'
              }`}
            >
              <item.icon />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-slate-100">
          <div className="bg-slate-50 p-4 rounded-3xl mb-5 flex items-center gap-3 border border-slate-100 group hover:border-indigo-200 transition-colors">
            {currentUser.avatar ? (
              <img src={currentUser.avatar} alt="Profile" className="h-11 w-11 rounded-2xl object-cover border-2 border-white shadow-md" />
            ) : (
              <div className="h-11 w-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-lg">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="overflow-hidden">
              <p className="text-xs font-black text-slate-800 truncate">{displayName}</p>
              <p className="text-[10px] text-indigo-500 font-black uppercase tracking-widest mt-0.5">{userRole}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2.5 px-5 py-3 text-sm font-black text-red-500 bg-red-50 hover:bg-red-100 rounded-2xl transition-all active:scale-95"
          >
            <Icons.Logout />
            Log Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-24 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center px-12 justify-between shrink-0 z-10 shadow-sm">
          <h2 className="text-2xl font-black text-slate-900 capitalize tracking-tighter">{activeTab.replace('-', ' ')}</h2>
          
          <div className="flex items-center gap-5 relative">
            <button 
              onClick={() => setShowNotif(!showNotif)}
              className={`relative p-3 rounded-2xl transition-all border ${showNotif ? 'bg-indigo-600 text-white border-indigo-700 shadow-xl' : 'bg-white text-slate-400 border-slate-200 hover:text-indigo-600 hover:border-indigo-100 hover:shadow-lg'}`}
            >
              <Icons.Bell />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 border-2 border-white rounded-full text-[9px] font-black text-white flex items-center justify-center shadow-lg animate-bounce">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotif && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotif(false)}></div>
                <div className="absolute right-0 top-16 w-80 bg-white border border-slate-200 rounded-3xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] z-50 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="p-5 border-b border-slate-50 flex justify-between items-center bg-slate-50/80 backdrop-blur-sm">
                    <h4 className="font-black text-slate-800 text-xs uppercase tracking-widest">Inbox</h4>
                    <button onClick={() => { onClearNotifications(); setShowNotif(false); }} className="text-[10px] font-black text-indigo-600 uppercase hover:underline">Mark as read</button>
                  </div>
                  <div className="max-h-[450px] overflow-y-auto divide-y divide-slate-50 scrollbar-hide">
                    {notifications.length === 0 ? (
                      <div className="p-12 text-center">
                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 opacity-50"><Icons.Bell /></div>
                        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">Everything clear</p>
                      </div>
                    ) : (
                      notifications.slice().reverse().map(n => (
                        <div key={n.id} className={`p-5 hover:bg-slate-50 transition-colors flex gap-4 ${!n.read ? 'bg-indigo-50/30' : ''}`}>
                          <div className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 shadow-sm ${n.type === 'sale' ? 'bg-indigo-500' : n.type === 'announcement' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                          <div>
                            <p className="text-[13px] text-slate-700 font-bold leading-snug">{n.message}</p>
                            <p className="text-[9px] text-slate-400 mt-2 font-black uppercase tracking-widest">{new Date(n.timestamp).toLocaleString()}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-12 bg-slate-50/50">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
