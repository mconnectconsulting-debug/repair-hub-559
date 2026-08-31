import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { StatusChip } from "@/components/StatusChip";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { TrendUp, Package, ClipboardText, CheckSquare, CurrencyDollar, Warning } from "@phosphor-icons/react";

const Metric = ({ label, value, sub, icon: Icon, testid }) => (
  <div className="metric-card" data-testid={testid}>
    <div className="flex items-start justify-between">
      <div className="text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <Icon size={16} weight="duotone" className="text-muted-foreground" />
    </div>
    <div className="mt-4 display text-4xl font-black tracking-tighter">{value}</div>
    {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
  </div>
);

export default function Dashboard() {
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/dashboard").then((r) => setD(r.data)); }, []);

  if (!d) return <div className="p-10 text-muted-foreground">Loading…</div>;

  const chartData = Object.entries(d.by_status)
    .filter(([_, v]) => v > 0)
    .map(([status, count]) => ({ status: status.length > 12 ? status.slice(0,10)+"…" : status, count }));

  return (
    <div className="p-8">
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Overview</div>
          <h1 className="display text-4xl font-black tracking-tighter mt-1">Dashboard</h1>
        </div>
        <div className="text-xs font-mono text-muted-foreground">
          {new Date().toLocaleString("en-SG", { timeZone: "Asia/Singapore" })}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <Metric label="Open Jobs" value={d.open_jobs} icon={ClipboardText} testid="metric-open" />
        <Metric label="Awaiting Approval" value={d.awaiting_approval} icon={Warning} testid="metric-approval" />
        <Metric label="In Repair" value={d.in_repair} icon={TrendUp} testid="metric-repair" />
        <Metric label="Ready to Ship" value={d.ready_for_dispatch} icon={Package} testid="metric-ready" />
        <Metric label="Closed / MTD" value={d.closed_this_month} icon={CheckSquare} testid="metric-closed" />
        {d.revenue_approved !== null && d.revenue_approved !== undefined && (
          <Metric label="Approved Revenue" value={`$${(d.revenue_approved || 0).toLocaleString()}`} icon={CurrencyDollar} testid="metric-revenue" />
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-8">
        <div className="lg:col-span-2 bg-card border border-border p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">Pipeline</div>
              <div className="display font-bold tracking-tight text-lg mt-0.5">Jobs by status</div>
            </div>
          </div>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="status" stroke="hsl(var(--muted-foreground))" fontSize={11}
                  tick={{ fontFamily: "IBM Plex Mono" }} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11}
                  tick={{ fontFamily: "IBM Plex Mono" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
                    fontSize: 12, fontFamily: "IBM Plex Mono",
                  }}
                  cursor={{ fill: "hsl(var(--muted) / 0.5)" }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border p-6">
          <div className="text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">Scope</div>
          <div className="display font-bold tracking-tight text-lg mt-0.5 mb-5">Registry counts</div>
          <div className="space-y-4">
            <div className="flex items-baseline justify-between border-b border-border pb-3">
              <div className="text-sm text-muted-foreground">Customers</div>
              <div className="display font-black text-2xl tracking-tighter">{d.customers}</div>
            </div>
            <div className="flex items-baseline justify-between border-b border-border pb-3">
              <div className="text-sm text-muted-foreground">Serialised Assets</div>
              <div className="display font-black text-2xl tracking-tighter">{d.assets}</div>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-sm text-muted-foreground">Total Jobs</div>
              <div className="display font-black text-2xl tracking-tighter">{d.total_jobs}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">Latest</div>
            <div className="display font-bold tracking-tight text-lg mt-0.5">Recent Jobs</div>
          </div>
          <Link to="/app/jobs" data-testid="dashboard-view-all-jobs" className="text-sm text-primary hover:underline">View all →</Link>
        </div>
        <table className="w-full data-table" data-testid="dashboard-recent-table">
          <thead>
            <tr>
              <th>Job No</th><th>RMA</th><th>ECU / Serial</th><th>Priority</th><th>Status</th><th>Created</th>
            </tr>
          </thead>
          <tbody>
            {d.recent_jobs.map((j) => (
              <tr key={j.id}>
                <td><Link to={`/app/jobs/${j.id}`} className="mono text-primary hover:underline">{j.job_no}</Link></td>
                <td className="mono text-xs text-muted-foreground">{j.rma_no}</td>
                <td>
                  <div className="text-sm">{j.ecu_type}</div>
                  <div className="mono text-[11px] text-muted-foreground">{j.serial_number}</div>
                </td>
                <td><span className="text-xs font-medium">{j.priority}</span></td>
                <td><StatusChip status={j.status} /></td>
                <td className="mono text-xs text-muted-foreground">
                  {new Date(j.created_at).toLocaleDateString("en-SG")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
