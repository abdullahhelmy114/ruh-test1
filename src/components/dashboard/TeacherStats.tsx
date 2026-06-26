import { motion } from "framer-motion";
import { Wallet, Users, Copy, TrendingUp } from "lucide-react";

export function TeacherStats() {
  const referrals = 67;
  const target = 100;
  const pct = Math.min(100, (referrals / target) * 100);
  const currentRate = referrals >= 100 ? 15 : 10;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Stat label="Total Earnings" value="$3,240" icon={<Wallet className="h-4 w-4" />} sub="+ $480 this month" />
      <Stat label="Active Students" value="124" icon={<Users className="h-4 w-4" />} sub="12 new this week" />
      <Stat label="Commission Rate" value={`${currentRate}%`} icon={<TrendingUp className="h-4 w-4" />} sub="Tier: Founding" />

      <div className="lg:col-span-3 rounded-3xl border bg-card p-6 shadow-elegant">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-widest text-gold">Affiliate Program</div>
            <h3 className="mt-1 font-serif text-2xl">Path to 15% Commission</h3>
          </div>
          <div className="text-sm text-muted-foreground">
            <span className="text-foreground font-semibold">{referrals}</span> / {target} referrals
          </div>
        </div>

        <div className="relative h-3 overflow-hidden rounded-full bg-muted">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="absolute inset-y-0 left-0 gradient-gold"
          />
          <div className="absolute inset-y-0 left-1/2 w-px bg-card/60" />
        </div>
        <div className="mt-2 flex justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
          <span>10% — Starting</span>
          <span>15% — After 100</span>
        </div>

        <div className="mt-6 flex flex-col gap-3 rounded-2xl border bg-background p-4 sm:flex-row sm:items-center">
          <div className="text-xs uppercase tracking-widest text-muted-foreground sm:flex-none">Your link</div>
          <code className="flex-1 truncate rounded-full bg-muted px-4 py-2 text-sm">ruhulqudus.academy/r/dr-jehan-7f2a</code>
          <button className="inline-flex items-center justify-center gap-2 rounded-full gradient-emerald px-4 py-2 text-xs font-semibold text-primary-foreground">
            <Copy className="h-3.5 w-3.5" /> Copy
          </button>
        </div>

        <div className="mt-6">
          <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Recent Referrals</div>
          <div className="divide-y rounded-2xl border bg-background">
            {[
              { name: "Aisha M.", date: "Today", amount: "+$9.80" },
              { name: "Yusuf R.", date: "Yesterday", amount: "+$4.90" },
              { name: "Fatima A.", date: "2 days ago", amount: "+$9.80" },
            ].map((r) => (
              <div key={r.name} className="flex items-center justify-between px-4 py-3 text-sm">
                <div className="flex items-center gap-3">
                  <div className="grid h-8 w-8 place-items-center rounded-full gradient-emerald text-xs text-primary-foreground">
                    {r.name[0]}
                  </div>
                  <span className="font-medium">{r.name}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{r.date}</span>
                  <span className="font-semibold text-gold">{r.amount}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, icon }: { label: string; value: string; sub: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-3xl border bg-card p-6 shadow-elegant">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="grid h-8 w-8 place-items-center rounded-full bg-accent text-accent-foreground">{icon}</div>
      </div>
      <div className="mt-3 font-serif text-3xl">{value}</div>
      <div className="mt-1 text-xs text-gold">{sub}</div>
    </div>
  );
}
