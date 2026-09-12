import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Wrench } from "@phosphor-icons/react";

const SHOW_DEMO = process.env.REACT_APP_SHOW_DEMO !== "false";

const DEMO = [
  { label: "Admin", email: "admin@mconnect.demo", password: "admin123" },
  { label: "Coordinator", email: "coord@mconnect.demo", password: "coord123" },
  { label: "Technician", email: "tech@mconnect.demo", password: "tech123" },
  { label: "QA", email: "qa@mconnect.demo", password: "qa123" },
  { label: "Customer", email: "customer@sbs.demo", password: "cust123" },
];

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e?.preventDefault?.();
    setBusy(true);
    try {
      const u = await login(email, password);
      toast.success(`Welcome, ${u.name}`);
      nav(u.role === "customer" ? "/portal" : "/app");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Login failed");
    } finally { setBusy(false); }
  };

  const quick = (d) => { setEmail(d.email); setPassword(d.password); };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-zinc-950 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-[0.06]" />
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary text-primary-foreground flex items-center justify-center font-bold display text-xl">M</div>
            <div>
              <div className="display font-bold tracking-tight">MCONNECT</div>
              <div className="text-[11px] uppercase tracking-[0.25em] text-white/50">Repair Services Platform</div>
            </div>
          </div>
        </div>
        <div className="relative z-10 space-y-6">
          <h1 className="display text-5xl font-black tracking-tighter leading-[0.95]">
            The control tower<br/>
            for repair operations.
          </h1>
          <p className="text-white/60 max-w-md leading-relaxed">
            Track every ECU from request to closure with serial-level traceability, integrated inventory, QA and warranty in one system.
          </p>
          <div className="grid grid-cols-3 gap-4 pt-6 border-t border-white/10">
            {["Serial-level tracking", "Full RMA lifecycle", "Live workshop queue"].map((t) => (
              <div key={t} className="text-xs text-white/50 uppercase tracking-[0.18em]">{t}</div>
            ))}
          </div>
        </div>
        <div className="relative z-10 text-[11px] uppercase tracking-[0.2em] text-white/40">
          v1.0 · Singapore Time · Internal Build
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <Wrench size={22} weight="duotone" className="text-primary" />
            <span className="display font-bold tracking-tight">MCONNECT</span>
          </div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Sign in</div>
          <h2 className="display text-3xl font-bold tracking-tight mb-8">Welcome back</h2>

          <form onSubmit={submit} className="space-y-4" data-testid="login-form">
            <div>
              <label className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Email</label>
              <input
                data-testid="login-email"
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full mt-1 px-3 py-2.5 bg-muted/50 border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none rounded-md font-mono text-sm"
                placeholder="you@company.com" required
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Password</label>
              <input
                data-testid="login-password"
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full mt-1 px-3 py-2.5 bg-muted/50 border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none rounded-md font-mono text-sm"
                placeholder="••••••••" required
              />
            </div>
            <button
              data-testid="login-submit"
              disabled={busy}
              className="w-full py-2.5 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary/90 transition-colors duration-100 disabled:opacity-50"
            >
              {busy ? "Signing in..." : "Sign in →"}
            </button>
          </form>

          <div className="mt-10 pt-6 border-t border-border">
            {SHOW_DEMO ? (
              <>
                <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-3">Quick demo access</div>
                <div className="grid grid-cols-2 gap-2">
                  {DEMO.map((d) => (
                    <button
                      key={d.email}
                      data-testid={`demo-login-${d.label.toLowerCase()}`}
                      onClick={() => quick(d)}
                      className="text-left px-3 py-2 bg-muted/40 hover:bg-muted border border-border rounded-md text-sm transition-colors duration-100"
                    >
                      <div className="font-medium">{d.label}</div>
                      <div className="font-mono text-[11px] text-muted-foreground truncate">{d.email}</div>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Ask your administrator for access
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
