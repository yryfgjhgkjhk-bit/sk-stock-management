
import React, { useState } from 'react';
import { Product, Sale, View } from '../types';
import { GoogleGenAI } from '@google/genai';

interface DashboardProps {
  products: Product[];
  sales: Sale[];
  setView: (v: View) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ products, sales, setView }) => {
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const totalStockValue = products.reduce((acc, p) => acc + (p.sellPrice * p.stock), 0);
  const lowStockItems = products.filter(p => p.stock <= p.minStock);
  const todaySales = sales.filter(s => new Date(s.timestamp).toDateString() === new Date().toDateString());
  const dailyRevenue = todaySales.reduce((acc, s) => acc + s.total, 0);

  const generateAiInsights = async () => {
    setLoadingAi(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const stockSummary = products.map(p => `${p.name}: ${p.stock} left (Min: ${p.minStock})`).join(', ');
      const salesSummary = sales.slice(0, 10).map(s => `Sale of ${s.total} with ${s.items.length} items`).join(', ');

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `As a business analyst, look at this stock: [${stockSummary}] and recent sales: [${salesSummary}]. Give 3 short, actionable bullet points for the store owner. Be concise.`,
      });

      setAiInsight(response.text || "Unable to generate insights at this time.");
    } catch (error) {
      console.error("AI Insight Error:", error);
      setAiInsight("Failed to fetch AI insights. Check your internet connection.");
    } finally {
      setLoadingAi(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Store Overview</h2>
          <p className="text-slate-500">Welcome back. Here's what's happening today.</p>
        </div>
        <button 
          onClick={generateAiInsights}
          disabled={loadingAi}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition shadow-sm disabled:opacity-50"
        >
          {loadingAi ? 'Thinking...' : 'Get AI Insights'}
        </button>
      </header>

      {aiInsight && (
        <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl shadow-inner relative overflow-hidden">
          <h3 className="text-indigo-800 font-bold mb-2 flex items-center gap-2">
            <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 rounded uppercase font-black">AI Suggestions</span>
          </h3>
          <div className="text-indigo-900 whitespace-pre-line text-sm leading-relaxed">
            {aiInsight}
          </div>
          <button onClick={() => setAiInsight(null)} className="mt-3 text-indigo-600 text-xs font-semibold hover:underline">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-slate-500 text-sm font-medium">Daily Revenue</p>
          <p className="text-2xl font-bold mt-2">${dailyRevenue.toFixed(2)}</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-slate-500 text-sm font-medium">Potential Asset Value</p>
          <p className="text-2xl font-bold mt-2">${totalStockValue.toLocaleString()}</p>
          <p className="mt-4 text-slate-400 text-xs font-medium">Across {products.length} products</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden">
          <p className="text-slate-500 text-sm font-medium">Low Stock Items</p>
          <p className="text-2xl font-bold mt-2 text-rose-600">{lowStockItems.length}</p>
          {lowStockItems.length > 0 && (
             <button onClick={() => setView(View.INVENTORY)} className="mt-4 text-rose-600 text-xs font-bold hover:underline flex items-center">
               View alerts
             </button>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-slate-500 text-sm font-medium">Completed Sales</p>
          <p className="text-2xl font-bold mt-2">{todaySales.length}</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
