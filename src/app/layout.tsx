import type { Metadata, Viewport } from "next";
import "./globals.css";

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
    <html lang="en" className="h-full scroll-smooth">
      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased max-w-md mx-auto">
        {children}
      </body>
    </html>
  );
}
