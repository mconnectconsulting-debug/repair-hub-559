import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { X, Plus, Trash } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";

export default function NewRMADialog({ open, onClose, onCreated }) {
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [customerPO, setCustomerPO] = useState("");
  const [items, setItems] = useState([blank()]);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  function blank() {
    return { ecu_type: "Engine ECU", manufacturer: "Bosch", part_number: "", serial_number: "", fault_description: "", priority: "Normal" };
  }

  useEffect(() => {
    if (open) {
      api.get("/customers").then((r) => {
        setCustomers(r.data);
        if (r.data.length && !customerId) setCustomerId(r.data[0].id);
      });
    }
  }, [open]); // eslint-disable-line

  if (!open) return null;

  const upd = (i, k, v) => setItems(items.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
  const rm = (i) => setItems(items.length > 1 ? items.filter((_, idx) => idx !== i) : items);

  const submit = async () => {
    if (!customerId) return toast.error("Select customer");
    for (const it of items) {
      if (!it.serial_number || !it.fault_description) return toast.error("Fill serial and fault for each item");
    }
    setBusy(true);
    try {
      const { data } = await api.post("/rmas", { customer_id: customerId, customer_po: customerPO, items });
      toast.success(`Created ${data.rma_no}`);
      onCreated?.();
      onClose();
      setItems([blank()]);
      setCustomerPO("");
      nav(`/app/rmas/${data.id}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" data-testid="new-rma-dialog">
      <div className="bg-card border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">Create</div>
            <div className="display font-bold text-xl tracking-tight">New Return Authorization</div>
          </div>
          <button onClick={onClose} data-testid="rma-dialog-close" className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10.5px] uppercase tracking-[0.15em] text-muted-foreground">Customer</label>
              <select data-testid="rma-customer-select" value={customerId} onChange={(e) => setCustomerId(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-muted/50 border border-border rounded-md text-sm">
                {customers.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10.5px] uppercase tracking-[0.15em] text-muted-foreground">Customer PO</label>
              <input value={customerPO} onChange={(e) => setCustomerPO(e.target.value)} data-testid="rma-po-input"
                className="w-full mt-1 px-3 py-2 bg-muted/50 border border-border rounded-md font-mono text-sm" placeholder="PO-1234" />
            </div>
          </div>

          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10.5px] uppercase tracking-[0.15em] text-muted-foreground">Items to repair</div>
              <button onClick={() => setItems([...items, blank()])} data-testid="rma-add-item"
                className="text-primary text-xs flex items-center gap-1 hover:underline"><Plus size={12}/> Add item</button>
            </div>
            <div className="space-y-3">
              {items.map((it, i) => (
                <div key={i} className="border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-mono text-muted-foreground">Item #{i+1}</div>
                    {items.length > 1 && (
                      <button onClick={() => rm(i)} className="text-destructive hover:opacity-80"><Trash size={14}/></button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="ECU Type" value={it.ecu_type} onChange={(e) => upd(i,"ecu_type",e.target.value)}
                      className="px-2 py-1.5 bg-muted/50 border border-border rounded text-sm" />
                    <input placeholder="Manufacturer" value={it.manufacturer} onChange={(e) => upd(i,"manufacturer",e.target.value)}
                      className="px-2 py-1.5 bg-muted/50 border border-border rounded text-sm" />
                    <input placeholder="Part Number" value={it.part_number} onChange={(e) => upd(i,"part_number",e.target.value)}
                      className="px-2 py-1.5 bg-muted/50 border border-border rounded font-mono text-sm" />
                    <input placeholder="Serial Number *" value={it.serial_number} onChange={(e) => upd(i,"serial_number",e.target.value)}
                      className="px-2 py-1.5 bg-muted/50 border border-border rounded font-mono text-sm" data-testid={`rma-item-serial-${i}`} />
                  </div>
                  <textarea placeholder="Fault description *" value={it.fault_description}
                    onChange={(e) => upd(i,"fault_description",e.target.value)} rows={2}
                    className="w-full px-2 py-1.5 bg-muted/50 border border-border rounded text-sm"
                    data-testid={`rma-item-fault-${i}`} />
                  <select value={it.priority} onChange={(e) => upd(i,"priority",e.target.value)}
                    className="px-2 py-1.5 bg-muted/50 border border-border rounded text-sm">
                    {["Low","Normal","High","Critical"].map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-5 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button onClick={submit} disabled={busy} data-testid="rma-submit"
            className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50">
            {busy ? "Creating…" : "Create RMA"}
          </button>
        </div>
      </div>
    </div>
  );
}
