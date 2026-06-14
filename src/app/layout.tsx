import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { ContractStatusBar } from "@/components/weather/ContractStatusBar";
import { ThemeToggle } from "@/components/ThemeToggle";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Chromium | AI Weather Intelligence",
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
      <body className="font-sans antialiased text-slate-900 dark:text-slate-100 min-h-screen">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {/* Watermark — the weather UI inspiration image, tiled at very low opacity */}
          <div
            aria-hidden="true"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 0,
              backgroundImage: 'url(/weather-bg.jpg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundAttachment: 'fixed',
              opacity: 0.07,
              pointerEvents: 'none',
            }}
          />
          <ThemeToggle />
          <main style={{ position: 'relative', zIndex: 1 }}>{children}</main>
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
            <ContractStatusBar />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
