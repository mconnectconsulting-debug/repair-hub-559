import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function Customers() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/customers").then((r) => setRows(r.data)); }, []);
  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Directory</div>
        <h1 className="display text-4xl font-black tracking-tighter mt-1">Customers</h1>
      </div>
      <div className="bg-card border border-border">
        <table className="w-full data-table" data-testid="customers-table">
          <thead><tr><th>Code</th><th>Name</th><th>Industry</th><th>Contact</th><th>Address</th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td className="mono text-primary">{c.code}</td>
                <td className="font-medium">{c.name}</td>
                <td className="text-sm text-muted-foreground">{c.industry}</td>
                <td className="text-sm mono">{c.contact_email}</td>
                <td className="text-sm text-muted-foreground">{c.address}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
