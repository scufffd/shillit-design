export default function Home() {
  const MARQUEE_WORDS = [
    "LAUNCH TOKEN", "//", "SET FEE SPLIT", "//", "RUN CAMPAIGNS", "//",
    "BAGWORK EARNINGS", "//", "METEORA DBC", "//", "SOLANA", "//",
  ];

  const BLOCK_COUNT = 16;

  return (
    <>
      {/* ── Marquee strip ── */}
      <section className="relative overflow-hidden border-b border-shill-line bg-shill-darker pt-[52px]">
        <div className="flex w-max animate-marquee gap-12 whitespace-nowrap py-2.5 text-[9px] font-bold uppercase tracking-[0.35em] font-mono">
          {[...Array(5)].map((_, i) => (
            <span key={i} className="flex shrink-0 gap-12">
              {MARQUEE_WORDS.map((w, j) => (
                <span key={j} className={w === "//" ? "text-shill-line" : "text-shill-accent"}>
                  {w}
                </span>
              ))}
            </span>
          ))}
        </div>
      </section>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-shill-darker">
        {/* Subtle scan line */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.02]">
          <div
            className="absolute left-0 right-0 h-px bg-shill-accent"
            style={{ animation: "scanline 8s linear infinite" }}
          />
        </div>

        {/* Grid background */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(#bdfe00 1px, transparent 1px), linear-gradient(90deg, #bdfe00 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative mx-auto max-w-5xl px-6 pt-24 pb-20 sm:pt-28 sm:pb-24">
          {/* Terminal badge */}
          <div className="mb-8 inline-flex items-center gap-3 border border-shill-line bg-shill-card px-4 py-2.5 font-mono">
            <span className="text-shill-accent text-[11px] font-bold">&#62;</span>
            <span className="text-[10px] uppercase tracking-widest text-shill-text/70">
              memecoin launchpad · meteora dbc · solana
            </span>
            <span className="animate-blink text-shill-accent text-[11px] font-bold">_</span>
          </div>

          <h1 className="font-display text-5xl font-black uppercase leading-[0.9] tracking-tight text-white sm:text-6xl md:text-7xl lg:text-[5.5rem]">
            <span className="block">Launch</span>
            <span className="block">memecoins</span>
            <span className="block text-shill-accent">that shill.</span>
          </h1>

          <p className="mt-7 max-w-md font-mono text-sm text-shill-muted sm:text-base">
            One token per image. Set your split. Run bagwork campaigns. Get paid on every trade.
          </p>

          {/* Block loader decoration */}
          <div className="mt-8 flex gap-[3px]">
            {Array.from({ length: BLOCK_COUNT }).map((_, i) => (
              <div
                key={i}
                className="h-2 flex-1 bg-shill-accent"
                style={{
                  animation: `blockBlink 1.2s ease-in-out infinite`,
                  animationDelay: `${i * 75}ms`,
                }}
              />
            ))}
          </div>

          <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <a
              href="/launch"
              className="inline-flex items-center gap-2 border border-shill-accent bg-shill-accent px-7 py-3.5 text-[11px] font-black uppercase tracking-widest text-black font-mono transition hover:shadow-glow-accent hover:-translate-y-px active:translate-y-0"
            >
              &#62;_ Launch token
            </a>
            <a
              href="/campaigns"
              className="inline-flex items-center gap-2 border border-shill-line bg-transparent px-7 py-3.5 text-[11px] font-black uppercase tracking-widest text-shill-text/70 font-mono transition hover:border-shill-accent/50 hover:text-shill-accent hover:-translate-y-px active:translate-y-0"
            >
              Browse campaigns
            </a>
          </div>

          {/* Flow steps */}
          <div className="mt-12 flex flex-wrap items-center gap-2 font-mono text-[10px]">
            {[
              { label: "Upload image", accent: true },
              { label: "→", accent: false, sep: true },
              { label: "Token deployed", accent: true },
              { label: "→", accent: false, sep: true },
              { label: "Set split %", accent: true },
              { label: "→", accent: false, sep: true },
              { label: "Run campaigns", accent: true },
              { label: "→", accent: false, sep: true },
              { label: "Earn forever", accent: true },
            ].map((item, i) =>
              item.sep ? (
                <span key={i} className="text-shill-dim font-bold">{item.label}</span>
              ) : (
                <span
                  key={i}
                  className="border border-shill-accent/30 bg-shill-accent/5 px-3 py-1.5 uppercase tracking-widest text-shill-accent"
                >
                  {item.label}
                </span>
              )
            )}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="border-t border-shill-line bg-shill-bg py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-3 flex items-center gap-2 font-mono">
            <span className="text-shill-accent text-[11px] font-bold">&#62;</span>
            <span className="text-[10px] uppercase tracking-widest text-shill-accent">How it works</span>
          </div>
          <h2 className="font-display text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">
            Four steps to the moon.
          </h2>

          <div className="mt-12 grid gap-px border border-shill-line sm:grid-cols-2 lg:grid-cols-4">
            {[
              { n: "01", title: "Deployer profile", body: "One-time fee. Rank on the leaderboard." },
              { n: "02", title: "Launch on Meteora", body: "Upload image, set token name & split." },
              { n: "03", title: "Set campaigns", body: "Pay per 1K views, cap budget, rules." },
              { n: "04", title: "Bagworkers paid", body: "Submit, approve, pay from dashboard." },
            ].map((step, i) => (
              <div
                key={step.n}
                className="group border-r border-shill-line bg-shill-card p-6 transition last:border-r-0 hover:bg-shill-surface"
              >
                <span className="font-mono text-3xl font-black leading-none text-shill-accent/30 group-hover:text-shill-accent transition">
                  {step.n}
                </span>
                <h3 className="mt-3 font-display text-xs font-black uppercase tracking-widest text-white">{step.title}</h3>
                <p className="mt-2 font-mono text-xs text-shill-muted">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Try it ── */}
      <section className="border-t border-shill-line bg-shill-darker py-20">
        <div className="mx-auto max-w-3xl px-6">
          <div className="mb-3 flex items-center gap-2 font-mono">
            <span className="text-shill-accent text-[11px] font-bold">&#62;</span>
            <span className="text-[10px] uppercase tracking-widest text-shill-accent">Try it</span>
          </div>
          <h2 className="font-display text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">
            One flow. Token live.
          </h2>
          <p className="mt-3 font-mono text-sm text-shill-muted">Launch your memecoin in minutes.</p>

          <div className="mt-8 border border-shill-line bg-shill-card p-1">
            <div className="border-b border-shill-line px-4 py-2 flex items-center gap-2">
              <span className="text-shill-accent font-mono text-[10px] font-bold">&#62;_</span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-shill-muted">terminal</span>
              <span className="ml-auto animate-blink text-shill-accent font-mono text-[10px]">▌</span>
            </div>
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="flex-1 font-mono">
                <span className="text-[9px] uppercase tracking-widest text-shill-dim block mb-1">Token name</span>
                <span className="text-sm font-bold text-white">SHILLIT on Meteora DBC</span>
                <span className="animate-blink text-shill-accent font-bold ml-0.5">_</span>
              </div>
              <a
                href="/launch"
                className="shrink-0 border border-shill-accent bg-shill-accent px-7 py-3 text-[10px] font-black uppercase tracking-widest text-black font-mono transition hover:shadow-glow-accent hover:-translate-y-px"
              >
                &#62;_ Launch now
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Platform ── */}
      <section className="border-t border-shill-line bg-shill-bg py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-3 flex items-center gap-2 font-mono">
            <span className="text-shill-accent text-[11px] font-bold">&#62;</span>
            <span className="text-[10px] uppercase tracking-widest text-shill-accent">Platform</span>
          </div>
          <h2 className="font-display text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">
            One platform. Every step.
          </h2>
          <p className="mt-3 font-mono text-sm text-shill-muted">From launch to campaigns to holder rewards.</p>

          <div className="mt-10 grid gap-px border border-shill-line sm:grid-cols-3">
            {[
              {
                href: "/launch",
                label: "Launch",
                tag: "01",
                body: "Deploy token on Meteora DBC. Set your fee split once, tweak anytime.",
              },
              {
                href: "/campaigns",
                label: "Campaigns",
                tag: "02",
                body: "Pay per 1K views. Guidelines, caps, and auto-payouts for shillers.",
              },
              {
                href: "/dashboard",
                label: "Dashboard",
                tag: "03",
                body: "Approve payouts. Run holder rewards. Track every token you deployed.",
              },
            ].map((card) => (
              <a
                key={card.label}
                href={card.href}
                className="group flex flex-col border-r border-shill-line bg-shill-card p-7 transition last:border-r-0 hover:bg-shill-surface"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-shill-dim">{card.tag}</span>
                  <span className="font-mono text-[9px] text-shill-dim group-hover:text-shill-accent transition">&#62;_</span>
                </div>
                <h3 className="mt-5 font-display text-sm font-black uppercase tracking-widest text-shill-accent">
                  {card.label}
                </h3>
                <p className="mt-2 font-mono text-xs text-shill-muted flex-1">{card.body}</p>
                <span className="mt-5 font-mono text-[9px] uppercase tracking-widest text-shill-dim group-hover:text-shill-accent transition">
                  Explore →
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── Earn / Revenue ── */}
      <section className="border-t border-shill-line bg-shill-darker py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="mb-3 flex items-center gap-2 font-mono">
            <span className="text-shill-accent text-[11px] font-bold">&#62;</span>
            <span className="text-[10px] uppercase tracking-widest text-shill-accent">Revenue</span>
          </div>
          <h2 className="font-display text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">
            Tokenize. Earn forever.
          </h2>
          <p className="mt-3 font-mono text-sm text-shill-muted">Every trade generates revenue. You set the split.</p>

          <div className="mt-8 border border-shill-line bg-shill-card">
            {/* Header bar */}
            <div className="flex items-center justify-between border-b border-shill-line px-6 py-3">
              <div className="flex items-center gap-2 font-mono">
                <span className="text-shill-accent text-[10px] font-bold">&#62;</span>
                <span className="text-[10px] uppercase tracking-widest text-shill-text/60">fee.split.config</span>
              </div>
              <span className="animate-blink text-shill-accent font-mono text-[10px]">▌</span>
            </div>

            <div className="p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-widest text-shill-accent">Your token</p>
                  <p className="mt-2 font-display text-xl font-black text-white">Set your split</p>
                  <p className="mt-1 font-mono text-xs text-shill-muted">Creator · Buys · Burns · LP · Holders</p>
                </div>
                <div className="flex gap-6 font-mono text-center">
                  <div className="border border-shill-line bg-shill-bg px-4 py-3">
                    <p className="text-[9px] uppercase tracking-widest text-shill-dim">Trading fees</p>
                    <p className="mt-1 text-sm font-bold text-shill-accent">You earn</p>
                  </div>
                  <div className="border border-shill-line bg-shill-bg px-4 py-3">
                    <p className="text-[9px] uppercase tracking-widest text-shill-dim">Holders</p>
                    <p className="mt-1 text-sm font-bold text-white">Claim share</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 grid gap-px border border-shill-line sm:grid-cols-3">
                {[
                  { title: "Earn on every trade", body: "Automatic. Perpetual. Your split forever." },
                  { title: "Holder rewards", body: "Claim from vault or push-to-holder. Your choice." },
                  { title: "Bagwork campaigns", body: "Pay shillers by performance. Per 1K views." },
                ].map((card) => (
                  <div
                    key={card.title}
                    className="border-r border-shill-line bg-shill-bg p-5 last:border-r-0"
                  >
                    <h4 className="font-display text-xs font-black uppercase tracking-widest text-shill-accent">
                      {card.title}
                    </h4>
                    <p className="mt-2 font-mono text-xs text-shill-muted">{card.body}</p>
                  </div>
                ))}
              </div>

              <p className="mt-5 font-mono text-[9px] uppercase tracking-widest text-shill-dim text-center">
                Powered by Meteora DBC · Solana
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Splits control ── */}
      <section className="border-t border-shill-line bg-shill-bg py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-3 flex items-center gap-2 font-mono">
            <span className="text-shill-accent text-[11px] font-bold">&#62;</span>
            <span className="text-[10px] uppercase tracking-widest text-shill-accent">Control</span>
          </div>
          <h2 className="font-display text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">
            One token. Full control.
          </h2>
          <p className="mt-3 font-mono text-sm text-shill-muted">Set your split once, tweak anytime in the dashboard.</p>

          <div className="mt-10 grid grid-cols-2 gap-px border border-shill-line sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Creator %", code: "01" },
              { label: "Buybacks", code: "02" },
              { label: "Burns", code: "03" },
              { label: "LP", code: "04" },
              { label: "Holders", code: "05" },
              { label: "Campaigns", code: "06" },
            ].map((item) => (
              <div
                key={item.label}
                className="group flex flex-col items-center justify-center gap-2 border-r border-b border-shill-line bg-shill-card px-4 py-6 text-center transition last:border-r-0 hover:bg-shill-surface"
              >
                <span className="font-mono text-[9px] uppercase tracking-widest text-shill-dim">{item.code}</span>
                <span className="font-display text-[10px] font-black uppercase tracking-widest text-shill-muted group-hover:text-shill-accent transition">
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {["Set split %", "Edit campaign", "Run rewards", "Claim fees", "Leaderboard", "CTO"].map((t) => (
              <span
                key={t}
                className="border border-shill-line bg-shill-card px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-shill-dim transition hover:border-shill-accent/40 hover:text-shill-accent cursor-default"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="relative overflow-hidden border-t border-shill-line bg-shill-darker py-28">
        {/* Grid bg */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `linear-gradient(#bdfe00 1px, transparent 1px), linear-gradient(90deg, #bdfe00 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />
        {/* Glow */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[700px] rounded-full blur-[120px]"
          style={{ background: "radial-gradient(ellipse, rgba(189,254,0,0.12) 0%, transparent 70%)" }}
        />

        <div className="relative mx-auto max-w-2xl px-6 text-center">
          <div className="mb-6 inline-flex items-center gap-3 border border-shill-line bg-shill-card px-4 py-2.5 font-mono">
            <span className="text-shill-accent font-bold text-[11px]">&#62;</span>
            <span className="text-[10px] uppercase tracking-widest text-shill-text/60">ready to launch</span>
            <span className="animate-blink text-shill-accent text-[11px] font-bold">_</span>
          </div>

          <h2 className="font-display text-4xl font-black uppercase tracking-tight text-white sm:text-5xl lg:text-6xl">
            Launch your<br />
            <span className="text-shill-accent">memecoin.</span>
          </h2>
          <p className="mt-5 font-mono text-sm text-shill-muted sm:text-base">
            Share earnings. Bagwork campaigns. Get paid on every trade.
          </p>

          {/* Block loader */}
          <div className="mt-8 mx-auto max-w-xs flex gap-[3px]">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="h-1.5 flex-1 bg-shill-accent"
                style={{
                  animation: `blockBlink 1.2s ease-in-out infinite`,
                  animationDelay: `${i * 100}ms`,
                }}
              />
            ))}
          </div>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="/launch"
              className="border border-shill-accent bg-shill-accent px-10 py-4 font-mono text-[11px] font-black uppercase tracking-widest text-black transition hover:shadow-glow-accent hover:-translate-y-px active:translate-y-0"
            >
              &#62;_ Launch token
            </a>
            <a
              href="/campaigns"
              className="border border-shill-line px-10 py-4 font-mono text-[11px] font-black uppercase tracking-widest text-shill-text/60 transition hover:border-shill-accent/40 hover:text-shill-accent hover:-translate-y-px active:translate-y-0"
            >
              Browse campaigns
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-shill-line bg-shill-bg py-8">
        <div className="mx-auto max-w-5xl px-6 flex flex-wrap items-center justify-between gap-6">
          <a href="/" className="flex items-center gap-2">
            <span className="font-mono text-shill-accent text-[11px] font-bold">&#62;</span>
            <span className="font-display text-xs font-black uppercase tracking-widest text-white">
              SHILL<span className="text-shill-accent">IT</span>
            </span>
            <span className="animate-blink font-mono text-shill-accent text-[11px] font-bold">_</span>
          </a>
          <nav className="flex flex-wrap gap-5 font-mono text-[9px] uppercase tracking-widest text-shill-dim">
            <a href="/#how" className="transition hover:text-shill-accent">How it works</a>
            <a href="/campaigns" className="transition hover:text-shill-accent">Campaigns</a>
            <a href="/leaderboard" className="transition hover:text-shill-accent">Leaderboard</a>
            <a href="/dashboard" className="transition hover:text-shill-accent">Dashboard</a>
            <a href="/deployer" className="transition hover:text-shill-accent">Deployer</a>
          </nav>
          <p className="font-mono text-[9px] uppercase tracking-widest text-shill-dim">
            © Shill It · Solana
          </p>
        </div>
      </footer>
    </>
  );
}
