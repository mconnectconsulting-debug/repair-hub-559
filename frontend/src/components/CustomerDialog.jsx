import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { X } from "@phosphor-icons/react";

const BLANK = {
  name: "", code: "", industry: "Transport",
  contact_email: "", contact_phone: "", address: "",
};

export default function CustomerDialog({ open, onClose, onSaved, initial }) {
  const editing = !!initial?.id;
  const [f, setF] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setF(initial ? {
        name: initial.name || "",
        code: initial.code || "",
        industry: initial.industry || "Transport",
        contact_email: initial.contact_email || "",
        contact_phone: initial.contact_phone || "",
        address: initial.address || "",
      } : BLANK);
      setErrors({});
    }
  }, [open, initial]);

  if (!open) return null;

  const upd = (k, v) => {
    setF((prev) => ({ ...prev, [k]: v }));
    if (errors[k]) setErrors((prev) => ({ ...prev, [k]: null }));
  };

  const validate = () => {
    const e = {};
    if (!f.name || f.name.trim().length < 2) e.name = "Name is required (min 2 chars)";
    if (!f.code || f.code.trim().length < 2) e.code = "Code is required (min 2 chars)";
    if (f.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.contact_email)) {
      e.contact_email = "Enter a valid email or leave blank";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setBusy(true);
    const payload = {
      name: f.name.trim(),
      code: f.code.trim().toUpperCase(),
      industry: f.industry?.trim() || null,
      contact_email: f.contact_email?.trim() || null,
      contact_phone: f.contact_phone?.trim() || null,
      address: f.address?.trim() || null,
    };
    try {
      if (editing) {
        await api.put(`/customers/${initial.id}`, payload);
        toast.success(`Updated ${payload.code}`);
      } else {
        await api.post(`/customers`, payload);
        toast.success(`Created ${payload.code}`);
      }
      onSaved?.();
      onClose();
    } catch (err) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      if (status === 409) toast.error(detail || "Duplicate customer code");
      else if (status === 403) toast.error("You don't have permission to do this");
      else if (status === 422) toast.error("Please check the highlighted fields");
      else toast.error(detail || "Failed to save customer");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" data-testid="customer-dialog">
      <div className="bg-card border border-border w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
              {editing ? "Edit" : "Create"}
            </div>
            <div className="display font-bold text-xl tracking-tight">
              {editing ? `Update ${initial.code}` : "New Customer"}
            </div>
          </div>
          <button onClick={onClose} data-testid="customer-dialog-close"
            className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10.5px] uppercase tracking-[0.15em] text-muted-foreground">Code *</label>
              <input
                data-testid="customer-code-input"
                value={f.code}
                onChange={(e) => upd("code", e.target.value.toUpperCase())}
                placeholder="SBS"
                className={`w-full mt-1 px-3 py-2 bg-muted/50 border rounded-md font-mono text-sm ${errors.code ? "border-destructive" : "border-border"}`}
              />
              {errors.code && <div className="text-xs text-destructive mt-1">{errors.code}</div>}
            </div>
            <div>
              <label className="text-[10.5px] uppercase tracking-[0.15em] text-muted-foreground">Industry</label>
              <input
                data-testid="customer-industry-input"
                value={f.industry || ""}
                onChange={(e) => upd("industry", e.target.value)}
                placeholder="Transport"
                className="w-full mt-1 px-3 py-2 bg-muted/50 border border-border rounded-md text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-[10.5px] uppercase tracking-[0.15em] text-muted-foreground">Name *</label>
            <input
              data-testid="customer-name-input"
              value={f.name}
              onChange={(e) => upd("name", e.target.value)}
              placeholder="SBS Transit Pte Ltd"
              className={`w-full mt-1 px-3 py-2 bg-muted/50 border rounded-md text-sm ${errors.name ? "border-destructive" : "border-border"}`}
            />
            {errors.name && <div className="text-xs text-destructive mt-1">{errors.name}</div>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10.5px] uppercase tracking-[0.15em] text-muted-foreground">Contact email</label>
              <input
                data-testid="customer-email-input"
                type="email"
                value={f.contact_email || ""}
                onChange={(e) => upd("contact_email", e.target.value)}
                placeholder="ops@example.com"
                className={`w-full mt-1 px-3 py-2 bg-muted/50 border rounded-md font-mono text-sm ${errors.contact_email ? "border-destructive" : "border-border"}`}
              />
              {errors.contact_email && <div className="text-xs text-destructive mt-1">{errors.contact_email}</div>}
            </div>
            <div>
              <label className="text-[10.5px] uppercase tracking-[0.15em] text-muted-foreground">Contact phone</label>
              <input
                data-testid="customer-phone-input"
                value={f.contact_phone || ""}
                onChange={(e) => upd("contact_phone", e.target.value)}
                placeholder="+65 6555 0100"
                className="w-full mt-1 px-3 py-2 bg-muted/50 border border-border rounded-md font-mono text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-[10.5px] uppercase tracking-[0.15em] text-muted-foreground">Address</label>
            <textarea
              data-testid="customer-address-input"
              rows={2}
              value={f.address || ""}
              onChange={(e) => upd("address", e.target.value)}
              placeholder="205 Braddell Rd, Singapore"
              className="w-full mt-1 px-3 py-2 bg-muted/50 border border-border rounded-md text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t border-border">
          <button onClick={onClose} data-testid="customer-cancel"
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button onClick={submit} disabled={busy} data-testid="customer-submit"
            className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50">
            {busy ? (editing ? "Saving…" : "Creating…") : (editing ? "Save changes" : "Create customer")}
          </button>
        </div>
      </div>
    </div>
  );
}
