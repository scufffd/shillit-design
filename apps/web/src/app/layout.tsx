import type { Metadata } from "next";
import { Orbitron, Space_Mono } from "next/font/google";
import { WalletProvider } from "@/components/WalletProvider";
import "./globals.css";

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-orbitron",
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  variable: "--font-space-mono",
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SHILL IT – Memecoin Launchpad · Meteora DBC · Solana",
  description: "Launch memecoins on Meteora DBC. Set fee splits. Run bagwork campaigns. Get paid on every trade.",
  themeColor: "#1d1d1d",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${orbitron.variable} ${spaceMono.variable}`}>
      <body className="min-h-screen bg-shill-bg font-mono text-shill-text antialiased">
        <header className="fixed left-0 right-0 top-0 z-50 border-b border-shill-line bg-shill-bg/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-3 sm:px-6">

            <a href="/" className="flex shrink-0 items-center gap-2.5 group">
              <span className="text-shill-accent text-[11px] font-bold font-mono">&#62;</span>
              <span className="font-display text-sm font-black uppercase tracking-widest text-white sm:text-base group-hover:text-shill-accent transition-colors">
                SHILL<span className="text-shill-accent">IT</span>
              </span>
              <span className="animate-blink text-shill-accent font-mono text-[11px] font-bold">_</span>
            </a>

            <nav className="hidden md:flex items-center gap-x-5 text-[10px] font-bold uppercase tracking-widest text-shill-muted font-mono">
              <a href="/#how" className="transition hover:text-shill-accent hover:before:content-['>_']">How it works</a>
              <a href="/campaigns" className="transition hover:text-shill-accent">Bagworkers</a>
              <a href="/leaderboard" className="transition hover:text-shill-accent">Leaderboard</a>
              <a href="/cto" className="transition hover:text-shill-accent">CTO</a>
              <a href="/dashboard" className="transition hover:text-shill-accent">Dashboard</a>
              <a href="/deployer" className="transition hover:text-shill-accent">Deployer</a>
            </nav>

            <a
              href="/launch"
              className="shrink-0 border border-shill-accent bg-shill-accent px-5 py-2 text-[10px] font-black uppercase tracking-widest text-black font-mono transition hover:shadow-glow-accent hover:-translate-y-px active:translate-y-0"
            >
              Launch
            </a>
          </div>
        </header>

        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
