import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ContractStatusBar } from "@/components/weather/ContractStatusBar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Chromium — AI Weather Intelligence",
  description:
    "Weather decisions powered by GenLayer Intelligent Contracts",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} h-full`}
    >
      <body className="font-sans antialiased bg-[#F0F4FF] text-slate-900 min-h-screen">
        <main>{children}</main>
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <ContractStatusBar />
        </div>
      </body>
    </html>
  );
}
