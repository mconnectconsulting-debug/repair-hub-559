import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { StatusChip } from "@/components/StatusChip";
import { Plus } from "@phosphor-icons/react";
import NewRMADialog from "@/components/NewRMADialog";

export default function RMAs() {
  const [rmas, setRmas] = useState([]);
  const [open, setOpen] = useState(false);
  const load = () => api.get("/rmas").then((r) => setRmas(r.data));
  useEffect(() => { load(); }, []);

  return (
    <div className="p-8">
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Requests</div>
          <h1 className="display text-4xl font-black tracking-tighter mt-1">RMAs</h1>
        </div>
        <button
          data-testid="new-rma-btn"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors duration-100"
        >
          <Plus size={16} weight="bold" /> New RMA
        </button>
      </div>

      <div className="bg-card border border-border">
        <table className="w-full data-table" data-testid="rma-table">
          <thead>
            <tr>
              <th>RMA No</th><th>Customer</th><th>Jobs</th><th>Customer PO</th><th>Status</th><th>Created</th>
            </tr>
          </thead>
          <tbody>
            {rmas.map((r) => (
              <tr key={r.id} data-testid={`rma-row-${r.rma_no}`}>
                <td><Link to={`/app/rmas/${r.id}`} className="mono text-primary hover:underline">{r.rma_no}</Link></td>
                <td className="text-sm">{r.customer_id?.slice(0,8)}</td>
                <td className="mono text-sm">{r.job_count}</td>
                <td className="mono text-xs text-muted-foreground">{r.customer_po || "—"}</td>
                <td><StatusChip status={r.status} /></td>
                <td className="mono text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString("en-SG")}
                </td>
              </tr>
            ))}
            {rmas.length === 0 && (
              <tr><td colSpan={6} className="text-center text-muted-foreground py-12">No RMAs yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <NewRMADialog open={open} onClose={() => setOpen(false)} onCreated={load} />
    </div>
  );
}
