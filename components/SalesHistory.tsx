
import React, { useState, useMemo } from 'react';
import { Sale, SaleItem, UserRole } from '../types';

interface SalesHistoryProps {
  sales: Sale[];
  onProcessReturn: (saleId: string, returns: { productId: string, quantity: number }[]) => void;
  userRole: UserRole;
}

const SalesHistory: React.FC<SalesHistoryProps> = ({ sales, onProcessReturn, userRole }) => {
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('All');
  const [paymentFilter, setPaymentFilter] = useState('All');

  const [isReturnMode, setIsReturnMode] = useState(false);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [isConfirmingReturn, setIsConfirmingReturn] = useState(false);

  const isAdmin = userRole === UserRole.ADMIN;

  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
      const matchesSearch = sale.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            sale.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            sale.processedBy?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPayment = paymentFilter === 'All' || sale.paymentMethod === paymentFilter;
      return matchesSearch && matchesPayment;
    });
  }, [sales, searchTerm, paymentFilter]);

  const handleReturnClick = () => {
    if (!isAdmin) return;
    setIsReturnMode(true);
    const initialQtys: Record<string, number> = {};
    selectedSale?.items.forEach(item => {
      initialQtys[item.productId] = 0;
    });
    setReturnQuantities(initialQtys);
  };

  const handleReturnQtyChange = (productId: string, qty: number, max: number) => {
    setReturnQuantities(prev => ({
      ...prev,
      [productId]: Math.min(Math.max(0, qty), max)
    }));
  };

  const submitReturn = () => {
    if (!isAdmin || !selectedSale) return;
    const returns = (Object.entries(returnQuantities) as [string, number][])
      .filter(([_, qty]) => qty > 0)
      .map(([id, qty]) => ({ productId: id, quantity: qty }));

    if (returns.length === 0) {
      setIsReturnMode(false);
      return;
    }

    onProcessReturn(selectedSale.id, returns);
    const updatedSale = sales.find(s => s.id === selectedSale.id);
    if (updatedSale) setSelectedSale(updatedSale);
    setIsReturnMode(false);
    setIsConfirmingReturn(false);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <header>
        <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Sales History</h2>
        <p className="text-slate-500 font-medium">Full ledger of all store transactions.</p>
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input 
              type="text" 
              placeholder="Search by ID, Customer or Staff..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4">Invoice ID</th>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Staff</th>
                <th className="px-6 py-4">Total</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm font-medium">
              {filteredSales.map(sale => (
                <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-mono text-indigo-600 font-bold">#{sale.id.slice(-8)}</td>
                  <td className="px-6 py-4 text-slate-400">{new Date(sale.timestamp).toLocaleString()}</td>
                  <td className="px-6 py-4 text-slate-800">{sale.customerName}</td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-black uppercase text-slate-500 px-2 py-0.5 bg-slate-100 rounded">{sale.processedBy || 'N/A'}</span>
                  </td>
                  <td className="px-6 py-4 font-black text-slate-900">${sale.total.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => setSelectedSale(sale)} className="text-indigo-600 font-black text-xs uppercase hover:underline">Details</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedSale && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-slideUp">
            <div className="bg-slate-900 p-6 flex justify-between items-center text-white">
              <h3 className="font-black uppercase tracking-tight">Invoice Details</h3>
              <button onClick={() => { setSelectedSale(null); setIsReturnMode(false); }}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            
            <div className="p-8 space-y-6">
              {!isReturnMode ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Customer Info</p>
                      <p className="text-base font-black text-slate-800 leading-tight">{selectedSale.customerName}</p>
                      {selectedSale.customerPhone && <p className="text-xs font-bold text-slate-500 mt-1">{selectedSale.customerPhone}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Staff / Payment</p>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{selectedSale.processedBy}</span>
                        <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">{selectedSale.paymentMethod}</span>
                      </div>
                    </div>
                    {selectedSale.customerAddress && (
                      <div className="col-span-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Shipping Address</p>
                        <p className="text-xs font-bold text-slate-600 italic leading-relaxed">{selectedSale.customerAddress}</p>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-dashed border-slate-200 pt-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Ordered Items</p>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                      {selectedSale.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <div className="text-xs">
                              <p className="font-black text-slate-800 uppercase tracking-tighter">{item.name}</p>
                              <p className="text-slate-400 font-bold">{item.quantity} x ${item.price.toFixed(2)}</p>
                              {item.returnedQuantity && item.returnedQuantity > 0 && (
                                <p className="text-rose-500 text-[10px] font-black uppercase mt-0.5">Returned: {item.returnedQuantity}</p>
                              )}
                            </div>
                            <p className="font-black text-slate-900">${item.total.toFixed(2)}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t-2 border-slate-50 flex justify-between items-end">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Grand Total</p>
                      <p className="text-3xl font-black text-indigo-600 tracking-tighter">${selectedSale.total.toFixed(2)}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => window.print()} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition active:scale-95">Print</button>
                      {isAdmin && (
                        <button onClick={handleReturnClick} className="bg-rose-50 text-rose-600 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-rose-100 transition active:scale-95">Return</button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight">Process Returns</h4>
                    <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Select quantities to return to stock</p>
                  </div>
                  
                  <div className="space-y-3">
                    {selectedSale.items.map((item) => {
                      const returnable = item.quantity - (item.returnedQuantity || 0);
                      return (
                        <div key={item.productId} className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-100">
                          <div className="flex justify-between mb-3">
                            <p className="font-black text-xs text-slate-800 uppercase tracking-tighter truncate">{item.name}</p>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{returnable} available</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <input 
                              type="range" 
                              min="0" 
                              max={returnable}
                              value={returnQuantities[item.productId] || 0}
                              onChange={(e) => handleReturnQtyChange(item.productId, parseInt(e.target.value), returnable)}
                              className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-500"
                            />
                            <span className="w-10 text-center font-black text-rose-600 text-lg">{returnQuantities[item.productId] || 0}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="flex gap-3 pt-4 border-t border-dashed border-slate-200">
                    <button onClick={() => setIsReturnMode(false)} className="flex-1 py-4 font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest text-xs">Cancel</button>
                    <button 
                      onClick={submitReturn} 
                      className="flex-1 py-4 bg-rose-600 text-white font-black rounded-2xl shadow-xl shadow-rose-100 hover:bg-rose-700 transition uppercase tracking-widest text-xs"
                    >
                      Confirm Return
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesHistory;
