'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useState } from 'react';
import { Home, ShoppingBag, Wallet, MessageSquare, Menu, X, LogOut, Clock, Sliders, Award, ShoppingCart } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { getUserRank } from '@/lib/ranks';
import { useCart } from '../context/CartContext';
import CartDrawer from './CartDrawer';

export default function Navbar({ onOpenContact, onOpenHistory }) {
  const { data: session, update } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { cartCount } = useCart();
  const [cartOpen, setCartOpen] = useState(false);

  const handleRefreshBalance = async () => {
    // อัปเดตเซสชันเพื่อดึงยอดเงินและยศ VIP ล่าสุดจาก DB
    await update({ refresh: true });
  };

  const navItems = [
    { label: 'หน้าแรก', href: '/', icon: Home },
    { label: 'สินค้าทั้งหมด', href: '/products', icon: ShoppingBag },
    { label: 'เติมเงิน', href: '/topup', icon: Wallet },
    { label: 'วงล้อ Gacha', href: '/gacha', icon: Award },
  ];

  // คำนวณหายศ VIP จากยอดสะสมจริง
  const userRank = session?.user ? getUserRank(session.user.totalSpent || 0) : null;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-[#02060d]/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Left Side: Brand Name & Navigation Links */}
        <div className="flex items-center gap-8">
          <Link href="/" className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span className="bg-gradient-to-r from-sky-400 to-blue-500 bg-clip-text text-transparent glow-text font-black">
              NakataShop
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-sky-400 ${
                    isActive ? 'text-sky-400' : 'text-zinc-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
            
            {/* Contact Link */}
            <Link
              href="/tickets"
              className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-sky-400 ${
                pathname === '/tickets' ? 'text-sky-400' : 'text-zinc-400'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              ติดต่อเรา / แจ้งปัญหา
            </Link>

            {/* Admin Dashboard Link */}
            {session?.user?.role === 'admin' && (
              <Link
                href="/admin"
                className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-sky-400 ${
                  pathname === '/admin' ? 'text-sky-400' : 'text-zinc-400'
                }`}
              >
                <Sliders className="w-4 h-4 text-sky-400 animate-pulse" />
                จัดการระบบ (Admin)
              </Link>
            )}
          </nav>
        </div>

        {/* Right Side: User Actions, Wallet */}
        <div className="flex items-center gap-4">
          
          {/* Cart Icon Button */}
          <Link href="/cart" className="relative p-2 rounded-full border border-white/5 hover:border-sky-500/20 hover:bg-zinc-900/40 text-zinc-400 hover:text-sky-400 flex items-center justify-center active:scale-95" title="ตะกร้าสินค้า">
          <ShoppingCart className="w-4 h-4" />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-sky-500 text-sky-950 font-black rounded-full flex items-center justify-center text-[9px] animate-pulse">
              {cartCount}
            </span>
          )}
        </Link>

          {/* User Session Info */}
          {session ? (
            <div className="hidden sm:flex items-center gap-3">
              {/* Rank Badge */}
              {userRank && (
                <span className={`inline-flex items-center text-[9px] font-black px-2 py-0.5 rounded border tracking-wider select-none ${userRank.color}`}>
                  {userRank.badge}
                </span>
              )}

              {/* Wallet */}
              <div 
                onClick={handleRefreshBalance}
                title="คลิกเพื่ออัปเดตยอดเงินและยศ VIP"
                className="flex items-center gap-2 bg-sky-950/40 hover:bg-sky-950/60 border border-sky-500/20 px-3 py-1.5 rounded-full text-xs font-semibold text-sky-400 cursor-pointer transition-all active:scale-95"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>{session.user.balance?.toLocaleString()} THB</span>
                <span className="text-[9px] opacity-60 bg-sky-500/10 px-1 rounded">อัปเดต</span>
              </div>

              {/* View History Button */}
              <Link
                href="/inventory"
                title="คลังสินค้า & ประวัติการซื้อ"
                className="p-2 rounded-full border border-white/5 hover:border-sky-500/20 hover:bg-zinc-900/40 text-zinc-400 hover:text-sky-400 cursor-pointer transition-colors flex items-center justify-center"
              >
                <Clock className="w-4 h-4" />
              </Link>

              {/* Logout Button */}
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="flex items-center gap-2 text-xs font-semibold text-red-400 hover:text-red-300 border border-red-500/10 hover:border-red-500/30 bg-red-950/10 px-3 py-1.5 rounded-md cursor-pointer transition-all"
              >
                <LogOut className="w-3.5 h-3.5" />
                ออกจากระบบ
              </button>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Link
                href="/auth/signin"
                className="text-xs font-semibold text-zinc-300 hover:text-white px-3 py-2 rounded-md hover:bg-white/5 transition-colors"
              >
                เข้าสู่ระบบ
              </Link>
              <Link
                href="/auth/signup"
                className="text-xs font-semibold bg-sky-500 text-sky-950 hover:bg-sky-400 px-3 py-2 rounded-md transition-all glow-btn"
              >
                สมัครสมาชิก
              </Link>
            </div>
          )}

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-md border border-white/5 text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-white/5 bg-[#02060d] px-4 py-4 space-y-3">
          <nav className="flex flex-col gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${
                    pathname === item.href ? 'bg-sky-500/10 text-sky-400' : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
            
            <Link
              href="/tickets"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${
                pathname === '/tickets' ? 'bg-sky-500/10 text-sky-400' : 'text-zinc-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <MessageSquare className="w-4.5 h-4.5" />
              ติดต่อเรา / แจ้งปัญหา
            </Link>

            {session?.user?.role === 'admin' && (
              <Link
                href="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium ${
                  pathname === '/admin' ? 'bg-sky-500/10 text-sky-400' : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Sliders className="w-4 h-4 text-sky-400" />
                จัดการระบบ (Admin)
              </Link>
            )}
          </nav>

          {/* Mobile Wallet & Auth Status */}
          <div className="pt-4 border-t border-white/5 space-y-3">
            {session ? (
              <div className="space-y-3">
                {/* Wallet Balance */}
                <div className="flex justify-between items-center bg-sky-950/20 border border-sky-500/10 px-4 py-2.5 rounded-lg text-sm">
                  <div className="flex items-center gap-2 text-sky-400 font-medium">
                    <Wallet className="w-4 h-4" />
                    <span>กระเป๋าเงินของคุณ</span>
                  </div>
                  <span className="font-bold text-sky-400">{session.user.balance?.toLocaleString()} THB</span>
                </div>

                {/* Mobile Rank Badge */}
                {userRank && (
                  <div className="flex justify-between items-center bg-zinc-950/40 border border-white/5 px-4 py-2 rounded-lg text-xs">
                    <span className="text-zinc-400">ระดับยศสมาชิก:</span>
                    <span className={`inline-flex items-center text-[9px] font-black px-2 py-0.5 rounded border tracking-wider select-none ${userRank.color}`}>
                      {userRank.badge}
                    </span>
                  </div>
                )}
                
                <Link
                  href="/inventory"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 w-full text-left px-3 py-2 rounded-md text-sm font-medium text-zinc-400 hover:bg-white/5 hover:text-white cursor-pointer"
                >
                  <Clock className="w-4 h-4" />
                  ประวัติและคลังของฉัน
                </Link>

                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    signOut({ callbackUrl: '/' });
                  }}
                  className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-md text-sm font-medium text-red-400 hover:bg-red-950/10 border border-red-500/10 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  ออกจากระบบ
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/auth/signin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center text-xs font-semibold text-zinc-300 hover:text-white px-3 py-2.5 rounded-xl border border-white/5 hover:bg-white/5 transition-colors"
                >
                  เข้าสู่ระบบ
                </Link>
                <Link
                  href="/auth/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center text-xs font-semibold bg-sky-500 text-sky-950 hover:bg-sky-400 px-3 py-2.5 rounded-xl transition-all font-bold"
                >
                  สมัครสมาชิก
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cart Drawer */}
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />
    </header>
  );
}
