
import React, { useState, useMemo, useRef } from 'react';
import { Product, Sale, SaleItem, Customer } from '../types';
import { GoogleGenAI, Type } from '@google/genai';

interface POSProps {
  products: Product[];
  customers: Customer[];
  onSaveCustomer: (customer: Customer) => void;
  onComplete: (sale: Sale) => void;
}

interface ScannedOrderItem {
  name: string;
  quantity: number;
  price: number;
  matchedProduct?: Product;
  selected: boolean;
}

const POS: React.FC<POSProps> = ({ products, customers, onSaveCustomer, onComplete }) => {
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Enhanced Customer Details
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'Transfer'>('Cash');
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [isCartExpanded, setIsCartExpanded] = useState(false);

  // Customer Management Search
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [isCustomerListOpen, setIsCustomerListOpen] = useState(false);

  // AI Scanning State
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedOrderItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  ).filter(p => p.stock > 0);

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
    c.phone.includes(customerSearchTerm)
  );

  const handleSelectCustomer = (customer: Customer) => {
    setCustomerName(customer.name);
    setCustomerAddress(customer.address);
    setCustomerPhone(customer.phone);
    setSelectedCustomerId(customer.id);
    setIsCustomerListOpen(false);
    setCustomerSearchTerm('');
  };

  const clearCustomer = () => {
    setCustomerName('');
    setCustomerAddress('');
    setCustomerPhone('');
    setSelectedCustomerId(null);
  };

  const handleSaveAsNewCustomer = () => {
    if (!customerName || !customerPhone) {
      alert("Name and Phone are required to save a customer.");
      return;
    }
    const newCustomer: Customer = {
      id: selectedCustomerId || `CUST-${Date.now()}`,
      name: customerName,
      address: customerAddress,
      phone: customerPhone
    };
    onSaveCustomer(newCustomer);
    setSelectedCustomerId(newCustomer.id);
    alert("Customer details saved!");
  };

  const handleScanFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
            { text: "Extract the customer's order from this voucher or cash-memo. Identify product names, quantities, and unit prices. Return as a strict JSON array of objects." },
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
                quantity: { type: Type.NUMBER },
                price: { type: Type.NUMBER },
              },
              required: ["name", "quantity", "price"],
            },
          },
        },
      });

      const rawItems = JSON.parse(response.text || "[]");
      const mapped = rawItems.map((item: any) => {
        const match = products.find(p => 
          p.name.toLowerCase().trim() === item.name.toLowerCase().trim() ||
          p.sku.toLowerCase().trim() === item.name.toLowerCase().trim()
        );
        return {
          ...item,
          matchedProduct: match,
          selected: !!match
        };
      });
      setScannedItems(mapped);
    } catch (err) {
      console.error("POS Scan error:", err);
      alert("Failed to read order. Please ensure the memo is clear.");
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const addScannedToCart = () => {
    const toAdd = scannedItems.filter(i => i.selected && i.matchedProduct);
    const newCart = [...cart];

    toAdd.forEach(item => {
      const prod = item.matchedProduct!;
      const existing = newCart.find(c => c.productId === prod.id);
      const qtyToAdd = Math.min(item.quantity, prod.stock);

      if (existing) {
        existing.quantity = Math.min(existing.quantity + qtyToAdd, prod.stock);
        existing.total = existing.quantity * existing.price;
      } else {
        newCart.push({
          productId: prod.id,
          name: prod.name,
          quantity: qtyToAdd,
          price: prod.sellPrice,
          total: qtyToAdd * prod.sellPrice
        });
      }
    });

    setCart(newCart);
    setIsScanModalOpen(false);
    setScannedItems([]);
  };

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.productId === product.id);
    if (existing) {
      if (existing.quantity >= product.stock) return;
      setCart(cart.map(item => 
        item.productId === product.id 
          ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price } 
          : item
      ));
    } else {
      setCart([...cart, {
        productId: product.id,
        name: product.name,
        quantity: 1,
        price: product.sellPrice,
        total: product.sellPrice
      }]);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prevCart => prevCart.map(item => {
      if (item.productId === productId) {
        const newQty = Math.max(0, item.quantity + delta);
        const prod = products.find(p => p.id === productId);
        if (newQty > (prod?.stock || 0)) return item;
        return newQty === 0 ? null : { ...item, quantity: newQty, total: newQty * item.price };
      }
      return item;
    }).filter(Boolean) as SaleItem[]);
  };

  const subtotal = cart.reduce((acc, item) => acc + item.total, 0);
  const tax = subtotal * 0.05; 
  const total = subtotal + tax;

  const handleFinish = () => {
    if (cart.length === 0) return;
    const sale: Sale = {
      id: `SALE-${Date.now()}`,
      timestamp: new Date().toISOString(),
      customerName: customerName || 'Walk-in Customer',
      customerAddress: customerAddress,
      customerPhone: customerPhone,
      items: [...cart],
      subtotal, tax, total, paymentMethod
    };
    onComplete(sale);
    setCompletedSale(sale);
    setCart([]);
    setCustomerName('');
    setCustomerAddress('');
    setCustomerPhone('');
    setSelectedCustomerId(null);
    setIsCartExpanded(false);
  };

  if (completedSale) {
    return (
      <div className="max-w-xl mx-auto py-8 animate-fadeIn px-4">
        <div className="bg-emerald-50 border border-emerald-100 p-8 rounded-3xl text-center no-print">
          <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
          </div>
          <h2 className="text-2xl font-bold text-emerald-900">Sale Completed!</h2>
          <p className="text-emerald-700 mt-2 font-mono text-sm uppercase">Order #{completedSale.id.slice(-8)}</p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => window.print()} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 00-2 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              Print Receipt
            </button>
            <button onClick={() => setCompletedSale(null)} className="px-8 py-3 bg-white border rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition">New Sale</button>
          </div>
        </div>

        {/* Receipt Styles */}
        <div className="print-only bg-white p-10 font-mono text-[11px] leading-snug text-black border-2 border-slate-100">
          <div className="text-center mb-8">
            <h1 className="text-xl font-black uppercase tracking-tighter">SARKAR TRADE STOCK</h1>
            <p>Quality Supply & Logistics</p>
            <div className="border-t border-dashed border-black my-5"></div>
            <p className="font-bold text-sm uppercase">CASH MEMO</p>
            <p>No: {completedSale.id.slice(-12)}</p>
          </div>

          <div className="space-y-1 mb-6">
            <div className="flex justify-between"><span>Date:</span> <span>{new Date(completedSale.timestamp).toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Customer:</span> <span className="font-bold">{completedSale.customerName}</span></div>
            {completedSale.customerPhone && <div className="flex justify-between"><span>Phone:</span> <span>{completedSale.customerPhone}</span></div>}
            {completedSale.customerAddress && <div className="flex justify-between"><span>Address:</span> <span className="text-right max-w-[150px]">{completedSale.customerAddress}</span></div>}
            <div className="flex justify-between"><span>Method:</span> <span>{completedSale.paymentMethod}</span></div>
          </div>

          <div className="border-t border-b border-dashed border-black py-3 mb-6">
            <div className="flex justify-between font-black mb-2 text-xs uppercase">
              <span className="w-1/2">Product Description</span>
              <span className="w-1/6 text-center">Qty</span>
              <span className="w-1/3 text-right">Amount</span>
            </div>
            {completedSale.items.map((item, idx) => (
              <div key={idx} className="flex justify-between mb-1">
                <span className="w-1/2 truncate uppercase">{item.name}</span>
                <span className="w-1/6 text-center">x{item.quantity}</span>
                <span className="w-1/3 text-right">${item.total.toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-1.5 ml-auto w-3/4">
            <div className="flex justify-between font-black text-base uppercase"><span>NET TOTAL:</span> <span>${completedSale.total.toFixed(2)}</span></div>
          </div>
          <div className="text-center mt-16 pt-6 border-t border-dashed border-black">
            <p className="font-bold">THANK YOU FOR YOUR PATRONAGE!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100vh-80px)] md:h-[calc(100vh-120px)] flex flex-col lg:flex-row gap-4 animate-fadeIn no-print overflow-hidden">
      {/* Product Catalog Section */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 sticky top-0 z-20 flex gap-2 mb-4">
          <div className="relative flex-1">
            <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input 
              type="text" 
              placeholder="Search products..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-sm"
            />
          </div>
          <button 
            onClick={() => setIsScanModalOpen(true)}
            className="bg-emerald-600 text-white p-3 rounded-xl hover:bg-emerald-700 transition shadow-lg shadow-emerald-100 flex items-center justify-center shrink-0"
            title="Scan Order Voucher"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /></svg>
            <span className="hidden sm:inline ml-2 font-bold text-sm">Scan Order</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pb-24 md:pb-4">
          <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 pr-1">
            {filteredProducts.map(p => (
              <button key={p.id} onClick={() => addToCart(p)} className="bg-white p-3 rounded-2xl border-2 border-slate-50 hover:border-indigo-400 hover:shadow-lg transition-all text-left group active:scale-95 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-1.5">
                    <span className="bg-slate-100 text-[9px] font-black px-2 py-0.5 rounded text-slate-400 uppercase tracking-tighter">{p.category}</span>
                    <span className="text-indigo-600 font-black text-sm">${p.sellPrice.toFixed(2)}</span>
                  </div>
                  <h4 className="font-bold text-slate-800 text-xs md:text-sm leading-tight line-clamp-2 min-h-[2.5rem] uppercase tracking-tighter">{p.name}</h4>
                </div>
                <div className="mt-3 flex justify-between items-center">
                  <span className={`text-[10px] font-black ${p.stock <= p.minStock ? 'text-rose-500' : 'text-slate-400'}`}>{p.stock} units</span>
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition shadow-sm font-black">+</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cart Container: Sidebar on Large, Bottom-Sheet on Mobile */}
      <div 
        className={`
          fixed inset-x-0 bottom-0 bg-white border-t rounded-t-[2.5rem] shadow-2xl z-[60] flex flex-col transition-all duration-300 ease-in-out
          lg:static lg:w-[420px] lg:h-full lg:rounded-2xl lg:border lg:inset-auto lg:shadow-sm lg:translate-y-0
          ${isCartExpanded ? 'h-[92vh]' : 'h-[76px] lg:h-full'}
        `}
      >
        {/* Cart Header / Expand Handle */}
        <div 
          onClick={() => setIsCartExpanded(!isCartExpanded)}
          className={`
            px-6 py-4 border-b flex flex-col items-center bg-indigo-600 text-white cursor-pointer select-none shrink-0
            ${isCartExpanded ? 'rounded-t-[2.5rem] lg:rounded-t-2xl' : 'rounded-t-[2.5rem] lg:rounded-t-2xl'}
            lg:rounded-t-2xl lg:cursor-default lg:py-6
          `}
        >
          {/* Mobile handle */}
          <div className="w-12 h-1.5 bg-white/30 rounded-full mb-3 lg:hidden"></div>
          
          <div className="w-full flex justify-between items-center">
            <div className="flex items-center gap-3">
               <div className="relative">
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                 {cart.length > 0 && (
                   <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-indigo-600 animate-bounce">
                     {cart.length}
                   </span>
                 )}
               </div>
               <h3 className="text-lg font-black uppercase tracking-tight">Checkout</h3>
            </div>
            
            <div className="flex items-center gap-4">
              <span className="lg:hidden font-black text-base">${total.toFixed(2)}</span>
              <button className="lg:hidden p-1.5 rounded-full bg-white/20">
                 <svg className={`w-5 h-5 transition-transform duration-300 ${isCartExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7" />
                 </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Cart Contents - Scrollable */}
        <div className={`flex-1 flex flex-col overflow-hidden ${!isCartExpanded && 'hidden lg:flex'}`}>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 custom-scrollbar">
            {cart.map(item => (
              <div key={item.productId} className="flex gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm group">
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm text-slate-800 uppercase leading-tight line-clamp-2">{item.name}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[11px] font-bold text-slate-400">${item.price.toFixed(2)}/unit</span>
                    <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                    <span className="text-xs font-black text-indigo-600">Total: ${item.total.toFixed(2)}</span>
                  </div>
                </div>
                <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-1 h-fit">
                  <button onClick={(e) => { e.stopPropagation(); updateQuantity(item.productId, -1); }} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm font-black text-slate-400 hover:text-rose-500 active:scale-90 transition">-</button>
                  <span className="w-8 text-center text-sm font-black text-slate-800">{item.quantity}</span>
                  <button onClick={(e) => { e.stopPropagation(); updateQuantity(item.productId, 1); }} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm font-black text-slate-400 hover:text-emerald-500 active:scale-90 transition">+</button>
                </div>
              </div>
            ))}
            
            {cart.length === 0 && (
              <div className="text-center py-20 opacity-20 flex flex-col items-center">
                <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                <p className="font-black uppercase tracking-widest text-xs">No items in cart</p>
              </div>
            )}

            {/* In-cart Customer and Payment Section */}
            <div className="space-y-4 pt-4 border-t border-dashed border-slate-200">
              {/* Customer Selection Section */}
              <div className="space-y-3 relative">
                <div className="flex justify-between items-center px-1">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Customer Details</h4>
                  {selectedCustomerId && (
                    <button onClick={clearCustomer} className="text-[9px] font-bold text-rose-500 hover:underline">Clear Selected</button>
                  )}
                </div>
                
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Search existing customers..." 
                    value={customerSearchTerm}
                    onFocus={() => setIsCustomerListOpen(true)}
                    onChange={(e) => { setCustomerSearchTerm(e.target.value); setIsCustomerListOpen(true); }}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-2xl text-xs font-bold outline-none focus:border-indigo-500 shadow-sm" 
                  />
                  {isCustomerListOpen && (customerSearchTerm || customers.length > 0) && (
                    <div className="absolute bottom-full mb-3 left-0 right-0 bg-white border border-slate-200 shadow-2xl rounded-3xl overflow-hidden z-[70] max-h-56 overflow-y-auto custom-scrollbar animate-slideUp">
                      {filteredCustomers.length > 0 ? (
                        filteredCustomers.map(c => (
                          <button 
                            key={c.id} 
                            onClick={() => handleSelectCustomer(c)}
                            className="w-full text-left p-4 hover:bg-indigo-50 border-b border-slate-50 transition flex justify-between items-center group"
                          >
                            <div className="min-w-0">
                              <p className="font-black text-xs text-slate-800 uppercase tracking-tighter truncate">{c.name}</p>
                              <p className="text-[10px] font-bold text-slate-400 mt-0.5">{c.phone}</p>
                            </div>
                            <svg className="w-5 h-5 text-slate-200 group-hover:text-indigo-600 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                          </button>
                        ))
                      ) : (
                        <div className="p-6 text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase italic">No customer found</p>
                        </div>
                      )}
                      <button onClick={() => setIsCustomerListOpen(false)} className="w-full py-3 bg-slate-50 text-[10px] font-black text-slate-500 hover:text-slate-800 border-t border-slate-100 transition">Close Customer List</button>
                    </div>
                  )}
                </div>

                <div className="space-y-3 p-4 bg-white rounded-3xl border border-slate-200 shadow-sm">
                  <input 
                    type="text" 
                    placeholder="Full Name" 
                    value={customerName} 
                    onChange={(e) => setCustomerName(e.target.value)} 
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-2xl text-xs font-bold outline-none focus:bg-white focus:border-indigo-500 transition" 
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input 
                      type="tel" 
                      placeholder="Phone Number" 
                      value={customerPhone} 
                      onChange={(e) => setCustomerPhone(e.target.value)} 
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-2xl text-[11px] font-bold outline-none focus:bg-white focus:border-indigo-500 transition" 
                    />
                    <button 
                      onClick={handleSaveAsNewCustomer}
                      className="w-full bg-slate-900 text-white text-[10px] font-black rounded-2xl py-3 hover:bg-slate-800 transition active:scale-95 shadow-md shadow-slate-200"
                    >
                      {selectedCustomerId ? 'Update Record' : 'Save Customer'}
                    </button>
                  </div>
                  <textarea 
                    placeholder="Shipping Address (Optional)" 
                    value={customerAddress} 
                    onChange={(e) => setCustomerAddress(e.target.value)} 
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-2xl text-[11px] font-bold outline-none focus:bg-white focus:border-indigo-500 resize-none h-20 transition"
                  />
                </div>
              </div>

              {/* Payment Section */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Payment Method</h4>
                <div className="grid grid-cols-3 gap-2">
                  {(['Cash', 'Card', 'Transfer'] as const).map(method => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={`py-3 rounded-2xl text-[10px] font-black uppercase transition border-2 ${
                        paymentMethod === method 
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' 
                        : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-200'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* FINAL STICKY FOOTER */}
          <div className="p-6 border-t-2 border-slate-100 bg-white shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)] shrink-0 z-10">
            <div className="flex justify-between items-center mb-6">
              <div className="flex flex-col">
                 <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Total Amount Due</span>
                 <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Includes 5% Sales Tax</span>
              </div>
              <div className="text-right">
                <span className="text-3xl font-black text-indigo-600 tracking-tight leading-none">${total.toFixed(2)}</span>
              </div>
            </div>

            <button 
              disabled={cart.length === 0} 
              onClick={handleFinish} 
              className="w-full bg-indigo-600 text-white font-black py-5 rounded-[1.5rem] shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-[0.97] disabled:opacity-30 disabled:pointer-events-none uppercase tracking-[0.2em] text-xs"
            >
              Finish Order & Print
            </button>
          </div>
        </div>
      </div>

      {/* AI POS Order Scanner Modal */}
      {isScanModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden animate-slideUp">
            <div className="bg-emerald-600 px-8 py-5 flex justify-between items-center text-white">
              <h3 className="text-xl font-black uppercase tracking-tight">AI Order Scanner</h3>
              <button onClick={() => setIsScanModalOpen(false)}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-8">
              {!scannedItems.length && !isScanning ? (
                <div 
                  onClick={() => fileInputRef.current?.click()} 
                  className="flex flex-col items-center justify-center py-20 border-4 border-dashed border-slate-100 rounded-[2rem] bg-slate-50 hover:bg-emerald-50/50 transition cursor-pointer group"
                >
                  <div className="w-20 h-20 bg-white rounded-3xl shadow-lg flex items-center justify-center mb-6 group-hover:scale-110 transition text-emerald-600">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /></svg>
                  </div>
                  <p className="font-black text-slate-800 uppercase tracking-widest text-sm text-center">Snapshot Voucher/Memo</p>
                  <p className="text-[10px] text-slate-400 font-bold mt-2 italic uppercase">AI will automatically create your cart</p>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleScanFile} />
                </div>
              ) : isScanning ? (
                <div className="text-center py-20">
                  <div className="w-16 h-16 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin mb-6 mx-auto"></div>
                  <h4 className="text-xl font-black text-slate-800 uppercase tracking-tight">AI Reading Order...</h4>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex justify-between items-center px-1">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Identified Items</h4>
                    <button onClick={() => setScannedItems([])} className="text-[10px] font-black text-rose-500 hover:underline">Clear</button>
                  </div>
                  <div className="max-h-72 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                    {scannedItems.map((item, idx) => (
                      <div key={idx} className={`flex justify-between items-center p-4 rounded-2xl border-2 transition ${item.matchedProduct ? 'bg-slate-50 border-slate-100' : 'bg-rose-50/50 border-rose-100 opacity-60'}`}>
                        <div className="flex items-center gap-3 flex-1 mr-4">
                          <input type="checkbox" checked={item.selected} onChange={() => {
                            const next = [...scannedItems];
                            next[idx].selected = !next[idx].selected;
                            setScannedItems(next);
                          }} className="w-5 h-5 rounded-lg text-emerald-600 focus:ring-0 cursor-pointer" disabled={!item.matchedProduct} />
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-slate-800 uppercase tracking-tighter truncate">{item.name}</p>
                            {!item.matchedProduct ? (
                              <span className="text-[9px] font-black text-rose-500 uppercase italic">Not found in inventory</span>
                            ) : (
                              <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter">Matched: {item.matchedProduct.name}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-black text-lg text-slate-900">x{item.quantity}</p>
                          <p className="text-[10px] font-bold text-slate-400 font-mono">${item.price.toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={addScannedToCart} 
                    className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition uppercase tracking-widest text-xs"
                  >
                    Add Items to Cart
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;
