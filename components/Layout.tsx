
import React from 'react';
import { Icons } from '../constants';
import { Role, User } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentUser: User;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, currentUser, onLogout, activeTab, setActiveTab }) => {
  const userRole = currentUser.role;
  const displayName = currentUser.username || currentUser.email;

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Icons.Dashboard },
    { id: 'sales', label: 'Sales & Work', icon: Icons.Sales },
    ...(userRole === 'admin' ? [{ id: 'employees', label: 'Team Hub', icon: Icons.Users }] : []),
    { id: 'profile', label: 'My Profile', icon: Icons.UserCircle },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm">
        <div className="p-6">
          <h1 className="text-xl font-bold text-indigo-600 flex items-center gap-2">
            <span className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white">C</span>
            CommishPro
          </h1>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-4">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === item.id
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'
              }`}
            >
              <item.icon />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="bg-slate-50 p-3 rounded-lg mb-4 flex items-center gap-3">
            {currentUser.avatar ? (
              <img src={currentUser.avatar} alt="Profile" className="h-10 w-10 rounded-full object-cover border-2 border-indigo-200" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-slate-700 truncate">{displayName}</p>
              <p className="text-[10px] text-indigo-600 font-bold uppercase">{userRole}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Icons.Logout />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-8 justify-between shrink-0">
          <h2 className="text-lg font-semibold text-slate-800 capitalize">{activeTab.replace('-', ' ')}</h2>
        </header>
        <div className="flex-1 overflow-y-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
