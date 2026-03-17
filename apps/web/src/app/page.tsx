export default function Home() {
  return (
    <>
      {/* Marquee strip – slapp.gg style */}
      <section className="relative overflow-hidden border-b border-white/5 bg-shill-darker py-3">
        <div className="flex w-max animate-marquee gap-8 whitespace-nowrap text-sm font-bold uppercase tracking-[0.3em] text-white/40">
          <span className="flex shrink-0 gap-8">
            <span>Launch</span><span>Memecoins</span><span>That</span><span>Shill</span>
          </span>
          <span className="flex shrink-0 gap-8">
            <span>Launch</span><span>Memecoins</span><span>That</span><span>Shill</span>
          </span>
          <span className="flex shrink-0 gap-8">
            <span>Launch</span><span>Memecoins</span><span>That</span><span>Shill</span>
          </span>
          <span className="flex shrink-0 gap-8">
            <span>Launch</span><span>Memecoins</span><span>That</span><span>Shill</span>
          </span>
        </div>
      </section>

      {/* Hero – main headline + tagline + CTAs */}
      <section className="relative min-h-[85vh] overflow-hidden bg-shill-darker pt-16 pb-24">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)`,
            backgroundSize: "64px 64px",
          }}
        />
        <div className="relative mx-auto max-w-5xl px-6 pt-20 text-center">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.35em] text-shill-yellow/90">
            Memecoin Launchpad
          </p>
          <h1 className="font-display text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            <span className="block text-white">Launch</span>
            <span className="mt-1 block text-white">memecoins</span>
            <span className="mt-1 block text-shill-green">that shill.</span>
          </h1>
          <p className="mt-6 max-w-xl mx-auto text-base text-white/70 sm:text-lg">
            One token per image on Meteora DBC. Set your split. Run bagwork campaigns. Get paid on every trade.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="/launch"
              className="inline-flex items-center gap-2 rounded-full bg-shill-yellow px-8 py-3.5 text-sm font-bold uppercase tracking-wider text-shill-dark transition hover:bg-shill-yellow/90"
            >
              Launch token
            </a>
            <a
              href="/campaigns"
              className="rounded-full border border-white/30 px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Browse campaigns
            </a>
          </div>
        </div>
      </section>

      {/* Feature bullets – 4 items in a row (slapp: Turn idea → sticker, etc.) */}
      <section className="border-t border-white/5 bg-shill-dark py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-shill-pink/20 text-xl font-bold text-shill-pink">1</div>
              <h3 className="font-semibold text-white">Create deployer profile</h3>
              <p className="mt-1 text-sm text-white/60">One-time fee. Rank on the leaderboard.</p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-shill-green/20 text-xl font-bold text-shill-green">2</div>
              <h3 className="font-semibold text-white">Launch on Meteora DBC</h3>
              <p className="mt-1 text-sm text-white/60">Upload image, set name & split.</p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-shill-blue/20 text-xl font-bold text-shill-blue">3</div>
              <h3 className="font-semibold text-white">Set campaigns & guidelines</h3>
              <p className="mt-1 text-sm text-white/60">Pay per 1K views, cap, rules.</p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-shill-yellow/20 text-xl font-bold text-shill-yellow">4</div>
              <h3 className="font-semibold text-white">Bagworkers get paid</h3>
              <p className="mt-1 text-sm text-white/60">Submit, approve, pay from dashboard.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive demo block – “Try it” (slapp: TRY IT. + input + generate) */}
      <section id="how" className="border-t border-white/5 bg-shill-darker py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Try it.
          </h2>
          <p className="mt-3 text-white/70">Launch your token in one flow.</p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-white/80 sm:w-auto">
              One image → one token. Set split. Go live.
            </div>
            <a
              href="/launch"
              className="shrink-0 rounded-full bg-shill-yellow px-8 py-3.5 text-sm font-bold uppercase tracking-wider text-shill-dark transition hover:bg-shill-yellow/90"
            >
              Launch token
            </a>
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-4 text-sm text-white/50">
            <span className="rounded-full border border-white/10 px-4 py-2">Image</span>
            <span>→</span>
            <span className="rounded-full border border-white/10 px-4 py-2">Token</span>
            <span>→</span>
            <span className="rounded-full border border-white/10 px-4 py-2">Split</span>
            <span>→</span>
            <span className="rounded-full border border-white/10 px-4 py-2">Live</span>
          </div>
        </div>
      </section>

      {/* Workflows – “Multiple workflows. One flexible workspace.” */}
      <section className="border-t border-white/5 bg-shill-dark py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center font-display text-2xl font-bold tracking-tight sm:text-3xl">
            One platform. Every step.
          </h2>
          <p className="mt-2 text-center text-white/60">
            From token launch to campaigns to holder rewards.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            <a href="/launch" className="rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-shill-green/30 hover:bg-white/[0.07]">
              <h3 className="font-semibold text-shill-green">Launch</h3>
              <p className="mt-2 text-sm text-white/70">Create token on Meteora DBC, set your fee split.</p>
            </a>
            <a href="/campaigns" className="rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-shill-blue/30 hover:bg-white/[0.07]">
              <h3 className="font-semibold text-shill-blue">Campaigns</h3>
              <p className="mt-2 text-sm text-white/70">Guidelines, pay per 1K views, fund & go live.</p>
            </a>
            <a href="/dashboard" className="rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-shill-yellow/30 hover:bg-white/[0.07]">
              <h3 className="font-semibold text-shill-yellow">Dashboard</h3>
              <p className="mt-2 text-sm text-white/70">Run rewards, approve payouts, track tokens.</p>
            </a>
          </div>
        </div>
      </section>

      {/* Gallery – “Anything’s possible” */}
      <section className="border-t border-white/5 bg-shill-darker py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Anything&apos;s possible
          </h2>
          <p className="mt-2 text-center text-white/60">
            With Shill It, you control the split and the narrative.
          </p>
          <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {["Creator %", "Buybacks", "Burns", "LP", "Holders", "Campaigns"].map((label, i) => (
              <div
                key={label}
                className="flex aspect-square items-center justify-center rounded-xl border border-white/10 bg-white/5 text-center text-sm font-medium text-white/80"
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* “One platform” / use cases – pills (slapp: Character mode) */}
      <section className="border-t border-white/5 bg-shill-dark py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            One token. Full control.
          </h2>
          <p className="mt-3 text-white/70">
            Set your split once, tweak anytime in the dashboard.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {["Creator cut", "Buybacks", "Burns", "LP", "Holder airdrops", "Meteora DBC"].map((t) => (
              <span
                key={t}
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/90"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* “Your pack. Your rules.” → “Your token. Your rules.” */}
      <section className="border-t border-white/5 bg-shill-darker py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Your token. Your rules.
          </h2>
          <p className="mt-3 text-white/70">
            Every change in the dashboard. No waiting.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {["Set split %", "Edit campaign", "Run rewards", "Claim fees", "Leaderboard", "CTO"].map((t) => (
              <span
                key={t}
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium uppercase tracking-wide text-white/90"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Tokenize – “Tokenize your IP. Get paid forever.” */}
      <section className="border-t border-white/5 bg-shill-dark py-20">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-center font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Tokenize. Earn forever.
          </h2>
          <p className="mt-2 text-center text-white/70">
            Launch your token. Every trade, you earn.
          </p>
          <div className="mt-12 rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-shill-yellow">Your token</p>
                <p className="mt-1 text-2xl font-bold text-white">Set your split</p>
                <p className="mt-1 text-sm text-white/60">Creator · Buys · Burns · LP · Holders</p>
              </div>
              <div className="flex gap-6 text-center">
                <div>
                  <p className="text-xs uppercase text-white/50">Fees</p>
                  <p className="text-lg font-bold text-shill-green">You earn</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-white/50">Holders</p>
                  <p className="text-lg font-bold text-white">Claim share</p>
                </div>
              </div>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-shill-darker/50 p-4">
                <h4 className="font-semibold text-shill-green">Earn on every trade</h4>
                <p className="mt-1 text-sm text-white/60">Automatic. Perpetual. Your split.</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-shill-darker/50 p-4">
                <h4 className="font-semibold text-shill-blue">Holder rewards</h4>
                <p className="mt-1 text-sm text-white/60">Claim from vault or push. Your choice.</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-shill-darker/50 p-4">
                <h4 className="font-semibold text-shill-pink">Bagwork campaigns</h4>
                <p className="mt-1 text-sm text-white/60">Pay shillers by performance.</p>
              </div>
            </div>
            <p className="mt-6 text-center text-sm text-white/50">
              Powered by Meteora DBC on Solana
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA – “Join the waitlist” → “Ready? Launch.” */}
      <section className="border-t border-white/5 bg-shill-darker py-24">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Ready?
          </h2>
          <p className="mt-3 text-lg text-white/80">
            Launch your memecoin with share earnings and bagwork campaigns.
          </p>
          <a
            href="/launch"
            className="mt-8 inline-block rounded-full bg-shill-yellow px-10 py-4 text-sm font-bold uppercase tracking-wider text-shill-dark transition hover:bg-shill-yellow/90"
          >
            Launch token
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-shill-dark py-10">
        <div className="mx-auto max-w-4xl px-6 flex flex-wrap items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-shill-yellow text-shill-dark">🚀</span>
            <span className="font-bold">Shill It</span>
          </a>
          <nav className="flex flex-wrap gap-6 text-sm text-white/70">
            <a href="/#how" className="transition hover:text-white">How it works</a>
            <a href="/campaigns" className="transition hover:text-white">Campaigns</a>
            <a href="/leaderboard" className="transition hover:text-white">Leaderboard</a>
            <a href="/dashboard" className="transition hover:text-white">Dashboard</a>
          </nav>
          <p className="text-sm text-white/50">© Shill It</p>
        </div>
      </footer>
    </>
  );
}
