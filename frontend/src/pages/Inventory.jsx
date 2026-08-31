import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function Inventory() {
  const [items, setItems] = useState([]);
  useEffect(() => { api.get("/inventory").then((r) => setItems(r.data)); }, []);
  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Stock</div>
        <h1 className="display text-4xl font-black tracking-tighter mt-1">Inventory</h1>
      </div>
      <div className="bg-card border border-border">
        <table className="w-full data-table" data-testid="inventory-table">
          <thead><tr><th>Code</th><th>Description</th><th>Category</th><th>UOM</th><th className="text-right">On Hand</th><th className="text-right">Reorder</th><th className="text-right">Unit Cost</th></tr></thead>
          <tbody>
            {items.map((i) => {
              const low = i.on_hand <= i.reorder_level;
              return (
                <tr key={i.id}>
                  <td className="mono text-primary">{i.code}</td>
                  <td>{i.description}</td>
                  <td className="text-xs text-muted-foreground">{i.category}</td>
                  <td className="text-xs mono">{i.uom}</td>
                  <td className={`text-right mono font-medium ${low ? "text-amber-500" : ""}`}>{i.on_hand}</td>
                  <td className="text-right mono text-muted-foreground">{i.reorder_level}</td>
                  <td className="text-right mono">${i.unit_cost.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
