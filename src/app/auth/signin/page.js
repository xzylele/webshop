'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { LogIn, Lock, Mail, ArrowRight, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import CanvasBackground from '../../components/CanvasBackground';

function SigninForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    if (!formData.email || !formData.password) {
      setErrorMsg('กรุณากรอกข้อมูลให้ครบถ้วน');
      setLoading(false);
      return;
    }

    try {
      const res = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (res?.error) {
        setErrorMsg(res.error);
        setLoading(false);
      } else {
        setSuccessMsg('เข้าสู่ระบบสำเร็จแล้ว! กำลังพาท่านไป...');
        setTimeout(() => {
          router.push(callbackUrl);
          router.refresh();
        }, 1500);
      }
    } catch (err) {
      console.error('Signin error:', err);
      setErrorMsg('เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="w-full max-w-md space-y-8 glass p-8 rounded-2xl border border-white/5 relative z-10">
      {/* Header */}
      <div className="text-center">
        <Link href="/" className="inline-block text-2xl font-black bg-gradient-to-r from-sky-400 to-blue-500 bg-clip-text text-transparent glow-text mb-2">
          NakataShop
        </Link>
        <h2 className="text-lg font-bold text-white tracking-tight">เข้าสู่ระบบ NakataShop</h2>
        <p className="text-xs text-zinc-400 mt-1">ล็อกอินเข้าสู่บัญชีเพื่อเติมเงินและซื้อสินค้าในระบบ</p>
      </div>

      {/* Status Messages */}
      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-xl text-xs text-red-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 rounded-xl text-xs text-emerald-400 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0 animate-pulse" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Signin Form */}
      <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
        
        {/* Email Input */}
        <div className="space-y-1.5">
          <label className="text-xs text-zinc-400 font-semibold block">อีเมลของคุณ</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-500">
              <Mail className="w-4 h-4" />
            </span>
            <input
              type="email"
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="w-full bg-[#03060d] border border-white/5 pl-10 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500 transition-colors"
              placeholder="example@gmail.com"
            />
          </div>
        </div>

        {/* Password Input */}
        <div className="space-y-1.5">
          <label className="text-xs text-zinc-400 font-semibold block">รหัสผ่าน</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-500">
              <Lock className="w-4 h-4" />
            </span>
            <input
              type="password"
              name="password"
              required
              value={formData.password}
              onChange={handleChange}
              className="w-full bg-[#03060d] border border-white/5 pl-10 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500 transition-colors"
              placeholder="••••••••"
            />
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-sky-500 text-sky-950 font-bold py-3 rounded-xl hover:bg-sky-400 transition-all glow-btn disabled:opacity-50 disabled:pointer-events-none cursor-pointer mt-6"
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4.5 h-4.5 animate-spin" />
              <span>กำลังเข้าสู่ระบบ...</span>
            </div>
          ) : (
            <>
              <LogIn className="w-4.5 h-4.5" />
              <span>เข้าสู่ระบบ</span>
              <ArrowRight className="w-4.5 h-4.5" />
            </>
          )}
        </button>
      </form>

      {/* Switch to Signup */}
      <div className="text-center text-xs text-zinc-400 pt-4 border-t border-white/5 mt-6">
        ยังไม่มีบัญชีสมาชิก?{' '}
        <Link href="/auth/signup" className="text-sky-400 hover:text-sky-300 font-semibold hover:underline">
          สมัครสมาชิกใหม่ที่นี่
        </Link>
      </div>
    </div>
  );
}

export default function SigninPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 glow-bg bg-[#02060d]">
      <CanvasBackground />
      <Suspense fallback={
        <div className="w-full max-w-md space-y-8 glass p-8 rounded-2xl border border-white/5 relative z-10 text-center text-zinc-500 py-20 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
          <p className="text-xs">กำลังโหลด...</p>
        </div>
      }>
        <SigninForm />
      </Suspense>
    </div>
  );
}

export const dynamic = 'force-dynamic';
