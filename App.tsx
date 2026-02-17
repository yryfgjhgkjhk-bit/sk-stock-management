
import React, { useState, useEffect } from 'react';
import { View, Product, Sale, StockLog, User, UserRole, Customer } from './types';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import POS from './components/POS';
import Reports from './components/Reports';
import SalesHistory from './components/SalesHistory';
import Login from './components/Login';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('sarkartrade_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('sarkartrade_products');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [sales, setSales] = useState<Sale[]>(() => {
    const saved = localStorage.getItem('sarkartrade_sales');
    return saved ? JSON.parse(saved) : [];
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem('sarkartrade_customers');
    return saved ? JSON.parse(saved) : [];
  });

  const [categories, setCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('sarkartrade_categories');
    if (saved) return JSON.parse(saved);
    const derived = Array.from(new Set(products.map(p => p.category)));
    return derived.length > 0 ? derived.sort() : ['General', 'Electronics', 'Groceries', 'Beverages'];
  });

  // Effect to handle visual saving indicator
  useEffect(() => {
    if (saveStatus === 'saving') {
      const timer = setTimeout(() => setSaveStatus('saved'), 600);
      return () => clearTimeout(timer);
    }
    if (saveStatus === 'saved') {
      const timer = setTimeout(() => setSaveStatus('idle'), 2000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  // Persist to LocalStorage with status updates
  useEffect(() => {
    if (!currentUser) return;
    setSaveStatus('saving');
    localStorage.setItem('sarkartrade_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    if (!currentUser) return;
    setSaveStatus('saving');
    localStorage.setItem('sarkartrade_sales', JSON.stringify(sales));
  }, [sales]);

  useEffect(() => {
    if (!currentUser) return;
    setSaveStatus('saving');
    localStorage.setItem('sarkartrade_customers', JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    if (!currentUser) return;
    setSaveStatus('saving');
    localStorage.setItem('sarkartrade_categories', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('sarkartrade_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('sarkartrade_user');
    }
  }, [currentUser]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setCurrentView(View.DASHBOARD);
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  const isAdmin = currentUser?.role === UserRole.ADMIN;

  const addCategory = (name: string) => {
    if (!isAdmin) return;
    if (!categories.includes(name)) {
      setCategories(prev => [...prev, name].sort());
    }
  };

  const renameCategory = (oldName: string, newName: string) => {
    if (!isAdmin) return;
    if (categories.includes(newName)) return;
    setCategories(prev => prev.map(c => c === oldName ? newName : c).sort());
    setProducts(prev => prev.map(p => p.category === oldName ? { ...p, category: newName } : p));
  };

  const deleteCategory = (name: string) => {
    if (!isAdmin) return;
    setCategories(prev => prev.filter(c => c !== name));
    setProducts(prev => prev.map(p => p.category === name ? { ...p, category: 'General' } : p));
    if (!categories.includes('General')) {
      setCategories(prev => ['General', ...prev.filter(c => c !== name)].sort());
    }
  };

  const addProduct = (p: Product) => {
    if (!isAdmin) return;
    const initialLog: StockLog = {
      id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
      type: 'INITIAL',
      amount: p.stock,
      balance: p.stock
    };
    setProducts(prev => [...prev, { ...p, stockHistory: [initialLog] }]);
    if (!categories.includes(p.category)) {
      addCategory(p.category);
    }
  };
  
  const updateProduct = (updated: Product) => {
    if (!isAdmin) return;
    setProducts(prev => prev.map(p => {
      if (p.id === updated.id) {
        const history = p.stockHistory || [];
        if (updated.stock !== p.stock) {
          const log: StockLog = {
            id: `LOG-${Date.now()}`,
            timestamp: new Date().toISOString(),
            type: 'ADJUSTMENT',
            amount: updated.stock - p.stock,
            balance: updated.stock,
            reason: 'Manual Update'
          };
          return { ...updated, stockHistory: [log, ...history] };
        }
        return { ...updated, stockHistory: history };
      }
      return p;
    }));
    if (!categories.includes(updated.category)) {
      addCategory(updated.category);
    }
  };

  const bulkUpdateProducts = (productIds: string[], updates: Partial<Product>) => {
    if (!isAdmin) return;
    setProducts(prev => prev.map(p => {
      if (productIds.includes(p.id)) {
        return { ...p, ...updates };
      }
      return p;
    }));
  };

  const adjustStock = (id: string, amount: number, reason: string) => {
    if (!isAdmin) return;
    setProducts(prev => prev.map(p => {
      if (p.id === id) {
        const newStock = Math.max(0, p.stock + amount);
        const log: StockLog = {
          id: `LOG-${Date.now()}-${p.id}`,
          timestamp: new Date().toISOString(),
          type: 'ADJUSTMENT',
          amount: amount,
          balance: newStock,
          reason: reason
        };
        return { 
          ...p, 
          stock: newStock,
          stockHistory: [log, ...(p.stockHistory || [])]
        };
      }
      return p;
    }));
  };

  const deleteProduct = (id: string) => {
    if (!isAdmin) return;
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const completeSale = (sale: Sale) => {
    const timestamp = new Date().toISOString();
    const processedSale = { ...sale, processedBy: currentUser?.fullName };
    
    setProducts(prev => prev.map(p => {
      const soldItem = sale.items.find(item => item.productId === p.id);
      if (soldItem) {
        const newStock = p.stock - soldItem.quantity;
        const log: StockLog = {
          id: `LOG-${Date.now()}-${p.id}`,
          timestamp: timestamp,
          type: 'SALE',
          amount: -soldItem.quantity,
          balance: newStock
        };
        return { 
          ...p, 
          stock: newStock,
          stockHistory: [log, ...(p.stockHistory || [])]
        };
      }
      return p;
    }));
    setSales(prev => [processedSale, ...prev]);
  };

  const processReturn = (saleId: string, returns: { productId: string, quantity: number }[]) => {
    if (!isAdmin) return;
    setSales(prev => prev.map(s => {
      if (s.id === saleId) {
        return {
          ...s,
          items: s.items.map(item => {
            const returnInfo = returns.find(r => r.productId === item.productId);
            if (returnInfo) {
              return {
                ...item,
                returnedQuantity: (item.returnedQuantity || 0) + returnInfo.quantity
              };
            }
            return item;
          })
        };
      }
      return s;
    }));

    returns.forEach(ret => {
      setProducts(prev => prev.map(p => {
        if (p.id === ret.productId) {
          const newStock = p.stock + ret.quantity;
          const log: StockLog = {
            id: `LOG-RET-${Date.now()}-${p.id}`,
            timestamp: new Date().toISOString(),
            type: 'RESTOCK',
            amount: ret.quantity,
            balance: newStock,
            reason: `Return from Sale #${saleId.slice(-6)}`
          };
          return {
            ...p,
            stock: newStock,
            stockHistory: [log, ...(p.stockHistory || [])]
          };
        }
        return p;
      }));
    });
  };

  const restockProduct = (id: string, amount: number) => {
    if (!isAdmin) return;
    setProducts(prev => prev.map(p => {
      if (p.id === id) {
        const newStock = p.stock + amount;
        const log: StockLog = {
          id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          timestamp: new Date().toISOString(),
          type: 'RESTOCK',
          amount: amount,
          balance: newStock
        };
        return { 
          ...p, 
          stock: newStock,
          lastRestocked: new Date().toISOString(),
          stockHistory: [log, ...(p.stockHistory || [])]
        };
      }
      return p;
    }));
  };

  const saveCustomer = (customer: Customer) => {
    setCustomers(prev => {
      const exists = prev.find(c => c.id === customer.id);
      if (exists) {
        return prev.map(c => c.id === customer.id ? customer : c);
      }
      return [...prev, customer];
    });
  };

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  const renderView = () => {
    switch (currentView) {
      case View.DASHBOARD:
        return <Dashboard products={products} sales={sales} setView={setCurrentView} />;
      case View.INVENTORY:
        return (
          <Inventory 
            products={products} 
            categories={categories}
            onAddCategory={addCategory}
            onRenameCategory={renameCategory}
            onDeleteCategory={deleteCategory}
            onAdd={addProduct} 
            onUpdate={updateProduct} 
            onBulkUpdate={bulkUpdateProducts}
            onDelete={deleteProduct}
            onRestock={restockProduct}
            onAdjust={adjustStock}
            userRole={currentUser.role}
          />
        );
      case View.POS:
        return (
          <POS 
            products={products} 
            customers={customers}
            onSaveCustomer={saveCustomer}
            onComplete={completeSale} 
          />
        );
      case View.REPORTS:
        return isAdmin ? <Reports products={products} sales={sales} /> : <Dashboard products={products} sales={sales} setView={setCurrentView} />;
      case View.HISTORY:
        return <SalesHistory sales={sales} onProcessReturn={processReturn} userRole={currentUser.role} />;
      default:
        return <Dashboard products={products} sales={sales} setView={setCurrentView} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <div className="no-print">
        <Sidebar currentView={currentView} setView={setCurrentView} user={currentUser} onLogout={handleLogout} />
      </div>
      <main className="flex-1 p-4 md:p-8 overflow-y-auto relative">
        <div className="max-w-7xl mx-auto">
          {renderView()}
        </div>

        {/* Subtle Offline Persistence Status */}
        <div className="fixed bottom-6 right-8 no-print pointer-events-none select-none">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur-sm border shadow-sm transition-all duration-500 transform ${saveStatus !== 'idle' ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${saveStatus === 'saving' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              {saveStatus === 'saving' ? 'Syncing to Storage' : 'Saved Offline'}
            </span>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
