export default function Home() {
  const MARQUEE_WORDS = ["Launch", "·", "Shill", "·", "Earn", "·", "Repeat", "·"];

  return (
    <>
      {/* ── Marquee strip ── */}
      <section className="relative overflow-hidden border-b border-[#222] bg-[#060606] py-2.5 pt-[68px]">
        <div className="flex w-max animate-marquee gap-10 whitespace-nowrap text-[11px] font-black uppercase tracking-[0.4em] text-shill-lime">
          {[...Array(6)].map((_, i) => (
            <span key={i} className="flex shrink-0 gap-10">
              {MARQUEE_WORDS.map((w, j) => (
                <span key={j} className={w === "·" ? "text-[#444]" : ""}>{w}</span>
              ))}
            </span>
          ))}
        </div>
      </section>

      {/* ── Hero ── */}
      <section className="relative min-h-[90vh] overflow-hidden bg-[#060606]">
        {/* Grid background */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(rgba(191,255,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(191,255,0,0.03) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
        {/* Radial glow center */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[800px] rounded-full opacity-10 blur-[120px]"
          style={{ background: "radial-gradient(ellipse, #BFFF00 0%, transparent 70%)" }}
        />

        <div className="relative mx-auto max-w-5xl px-6 pt-28 pb-28 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-2xl border border-shill-lime/30 bg-shill-lime/5 px-4 py-2">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-shill-lime" />
            <span className="text-[11px] font-black uppercase tracking-widest text-shill-lime">
              Memecoin Launchpad · Powered by Meteora DBC
            </span>
          </div>

          <h1 className="font-display text-5xl font-black leading-[0.95] tracking-tight text-white sm:text-6xl md:text-7xl lg:text-8xl">
            <span className="block">Launch</span>
            <span className="block">memecoins</span>
            <span className="block text-shill-lime">that shill.</span>
          </h1>

          <p className="mt-8 mx-auto max-w-lg text-base text-[#888] sm:text-lg">
            One token per image. Set your split. Run bagwork campaigns. Get paid on every trade.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="/launch"
              className="inline-flex items-center gap-2 rounded-2xl bg-shill-lime px-8 py-4 text-sm font-black uppercase tracking-widest text-[#0A0A0A] shadow-hard transition hover:shadow-glow-lime hover:-translate-y-0.5"
            >
              🚀 Launch token
            </a>
            <a
              href="/campaigns"
              className="inline-flex items-center gap-2 rounded-2xl border border-shill-cyan bg-shill-cyan/10 px-8 py-4 text-sm font-black uppercase tracking-widest text-shill-cyan shadow-hard-cyan transition hover:shadow-glow-cyan hover:-translate-y-0.5"
            >
              Browse campaigns
            </a>
          </div>

          {/* Flow pills */}
          <div className="mt-16 flex flex-wrap items-center justify-center gap-3 text-sm">
            {[
              { label: "🖼 Upload image", color: "lime" },
              { label: "→", color: "muted" },
              { label: "🪙 Token live", color: "lime" },
              { label: "→", color: "muted" },
              { label: "💸 Set split", color: "cyan" },
              { label: "→", color: "muted" },
              { label: "📣 Campaigns", color: "cyan" },
              { label: "→", color: "muted" },
              { label: "💰 Earn", color: "lime" },
            ].map((item, i) =>
              item.color === "muted" ? (
                <span key={i} className="text-[#444] font-bold">{item.label}</span>
              ) : item.color === "lime" ? (
                <span key={i} className="rounded-xl border border-shill-lime/40 bg-shill-lime/10 px-4 py-2 font-bold text-shill-lime">
                  {item.label}
                </span>
              ) : (
                <span key={i} className="rounded-xl border border-shill-cyan/40 bg-shill-cyan/10 px-4 py-2 font-bold text-shill-cyan">
                  {item.label}
                </span>
              )
            )}
          </div>
        </div>
      </section>

      {/* ── 4 Steps ── */}
      <section className="border-t border-[#222] bg-[#0A0A0A] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <p className="mb-3 text-center text-[11px] font-black uppercase tracking-widest text-shill-lime">
            How it works
          </p>
          <h2 className="text-center font-display text-3xl font-black tracking-tight text-white sm:text-4xl">
            Four steps to the moon.
          </h2>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                n: "01",
                title: "Create deployer profile",
                body: "One-time fee. Rank on the leaderboard.",
                color: "lime",
              },
              {
                n: "02",
                title: "Launch on Meteora DBC",
                body: "Upload image, set token name & split.",
                color: "cyan",
              },
              {
                n: "03",
                title: "Set campaigns & guidelines",
                body: "Pay per 1K views, cap, rules.",
                color: "lime",
              },
              {
                n: "04",
                title: "Bagworkers get paid",
                body: "Submit, approve, pay from dashboard.",
                color: "cyan",
              },
            ].map((step) => (
              <div
                key={step.n}
                className={`group rounded-2xl border ${
                  step.color === "lime"
                    ? "border-shill-lime/20 hover:border-shill-lime/60 hover:shadow-glow-lime"
                    : "border-shill-cyan/20 hover:border-shill-cyan/60 hover:shadow-glow-cyan"
                } bg-[#111] p-6 transition`}
              >
                <span
                  className={`text-5xl font-black leading-none ${
                    step.color === "lime" ? "text-shill-lime" : "text-shill-cyan"
                  } opacity-40 group-hover:opacity-80 transition`}
                >
                  {step.n}
                </span>
                <h3 className="mt-3 font-bold text-white">{step.title}</h3>
                <p className="mt-1 text-sm text-[#888]">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Try It ── */}
      <section id="how" className="border-t border-[#222] bg-[#060606] py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-shill-lime">Try it</p>
          <h2 className="font-display text-3xl font-black tracking-tight text-white sm:text-4xl">
            One flow. Token live.
          </h2>
          <p className="mt-4 text-[#888]">Launch your memecoin in minutes.</p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <div className="flex-1 max-w-sm rounded-2xl border border-[#222] bg-[#111] px-5 py-4 text-left text-sm text-[#888]">
              <span className="text-[#555] text-xs uppercase tracking-widest block mb-1">Token name</span>
              <span className="text-white font-bold">SHILLIT on Meteora DBC</span>
            </div>
            <a
              href="/launch"
              className="shrink-0 rounded-2xl bg-shill-lime px-8 py-4 text-sm font-black uppercase tracking-widest text-[#0A0A0A] shadow-hard transition hover:shadow-glow-lime hover:-translate-y-0.5"
            >
              Launch now
            </a>
          </div>
        </div>
      </section>

      {/* ── Platform Cards ── */}
      <section className="border-t border-[#222] bg-[#0A0A0A] py-20">
        <div className="mx-auto max-w-5xl px-6">
          <p className="mb-3 text-center text-[11px] font-black uppercase tracking-widest text-shill-lime">Platform</p>
          <h2 className="text-center font-display text-3xl font-black tracking-tight text-white sm:text-4xl">
            One platform. Every step.
          </h2>
          <p className="mt-3 text-center text-[#888]">
            From launch to campaigns to holder rewards.
          </p>

          <div className="mt-14 grid gap-5 sm:grid-cols-3">
            {[
              {
                href: "/launch",
                label: "Launch",
                icon: "🚀",
                body: "Create token on Meteora DBC, set your fee split.",
                color: "lime",
              },
              {
                href: "/campaigns",
                label: "Campaigns",
                icon: "📣",
                body: "Guidelines, pay per 1K views, fund & go live.",
                color: "cyan",
              },
              {
                href: "/dashboard",
                label: "Dashboard",
                icon: "📊",
                body: "Run rewards, approve payouts, track tokens.",
                color: "lime",
              },
            ].map((card) => (
              <a
                key={card.label}
                href={card.href}
                className={`group flex flex-col rounded-2xl border ${
                  card.color === "lime"
                    ? "border-shill-lime/20 hover:border-shill-lime/60 hover:shadow-glow-lime"
                    : "border-shill-cyan/20 hover:border-shill-cyan/60 hover:shadow-glow-cyan"
                } bg-[#111] p-7 transition`}
              >
                <span className="text-3xl">{card.icon}</span>
                <h3
                  className={`mt-4 text-lg font-black uppercase tracking-wide ${
                    card.color === "lime" ? "text-shill-lime" : "text-shill-cyan"
                  }`}
                >
                  {card.label}
                </h3>
                <p className="mt-2 text-sm text-[#888] flex-1">{card.body}</p>
                <span
                  className={`mt-5 self-start text-xs font-black uppercase tracking-widest ${
                    card.color === "lime" ? "text-shill-lime" : "text-shill-cyan"
                  }`}
                >
                  Explore →
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── Earn Section ── */}
      <section className="border-t border-[#222] bg-[#060606] py-20">
        <div className="mx-auto max-w-4xl px-6">
          <p className="mb-3 text-center text-[11px] font-black uppercase tracking-widest text-shill-cyan">Revenue</p>
          <h2 className="text-center font-display text-3xl font-black tracking-tight text-white sm:text-4xl">
            Tokenize. Earn forever.
          </h2>
          <p className="mt-3 text-center text-[#888]">
            Every trade generates revenue. You set the split.
          </p>

          <div className="mt-12 rounded-2xl border border-shill-lime/20 bg-[#111] p-8">
            <div className="flex flex-wrap items-start justify-between gap-8">
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-shill-lime">Your token</p>
                <p className="mt-2 text-2xl font-black text-white">Set your split</p>
                <p className="mt-1 text-sm text-[#888]">Creator · Buys · Burns · LP · Holders</p>
              </div>
              <div className="flex gap-8 text-center">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-[#555]">Trading fees</p>
                  <p className="mt-1 text-xl font-black text-shill-lime">You earn</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-[#555]">Holders</p>
                  <p className="mt-1 text-xl font-black text-shill-cyan">Claim share</p>
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                {
                  title: "Earn on every trade",
                  body: "Automatic. Perpetual. Your split.",
                  color: "lime",
                },
                {
                  title: "Holder rewards",
                  body: "Claim from vault or push. Your choice.",
                  color: "cyan",
                },
                {
                  title: "Bagwork campaigns",
                  body: "Pay shillers by performance.",
                  color: "lime",
                },
              ].map((card) => (
                <div
                  key={card.title}
                  className={`rounded-xl border ${
                    card.color === "lime" ? "border-shill-lime/20" : "border-shill-cyan/20"
                  } bg-[#0A0A0A] p-5`}
                >
                  <h4 className={`font-black ${card.color === "lime" ? "text-shill-lime" : "text-shill-cyan"}`}>
                    {card.title}
                  </h4>
                  <p className="mt-1 text-sm text-[#888]">{card.body}</p>
                </div>
              ))}
            </div>

            <p className="mt-6 text-center text-[11px] uppercase tracking-widest text-[#555]">
              Powered by Meteora DBC on Solana
            </p>
          </div>
        </div>
      </section>

      {/* ── Splits Grid ── */}
      <section className="border-t border-[#222] bg-[#0A0A0A] py-20">
        <div className="mx-auto max-w-5xl px-6">
          <p className="mb-3 text-center text-[11px] font-black uppercase tracking-widest text-shill-lime">Control</p>
          <h2 className="text-center font-display text-3xl font-black tracking-tight text-white sm:text-4xl">
            One token. Full control.
          </h2>
          <p className="mt-3 text-center text-[#888]">Set your split once, tweak anytime in the dashboard.</p>

          <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Creator %", icon: "🎨" },
              { label: "Buybacks", icon: "🔄" },
              { label: "Burns", icon: "🔥" },
              { label: "LP", icon: "💧" },
              { label: "Holders", icon: "🏆" },
              { label: "Campaigns", icon: "📣" },
            ].map((item) => (
              <div
                key={item.label}
                className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-[#222] bg-[#111] p-6 text-center transition hover:border-shill-lime/50 hover:shadow-glow-lime"
              >
                <span className="text-2xl">{item.icon}</span>
                <span className="text-xs font-black uppercase tracking-wide text-[#888] group-hover:text-shill-lime transition">
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {["Set split %", "Edit campaign", "Run rewards", "Claim fees", "Leaderboard", "CTO"].map((t) => (
              <span
                key={t}
                className="rounded-xl border border-[#333] bg-[#111] px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#888] hover:border-shill-lime/40 hover:text-shill-lime transition cursor-default"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="relative overflow-hidden border-t border-[#222] bg-[#060606] py-28">
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[600px] rounded-full opacity-10 blur-[100px]"
          style={{ background: "radial-gradient(ellipse, #BFFF00 0%, transparent 70%)" }}
        />
        <div className="relative mx-auto max-w-2xl px-6 text-center">
          <p className="mb-4 text-[11px] font-black uppercase tracking-widest text-shill-lime">Ready?</p>
          <h2 className="font-display text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
            Launch your<br />
            <span className="text-shill-lime">memecoin.</span>
          </h2>
          <p className="mt-5 text-lg text-[#888]">
            Share earnings. Bagwork campaigns. Get paid on every trade.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="/launch"
              className="rounded-2xl bg-shill-lime px-10 py-4 text-sm font-black uppercase tracking-widest text-[#0A0A0A] shadow-hard transition hover:shadow-glow-lime hover:-translate-y-0.5"
            >
              🚀 Launch token
            </a>
            <a
              href="/campaigns"
              className="rounded-2xl border border-shill-cyan bg-shill-cyan/10 px-10 py-4 text-sm font-black uppercase tracking-widest text-shill-cyan shadow-hard-cyan transition hover:shadow-glow-cyan hover:-translate-y-0.5"
            >
              Browse campaigns
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[#222] bg-[#0A0A0A] py-10">
        <div className="mx-auto max-w-5xl px-6 flex flex-wrap items-center justify-between gap-6">
          <a href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-shill-lime text-[#0A0A0A] text-base shadow-hard">🚀</span>
            <span className="font-black uppercase text-white">
              Shill<span className="text-shill-lime">It</span>
            </span>
          </a>
          <nav className="flex flex-wrap gap-6 text-[11px] font-bold uppercase tracking-widest text-[#555]">
            <a href="/#how" className="transition hover:text-white">How it works</a>
            <a href="/campaigns" className="transition hover:text-white">Campaigns</a>
            <a href="/leaderboard" className="transition hover:text-white">Leaderboard</a>
            <a href="/dashboard" className="transition hover:text-white">Dashboard</a>
            <a href="/deployer" className="transition hover:text-white">Deployer</a>
          </nav>
          <p className="text-[11px] uppercase tracking-widest text-[#555]">© Shill It · Solana</p>
        </div>
      </footer>
    </>
  );
}
