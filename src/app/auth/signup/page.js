'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { UserPlus, Lock, Mail, User, ArrowRight, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import CanvasBackground from '../../components/CanvasBackground';

export default function SignupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const mutation = useMutation({
    mutationFn: async (userData) => {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาดในการลงทะเบียน');
      return data;
    },
    onSuccess: (data) => {
      setSuccessMsg(data.message || 'สมัครสมาชิกสำเร็จแล้ว! กำลังพาท่านไปหน้าเข้าสู่ระบบ...');
      setErrorMsg('');
      setTimeout(() => {
        router.push('/auth/signin');
      }, 2500);
    },
    onError: (error) => {
      setErrorMsg(error.message);
      setSuccessMsg('');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.username || !formData.email || !formData.password || !formData.confirmPassword) {
      setErrorMsg('กรุณากรอกข้อมูลให้ครบทุกช่อง');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setErrorMsg('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }
    mutation.mutate({
      username: formData.username,
      email: formData.email,
      password: formData.password,
    });
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 glow-bg">
      <CanvasBackground />

      <div className="w-full max-w-md space-y-8 glass p-8 rounded-2xl border border-white/5 relative z-10">
        
        {/* Header */}
        <div className="text-center">
          <Link href="/" className="inline-block text-2xl font-black bg-gradient-to-r from-sky-400 to-blue-500 bg-clip-text text-transparent glow-text mb-2">
            NakataShop
          </Link>
          <h2 className="text-lg font-bold text-white tracking-tight">สมัครสมาชิก NakataShop</h2>
          <p className="text-xs text-zinc-400 mt-1">กรอกรายละเอียดด้านล่างเพื่อเริ่มเข้าสู่ระบบช็อปปิ้ง</p>
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

        {/* Signup Form */}
        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          
          {/* Username Input */}
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400 font-semibold block">ชื่อผู้ใช้งาน</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-500">
                <User className="w-4 h-4" />
              </span>
              <input
                type="text"
                name="username"
                required
                value={formData.username}
                onChange={handleChange}
                className="w-full bg-[#03060d] border border-white/5 pl-10 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500 transition-colors"
                placeholder="NakataGaming"
              />
            </div>
          </div>

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

          {/* Confirm Password Input */}
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400 font-semibold block">ยืนยันรหัสผ่าน</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                name="confirmPassword"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full bg-[#03060d] border border-white/5 pl-10 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500 transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full flex items-center justify-center gap-2 bg-sky-500 text-sky-950 font-bold py-3 rounded-xl hover:bg-sky-400 transition-all glow-btn disabled:opacity-50 disabled:pointer-events-none cursor-pointer mt-6"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>กำลังสมัครสมาชิก...</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>สมัครสมาชิก</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Switch to Signin */}
        <div className="text-center text-xs text-zinc-400 pt-4 border-t border-white/5 mt-6">
          เป็นสมาชิกอยู่แล้ว?{' '}
          <Link href="/auth/signin" className="text-sky-400 hover:text-sky-300 font-semibold hover:underline">
            เข้าสู่ระบบที่นี่
          </Link>
        </div>

      </div>
    </div>
  );
}
