import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, LIFECYCLE } from "@/lib/api";
import { StatusChip } from "@/components/StatusChip";

export default function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [filter, setFilter] = useState("");
  useEffect(() => {
    const url = filter ? `/jobs?status_filter=${encodeURIComponent(filter)}` : "/jobs";
    api.get(url).then((r) => setJobs(r.data));
  }, [filter]);

  return (
    <div className="p-8">
      <div className="flex items-end justify-between mb-6">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Workshop</div>
          <h1 className="display text-4xl font-black tracking-tighter mt-1">Repair Jobs</h1>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button onClick={() => setFilter("")} data-testid="job-filter-all"
          className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider border rounded-md ${filter === "" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
          All
        </button>
        {LIFECYCLE.map((s) => (
          <button key={s} onClick={() => setFilter(s)} data-testid={`job-filter-${s.replace(/\s+/g,'-').toLowerCase()}`}
            className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider border rounded-md ${filter === s ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
            {s}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border">
        <table className="w-full data-table" data-testid="jobs-table">
          <thead>
            <tr>
              <th>Job No</th><th>RMA</th><th>Fault</th><th>ECU / Serial</th><th>Priority</th><th>Assigned</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id}>
                <td><Link to={`/app/jobs/${j.id}`} className="mono text-primary hover:underline">{j.job_no}</Link></td>
                <td className="mono text-xs text-muted-foreground">{j.rma_no}</td>
                <td className="max-w-xs truncate text-sm">{j.fault_description}</td>
                <td>
                  <div className="text-sm">{j.ecu_type} · {j.manufacturer}</div>
                  <div className="mono text-[11px] text-muted-foreground">{j.serial_number}</div>
                </td>
                <td className="text-xs">{j.priority}</td>
                <td className="text-xs">{j.assigned_name || <span className="text-muted-foreground">—</span>}</td>
                <td><StatusChip status={j.status} /></td>
              </tr>
            ))}
            {jobs.length === 0 && <tr><td colSpan={7} className="text-center text-muted-foreground py-12">No jobs match filter</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
