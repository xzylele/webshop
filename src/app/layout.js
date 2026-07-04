import { Inter, IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["thai", "latin"],
  variable: "--font-thai",
});

export const metadata = {
  title: "NakataShop • ร้านค้าออนไลน์จำหน่ายบัตรเติมเกมและสตรีมมิ่งยอดนิยม",
  description: "จำหน่ายบัตรเติมเกม, Steam Wallet, Netflix, Disney+, Spotify และบริการอื่นๆ ราคาถูก ปลอดภัย ได้รับของทันที",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="th"
      className={`${inter.variable} ${ibmPlexSansThai.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-[#02060d] text-foreground">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
