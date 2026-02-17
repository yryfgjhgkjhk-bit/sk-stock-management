
import React, { useMemo, useState } from 'react';
import { Product, Sale, StockLog } from '../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';

interface ReportsProps {
  products: Product[];
  sales: Sale[];
}

interface CombinedStockLog extends StockLog {
  productName: string;
}

const Reports: React.FC<ReportsProps> = ({ products, sales }) => {
  const [activeTab, setActiveTab] = useState<'sales' | 'inventory' | 'movement'>('sales');
  const [movementSearch, setMovementSearch] = useState('');

  const salesByDay = useMemo(() => {
    const map = new Map();
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toDateString();
    }).reverse();

    last7Days.forEach(day => map.set(day, 0));
    sales.forEach(s => {
      const day = new Date(s.timestamp).toDateString();
      if (map.has(day)) map.set(day, map.get(day) + s.total);
    });

    return Array.from(map.entries()).map(([date, total]) => ({
      date: date.split(' ').slice(1, 3).join(' '),
      total
    }));
  }, [sales]);

  const allStockMovement = useMemo(() => {
    const logs: CombinedStockLog[] = [];
    products.forEach(p => {
      (p.stockHistory || []).forEach(log => {
        logs.push({ ...log, productName: p.name });
      });
    });
    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [products]);

  const filteredMovement = allStockMovement.filter(log => 
    log.productName.toLowerCase().includes(movementSearch.toLowerCase()) ||
    log.type.toLowerCase().includes(movementSearch.toLowerCase())
  );

  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="space-y-8 animate-fadeIn">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Business Reports</h2>
          <p className="text-slate-500">Track performance and movement history.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl no-print">
          {(['sales', 'inventory', 'movement'] as const).map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-bold text-xs uppercase transition ${activeTab === tab ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {tab} Report
            </button>
          ))}
        </div>
      </header>

      {activeTab === 'sales' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-800 mb-6">Last 7 Days Revenue</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesByDay}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="total" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'inventory' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b flex justify-between items-center">
            <h3 className="font-bold">Inventory Status</h3>
            <button onClick={() => window.print()} className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg text-xs font-bold no-print">Print Status</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400">
                <tr><th className="px-6 py-4">Product</th><th className="px-6 py-4">Stock</th><th className="px-6 py-4">Asset Value</th><th className="px-6 py-4">Status</th></tr>
              </thead>
              <tbody className="text-sm divide-y">
                {products.map(p => (
                  <tr key={p.id}>
                    <td className="px-6 py-4 font-bold text-slate-700">{p.name}</td>
                    <td className="px-6 py-4">{p.stock}</td>
                    <td className="px-6 py-4 font-black text-slate-900">${(p.sellPrice * p.stock).toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className={`font-bold ${p.stock <= p.minStock ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {p.stock <= p.minStock ? 'Low Stock' : 'Healthy'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'movement' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fadeIn">
          <div className="p-4 border-b flex flex-col sm:flex-row justify-between items-center gap-4 no-print">
            <h3 className="font-bold text-slate-800">Stock Movement History</h3>
            <div className="relative w-full sm:w-64">
              <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input type="text" placeholder="Filter by product..." value={movementSearch} onChange={(e) => setMovementSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-slate-50 border rounded-lg text-xs" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[9px] font-bold uppercase text-slate-400">
                <tr><th className="px-6 py-3">Time</th><th className="px-6 py-3">Product</th><th className="px-6 py-3">Type</th><th className="px-6 py-3">Change</th><th className="px-6 py-3">Balance</th></tr>
              </thead>
              <tbody className="text-[11px] divide-y divide-slate-100">
                {filteredMovement.map((log, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-2.5 text-slate-400 font-mono">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="px-6 py-2.5 font-bold text-slate-700">{log.productName}</td>
                    <td className="px-6 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full font-black text-[9px] ${
                        log.type === 'SALE' ? 'bg-indigo-100 text-indigo-700' :
                        log.type === 'RESTOCK' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}>{log.type}</span>
                    </td>
                    <td className={`px-6 py-2.5 font-black ${log.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {log.amount > 0 ? `+${log.amount}` : log.amount}
                    </td>
                    <td className="px-6 py-2.5 font-bold text-slate-900">{log.balance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
