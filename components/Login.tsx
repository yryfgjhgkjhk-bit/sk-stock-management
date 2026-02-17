
import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');

  // Load saved credentials on mount
  useEffect(() => {
    const saved = localStorage.getItem('sarkartrade_saved_creds');
    if (saved) {
      const { u, p } = JSON.parse(saved);
      setUsername(u || '');
      setPassword(p || '');
      setRememberMe(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Simulation of a basic authentication system
    if (username === 'admin' && password === 'admin') {
      const user = {
        id: '1',
        username: 'admin',
        role: UserRole.ADMIN,
        fullName: 'Admin User'
      };
      
      if (rememberMe) {
        localStorage.setItem('sarkartrade_saved_creds', JSON.stringify({ u: username, p: password }));
      } else {
        localStorage.removeItem('sarkartrade_saved_creds');
      }
      
      onLogin(user);
    } else if (username === 'sales' && password === 'sales') {
      const user = {
        id: '2',
        username: 'sales',
        role: UserRole.SALESPERSON,
        fullName: 'Sales Associate'
      };

      if (rememberMe) {
        localStorage.setItem('sarkartrade_saved_creds', JSON.stringify({ u: username, p: password }));
      } else {
        localStorage.removeItem('sarkartrade_saved_creds');
      }

      onLogin(user);
    } else {
      setError('Invalid username or password. Use admin/admin or sales/sales.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-slideUp">
        <div className="bg-indigo-600 p-10 text-center text-white">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/30">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight">Sarkar Trade</h1>
          <p className="text-indigo-200 font-bold text-sm mt-1 uppercase tracking-widest">Management Suite</p>
        </div>
        
        <form onSubmit={handleLogin} className="p-10 space-y-6">
          {error && (
            <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-xl text-xs font-bold text-center">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Username</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 outline-none transition font-bold"
              placeholder="e.g. admin"
              autoFocus
            />
          </div>
          
          <div className="relative">
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 outline-none transition font-bold pr-14"
                placeholder="••••••••"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition p-2"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 px-1">
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className="relative">
                <input 
                  type="checkbox" 
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-5 h-5 border-2 rounded-lg transition-all ${rememberMe ? 'bg-indigo-600 border-indigo-600' : 'border-slate-200 bg-white group-hover:border-indigo-300'}`}>
                  {rememberMe && (
                    <svg className="w-full h-full text-white p-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Remember Me</span>
            </label>
          </div>
          
          <button 
            type="submit"
            className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition uppercase tracking-widest text-xs"
          >
            Enter Workspace
          </button>

          <div className="pt-4 border-t border-slate-100 text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Demo Credentials</p>
            <div className="flex justify-center gap-4 mt-2">
              <span className="text-[10px] font-black text-slate-600">Admin: admin/admin</span>
              <span className="text-[10px] font-black text-slate-600">Sales: sales/sales</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
