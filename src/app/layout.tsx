import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import { ToastProvider } from "@/components/Toast";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "GetThereIE - Real-time Bus & Luas Tracking",
  description: "Track buses and Luas across Ireland in real-time. Compete on the leaderboard and earn points with GetThereIE.",
  icons: {
    icon: "/logo.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full scroll-smooth ${inter.variable}`}>
      <body className="min-h-screen antialiased max-w-md mx-auto app-shell pb-20">
        <ToastProvider>
          {children}
          <BottomNav />
        </ToastProvider>
        <div className="version-badge">{process.env.APP_VERSION ?? "dev"}</div>
      </body>
    </html>
  );
}
