import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import { WalletProvider } from "@/components/WalletProvider";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Shill It – Memecoin Launchpad with Share Earnings & Bagwork Campaigns",
  description: "Launch memecoins on Meteora DBC. One token per image. Set share earnings (creator, buys, burns, LP, airdrops). Create bagwork campaigns with guidelines and performance pay.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${spaceGrotesk.variable}`}>
      <body className="min-h-screen bg-shill-dark font-sans text-white antialiased">
        <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/5 bg-shill-dark/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-3 sm:px-6">
            <a href="/" className="flex shrink-0 items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-shill-yellow text-shill-dark sm:h-9 sm:w-9">
                🚀
              </span>
              <span className="text-lg font-bold tracking-tight sm:text-xl">Shill It</span>
            </a>
            <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm sm:gap-x-6">
              <a href="/#how" className="text-white/75 transition hover:text-white">
                How it works
              </a>
              <a href="/campaigns" className="text-white/75 transition hover:text-white">
                Bagworkers
              </a>
              <a href="/leaderboard" className="text-white/75 transition hover:text-white">
                Leaderboard
              </a>
              <a href="/cto" className="text-white/75 transition hover:text-white">
                CTO
              </a>
              <a href="/dashboard" className="text-white/75 transition hover:text-white">
                Dashboard
              </a>
              <a href="/deployer" className="text-white/75 transition hover:text-white">
                Deployer
              </a>
            </nav>
            <a
              href="/launch"
              className="shrink-0 rounded-full bg-shill-yellow px-5 py-2 text-sm font-bold uppercase tracking-wider text-shill-dark transition hover:bg-shill-yellow/90"
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
