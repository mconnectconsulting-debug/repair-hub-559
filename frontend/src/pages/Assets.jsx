import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function Assets() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/assets").then((r) => setRows(r.data)); }, []);
  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Registry</div>
        <h1 className="display text-4xl font-black tracking-tighter mt-1">Repairable Assets</h1>
      </div>
      <div className="bg-card border border-border">
        <table className="w-full data-table" data-testid="assets-table">
          <thead><tr><th>Serial No</th><th>Type</th><th>Manufacturer</th><th>Part No</th><th>HW/SW</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td className="mono text-primary">{a.serial_number}</td>
                <td>{a.ecu_type}</td>
                <td>{a.manufacturer}</td>
                <td className="mono">{a.part_number}</td>
                <td className="mono text-xs text-muted-foreground">{a.hw_version} / {a.sw_version}</td>
                <td><span className="text-xs">{a.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
