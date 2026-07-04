'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ShoppingBag, Loader2, Gamepad2, Play, CreditCard, Sparkles } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ContactModal from '../components/ContactModal';
import HistoryModal from '../components/HistoryModal';
import ProductDetailModal from '../components/ProductDetailModal';
import CanvasBackground from '../components/CanvasBackground';

export default function ProductsPage() {
  const [selectedSubcategory, setSelectedSubcategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Modals status
  const [contactOpen, setContactOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Query products from API
  const { data: products = [], isLoading, error } = useQuery({
    queryKey: ['products', selectedSubcategory, searchQuery],
    queryFn: async () => {
      let url = '/api/products';
      const params = [];
      
      if (selectedSubcategory !== 'all') {
        params.push(`subcategory=${encodeURIComponent(selectedSubcategory)}`);
      }
      if (searchQuery) {
        params.push(`search=${encodeURIComponent(searchQuery)}`);
      }
      
      if (params.length > 0) {
        url += `?${params.join('&')}`;
      }
      
      const res = await fetch(url);
      if (!res.ok) throw new Error('เกิดข้อผิดพลาดในการโหลดสินค้า');
      return res.json();
    },
  });

  const categoriesTabs = [
    { id: 'all', name: 'ทั้งหมด', icon: Sparkles },
    { id: 'บัตรเติมเกม', name: 'บัตรเติมเกม', icon: Gamepad2 },
    { id: 'Steam Wallet', name: 'Steam Wallet', icon: CreditCard },
    { id: 'Netflix', name: 'Netflix', icon: Play },
    { id: 'Disneyplus', name: 'Disney+', icon: Play },
    { id: 'Spotify', name: 'Spotify', icon: Play },
  ];

  return (
    <div className="relative min-h-screen flex flex-col bg-[#02060d]">
      <CanvasBackground />
      <Navbar onOpenContact={() => setContactOpen(true)} onOpenHistory={() => setHistoryOpen(true)} />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
        
        {/* Header section with Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <ShoppingBag className="w-6 h-6 text-sky-400" />
              <span>สินค้าทั้งหมดใน NakataShop</span>
            </h1>
            <p className="text-xs text-zinc-400 mt-1">พบกับบัตรเติมเกมและไอดีสตรีมมิ่งราคาถูก การันตีปลอดภัย 100%</p>
          </div>

          {/* Search Input */}
          <div className="relative max-w-md w-full">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-500 pointer-events-none">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาสินค้า เช่น Netflix, Steam..."
              className="w-full bg-zinc-950/60 border border-white/5 pl-10 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>
        </div>

        {/* Categories Tabs Filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 scrollbar-hide border-b border-white/5">
          {categoriesTabs.map((tab) => {
            const Icon = tab.icon;
            const isSelected = selectedSubcategory === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedSubcategory(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-sky-500 text-sky-950 border-sky-500'
                    : 'bg-zinc-950/40 border-white/5 text-zinc-400 hover:text-white hover:border-white/10'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.name}
              </button>
            );
          })}
        </div>

        {/* Products Grid */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3">
            <Loader2 className="w-10 h-10 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-zinc-500">กำลังดึงรายการสินค้าจาก NakataShop...</p>
          </div>
        ) : error ? (
          <div className="text-center py-20 text-red-400 text-sm">
            {error.message || 'เกิดข้อผิดพลาดในการโหลดสินค้า'}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-32 text-zinc-500 space-y-2">
            <ShoppingBag className="w-12 h-12 stroke-[1.5] text-zinc-700 mx-auto" />
            <p className="text-sm">ไม่พบสินค้าในหมวดหมู่นี้</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => {
              const isOutOfStock = product.stock <= 0;
              return (
                <div
                  key={product._id}
                  onClick={() => setSelectedProduct(product)}
                  className="glass-card rounded-2xl overflow-hidden flex flex-col h-full cursor-pointer group"
                >
                  {/* Image Container */}
                  <div className="relative aspect-video w-full overflow-hidden bg-zinc-950">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    
                    {/* Subcategory Badge */}
                    <span className="absolute top-3 left-3 text-[10px] font-bold px-2 py-0.5 bg-[#02060d]/80 backdrop-blur border border-white/10 text-sky-400 rounded">
                      {product.subcategory}
                    </span>
                    
                    {/* Out of Stock overlay */}
                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-sm font-bold text-red-400 uppercase tracking-widest">
                        สินค้าหมดคลัง
                      </div>
                    )}
                  </div>

                  {/* Body Info */}
                  <div className="p-4 flex flex-col flex-1 space-y-3">
                    <div className="space-y-1 flex-1">
                      <h3 className="text-sm font-bold text-white leading-snug line-clamp-1 group-hover:text-sky-400 transition-colors">
                        {product.name}
                      </h3>
                      <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                        {product.description}
                      </p>
                    </div>

                    {/* Stock status */}
                    <div className="flex justify-between items-center text-[10px] text-zinc-500">
                      <span>พร้อมส่ง {product.stock} ชิ้น</span>
                      <span>ขายแล้ว {product.sold} ชิ้น</span>
                    </div>

                    {/* Bottom: Price and Buy Button */}
                    <div className="flex items-center justify-between pt-2.5 border-t border-white/5">
                      <span className="text-sm font-bold text-sky-400">
                        {product.price.toLocaleString()} THB
                      </span>
                      <button
                        disabled={isOutOfStock}
                        className="text-[11px] font-bold bg-sky-500 text-sky-950 hover:bg-sky-400 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer disabled:bg-zinc-800 disabled:text-zinc-500 disabled:pointer-events-none"
                      >
                        สั่งซื้อ
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </main>

      {/* Footer */}
      <Footer onOpenContact={() => setContactOpen(true)} />

      {/* Auxiliary Modals */}
      <ContactModal isOpen={contactOpen} onClose={() => setContactOpen(false)} />
      <HistoryModal isOpen={historyOpen} onClose={() => setHistoryOpen(false)} />
      
      {/* Product Buy Modal */}
      <ProductDetailModal
        product={selectedProduct}
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </div>
  );
}
