
import React, { useState, useMemo, useRef } from 'react';
import { Product, StockLog, UserRole } from '../types';
import { GoogleGenAI, Type } from '@google/genai';

interface InventoryProps {
  products: Product[];
  categories: string[];
  onAddCategory: (name: string) => void;
  onRenameCategory: (oldName: string, newName: string) => void;
  onDeleteCategory: (name: string) => void;
  onAdd: (p: Product) => void;
  onUpdate: (p: Product) => void;
  onBulkUpdate: (ids: string[], updates: Partial<Product>) => void;
  onDelete: (id: string) => void;
  onRestock: (id: string, amount: number) => void;
  onAdjust: (id: string, amount: number, reason: string) => void;
  userRole: UserRole;
}

interface ScannedItem {
  name: string;
  sku: string;
  quantity: number;
  price: number;
  matchedId?: string;
  matchedName?: string;
  isNew?: boolean;
  selected: boolean;
}

type SortDirection = 'asc' | 'desc' | null;
interface SortConfig {
  key: keyof Product;
  direction: SortDirection;
}

const Inventory: React.FC<InventoryProps> = ({ 
  products, 
  categories,
  onAdd, 
  onUpdate, 
  onDelete, 
  onRestock,
  userRole
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  const isAdmin = userRole === UserRole.ADMIN;

  // Multi-column sort state
  const [sortConfigs, setSortConfigs] = useState<SortConfig[]>([
    { key: 'category', direction: 'asc' },
    { key: 'name', direction: 'asc' }
  ]);

  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quick Restock State
  const [quickRestockProduct, setQuickRestockProduct] = useState<Product | null>(null);
  const [restockAmount, setRestockAmount] = useState<string>('');

  const [formBuyPrice, setFormBuyPrice] = useState<number>(0);
  const [formMargin, setFormMargin] = useState<number>(20);

  const lowStockItems = useMemo(() => products.filter(p => p.stock <= p.minStock), [products]);

  const calculatedSellPrice = useMemo(() => {
    return formBuyPrice * (1 + formMargin / 100);
  }, [formBuyPrice, formMargin]);

  const handleSort = (key: keyof Product, isShift: boolean) => {
    setSortConfigs(prev => {
      const existingIdx = prev.findIndex(c => c.key === key);
      let nextDirection: SortDirection = 'asc';

      if (existingIdx !== -1) {
        if (prev[existingIdx].direction === 'asc') nextDirection = 'desc';
        else if (prev[existingIdx].direction === 'desc') nextDirection = null;
      }

      if (!isShift) {
        // Primary sort replacement
        return nextDirection ? [{ key, direction: nextDirection }] : [];
      } else {
        // Multi-sort modification
        const newConfigs = [...prev];
        if (existingIdx !== -1) {
          if (nextDirection) {
            newConfigs[existingIdx] = { key, direction: nextDirection };
          } else {
            newConfigs.splice(existingIdx, 1);
          }
        } else if (nextDirection) {
          newConfigs.push({ key, direction: nextDirection });
        }
        return newConfigs;
      }
    });
  };

  const filteredProducts = useMemo(() => {
    let result = products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    if (sortConfigs.length > 0) {
      result = [...result].sort((a, b) => {
        for (const config of sortConfigs) {
          const { key, direction } = config;
          if (!direction) continue;

          let valA = a[key];
          let valB = b[key];

          // Handle string comparisons
          if (typeof valA === 'string' && typeof valB === 'string') {
            valA = valA.toLowerCase();
            valB = valB.toLowerCase();
          }

          if (valA < valB) return direction === 'asc' ? -1 : 1;
          if (valA > valB) return direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return result;
  }, [products, searchTerm, selectedCategory, sortConfigs]);

  const handleExportCSV = () => {
    const headers = ['ID', 'SKU', 'Name', 'Category', 'Description/Notes', 'Buy Price', 'Margin %', 'Sell Price', 'Stock', 'Min Stock', 'Last Restocked'];
    const rows = filteredProducts.map(p => [
      p.id,
      p.sku,
      `"${p.name.replace(/"/g, '""')}"`,
      p.category,
      `"${(p.description || '').replace(/"/g, '""')}"`,
      p.buyPrice.toFixed(2),
      p.marginPercent,
      p.sellPrice.toFixed(2),
      p.stock,
      p.minStock,
      new Date(p.lastRestocked).toLocaleString()
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `sarkar_inventory_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScannedItems([]);
    
    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      });

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { mimeType: file.type, data: base64 } },
            { text: "Extract product information from this voucher or cash-memo. Identify the item names, SKU or item codes if visible, the quantity purchased, and the unit cost (price per item). Return the result as a strict JSON array of objects." },
          ],
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                sku: { type: Type.STRING },
                quantity: { type: Type.NUMBER },
                price: { type: Type.NUMBER },
              },
              required: ["name", "quantity", "price"],
            },
          },
        },
      });

      const textOutput = response.text || "[]";
      const rawItems = JSON.parse(textOutput);
      
      const mappedItems = rawItems.map((item: any) => {
        const match = products.find(p => 
          (item.sku && p.sku === item.sku) || p.name.toLowerCase().trim() === item.name.toLowerCase().trim()
        );
        return { 
          ...item, 
          matchedId: match?.id, 
          matchedName: match?.name, 
          isNew: !match, 
          selected: true 
        };
      });

      setScannedItems(mappedItems);
    } catch (err) {
      console.error("Scan error:", err);
      alert("Scan failed. Ensure the image of the voucher/memo is clear.");
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmRestock = () => {
    if (!isAdmin) return;
    const selected = scannedItems.filter(i => i.selected);
    selected.forEach(item => {
      if (item.matchedId) {
        onRestock(item.matchedId, item.quantity);
      } else {
        const p: Product = {
          id: `PROD-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          name: item.name,
          sku: item.sku || `AUTO-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
          category: 'General',
          buyPrice: item.price,
          marginPercent: 20,
          sellPrice: item.price * 1.2,
          stock: item.quantity,
          minStock: 5,
          description: "Imported via AI Scan",
          lastRestocked: new Date().toISOString(),
          stockHistory: []
        };
        onAdd(p);
      }
    });
    setIsScanModalOpen(false);
    setScannedItems([]);
  };

  const handleQuickRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (quickRestockProduct && restockAmount) {
      onRestock(quickRestockProduct.id, parseInt(restockAmount));
      setQuickRestockProduct(null);
      setRestockAmount('');
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isAdmin) return;
    const formData = new FormData(e.currentTarget);
    const buy = parseFloat(formData.get('buyPrice') as string) || 0;
    const margin = parseFloat(formData.get('marginPercent') as string) || 0;
    
    const productData: Product = {
      id: editingProduct?.id || `PROD-${Date.now()}`,
      name: formData.get('name') as string,
      sku: formData.get('sku') as string,
      category: formData.get('category') as string,
      buyPrice: buy,
      marginPercent: margin,
      sellPrice: buy * (1 + margin / 100),
      stock: parseInt(formData.get('stock') as string) || 0,
      minStock: parseInt(formData.get('minStock') as string) || 0,
      description: formData.get('description') as string,
      lastRestocked: editingProduct?.lastRestocked || new Date().toISOString(),
      stockHistory: editingProduct?.stockHistory || []
    };

    if (editingProduct) onUpdate(productData);
    else onAdd(productData);
    
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const SortHeader = ({ label, sortKey, className = "" }: { label: string, sortKey: keyof Product, className?: string }) => {
    const configIdx = sortConfigs.findIndex(c => c.key === sortKey);
    const config = configIdx !== -1 ? sortConfigs[configIdx] : null;

    return (
      <th 
        className={`px-6 py-4 cursor-pointer select-none transition-colors group ${config ? 'bg-indigo-50/50' : 'hover:bg-slate-100'} ${className}`}
        onClick={(e) => handleSort(sortKey, e.shiftKey)}
      >
        <div className="flex items-center gap-2">
          <span>{label}</span>
          <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
            <svg className={`w-2 h-2 ${config?.direction === 'asc' ? 'text-indigo-600' : 'text-slate-300'}`} fill="currentColor" viewBox="0 0 24 24"><path d="M12 4l-8 8h16l-8-8z" /></svg>
            <svg className={`w-2 h-2 ${config?.direction === 'desc' ? 'text-indigo-600' : 'text-slate-300'}`} fill="currentColor" viewBox="0 0 24 24"><path d="M12 20l8-8H4l8 8z" /></svg>
          </div>
          {config && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-black text-indigo-600 bg-indigo-100 w-4 h-4 rounded-full flex items-center justify-center">
                {configIdx + 1}
              </span>
              {config.direction === 'asc' ? (
                <svg className="w-3 h-3 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7" /></svg>
              ) : (
                <svg className="w-3 h-3 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
              )}
            </div>
          )}
        </div>
      </th>
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn no-print">
      <style>{`
        @keyframes pulse-red {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(225, 29, 72, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(225, 29, 72, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(225, 29, 72, 0); }
        }
        .pulse-red {
          animation: pulse-red 2s infinite;
        }
      `}</style>
      
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Product Inventory</h2>
          <p className="text-slate-500 font-medium">Detailed view of all products and pricing.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleExportCSV}
            className="bg-slate-100 text-slate-600 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-200 transition border border-slate-200"
            title="Export to CSV"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <span className="hidden sm:inline">Export CSV</span>
          </button>
          {isAdmin && (
            <>
              <button 
                onClick={() => setIsScanModalOpen(true)} 
                className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-700 transition shadow-lg shadow-emerald-100"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /></svg>
                Scan Voucher
              </button>
              <button 
                onClick={() => { setEditingProduct(null); setFormBuyPrice(0); setFormMargin(20); setIsModalOpen(true); }} 
                className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100"
              >
                + Add Product
              </button>
            </>
          )}
        </div>
      </header>

      {/* Critical Stock Notification System */}
      {lowStockItems.length > 0 && (
        <div className="bg-rose-50 border-2 border-rose-100 rounded-2xl p-4 flex flex-col md:flex-row items-center gap-4 animate-fadeIn">
          <div className="w-12 h-12 rounded-full bg-rose-600 flex items-center justify-center shrink-0 pulse-red">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-rose-900 font-black uppercase tracking-tight text-sm">Critical Stock Alert</h3>
            <p className="text-rose-700 text-xs font-bold leading-tight">
              {lowStockItems.length} {lowStockItems.length === 1 ? 'item is' : 'items are'} currently below the safety threshold. Consider restocking soon.
            </p>
          </div>
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
            {lowStockItems.slice(0, 3).map(item => (
              <div key={item.id} className="bg-white px-3 py-1.5 rounded-lg border border-rose-200 flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-black text-rose-600 uppercase tracking-tighter truncate max-w-[80px]">{item.name}</span>
                <span className="text-[10px] font-black bg-rose-600 text-white px-1.5 rounded">{item.stock}</span>
              </div>
            ))}
            {lowStockItems.length > 3 && (
              <div className="bg-rose-100 px-3 py-1.5 rounded-lg flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-black text-rose-700">+{lowStockItems.length - 3} more</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input 
            type="text" 
            placeholder="Search by name, SKU or notes..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        <select 
          value={selectedCategory} 
          onChange={(e) => setSelectedCategory(e.target.value)} 
          className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 w-full md:w-auto"
        >
          <option value="All">All Categories</option>
          {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        {sortConfigs.length > 0 && (
          <button 
            onClick={() => setSortConfigs([])} 
            className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest px-2"
          >
            Reset Sorting
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
              <tr>
                <SortHeader label="SKU & Product Name" sortKey="name" />
                <SortHeader label="Category" sortKey="category" />
                <SortHeader label="Cost (Buy)" sortKey="buyPrice" />
                <SortHeader label="Margin %" sortKey="marginPercent" className="text-indigo-600" />
                <SortHeader label="Price (Sell)" sortKey="sellPrice" />
                <SortHeader label="Stock Status" sortKey="stock" />
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredProducts.map(p => {
                const isLow = p.stock <= p.minStock;
                return (
                  <tr key={p.id} className="hover:bg-indigo-50/30 transition-colors group">
                    <td className="px-6 py-4 relative">
                      {isLow && (
                        <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-rose-500 rounded-full" title="Low Stock Condition"></div>
                      )}
                      <div className="flex flex-col">
                        <span className="text-[10px] font-mono text-slate-400 font-bold uppercase mb-0.5 tracking-tighter">{p.sku}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 text-base">{p.name}</span>
                          {isLow && (
                            <div className="w-2 h-2 rounded-full bg-rose-600 pulse-red" title="Critical Stock"></div>
                          )}
                        </div>
                        {p.description && (
                          <span className="text-[10px] text-slate-500 font-medium italic mt-0.5 max-w-[200px] truncate" title={p.description}>
                            {p.description}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">{p.category}</span>
                    </td>
                    <td className="px-6 py-4 font-mono font-medium text-slate-500">${p.buyPrice.toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className="font-black text-indigo-600">{p.marginPercent}%</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-black text-slate-900 text-base">${p.sellPrice.toFixed(2)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${isLow ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-50'}`}>
                        <span className={`text-lg font-black ${isLow ? 'text-rose-600' : 'text-slate-800'}`}>{p.stock}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">/ {p.minStock} min</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {isAdmin ? (
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => setQuickRestockProduct(p)} 
                            title="Quick Restock"
                            className="bg-emerald-50 text-emerald-600 p-2 rounded-lg hover:bg-emerald-100 transition"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                          </button>
                          <button 
                            onClick={() => { setEditingProduct(p); setFormBuyPrice(p.buyPrice); setFormMargin(p.marginPercent); setIsModalOpen(true); }} 
                            className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg font-black text-xs uppercase hover:bg-indigo-100 transition"
                          >
                            Edit
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-300 uppercase italic">Read Only</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Restock Modal (Admin Only) */}
      {isAdmin && quickRestockProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-slideUp">
            <div className="bg-emerald-600 p-6 flex justify-between items-center text-white">
              <h3 className="font-black uppercase tracking-tight">Quick Restock</h3>
              <button onClick={() => setQuickRestockProduct(null)}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <form onSubmit={handleQuickRestockSubmit} className="p-6 space-y-4">
              <p className="text-sm font-bold text-slate-600">Restocking: <span className="text-slate-900">{quickRestockProduct.name}</span></p>
              <div>
                <label className="block text-xs font-black uppercase text-slate-400 mb-1">Quantity to Add</label>
                <input 
                  autoFocus
                  type="number" 
                  value={restockAmount} 
                  onChange={(e) => setRestockAmount(e.target.value)} 
                  className="w-full px-4 py-3 border-2 border-slate-100 rounded-xl font-black text-xl text-emerald-600 outline-none focus:border-emerald-500"
                  placeholder="0"
                />
              </div>
              <button type="submit" className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition uppercase tracking-widest text-xs">
                Update Stock
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Product Add/Edit Modal (Admin Only) */}
      {isAdmin && isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-slideUp my-auto">
            <div className="bg-indigo-600 px-8 py-5 flex justify-between items-center text-white">
              <h3 className="text-xl font-black uppercase tracking-tight">{editingProduct ? 'Update Product' : 'New Product'}</h3>
              <button onClick={() => setIsModalOpen(false)}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-5">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-black uppercase text-slate-400 mb-1">Product Name</label>
                    <input name="name" required defaultValue={editingProduct?.name} className="w-full px-4 py-2.5 border-2 border-slate-100 rounded-xl focus:border-indigo-500 outline-none transition font-bold text-slate-800" />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase text-slate-400 mb-1">SKU Code</label>
                    <input name="sku" required defaultValue={editingProduct?.sku} className="w-full px-4 py-2.5 border-2 border-slate-100 rounded-xl focus:border-indigo-500 outline-none transition font-mono font-bold" />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase text-slate-400 mb-1">Category</label>
                    <select name="category" defaultValue={editingProduct?.category || 'General'} className="w-full px-4 py-2.5 border-2 border-slate-100 rounded-xl bg-white focus:border-indigo-500 outline-none font-bold text-slate-600">
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-400 mb-1">Internal Notes / Description</label>
                  <textarea 
                    name="description" 
                    defaultValue={editingProduct?.description} 
                    rows={3}
                    className="w-full px-4 py-2.5 border-2 border-slate-100 rounded-xl focus:border-indigo-500 outline-none transition font-medium text-slate-700 resize-none"
                    placeholder="E.g. Supplier contact, specific storage needs, or batch info..."
                  />
                </div>

                <div className="p-5 bg-slate-50 rounded-2xl border-2 border-slate-100 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Buy Price ($)</label>
                      <input name="buyPrice" type="number" step="0.01" required value={formBuyPrice} onChange={(e) => setFormBuyPrice(parseFloat(e.target.value) || 0)} className="w-full px-4 py-2 border-2 border-white rounded-xl font-mono text-sm shadow-sm" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-indigo-400 mb-1">Margin (%)</label>
                      <input name="marginPercent" type="number" required value={formMargin} onChange={(e) => setFormMargin(parseFloat(e.target.value) || 0)} className="w-full px-4 py-2 border-2 border-indigo-100 rounded-xl text-indigo-600 font-black text-sm shadow-sm" />
                    </div>
                  </div>
                  <div className="pt-3 border-t-2 border-white flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400 uppercase">Sell Price</span>
                    <span className="text-2xl font-black text-slate-900">${calculatedSellPrice.toFixed(2)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase text-slate-400 mb-1">Stock</label>
                    <input name="stock" type="number" required defaultValue={editingProduct?.stock || 0} className="w-full px-4 py-2.5 border-2 border-slate-100 rounded-xl font-bold" />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase text-slate-400 mb-1">Min Alert</label>
                    <input name="minStock" type="number" required defaultValue={editingProduct?.minStock || 5} className="w-full px-4 py-2.5 border-2 border-slate-100 rounded-xl font-bold" />
                  </div>
                </div>
              </div>
              
              <div className="pt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 font-bold text-slate-400 hover:text-slate-600 transition uppercase text-xs">Cancel</button>
                <button type="submit" className="px-10 py-3 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 transition shadow-xl uppercase text-xs">Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Scan Modal (Admin Only) */}
      {isAdmin && isScanModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-slideUp">
            <div className="bg-emerald-600 px-8 py-5 flex justify-between items-center text-white">
              <h3 className="text-xl font-black uppercase tracking-tight">AI Restock Scanner</h3>
              <button onClick={() => setIsScanModalOpen(false)}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-8">
              {!scannedItems.length && !isScanning ? (
                <div onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center py-20 border-4 border-dashed border-slate-100 rounded-[2.5rem] bg-slate-50 hover:bg-emerald-50/50 transition cursor-pointer group">
                  <svg className="w-10 h-10 text-emerald-600 mb-6 group-hover:scale-110 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  <p className="font-black text-slate-800 uppercase tracking-widest text-sm text-center px-4">Upload Voucher / Cash-Memo Image</p>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </div>
              ) : isScanning ? (
                <div className="text-center py-20">
                  <div className="w-16 h-16 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin mb-6 mx-auto"></div>
                  <h4 className="text-xl font-black text-slate-800 uppercase tracking-tight">Extracting Items...</h4>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="max-h-72 overflow-y-auto space-y-3 pr-2">
                    {scannedItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border-2 border-slate-100">
                        <div className="flex-1 mr-4">
                          <p className="font-bold text-sm text-slate-800 uppercase">{item.name}</p>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${item.isNew ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {item.isNew ? 'New Product' : `Matches: ${item.matchedName}`}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-lg text-slate-900">x{item.quantity}</p>
                          <p className="text-[10px] font-bold text-slate-400 font-mono">${item.price.toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={confirmRestock} className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest text-xs">Import to Inventory</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
