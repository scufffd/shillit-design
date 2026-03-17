import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import { WalletProvider } from "@/components/WalletProvider";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
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
      <body className="min-h-screen bg-[#0A0A0A] font-sans text-[#FAFAFA] antialiased">
        <header className="fixed left-0 right-0 top-0 z-50 border-b border-[#222] bg-[#0A0A0A]/95 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-3.5 sm:px-6">

            <a href="/" className="flex shrink-0 items-center gap-2.5 group">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-shill-lime text-[#0A0A0A] text-base shadow-hard sm:h-9 sm:w-9 transition-all group-hover:shadow-glow-lime">
                🚀
              </span>
              <span className="text-base font-black uppercase tracking-tight sm:text-lg">
                Shill<span className="text-shill-lime">It</span>
              </span>
            </a>

            <nav className="hidden md:flex items-center gap-x-6 text-[11px] font-bold uppercase tracking-widest text-[#888]">
              <a href="/#how" className="transition hover:text-white">How it works</a>
              <a href="/campaigns" className="transition hover:text-white">Bagworkers</a>
              <a href="/leaderboard" className="transition hover:text-white">Leaderboard</a>
              <a href="/cto" className="transition hover:text-white">CTO</a>
              <a href="/dashboard" className="transition hover:text-white">Dashboard</a>
              <a href="/deployer" className="transition hover:text-white">Deployer</a>
            </nav>

            <a
              href="/launch"
              className="shrink-0 rounded-2xl bg-shill-lime px-5 py-2.5 text-[11px] font-black uppercase tracking-widest text-[#0A0A0A] shadow-hard transition hover:shadow-glow-lime hover:-translate-y-0.5"
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
