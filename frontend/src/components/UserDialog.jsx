import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { X, Key } from "@phosphor-icons/react";

const ROLES = ["admin", "coordinator", "technician", "qa", "customer"];
const BLANK = {
  email: "", name: "", role: "technician", password: "",
  customer_id: "", is_active: true,
};

export default function UserDialog({ open, onClose, onSaved, initial }) {
  const editing = !!initial?.id;
  const [f, setF] = useState(BLANK);
  const [customers, setCustomers] = useState([]);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [newPw, setNewPw] = useState("");

  useEffect(() => {
    if (!open) return;
    setResetMode(false);
    setNewPw("");
    setErrors({});
    setF(initial ? {
      email: initial.email || "",
      name: initial.name || "",
      role: initial.role || "technician",
      password: "",
      customer_id: initial.customer_id || "",
      is_active: initial.is_active !== false,
    } : BLANK);
    api.get("/customers").then((r) => setCustomers(r.data)).catch(() => {});
  }, [open, initial]);

  if (!open) return null;

  const upd = (k, v) => {
    setF((prev) => ({ ...prev, [k]: v }));
    if (errors[k]) setErrors((prev) => ({ ...prev, [k]: null }));
  };

  const validate = () => {
    const e = {};
    if (!f.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = "Enter a valid email";
    if (!f.name || f.name.trim().length < 2) e.name = "Name is required (min 2 chars)";
    if (!ROLES.includes(f.role)) e.role = "Invalid role";
    if (!editing && (!f.password || f.password.length < 6)) e.password = "Password must be at least 6 chars";
    if (f.role === "customer" && !f.customer_id) e.customer_id = "Select a customer";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      if (editing) {
        const payload = {
          email: f.email.toLowerCase().trim(),
          name: f.name.trim(),
          role: f.role,
          customer_id: f.role === "customer" ? f.customer_id : null,
          is_active: f.is_active,
        };
        await api.put(`/users/${initial.id}`, payload);
        toast.success(`Updated ${payload.email}`);
      } else {
        const payload = {
          email: f.email.toLowerCase().trim(),
          name: f.name.trim(),
          role: f.role,
          password: f.password,
          customer_id: f.role === "customer" ? f.customer_id : null,
          is_active: f.is_active,
        };
        await api.post(`/users`, payload);
        toast.success(`Created ${payload.email}`);
      }
      onSaved?.();
      onClose();
    } catch (err) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      if (status === 409) toast.error(detail || "Duplicate user");
      else if (status === 403) toast.error("Only admin can manage users");
      else if (status === 400) toast.error(detail || "Invalid request");
      else if (status === 422) toast.error("Please check the highlighted fields");
      else toast.error(detail || "Failed to save user");
    } finally { setBusy(false); }
  };

  const resetPassword = async () => {
    if (!newPw || newPw.length < 6) {
      toast.error("Password must be at least 6 chars");
      return;
    }
    setBusy(true);
    try {
      await api.post(`/users/${initial.id}/reset-password`, { password: newPw });
      toast.success("Password reset");
      setResetMode(false);
      setNewPw("");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to reset password");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" data-testid="user-dialog">
      <div className="bg-card border border-border w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
              {editing ? "Edit" : "Create"}
            </div>
            <div className="display font-bold text-xl tracking-tight">
              {editing ? `Update ${initial.email}` : "New User"}
            </div>
          </div>
          <button onClick={onClose} data-testid="user-dialog-close"
            className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-[10.5px] uppercase tracking-[0.15em] text-muted-foreground">Email *</label>
            <input
              data-testid="user-email-input"
              type="email"
              value={f.email}
              onChange={(e) => upd("email", e.target.value)}
              placeholder="user@company.com"
              className={`w-full mt-1 px-3 py-2 bg-muted/50 border rounded-md font-mono text-sm ${errors.email ? "border-destructive" : "border-border"}`}
            />
            {errors.email && <div className="text-xs text-destructive mt-1">{errors.email}</div>}
          </div>

          <div>
            <label className="text-[10.5px] uppercase tracking-[0.15em] text-muted-foreground">Name *</label>
            <input
              data-testid="user-name-input"
              value={f.name}
              onChange={(e) => upd("name", e.target.value)}
              placeholder="Full name"
              className={`w-full mt-1 px-3 py-2 bg-muted/50 border rounded-md text-sm ${errors.name ? "border-destructive" : "border-border"}`}
            />
            {errors.name && <div className="text-xs text-destructive mt-1">{errors.name}</div>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10.5px] uppercase tracking-[0.15em] text-muted-foreground">Role *</label>
              <select
                data-testid="user-role-select"
                value={f.role}
                onChange={(e) => upd("role", e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-muted/50 border border-border rounded-md text-sm"
              >
                {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10.5px] uppercase tracking-[0.15em] text-muted-foreground">Status</label>
              <div className="mt-1 flex items-center gap-3 h-9">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    data-testid="user-active-checkbox"
                    type="checkbox"
                    checked={f.is_active}
                    onChange={(e) => upd("is_active", e.target.checked)}
                  />
                  {f.is_active ? "Active" : "Inactive"}
                </label>
              </div>
            </div>
          </div>

          {f.role === "customer" && (
            <div>
              <label className="text-[10.5px] uppercase tracking-[0.15em] text-muted-foreground">Linked customer *</label>
              <select
                data-testid="user-customer-select"
                value={f.customer_id || ""}
                onChange={(e) => upd("customer_id", e.target.value)}
                className={`w-full mt-1 px-3 py-2 bg-muted/50 border rounded-md text-sm ${errors.customer_id ? "border-destructive" : "border-border"}`}
              >
                <option value="">Select customer…</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
              </select>
              {errors.customer_id && <div className="text-xs text-destructive mt-1">{errors.customer_id}</div>}
            </div>
          )}

          {!editing && (
            <div>
              <label className="text-[10.5px] uppercase tracking-[0.15em] text-muted-foreground">Password *</label>
              <input
                data-testid="user-password-input"
                type="password"
                value={f.password}
                onChange={(e) => upd("password", e.target.value)}
                placeholder="Minimum 6 characters"
                className={`w-full mt-1 px-3 py-2 bg-muted/50 border rounded-md font-mono text-sm ${errors.password ? "border-destructive" : "border-border"}`}
              />
              {errors.password && <div className="text-xs text-destructive mt-1">{errors.password}</div>}
            </div>
          )}

          {editing && (
            <div className="pt-3 border-t border-border">
              {resetMode ? (
                <div className="space-y-2">
                  <label className="text-[10.5px] uppercase tracking-[0.15em] text-muted-foreground">New password</label>
                  <div className="flex gap-2">
                    <input
                      data-testid="user-new-password-input"
                      type="password"
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="flex-1 px-3 py-2 bg-muted/50 border border-border rounded-md font-mono text-sm"
                    />
                    <button onClick={resetPassword} data-testid="user-reset-password-confirm" disabled={busy}
                      className="px-3 py-2 bg-primary text-primary-foreground text-sm rounded-md">Set</button>
                    <button onClick={() => { setResetMode(false); setNewPw(""); }}
                      className="px-3 py-2 border border-border text-sm rounded-md">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setResetMode(true)} data-testid="user-reset-password-btn"
                  className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <Key size={14} weight="duotone" /> Reset password
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t border-border">
          <button onClick={onClose} data-testid="user-cancel"
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button onClick={submit} disabled={busy} data-testid="user-submit"
            className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50">
            {busy ? (editing ? "Saving…" : "Creating…") : (editing ? "Save changes" : "Create user")}
          </button>
        </div>
      </div>
    </div>
  );
}
