
import React from 'react';
import { View, User, UserRole } from '../types';

interface SidebarProps {
  currentView: View;
  setView: (v: View) => void;
  user: User;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, user, onLogout }) => {
  const isAdmin = user.role === UserRole.ADMIN;

  const menuItems = [
    { id: View.DASHBOARD, label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: View.INVENTORY, label: 'Inventory', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
    { id: View.POS, label: 'Point of Sale', icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z' },
    { id: View.REPORTS, label: 'Reports', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', adminOnly: true },
    { id: View.HISTORY, label: 'Sales History', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  ];

  return (
    <aside className="group w-20 hover:w-64 bg-indigo-950 h-screen sticky top-0 text-white flex flex-col transition-all duration-300 ease-in-out z-30 overflow-x-hidden border-r border-indigo-900 shadow-xl">
      <div className="p-5 mb-4 shrink-0">
        <div className="flex items-center gap-4 overflow-hidden">
          <div className="w-10 h-10 shrink-0 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h1 className="text-xl font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            Sarkar Trade Stock
          </h1>
        </div>
      </div>
      
      <nav className="flex-1 px-3 space-y-2">
        {menuItems.filter(item => !item.adminOnly || isAdmin).map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={`w-full flex items-center gap-4 px-3.5 py-3 rounded-xl transition-all duration-200 relative group/item ${
              currentView === item.id 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-indigo-300 hover:bg-indigo-800/40 hover:text-white'
            }`}
          >
            <div className="shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
              </svg>
            </div>
            <span className="font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              {item.label}
            </span>
            
            <div className="absolute left-full ml-4 px-2 py-1 bg-indigo-900 text-white text-xs rounded opacity-0 group-hover:hidden pointer-events-none whitespace-nowrap z-50 shadow-lg">
              {item.label}
            </div>
          </button>
        ))}
      </nav>

      <div className="p-4 mt-auto border-t border-indigo-900/50 bg-indigo-950/80">
        <div className="flex flex-col gap-4 overflow-hidden">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center font-bold text-white shadow-inner">
              {user.fullName.charAt(0)}
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap min-w-0 flex-1">
              <p className="text-sm font-bold truncate text-white">{user.fullName}</p>
              <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider truncate">{user.role}</p>
            </div>
          </div>
          
          <button 
            onClick={onLogout}
            className="flex items-center gap-4 px-3.5 py-2 rounded-xl text-rose-400 hover:bg-rose-900/20 hover:text-rose-300 transition-colors"
          >
            <div className="shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </div>
            <span className="text-xs font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              Logout
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
