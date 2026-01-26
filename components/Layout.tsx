
import React, { useState } from 'react';
import { Icons } from '../constants';
import { Role, User, AppNotification } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentUser: User;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  notifications: AppNotification[];
  onClearNotifications: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, currentUser, onLogout, activeTab, setActiveTab, notifications, onClearNotifications }) => {
  const userRole = currentUser.role;
  const displayName = currentUser.username || currentUser.email;
  const [showNotif, setShowNotif] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Icons.Dashboard },
    { id: 'products', label: 'Products', icon: Icons.Tag },
    ...(userRole === 'admin' ? [{ id: 'employees', label: 'Team Hub', icon: Icons.Users }] : []),
    { id: 'announcements', label: 'Announcements', icon: Icons.Speakerphone },
    { id: 'profile', label: 'My Profile', icon: Icons.UserCircle },
  ];

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm">
        <div className="p-6">
          <h1 className="text-xl font-black text-indigo-600 flex items-center gap-2 tracking-tighter">
            <span className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">C</span>
            COMMISH<span className="text-slate-400">PRO</span>
          </h1>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-4">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                activeTab === item.id
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'
              }`}
            >
              <item.icon />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="bg-slate-50 p-4 rounded-2xl mb-4 flex items-center gap-3 border border-slate-100">
            {currentUser.avatar ? (
              <img src={currentUser.avatar} alt="Profile" className="h-10 w-10 rounded-full object-cover border-2 border-white shadow-sm" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="overflow-hidden">
              <p className="text-xs font-black text-slate-800 truncate">{displayName}</p>
              <p className="text-[10px] text-indigo-500 font-black uppercase tracking-widest">{userRole}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-all"
          >
            <Icons.Logout />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center px-10 justify-between shrink-0 z-10 shadow-sm">
          <h2 className="text-xl font-black text-slate-900 capitalize tracking-tight">{activeTab.replace('-', ' ')}</h2>
          
          <div className="flex items-center gap-4 relative">
            <button 
              onClick={() => setShowNotif(!showNotif)}
              className="relative p-2.5 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all border border-transparent hover:border-indigo-100"
            >
              <Icons.Bell />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-4 w-4 bg-red-500 border-2 border-white rounded-full text-[8px] font-black text-white flex items-center justify-center animate-bounce">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotif && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotif(false)}></div>
                <div className="absolute right-0 top-14 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h4 className="font-black text-slate-800 text-sm">Notifications</h4>
                    <button onClick={onClearNotifications} className="text-[10px] font-black text-indigo-600 uppercase hover:underline">Clear All</button>
                  </div>
                  <div className="max-h-96 overflow-y-auto divide-y divide-slate-50">
                    {notifications.length === 0 ? (
                      <div className="p-10 text-center">
                        <p className="text-xs text-slate-400 font-medium italic">No new alerts.</p>
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} className="p-4 hover:bg-slate-50 transition-colors flex gap-3">
                          <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${n.type === 'sale' ? 'bg-indigo-500' : 'bg-emerald-500'}`}></div>
                          <div>
                            <p className="text-xs text-slate-700 font-medium leading-relaxed">{n.message}</p>
                            <p className="text-[9px] text-slate-400 mt-1 font-bold uppercase">{new Date(n.timestamp).toLocaleString()}</p>
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
        <div className="flex-1 overflow-y-auto p-10">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
