import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('กรุณากรอกอีเมลและรหัสผ่าน');
        }

        const emailLower = credentials.email.toLowerCase();

        // ค้นหาข้อมูลผู้ใช้จากตาราง users ใน Supabase
        const { data: user, error } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('email', emailLower)
          .maybeSingle();
        
        if (error) {
          console.error('Database query error:', error);
          throw new Error('เกิดข้อผิดพลาดในการตรวจสอบข้อมูลในฐานข้อมูล');
        }

        if (!user) {
          throw new Error('ไม่พบบัญชีผู้ใช้งานที่ใช้อีเมลนี้');
        }

        const isPasswordCorrect = await bcrypt.compare(credentials.password, user.password);
        
        if (!isPasswordCorrect) {
          throw new Error('รหัสผ่านไม่ถูกต้อง');
        }

        return {
          id: user.id,
          name: user.username,
          email: user.email,
          role: user.role,
          balance: Number(user.balance),
          totalSpent: Number(user.total_spent) || 0,
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.balance = user.balance;
        token.totalSpent = user.totalSpent || 0;
      }
      
      // ดึงยอดเงินและ Rank ล่าสุด
      if (trigger === "update") {
        const { data: freshUser } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('id', token.id)
          .maybeSingle();

        if (freshUser) {
          token.balance = Number(freshUser.balance);
          token.name = freshUser.username;
          token.totalSpent = Number(freshUser.total_spent) || 0;
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.balance = token.balance;
        session.user.name = token.name;
        session.user.totalSpent = token.totalSpent || 0;
      }
      return session;
    }
  },
  pages: {
    signIn: '/auth/signin',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

