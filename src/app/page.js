'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, Gamepad2, Play, CreditCard, Users, ShoppingBag, Layers, CheckSquare, MessageSquare, ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ContactModal from './components/ContactModal';
import HistoryModal from './components/HistoryModal';
import ProductDetailModal from './components/ProductDetailModal';
import CanvasBackground from './components/CanvasBackground';

export default function HomePage() {
  const { data: session } = useSession();

  // Modals status
  const [contactOpen, setContactOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Fetch Dashboard Stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const res = await fetch('/api/stats');
      if (!res.ok) throw new Error('Failed to load stats');
      return res.json();
    },
    refetchInterval: 15000, // Refresh every 15s
  });

  // Query recommended/featured products (limit to 4)
  const { data: featuredProducts = [] } = useQuery({
    queryKey: ['featured-products'],
    queryFn: async () => {
      const res = await fetch('/api/products?limit=4');
      if (!res.ok) throw new Error('Failed to load featured products');
      const data = await res.json();
      return data.slice(0, 4); // return first 4 items
    },
  });

  // Seed db trigger (only call once if db is empty)
  useEffect(() => {
    const checkAndSeed = async () => {
      try {
        const res = await fetch('/api/products');
        const data = await res.json();
        if (Array.isArray(data) && data.length === 0) {
          // Trigger seeding
          await fetch('/api/seed');
        }
      } catch (err) {
        console.error('Check/Seed error:', err);
      }
    };
    checkAndSeed();
  }, []);

  // Carousel slider state
  const [currentSlide, setCurrentSlide] = useState(0);

  const { data: dbBanners = [] } = useQuery({
    queryKey: ['banners'],
    queryFn: async () => {
      const res = await fetch('/api/banners');
      if (!res.ok) throw new Error('Failed to load banners');
      return res.json();
    }
  });

  const defaultSlides = [
    {
      title: 'ยินดีต้อนรับสู่ NakataShop',
      desc: 'ร้านจำหน่ายบัตรเติมเงินและไอดีสตรีมมิ่งยอดนิยม ราคาประหยัด มีสต็อกพร้อมจัดส่งทันที',
      image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&auto=format&fit=crop&q=80',
      action: 'ดูสินค้าทั้งหมด',
      href: '/products',
    },
    {
      title: 'สตรีมมิ่งความคมชัดระดับ 4K',
      desc: 'Netflix Premium, Disney+ Hotstar, Spotify ราคาคุ้มค่าที่สุด เริ่มต้นเพียง 49 บาทเท่านั้น!',
      image: 'https://images.unsplash.com/photo-1574375927938-d5a98e8fed85?w=1200&auto=format&fit=crop&q=80',
      action: 'เลือกซื้อตอนนี้',
      href: '/products',
    },
  ];

  const carouselSlides = dbBanners.length > 0 ? dbBanners : defaultSlides;
  const activeSlide = carouselSlides[currentSlide] || carouselSlides[0] || defaultSlides[0];

  useEffect(() => {
    if (carouselSlides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselSlides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [carouselSlides.length]);

  const handleNextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % carouselSlides.length);
  };

  const handlePrevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + carouselSlides.length) % carouselSlides.length);
  };

  // Recommended categories
  const categoriesList = [
    {
      name: 'บัตรเติมเกม',
      desc: 'บัตร Garena, Razer Gold PIN และสิทธิ์เติมเกมอื่นๆ',
      image: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=500&auto=format&fit=crop&q=60',
      count: 2,
    },
    {
      name: 'Steam Wallet',
      desc: 'เติมเครดิตบัญชี Steam ประเทศไทย ซื้อเกมคุ้มค่าที่สุด',
      image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=500&auto=format&fit=crop&q=60',
      count: 2,
    },
    {
      name: 'สตรีมมิ่งบันเทิง',
      desc: 'แพ็กเกจแชร์และจอส่วนตัวของ Netflix, Disney+, Spotify',
      image: 'https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=500&auto=format&fit=crop&q=60',
      count: 4,
    },
  ];

  return (
    <div className="relative min-h-screen flex flex-col bg-[#02060d]">
      <CanvasBackground />
      <Navbar onOpenContact={() => setContactOpen(true)} onOpenHistory={() => setHistoryOpen(true)} />

      {/* Hero Welcome Section */}
      <section className="relative w-full h-[500px] lg:h-[450px] overflow-hidden flex items-center justify-start z-10">

        {/* Background Image overlay */}
        <div className="absolute inset-0 bg-black/60 z-0">
          <img
            src="https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1600&auto=format&fit=crop&q=80"
            alt="Hero Background"
            className="w-full h-full object-cover opacity-35"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#02060d] via-transparent to-black/20" />
        </div>

        {/* Text Details */}
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 relative z-10 text-left">
          <div className="max-w-xl space-y-6">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-500/10 text-sky-400 text-xs font-semibold rounded-full border border-sky-500/20">
                <Sparkles className="w-3.5 h-3.5" />
                ยินดีต้อนรับสู่ NakataShop
              </span>

              <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight glow-text">
                ร้านเติมเงินเกม & สตรีมมิ่งสุดพรีเมียม
              </h1>

              <p className="text-sm text-zinc-300 leading-relaxed">
                แหล่งจำหน่ายบัตรเติมเงิน บัตรเติมเกม และแพ็กเกจสตรีมมิ่งความคมชัดระดับ 4K
                ราคาประหยัด ปลอดภัยด้วยการเชื่อมต่อระบบฐานข้อมูลจริง ได้รับรหัสสินค้าทันทีหลังทำรายการสำเร็จ
              </p>
            </div>

            {/* Quick CTAs */}
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/products"
                className="bg-sky-500 text-sky-950 px-6 py-3 rounded-xl font-bold hover:bg-sky-400 transition-all glow-btn text-sm"
              >
                เลือกซื้อสินค้า
              </Link>
              <Link
                href="/topup"
                className="bg-zinc-900 text-zinc-300 border border-white/5 px-6 py-3 rounded-xl font-bold hover:text-white hover:bg-zinc-800 transition-colors text-sm"
              >
                เติมเงิน (Wallet)
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Main Home Content */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16 relative z-10">

        {/* Interactive Banner Slider */}
        <section className="relative group rounded-2xl overflow-hidden border border-white/5 aspect-21/9 md:aspect-[3/1] bg-zinc-950">
          <img
            src={activeSlide.image}
            alt={activeSlide.title || "Banner"}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
              (activeSlide.title || activeSlide.desc) ? 'opacity-40' : 'opacity-100'
            }`}
          />
          {(activeSlide.title || activeSlide.desc) && (
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent flex flex-col justify-center p-6 sm:p-10 lg:p-12 text-left" />
          )}

          {(activeSlide.title || activeSlide.desc || (activeSlide.action && activeSlide.href)) && (
            <div className="absolute inset-0 flex flex-col justify-center p-6 sm:p-10 lg:p-12 text-left max-w-lg space-y-3.5">
              {activeSlide.title && (
                <h2 className="text-lg sm:text-2xl font-bold text-white leading-tight">
                  {activeSlide.title}
                </h2>
              )}
              {activeSlide.desc && (
                <p className="text-xs sm:text-sm text-zinc-300 leading-normal">
                  {activeSlide.desc}
                </p>
              )}
              {activeSlide.action && activeSlide.href && (
                <div>
                  <Link
                    href={activeSlide.href}
                    className="inline-flex bg-sky-500 hover:bg-sky-400 text-sky-950 text-xs font-bold px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
                  >
                    {activeSlide.action}
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Left Arrow */}
          <button
            onClick={handlePrevSlide}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full border border-white/5 bg-black/40 hover:bg-black/80 text-zinc-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100 cursor-pointer hidden sm:flex"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Right Arrow */}
          <button
            onClick={handleNextSlide}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full border border-white/5 bg-black/40 hover:bg-black/80 text-zinc-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100 cursor-pointer hidden sm:flex"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </section>

        {/* Dynamic Statistics Grid */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Total Users */}
          <div className="glass p-5 rounded-2xl border border-white/5 flex items-center gap-4 hover:border-sky-500/20 transition-all">
            <div className="bg-sky-500/10 p-3 rounded-xl text-sky-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">
                ผู้ใช้ทั้งหมด
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-white mt-0.5">
                {statsLoading ? (
                  <span className="inline-block w-16 h-6 skeleton-pulse rounded" />
                ) : (
                  stats?.users?.toLocaleString() + '+'
                )}
              </h3>
            </div>
          </div>

          {/* Total Products */}
          <div className="glass p-5 rounded-2xl border border-white/5 flex items-center gap-4 hover:border-sky-500/20 transition-all">
            <div className="bg-sky-500/10 p-3 rounded-xl text-sky-400">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">
                สินค้าทั้งหมด
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-white mt-0.5">
                {statsLoading ? (
                  <span className="inline-block w-16 h-6 skeleton-pulse rounded" />
                ) : (
                  stats?.products?.toLocaleString()
                )}
              </h3>
            </div>
          </div>

          {/* Total Stock */}
          <div className="glass p-5 rounded-2xl border border-white/5 flex items-center gap-4 hover:border-sky-500/20 transition-all">
            <div className="bg-sky-500/10 p-3 rounded-xl text-sky-400">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">
                สต๊อกทั้งหมด
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-white mt-0.5">
                {statsLoading ? (
                  <span className="inline-block w-16 h-6 skeleton-pulse rounded" />
                ) : (
                  stats?.stock?.toLocaleString()
                )}
              </h3>
            </div>
          </div>

          {/* Total Items Sold */}
          <div className="glass p-5 rounded-2xl border border-white/5 flex items-center gap-4 hover:border-sky-500/20 transition-all">
            <div className="bg-sky-500/10 p-3 rounded-xl text-sky-400">
              <CheckSquare className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">
                ขายแล้วทั้งหมด
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-white mt-0.5">
                {statsLoading ? (
                  <span className="inline-block w-16 h-6 skeleton-pulse rounded" />
                ) : (
                  stats?.sold?.toLocaleString() + '+'
                )}
              </h3>
            </div>
          </div>

        </section>

        {/* Recommended Products Grid */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">สินค้าแนะนำสำหรับคุณ</h2>
              <p className="text-xs text-zinc-500">รวมสินค้าขายดีและได้รับความนิยมสูง</p>
            </div>
            <Link
              href="/products"
              className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1 hover:underline"
            >
              <span>ดูเพิ่มเติม</span>
              <span>→</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {featuredProducts.map((p) => {
              const isOutOfStock = p.stock <= 0;
              return (
                <div
                  key={p._id}
                  onClick={() => setSelectedProduct(p)}
                  className="glass-card rounded-2xl overflow-hidden flex flex-col h-full cursor-pointer group"
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-zinc-950">
                    <img
                      src={p.image}
                      alt={p.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <span className="absolute top-3 left-3 text-[10px] font-bold px-2 py-0.5 bg-[#02060d]/80 backdrop-blur border border-white/10 text-sky-400 rounded">
                      {p.subcategory}
                    </span>
                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-sm font-bold text-red-400">
                        สินค้าหมด
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex flex-col flex-1 space-y-3">
                    <h3 className="text-sm font-bold text-white line-clamp-1 group-hover:text-sky-400 transition-colors">
                      {p.name}
                    </h3>
                    <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed flex-1">
                      {p.description}
                    </p>
                    <div className="flex items-center justify-between pt-2.5 border-t border-white/5">
                      <span className="text-sm font-bold text-sky-400">
                        {p.price.toLocaleString()} THB
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        ขายแล้ว {p.sold} ชิ้น
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Recommended Categories Section */}
        <section className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-white">หมวดหมู่แนะนำสำหรับคุณ</h2>
            <p className="text-xs text-zinc-500">เลือกหมวดหมู่ที่ตอบโจทย์ไลฟ์สไตล์คุณ</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {categoriesList.map((cat, idx) => (
              <Link
                key={idx}
                href="/products"
                className="glass-card rounded-2xl overflow-hidden block relative border border-white/5 transition-all group"
              >
                <div className="aspect-[4/2] w-full overflow-hidden bg-zinc-950 relative">
                  <img
                    src={cat.image}
                    alt={cat.name}
                    className="w-full h-full object-cover opacity-60 transition-transform duration-500 group-hover:scale-103"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#02060d] via-black/35 to-transparent" />
                </div>
                <div className="p-5 space-y-1">
                  <h3 className="text-base font-bold text-white group-hover:text-sky-400 transition-colors">
                    {cat.name}
                  </h3>
                  <p className="text-xs text-zinc-400 leading-normal">
                    {cat.desc}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Discord Contact CTA Banner */}
        <section className="w-full">
          <a
            href="https://rdcw.co.th/discord"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col sm:flex-row items-center justify-between gap-6 bg-[#5865F2]/10 hover:bg-[#5865F2]/15 border border-[#5865F2]/20 p-6 sm:p-8 rounded-2xl transition-all hover:scale-[0.99] text-left"
          >
            <div className="flex items-center gap-4">
              <div className="bg-[#5865F2] text-white p-3.5 rounded-xl shrink-0">
                <HelpCircle className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white leading-tight">
                  สอบถามหรือแนะนำระบบเพิ่มเติมได้ที่ Discord ของเรา
                </h3>
                <p className="text-xs text-zinc-400">
                  มีปัญหาการเติมเงิน การซื้อ หรือสตรีมมิ่งหลุด สามารถเข้าแจ้งแอดมินคอมมูนิตี้ช่วยเหลือได้ทันที
                </p>
              </div>
            </div>

            <span className="bg-[#5865F2] text-white hover:bg-[#5865F2]/90 px-5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap">
              เข้าร่วม Discord
            </span>
          </a>
        </section>

      </main>

      {/* Footer */}
      <Footer onOpenContact={() => setContactOpen(true)} />

      {/* Auxiliary Modals */}
      <ContactModal isOpen={contactOpen} onClose={() => setContactOpen(false)} />
      <HistoryModal isOpen={historyOpen} onClose={() => setHistoryOpen(false)} />

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={selectedProduct}
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </div>
  );
}
