'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Wallet, Smartphone, Landmark, CreditCard, CheckCircle, AlertCircle, Loader2, Copy, Check, Upload } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ContactModal from '../components/ContactModal';
import HistoryModal from '../components/HistoryModal';
import CanvasBackground from '../components/CanvasBackground';
import Link from 'next/link';

// CRC16 Calculation for EMVCo
function crc16(data) {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    let x = ((crc >> 8) ^ data.charCodeAt(i)) & 0xFF;
    x ^= x >> 4;
    crc = ((crc << 8) ^ (x << 12) ^ (x << 5) ^ x) & 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// Generate PromptPay Payload (EMVCo Standard)
function generatePromptPayPayload(target, amount) {
  let targetType = "";
  let formattedTarget = String(target).replace(/[-]/g, "").trim();

  if (formattedTarget.length === 15) {
    targetType = "03";
  } else if (formattedTarget.length === 13) {
    targetType = "02";
  } else if (formattedTarget.length === 10) {
    targetType = "01";
    formattedTarget = "0066" + formattedTarget.slice(1);
  } else {
    targetType = "01";
    if (formattedTarget.startsWith("66")) {
      formattedTarget = "00" + formattedTarget;
    } else {
      formattedTarget = "0066" + formattedTarget;
    }
  }

  const sub00 = "0016A000000677010111"; // Application ID
  const sub01 = targetType + String(formattedTarget.length).padStart(2, "0") + formattedTarget;
  const tag29Value = sub00 + sub01;
  const tag29 = "29" + String(tag29Value.length).padStart(2, "0") + tag29Value;

  const tag00 = "000201";
  const tag01 = amount && Number(amount) > 0 ? "010212" : "010211";
  const tag53 = "5303764";
  const tag58 = "5802TH";

  let tag54 = "";
  if (amount && Number(amount) > 0) {
    const formattedAmount = Number(amount).toFixed(2);
    tag54 = "54" + String(formattedAmount.length).padStart(2, "0") + formattedAmount;
  }

  const payloadToCRC = tag00 + tag01 + tag29 + tag53 + tag54 + tag58 + "6304";
  const crc = crc16(payloadToCRC);
  return payloadToCRC + crc;
}

export default function TopupPage() {
  const { data: session, update: updateSession } = useSession();
  const [method, setMethod] = useState('promptpay'); // promptpay | wallet | cashcard
  const [amount, setAmount] = useState('');
  const [refCode, setRefCode] = useState('');
  const [topupSuccess, setTopupSuccess] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [base64Slip, setBase64Slip] = useState('');
  const [slipPreview, setSlipPreview] = useState('');
  
  const { data: config = {
    promptpay: { enabled: true, promptpayId: '0812345678', expectedName: '' },
    wallet: { enabled: true },
    cashcard: { enabled: true, feePercent: 15 },
    giftcode: { enabled: true }
  }, isLoading: configLoading } = useQuery({
    queryKey: ['topup-config'],
    queryFn: async () => {
      const res = await fetch('/api/topup/config');
      if (!res.ok) throw new Error('Failed to fetch topup config');
      return res.json();
    }
  });

  const promptpayId = config.promptpay?.promptpayId || '0812345678';
  const qrPayload = generatePromptPayPayload(promptpayId, amount);
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrPayload)}`;

  useEffect(() => {
    if (config) {
      const firstEnabled = ['promptpay', 'wallet', 'cashcard', 'giftcode'].find(id => {
        if (id === 'promptpay') return config.promptpay?.enabled;
        if (id === 'wallet') return config.wallet?.enabled;
        if (id === 'cashcard') return config.cashcard?.enabled;
        if (id === 'giftcode') return config.giftcode?.enabled;
        return false;
      });
      if (firstEnabled && (!config[method]?.enabled || !['promptpay', 'wallet', 'cashcard', 'giftcode'].includes(method))) {
        setMethod(firstEnabled);
      }
    }
  }, [config, method]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
      setErrorMsg('ขนาดรูปภาพสลิปต้องไม่เกิน 4MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setBase64Slip(reader.result);
      setSlipPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Modals status
  const [contactOpen, setContactOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: async (payload) => {
      const res = await fetch('/api/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาดในการเติมเงิน');
      return data;
    },
    onSuccess: (data) => {
      setTopupSuccess(data);
      updateSession({ refresh: true }); // อัปเดตยอดเงินในหัวเว็บ
      setAmount('');
      setRefCode('');
      setErrorMsg('');
      setBase64Slip('');
      setSlipPreview('');
    },
    onError: (err) => {
      setErrorMsg(err.message);
      setTopupSuccess(null);
    },
  });

  const handleTopup = (e) => {
    e.preventDefault();
    setErrorMsg('');
    setTopupSuccess(null);

    if (method === 'giftcode') {
      if (!refCode.trim()) {
        setErrorMsg('กรุณากรอกรหัสโค้ดเติมเงิน');
        return;
      }
      mutation.mutate({
        method: 'giftcode',
        refCode: refCode.trim(),
      });
      return;
    }

    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setErrorMsg('กรุณากรอกจำนวนเงินมากกว่า 0 บาท');
      return;
    }

    if (method === 'wallet' && !refCode.startsWith('https://gift.truemoney.com/')) {
      setErrorMsg('กรุณากรอกลิ้งค์ซองของขวัญ TrueMoney Wallet ที่ถูกต้อง');
      return;
    }

    if (method === 'cashcard' && (refCode.length < 14 || isNaN(refCode))) {
      setErrorMsg('กรุณากรอกรหัสบัตรเติมเงิน 14 หลักให้ถูกต้อง');
      return;
    }

    if (method === 'promptpay') {
      if (!base64Slip) {
        setErrorMsg('กรุณาอัปโหลดรูปภาพสลิปโอนเงิน');
        return;
      }
      mutation.mutate({
        amount: amt,
        method: 'PromptPay QR',
        base64: base64Slip,
      });
      return;
    }

    mutation.mutate({
      amount: amt,
      method: method === 'wallet' ? 'TrueMoney Wallet Gift' : 'TrueMoney Cashcard',
      refCode: refCode || undefined,
    });
  };

  const methodsList = [
    { id: 'promptpay', name: 'PromptPay QR', icon: Landmark, color: 'text-sky-400', desc: 'เติมเงินผ่าน QR Code ไม่มีค่าธรรมเนียม' },
    { id: 'wallet', name: 'TrueMoney Gift Link', icon: Smartphone, color: 'text-orange-400', desc: 'สร้างซองของขวัญ TrueMoney ส่งลิงค์เพื่อเติมเงิน' },
    { id: 'cashcard', name: 'TrueMoney Cashcard', icon: CreditCard, color: 'text-amber-400', desc: `บัตรเติมเงินทรูมันนี่ (ค่าธรรมเนียม ${config.cashcard?.feePercent ?? 15}%)` },
    { id: 'giftcode', name: 'Gacha Code', icon: Wallet, color: 'text-rose-400', desc: 'แลกโค้ดเติมเงินของรางวัลจาก Gacha' },
  ];

  const enabledMethods = methodsList.filter(m => {
    if (m.id === 'promptpay') return config.promptpay?.enabled;
    if (m.id === 'wallet') return config.wallet?.enabled;
    if (m.id === 'cashcard') return config.cashcard?.enabled;
    if (m.id === 'giftcode') return config.giftcode?.enabled;
    return true;
  });

  return (
    <div className="relative min-h-screen flex flex-col">
      <CanvasBackground />
      <Navbar onOpenContact={() => setContactOpen(true)} onOpenHistory={() => setHistoryOpen(true)} />

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
        
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Wallet className="w-6 h-6 text-sky-400" />
            <span>เติมเงินเข้าบัญชี (Wallet)</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">เลือกช่องทางชำระเงินที่ต้องการและทำรายการเพื่อเพิ่มยอดเงิน</p>
        </div>

        {!session ? (
          /* Signin Redirect Card */
          <div className="glass p-10 rounded-2xl border border-white/5 text-center max-w-md mx-auto space-y-6">
            <div className="inline-flex bg-sky-500/10 p-4 rounded-full text-sky-400">
              <Wallet className="w-12 h-12" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-white">ต้องการเข้าสู่ระบบก่อน</h2>
              <p className="text-xs text-zinc-400">กรุณาเข้าสู่ระบบ NakataShop เพื่อใช้บริการระบบเติมเงิน</p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Link href="/auth/signin" className="flex items-center justify-center text-sm font-semibold text-zinc-300 border border-white/5 hover:bg-white/5 py-3 rounded-xl">
                เข้าสู่ระบบ
              </Link>
              <Link href="/auth/signup" className="flex items-center justify-center text-sm font-semibold bg-sky-500 text-sky-950 hover:bg-sky-400 py-3 rounded-xl transition-all">
                สมัครสมาชิก
              </Link>
            </div>
          </div>
        ) : (
          /* Main Topup Layout */
          configLoading ? (
            <div className="flex justify-center items-center py-20 text-zinc-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
              <span>กำลังโหลดข้อมูลช่องทางเติมเงิน...</span>
            </div>
          ) : enabledMethods.length === 0 ? (
            <div className="glass p-10 rounded-2xl border border-white/5 text-center max-w-md mx-auto space-y-4">
              <div className="inline-flex bg-amber-500/10 p-4 rounded-full text-amber-400">
                <AlertCircle className="w-12 h-12 animate-bounce" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white">ระบบเติมเงินปิดปรับปรุงชั่วคราว</h2>
                <p className="text-xs text-zinc-400">ขณะนี้ไม่มีช่องทางเติมเงินใดเปิดใช้งาน ขออภัยในความไม่สะดวก</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Left Col: Methods List */}
              <div className="space-y-3">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                  ช่องทางชำระเงิน
                </span>
                
                {enabledMethods.map((m) => {
                  const Icon = m.icon;
                  const isSelected = method === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                      setMethod(m.id);
                      setTopupSuccess(null);
                      setErrorMsg('');
                    }}
                    className={`w-full flex items-start gap-4 p-4 rounded-xl text-left border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-sky-500/10 border-sky-500/30 shadow-[0_0_15px_rgba(0,210,255,0.05)]'
                        : 'bg-zinc-950/40 border-white/5 hover:border-white/10 hover:bg-zinc-900/40'
                    }`}
                  >
                    <div className={`p-2.5 rounded-lg bg-zinc-900 border border-white/5 shrink-0 ${m.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5">
                      <h3 className={`text-sm font-semibold ${isSelected ? 'text-sky-400' : 'text-white'}`}>
                        {m.name}
                      </h3>
                      <p className="text-[11px] text-zinc-500 leading-normal">{m.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right Col: Payment Form */}
            <div className="md:col-span-2 space-y-4">
              <div className="glass p-6 rounded-2xl border border-white/5 space-y-5">
                
                {/* Method Header */}
                <div className="pb-4 border-b border-white/5">
                  <h2 className="text-base font-bold text-white">
                    ชำระเงินด้วย {methodsList.find(m => m.id === method)?.name}
                  </h2>
                </div>

                {/* Status Alerts */}
                {topupSuccess && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-3.5 rounded-xl text-xs text-emerald-400 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 shrink-0 animate-bounce" />
                    <div>
                      <span className="font-semibold block">{topupSuccess.message}</span>
                      <span className="text-[10px] text-zinc-400">ยอดเงินใหม่ของคุณคือ: {topupSuccess.newBalance?.toLocaleString()} THB</span>
                    </div>
                  </div>
                )}

                {errorMsg && (
                  <div className="bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-xl text-xs text-red-400 flex items-center gap-2">
                    <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Form Elements */}
                <form onSubmit={handleTopup} className="space-y-4">
                  
                  {/* Amount Input */}
                  {method !== 'giftcode' && (
                    <div className="space-y-1.5">
                      <label className="text-xs text-zinc-400 font-semibold block">จำนวนเงินที่ต้องการเติม (THB)</label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full bg-[#03060d] border border-white/5 px-4 py-2.5 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500 transition-colors"
                        placeholder="เช่น 100, 300, 500"
                      />
                    </div>
                  )}

                  {/* Contextual Input Fields based on Payment Method */}
                  {method === 'promptpay' && (
                    <div className="bg-zinc-950/50 border border-white/5 p-4 rounded-xl space-y-4 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <span className="bg-gradient-to-r from-sky-400 to-blue-500 bg-clip-text text-transparent font-black tracking-widest text-lg">
                          Prompt Pay
                        </span>
                        <span className="text-[10px] text-zinc-500">สแกนคิวอาร์โค้ดด้านล่างเพื่อชำระเงิน</span>
                      </div>
                      
                      {/* Dynamic Real/Placeholder QR Code */}
                      <div className="bg-white p-3 rounded-xl inline-block border-2 border-sky-950 shadow-inner">
                        <img
                          src={qrCodeUrl}
                          alt="PromptPay QR Code"
                          className="w-44 h-44"
                        />
                      </div>

                      {/* Image Upload for Bank Slip */}
                      <div className="space-y-2 text-left">
                        <label className="text-xs text-zinc-400 font-semibold block">อัปโหลดภาพสลิปโอนเงิน</label>
                        <div className="flex flex-col items-center justify-center border-2 border-dashed border-white/5 hover:border-sky-500/50 rounded-xl p-4 bg-zinc-950/30 transition-all cursor-pointer relative group">
                          {slipPreview ? (
                            <div className="relative w-full flex flex-col items-center gap-2">
                              <img
                                src={slipPreview}
                                alt="Slip Preview"
                                className="max-h-48 object-contain rounded-lg border border-white/10"
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setSlipPreview('');
                                  setBase64Slip('');
                                }}
                                className="text-xs text-red-400 hover:text-red-300 font-semibold"
                              >
                                ลบรูปภาพสลิป
                              </button>
                            </div>
                          ) : (
                            <label className="w-full h-full flex flex-col items-center justify-center py-4 cursor-pointer">
                              <Upload className="w-8 h-8 text-zinc-500 group-hover:text-sky-400 transition-colors mb-2" />
                              <span className="text-xs font-semibold text-zinc-400 group-hover:text-zinc-300 transition-colors text-center">
                                คลิกเพื่ออัปโหลดภาพสลิปโอนเงิน (JPG, PNG)
                              </span>
                              <span className="text-[10px] text-zinc-600 mt-1">ขนาดสูงสุดไม่เกิน 4MB</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleFileChange}
                              />
                            </label>
                          )}
                        </div>
                      </div>

                      <div className="text-left space-y-1 bg-white/5 p-3 rounded-lg border border-white/5 text-xs text-zinc-400 leading-normal">
                        <span className="font-semibold block text-zinc-300">ขั้นตอนการเติมเงิน:</span>
                        <span>1. สแกนคิวอาร์โค้ดชำระเงินตามจำนวนเงินด้านบน</span>
                        <br />
                        <span>2. อัปโหลดภาพสลิปโอนเงินที่ได้ลงในระบบเพื่อใช้ตรวจสอบ</span>
                        <br />
                        <span>3. กดปุ่ม <b>"ตรวจสอบและเติมเงิน"</b> ด้านล่างเพื่อเพิ่มยอดเงิน</span>
                      </div>
                    </div>
                  )}

                  {method === 'wallet' && (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs text-zinc-400 font-semibold block">ลิงค์ซองของขวัญทรูมันนี่</label>
                        <input
                          type="url"
                          required
                          value={refCode}
                          onChange={(e) => setRefCode(e.target.value)}
                          className="w-full bg-[#03060d] border border-white/5 px-4 py-2.5 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500 transition-colors"
                          placeholder="https://gift.truemoney.com/campaign/?v=..."
                        />
                      </div>
                      
                      <div className="p-3 bg-zinc-950/40 border border-white/5 rounded-xl text-xs text-zinc-500 leading-normal space-y-1">
                        <span className="font-semibold text-zinc-400 block">วิธีสร้างซองของขวัญทรูมันนี่:</span>
                        <span>1. เปิดแอป TrueMoney Wallet และกดเลือกเมนู "ส่งซองของขวัญ"</span>
                        <br />
                        <span>2. ตั้งยอดเงินเท่ากับจำนวนเงินที่คุณระบุระบุไว้ด้านบน และเลือกแบบ "สุ่มจำนวนเงิน" หรือ "แบ่งเท่ากัน" (เลือกแบบแบ่งเท่ากัน 1 คน)</span>
                        <br />
                        <span>3. คัดลอกลิงก์ซองของขวัญนำมาวางในช่องและกดเติมเงิน</span>
                      </div>
                    </div>
                  )}

                  {method === 'cashcard' && (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs text-zinc-400 font-semibold block">รหัสบัตรเติมเงินทรูมันนี่ (14 หลัก)</label>
                        <input
                          type="text"
                          required
                          maxLength="14"
                          value={refCode}
                          onChange={(e) => setRefCode(e.target.value)}
                          className="w-full bg-[#03060d] border border-white/5 px-4 py-2.5 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500 transition-colors"
                          placeholder="เช่น 38048293028372"
                        />
                      </div>

                      <div className="p-3.5 bg-amber-500/5 border border-amber-500/10 text-amber-400/90 rounded-xl text-xs leading-normal">
                        * บัตรเงินสดทรูมันนี่มีค่าธรรมเนียมการเติม 15% บัตรราคา 100 บาท จะได้รับเงิน 85 บาทเข้าบัญชี
                      </div>
                    </div>
                  )}

                  {method === 'giftcode' && (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs text-zinc-400 font-semibold block">รหัสโค้ดเติมเงินรางวัล (Gacha Code)</label>
                        <input
                          type="text"
                          required
                          value={refCode}
                          onChange={(e) => setRefCode(e.target.value)}
                          className="w-full bg-[#03060d] border border-white/5 px-4 py-2.5 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500 transition-colors font-mono"
                          placeholder="เช่น TOPUP-XXXXXXXX"
                        />
                      </div>

                      <div className="p-3 bg-zinc-950/40 border border-white/5 rounded-xl text-xs text-zinc-500 leading-normal space-y-1">
                        <span className="font-semibold text-zinc-400 block">วิธีแลกโค้ดของรางวัล:</span>
                        <span>1. นำโค้ดรางวัลที่คุณได้รับจากการสุ่ม Gacha (รหัสขึ้นต้นด้วย TOPUP-)</span>
                        <br />
                        <span>2. วางโค้ดลงในช่องด้านบนและกดปุ่มยืนยัน ยอดเงินจะเพิ่มเข้าบัญชีของคุณทันที</span>
                      </div>
                    </div>
                  )}

                  {/* Submit Trigger Button */}
                  <button
                    type="submit"
                    disabled={mutation.isPending}
                    className="w-full flex items-center justify-center gap-2 bg-sky-500 text-sky-950 font-bold py-3.5 rounded-xl hover:bg-sky-400 transition-all glow-btn disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                  >
                    {mutation.isPending ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>กำลังตรวจสอบรายการ...</span>
                      </>
                    ) : (
                      <span>ตรวจสอบและเติมเงิน</span>
                    )}
                  </button>

                </form>

              </div>
            </div>

          </div>
        ))}

      </main>

      {/* Footer */}
      <Footer onOpenContact={() => setContactOpen(true)} />

      {/* Auxiliary Modals */}
      <ContactModal isOpen={contactOpen} onClose={() => setContactOpen(false)} />
      <HistoryModal isOpen={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}
