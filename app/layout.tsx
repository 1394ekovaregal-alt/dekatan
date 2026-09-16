import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import FeedbackButton from '@/components/FeedbackButton';

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dekatan — Jauh di Mata, Dekat di Frame",
  description: "Platform virtual photobooth dan interaksi kencan online khusus pasangan LDR agar tetap terasa dekat setiap saat.",
  icons: {
    icon: "/icon.png", // Mengarah langsung ke file di folder public
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#FAF7F2] text-[#264653] selection:bg-[#DA6868] selection:text-white">
        {children}
         <FeedbackButton />
      </body>
    </html>
  );
}
