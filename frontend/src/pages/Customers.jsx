import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Plus, PencilSimple, Trash, X } from "@phosphor-icons/react";
import CustomerDialog from "@/components/CustomerDialog";

export default function Customers() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const canManage = ["admin", "coordinator"].includes(user?.role);
  const canDelete = user?.role === "admin";

  const load = () => {
    setLoading(true);
    api.get("/customers")
      .then((r) => setRows(r.data))
      .catch(() => toast.error("Failed to load customers"))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (c) => { setEditing(c); setDialogOpen(true); };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await api.delete(`/customers/${deleteTarget.id}`);
      toast.success(`Deleted ${deleteTarget.code}`);
      setDeleteTarget(null);
      load();
    } catch (err) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      if (status === 409) toast.error(detail || "Customer has linked records and cannot be deleted");
      else if (status === 403) toast.error("Only admin can delete customers");
      else if (status === 404) toast.error("Customer not found");
      else toast.error(detail || "Delete failed");
    } finally { setDeleteBusy(false); }
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Directory</div>
          <h1 className="display text-4xl font-black tracking-tighter mt-1">Customers</h1>
        </div>
        {canManage && (
          <button
            data-testid="new-customer-btn"
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors duration-100"
          >
            <Plus size={16} weight="bold" /> New Customer
          </button>
        )}
      </div>

      <div className="bg-card border border-border">
        <table className="w-full data-table" data-testid="customers-table">
          <thead>
            <tr>
              <th>Code</th><th>Name</th><th>Industry</th><th>Contact</th><th>Address</th>
              {canManage && <th className="text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} data-testid={`customer-row-${c.code}`}>
                <td className="mono text-primary">{c.code}</td>
                <td className="font-medium">{c.name}</td>
                <td className="text-sm text-muted-foreground">{c.industry}</td>
                <td className="text-sm mono">{c.contact_email}</td>
                <td className="text-sm text-muted-foreground">{c.address}</td>
                {canManage && (
                  <td className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        data-testid={`customer-edit-${c.code}`}
                        onClick={() => openEdit(c)}
                        title="Edit"
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors duration-100"
                      >
                        <PencilSimple size={16} weight="duotone" />
                      </button>
                      {canDelete && (
                        <button
                          data-testid={`customer-delete-${c.code}`}
                          onClick={() => setDeleteTarget(c)}
                          title="Delete"
                          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors duration-100"
                        >
                          <Trash size={16} weight="duotone" />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={canManage ? 6 : 5} className="text-center text-muted-foreground py-12">No customers yet</td></tr>
            )}
            {loading && (
              <tr><td colSpan={canManage ? 6 : 5} className="text-center text-muted-foreground py-12">Loading…</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <CustomerDialog
        open={dialogOpen}
        initial={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={load}
      />

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" data-testid="customer-delete-dialog">
          <div className="bg-card border border-border w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <div className="text-[10.5px] uppercase tracking-[0.2em] text-destructive">Delete customer</div>
                <div className="display font-bold text-xl tracking-tight">Are you sure?</div>
              </div>
              <button onClick={() => setDeleteTarget(null)} className="text-muted-foreground hover:text-foreground">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 text-sm">
              This will permanently remove <span className="font-medium">{deleteTarget.name}</span>{" "}
              (<span className="mono text-primary">{deleteTarget.code}</span>). The action cannot be undone.
              If this customer has any linked depots, vehicles, assets, RMAs, jobs, or users, the deletion will be blocked.
            </div>
            <div className="flex items-center justify-end gap-2 p-5 border-t border-border">
              <button onClick={() => setDeleteTarget(null)} data-testid="customer-delete-cancel"
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
              <button
                data-testid="customer-delete-confirm"
                onClick={confirmDelete}
                disabled={deleteBusy}
                className="px-4 py-2 bg-destructive text-destructive-foreground text-sm font-medium rounded-md hover:bg-destructive/90 disabled:opacity-50"
              >
                {deleteBusy ? "Deleting…" : "Delete customer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
