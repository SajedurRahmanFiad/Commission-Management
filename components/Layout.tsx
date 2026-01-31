
import React, { useState, useRef, useEffect } from 'react';
import { Icons } from '../constants';
import { Role, User, AppNotification } from '../types';
import { BadgeCounts } from '../services/notificationBadgeService';

interface LayoutProps {
  children: React.ReactNode;
  currentUser: User;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onClearNotifications: () => void;
  badgeCounts?: BadgeCounts;
  // Optional key to represent current content (e.g., selected product/user id)
  contentKey?: string | number | null;
  // Date filter (controls views)
  dateFilter?: { type: 'all' | 'today' | '7d' | '30d' | 'custom'; from?: string; to?: string };
  onDateFilterChange?: (f: { type: 'all' | 'today' | '7d' | '30d' | 'custom'; from?: string; to?: string }) => void;
}

export const formatDateTime = (isoString: string) => {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const Layout: React.FC<LayoutProps> = ({ children, currentUser, onLogout, activeTab, setActiveTab, onClearNotifications, badgeCounts, contentKey, dateFilter, onDateFilterChange }) => {
  const userRole = currentUser?.role;
  const displayName = (currentUser && (currentUser.username || currentUser.email)) || '—';
  const displayInitial = displayName && typeof displayName === 'string' && displayName.length ? displayName.charAt(0).toUpperCase() : '—';
  const [showNotif, setShowNotif] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showCustomPanel, setShowCustomPanel] = useState(false);
  const [showFilterMobile, setShowFilterMobile] = useState(false);
  const [tempFrom, setTempFrom] = useState<string | undefined>(undefined);
  const [tempTo, setTempTo] = useState<string | undefined>(undefined);
  const profileBtnRef = useRef<HTMLButtonElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  // close profile menu when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!showProfileMenu) return;
      if (!profileMenuRef.current?.contains(e.target as Node) && !profileBtnRef.current?.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [showProfileMenu]);

  // Content animation when switching tabs or contentKey changes
  const [contentAnimClass, setContentAnimClass] = useState('');
  useEffect(() => {
    // apply a short enter animation class then remove it
    setContentAnimClass('animate-in fade-in slide-in-from-bottom-4 duration-300');
    const t = setTimeout(() => setContentAnimClass(''), 350);
    return () => clearTimeout(t);
  }, [activeTab, contentKey]);

  // Default badge counts if not provided
  const badges = badgeCounts || { sales: 0, withdraw: 0, announcements: 0 };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Icons.Dashboard },
    { id: 'sales', label: 'Sales', icon: Icons.Sales },
    { id: 'products', label: 'Products', icon: Icons.Tag },
    ...(userRole === 'admin' ? [{ id: 'employees', label: 'Agents Hub', icon: Icons.Users }] : []),
    { id: 'withdraw', label: 'Withdraw', icon: Icons.Cash },
    { id: 'announcements', label: 'Notices', icon: Icons.Speakerphone },
    { id: 'profile', label: 'My Profile', icon: Icons.UserCircle },
  ];

  const notifications = currentUser.notifications || [];
  const unreadCount = notifications.filter(n => !n.read).length;

  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Scroll to top when navigating between tabs or when contentKey changes (e.g., opening detail)
    try { contentRef.current?.scrollTo?.({ top: 0, behavior: 'auto' }); } catch (e) {}
  }, [activeTab, contentKey]);

  // Helper component to render badge if count > 0
  const Badge: React.FC<{ count: number }> = ({ count }) => {
    if (count <= 0) return null;
    return (
      <span className="ml-2 inline-flex items-center justify-center h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold">
        {count > 99 ? '99+' : count}
      </span>
    );
  };

  const Navigation = () => (
    <nav className="space-y-1">
      {menuItems.map((item) => {
        // Get badge count for this item
        let badgeCount = 0;
        if (item.id === 'sales') badgeCount = badges.sales;
        else if (item.id === 'withdraw') badgeCount = badges.withdraw;
        else if (item.id === 'announcements') badgeCount = badges.announcements;

        return (
          <button
            key={item.id}
            onClick={() => {
              setActiveTab(item.id);
              setIsMobileMenuOpen(false);
              // scroll content to top when navigating (useful for mobile)
              try { contentRef.current?.scrollTo?.({ top: 0, behavior: 'auto' }); } catch (e) {}
            }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === item.id
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'
            }`}
          >
            <item.icon />
            <span className="flex items-center">
              {item.label}
              {badgeCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                  {badgeCount > 99 ? '99+' : badgeCount}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );

  const activeLabel = menuItems.find(m => m.id === activeTab)?.label || (activeTab === 'employees' ? 'Agents' : activeTab.replace('-', ' '));

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col shadow-sm">
        <div className="p-6">
          <h1 className="text-xl font-bold text-indigo-600 flex items-center gap-2">
            <span className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">S</span>
            Sales Panel
          </h1>
        </div>

        <div className="flex-1 px-4 mt-4">
          <Navigation />
        </div>

        <div className="p-4 border-t border-slate-100">
          <div className="bg-slate-50 p-3 rounded-xl mb-4 flex items-center gap-3 border border-slate-100">
            {currentUser.avatar ? (
              <img src={currentUser.avatar} alt="Profile" className="h-9 w-9 rounded-lg object-cover border border-white" />
            ) : (
              <div className="h-9 w-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                {displayInitial}
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
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-4 md:px-8 justify-between shrink-0 z-10 relative">
          <div className="flex items-center gap-3">
            {/* Mobile menu button removed: bottom nav used for mobile navigation */}
            <h2 className="text-lg font-semibold text-slate-800 capitalize truncate max-w-[150px] md:max-w-none">
              {activeLabel}
            </h2>
          </div>
          {/* Right-aligned controls: filter (top) and credit (below) */}
          <div className="absolute right-4 inset-y-0 flex flex-col items-end justify-center gap-1">
            <div className="hidden sm:block relative">
              <select value={dateFilter?.type || 'all'} onChange={e => {
                const val = e.target.value as any;
                if (val !== 'custom') {
                  onDateFilterChange && onDateFilterChange({ type: val });
                } else {
                  setTempFrom(dateFilter?.from);
                  setTempTo(dateFilter?.to);
                  setShowCustomPanel(true);
                }
              }} className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 outline-none text-xs font-bold text-slate-700">
                <option value="all">All time</option>
                <option value="today">Today</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="custom">Custom range</option>
              </select>

              {showCustomPanel && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-100 rounded-xl shadow-lg p-4 z-50">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">From (date/time)</label>
                  <input type="datetime-local" value={tempFrom || ''} onChange={e => setTempFrom(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 mb-3" />
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">To (date/time)</label>
                  <input type="datetime-local" value={tempTo || ''} onChange={e => setTempTo(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 mb-4" />
                  <div className="flex gap-2">
                    <button onClick={() => {
                      if (!tempFrom) return alert('Select a start date/time');
                      onDateFilterChange && onDateFilterChange({ type: 'custom', from: tempFrom, to: tempTo });
                      setShowCustomPanel(false);
                    }} className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold">Apply</button>
                    <button onClick={() => { setShowCustomPanel(false); }} className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold">Cancel</button>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Mobile-only full credit at the bottom of page (requires scroll to see) */}

          {/* Mobile controls: filter + profile */}
          <div className="sm:hidden absolute right-4 inset-y-0 flex items-center gap-2">
            <button onClick={() => setShowFilterMobile(true)} className="p-2 rounded-md text-slate-600 hover:bg-slate-50 border border-slate-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 01.707 1.707L11 12.414V16a1 1 0 01-1.447.894l-2-1A1 1 0 017 15v-2.586L2.293 6.707A1 1 0 013 5z" clipRule="evenodd" />
              </svg>
            </button>

            <div className="relative">
              <button ref={profileBtnRef} aria-haspopup="true" aria-expanded={showProfileMenu} onClick={() => setShowProfileMenu(s => !s)} className="h-9 w-9 rounded-full bg-slate-100 overflow-hidden flex items-center justify-center border border-slate-100">
                {currentUser.avatar ? (
                  <img src={currentUser.avatar} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-sm font-bold text-indigo-600 uppercase">{displayInitial}</span>
                )}
              </button>

              <div
                ref={profileMenuRef}
                role="menu"
                aria-hidden={!showProfileMenu}
                className={`absolute right-0 top-full mt-2 w-44 bg-white border border-slate-100 rounded-xl shadow-lg p-2 z-50 transform transition-all duration-200 origin-top-right ${showProfileMenu ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'}`}
              >
                <button onClick={() => { setActiveTab('profile'); setShowProfileMenu(false); }} className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-md">My Profile</button>
                <button onClick={() => { setShowProfileMenu(false); onLogout(); }} className="w-full text-left px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 rounded-md">Log Out</button>
              </div> 
            </div>
          </div>
        </header>

        <div aria-hidden={!showFilterMobile} className={`fixed inset-0 z-[9999] p-6 transition-colors duration-200 ${showFilterMobile ? 'bg-white pointer-events-auto' : 'bg-white/0 pointer-events-none'}`}>
          <div className={`max-w-md mx-auto transition-transform duration-200 ${showFilterMobile ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold">Filter by date</h4>
              <button onClick={() => setShowFilterMobile(false)} className="p-2 text-slate-500"><Icons.X /></button>
            </div>

            <select value={dateFilter?.type || 'all'} onChange={e => {
              const v = e.target.value as any;
              if (v !== 'custom') {
                onDateFilterChange && onDateFilterChange({ type: v });
                setShowFilterMobile(false);
              } else {
                setTempFrom(dateFilter?.from);
                setTempTo(dateFilter?.to);
                setShowCustomPanel(true);
              }
            }} className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 mb-4">
              <option value="all">All time</option>
              <option value="today">Today</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="custom">Custom range</option>
            </select>

            {showCustomPanel && (
              <div className="mb-4">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">From</label>
                <input type="datetime-local" value={tempFrom || ''} onChange={e => setTempFrom(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 mb-3" />
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">To</label>
                <input type="datetime-local" value={tempTo || ''} onChange={e => setTempTo(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200" />
                <div className="flex gap-2 mt-3">
                  <button onClick={() => { if (!tempFrom) return alert('Select a start date/time'); onDateFilterChange && onDateFilterChange({ type: 'custom', from: tempFrom, to: tempTo }); setShowCustomPanel(false); setShowFilterMobile(false); }} className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold">Apply</button>
                  <button onClick={() => { setShowCustomPanel(false); }} className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div ref={contentRef} className={`flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 py-6 md:py-8 pb-28 md:pb-8 ${contentAnimClass}`}>
          {children}

          {/* Mobile-only full credit at the bottom of page (requires scroll to see) */}
          <div className="mt-6 text-center pb-6">
            <a href="https://sajedurrahmanfiad.me" target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-slate-400 hover:text-indigo-600 transition-colors hover:underline">Designed and developed by Fiad</a>
          </div>
        </div>
        {/* Mobile Bottom Nav */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 py-2 px-1">
          <div className="flex items-center w-full">
            {menuItems.filter(item => item.id !== 'profile').map((item) => {
              let badgeCount = 0;
              if (item.id === 'sales') badgeCount = badges.sales;
              else if (item.id === 'withdraw') badgeCount = badges.withdraw;
              else if (item.id === 'announcements') badgeCount = badges.announcements;

              // Short label for announcements on mobile and rename employees to Agents
              const label = item.id === 'announcements' ? 'Notices' : item.id === 'employees' ? 'Agents' : item.label;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    // ensure content scrolls to top on mobile tab navigation
                    try { contentRef.current?.scrollTo?.({ top: 0, behavior: 'auto' }); } catch (e) {}
                  }}
                  aria-current={activeTab === item.id ? 'page' : undefined}
                  className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[9px] py-1 transition-all ${activeTab === item.id ? 'text-indigo-600 rounded-t-xl' : 'text-slate-600 hover:text-indigo-600'}`}
                >
                  <div className={`relative flex items-center justify-center ${activeTab === item.id ? 'bg-indigo-100 text-indigo-600 p-2 rounded-lg scale-105' : 'transform scale-90'}`}>
                    <item.icon />
                    {badgeCount > 0 && (
                      <span className="absolute -top-1 -right-2 inline-flex items-center justify-center h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-bold">
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] truncate leading-3">{label}</span>
                </button>
              );
            })}
          </div>
        </div>


      </main>
    </div>
  );
};

export default Layout;
