import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { StatusChip } from "@/components/StatusChip";
import NewRMADialog from "@/components/NewRMADialog";
import { toast } from "sonner";
import { Plus, SignOut } from "@phosphor-icons/react";

export default function CustomerPortal() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [rmas, setRmas] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [dash, setDash] = useState({});
  const [open, setOpen] = useState(false);

  const load = () => {
    api.get("/rmas").then((r) => setRmas(r.data));
    api.get("/jobs").then((r) => setJobs(r.data));
    api.get("/dashboard").then((r) => setDash(r.data));
  };
  useEffect(() => { load(); }, []);

  const decideQuote = async (jobId, decision) => {
    try {
      await api.post(`/jobs/${jobId}/quote/decide`, { decision, customer_po: decision === "Approved" ? "PO-" + Date.now() : null });
      toast.success(`Quote ${decision}`);
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  const pending = jobs.filter((j) => j.status === "Awaiting Approval" && j.quote && !j.quote.decision);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary text-primary-foreground flex items-center justify-center font-bold display text-lg">M</div>
            <div>
              <div className="display font-bold tracking-tight">MCONNECT</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Customer Portal</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm font-medium">{user?.name}</div>
              <div className="text-xs text-muted-foreground">Customer</div>
            </div>
            <button onClick={() => { logout(); nav("/login"); }} data-testid="portal-logout"
              className="p-2 hover:bg-muted rounded-md"><SignOut size={18}/></button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Welcome</div>
            <h1 className="display text-4xl font-black tracking-tighter mt-1">Your repair services</h1>
          </div>
          <button onClick={() => setOpen(true)} data-testid="portal-new-rma"
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-md font-medium">
            <Plus size={16} weight="bold" /> Submit new request
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Metric label="Open" value={dash.open_jobs || 0} />
          <Metric label="Awaiting your approval" value={pending.length} highlight={pending.length > 0} />
          <Metric label="In repair" value={dash.in_repair || 0} />
          <Metric label="Closed" value={dash.closed_this_month || 0} />
        </div>

        {pending.length > 0 && (
          <section className="bg-card border border-primary/40 border-l-[3px] border-l-primary">
            <div className="p-5 border-b border-border">
              <div className="text-[10.5px] uppercase tracking-[0.2em] text-primary font-semibold">Action required</div>
              <div className="display font-bold text-xl tracking-tight mt-1">Quotations awaiting your decision</div>
            </div>
            <div className="divide-y divide-border">
              {pending.map((j) => (
                <div key={j.id} className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1">
                    <Link to={`/portal/jobs/${j.id}`} className="mono text-primary font-medium">{j.job_no}</Link>
                    <div className="text-sm">{j.ecu_type} · <span className="mono">{j.serial_number}</span></div>
                    <div className="text-xs text-muted-foreground mt-1">Total: <span className="mono font-medium">${j.quote.total.toFixed(2)}</span> · {j.quote.warranty_months}mo warranty</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => decideQuote(j.id, "Approved")} data-testid={`portal-approve-${j.job_no}`}
                      className="px-3 py-2 bg-emerald-600 text-white rounded-md text-sm">Approve</button>
                    <button onClick={() => decideQuote(j.id, "Rejected")}
                      className="px-3 py-2 border border-border rounded-md text-sm">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="bg-card border border-border">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">History</div>
              <div className="display font-bold text-xl tracking-tight mt-0.5">All repair jobs</div>
            </div>
          </div>
          <table className="w-full data-table" data-testid="portal-jobs-table">
            <thead><tr><th>Job</th><th>ECU / Serial</th><th>Fault</th><th>Status</th><th>Created</th></tr></thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td><Link to={`/portal/jobs/${j.id}`} className="mono text-primary hover:underline">{j.job_no}</Link></td>
                  <td>
                    <div className="text-sm">{j.ecu_type}</div>
                    <div className="mono text-[11px] text-muted-foreground">{j.serial_number}</div>
                  </td>
                  <td className="text-sm max-w-xs truncate">{j.fault_description}</td>
                  <td><StatusChip status={j.status} /></td>
                  <td className="mono text-xs text-muted-foreground">{new Date(j.created_at).toLocaleDateString("en-SG")}</td>
                </tr>
              ))}
              {jobs.length === 0 && <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">No repair jobs yet</td></tr>}
            </tbody>
          </table>
        </section>
      </main>
      <NewRMADialog open={open} onClose={() => setOpen(false)} onCreated={load} />
    </div>
  );
}

const Metric = ({ label, value, highlight }) => (
  <div className={`metric-card ${highlight ? "border-primary/50" : ""}`}>
    <div className="text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
    <div className={`mt-3 display text-3xl font-black tracking-tighter ${highlight ? "text-primary" : ""}`}>{value}</div>
  </div>
);
