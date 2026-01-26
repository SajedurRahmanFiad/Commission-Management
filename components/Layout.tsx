
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
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm">
        <div className="p-6">
          <h1 className="text-xl font-bold text-indigo-600 flex items-center gap-2">
            <span className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">C</span>
            CommishPro
          </h1>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-4">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === item.id
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'
              }`}
            >
              <item.icon />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="bg-slate-50 p-3 rounded-xl mb-4 flex items-center gap-3 border border-slate-100">
            {currentUser.avatar ? (
              <img src={currentUser.avatar} alt="Profile" className="h-9 w-9 rounded-lg object-cover border border-white" />
            ) : (
              <div className="h-9 w-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-slate-800 truncate">{displayName}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{userRole}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-50 rounded-xl transition-all"
          >
            <Icons.Logout />
            Log Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-8 justify-between shrink-0 z-10">
          <h2 className="text-lg font-semibold text-slate-800 capitalize">{activeTab.replace('-', ' ')}</h2>
          
          <div className="flex items-center gap-4 relative">
            <button 
              onClick={() => setShowNotif(!showNotif)}
              className={`relative p-2 rounded-lg transition-all border ${showNotif ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-400 border-slate-200 hover:text-indigo-600 hover:bg-indigo-50'}`}
            >
              <Icons.Bell />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 border-2 border-white rounded-full text-[8px] font-bold text-white flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotif && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotif(false)}></div>
                <div className="absolute right-0 top-12 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Notifications</h4>
                    <button onClick={() => { onClearNotifications(); setShowNotif(false); }} className="text-[10px] font-bold text-indigo-600 uppercase hover:underline">Mark read</button>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-xs">No notifications</div>
                    ) : (
                      notifications.slice().reverse().map(n => (
                        <div key={n.id} className={`p-4 hover:bg-slate-50 transition-colors flex gap-3 ${!n.read ? 'bg-indigo-50/30' : ''}`}>
                          <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${n.type === 'sale' ? 'bg-indigo-500' : n.type === 'announcement' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                          <div>
                            <p className="text-xs text-slate-700 font-medium leading-normal">{n.message}</p>
                            <p className="text-[9px] text-slate-400 mt-1 font-semibold uppercase">{new Date(n.timestamp).toLocaleTimeString()}</p>
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
        <div className="flex-1 overflow-y-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
