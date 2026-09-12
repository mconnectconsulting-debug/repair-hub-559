import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Plus, PencilSimple, Power } from "@phosphor-icons/react";
import UserDialog from "@/components/UserDialog";

const ROLE_LABEL = {
  admin: "Admin", coordinator: "Coordinator", technician: "Technician",
  qa: "QA", customer: "Customer",
};

export default function Users() {
  const { user: me } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [customers, setCustomers] = useState([]);

  const load = () => {
    setLoading(true);
    api.get("/users")
      .then((r) => setRows(r.data))
      .catch(() => toast.error("Failed to load users"))
      .finally(() => setLoading(false));
    api.get("/customers").then((r) => setCustomers(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (u) => { setEditing(u); setDialogOpen(true); };

  const toggleActive = async (u) => {
    try {
      await api.put(`/users/${u.id}`, { is_active: !u.is_active });
      toast.success(`${u.email} ${u.is_active ? "deactivated" : "activated"}`);
      load();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(detail || "Failed to update status");
    }
  };

  const custName = (id) => {
    const c = customers.find((x) => x.id === id);
    return c ? `${c.code} — ${c.name}` : "—";
  };

  const filtered = filter ? rows.filter((u) => u.role === filter) : rows;

  return (
    <div className="p-8">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Administration</div>
          <h1 className="display text-4xl font-black tracking-tighter mt-1">Users</h1>
        </div>
        <button
          data-testid="new-user-btn"
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors duration-100"
        >
          <Plus size={16} weight="bold" /> New User
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button onClick={() => setFilter("")} data-testid="user-filter-all"
          className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider border rounded-md ${filter === "" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
          All ({rows.length})
        </button>
        {Object.keys(ROLE_LABEL).map((r) => (
          <button key={r} onClick={() => setFilter(r)} data-testid={`user-filter-${r}`}
            className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider border rounded-md ${filter === r ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
            {ROLE_LABEL[r]} ({rows.filter((u) => u.role === r).length})
          </button>
        ))}
      </div>

      <div className="bg-card border border-border">
        <table className="w-full data-table" data-testid="users-table">
          <thead>
            <tr>
              <th>Email</th><th>Name</th><th>Role</th><th>Linked Customer</th><th>Status</th><th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const isMe = u.id === me?.id;
              return (
                <tr key={u.id} data-testid={`user-row-${u.email}`}>
                  <td className="mono text-primary">{u.email}</td>
                  <td className="font-medium">
                    {u.name}
                    {isMe && <span className="ml-2 text-[10px] uppercase tracking-widest text-muted-foreground">(you)</span>}
                  </td>
                  <td>
                    <span className="text-xs font-mono uppercase tracking-wider">{ROLE_LABEL[u.role] || u.role}</span>
                  </td>
                  <td className="text-sm text-muted-foreground">
                    {u.role === "customer" ? custName(u.customer_id) : "—"}
                  </td>
                  <td>
                    <span className={`status-chip border ${u.is_active ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" : "bg-zinc-500/10 text-zinc-500 border-zinc-500/30"}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                      {u.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        data-testid={`user-edit-${u.email}`}
                        onClick={() => openEdit(u)}
                        title="Edit"
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors duration-100"
                      >
                        <PencilSimple size={16} weight="duotone" />
                      </button>
                      <button
                        data-testid={`user-toggle-${u.email}`}
                        onClick={() => toggleActive(u)}
                        disabled={isMe}
                        title={isMe ? "You cannot deactivate yourself" : (u.is_active ? "Deactivate" : "Activate")}
                        className={`p-1.5 rounded-md transition-colors duration-100 ${
                          isMe
                            ? "text-muted-foreground/40 cursor-not-allowed"
                            : u.is_active
                              ? "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              : "text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10"
                        }`}
                      >
                        <Power size={16} weight="duotone" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center text-muted-foreground py-12">No users match this filter</td></tr>
            )}
            {loading && (
              <tr><td colSpan={6} className="text-center text-muted-foreground py-12">Loading…</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <UserDialog
        open={dialogOpen}
        initial={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={load}
      />
    </div>
  );
}
