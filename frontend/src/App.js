import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";
import Login from "@/pages/Login";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import RMAs from "@/pages/RMAs";
import Jobs from "@/pages/Jobs";
import JobDetail from "@/pages/JobDetail";
import Customers from "@/pages/Customers";
import Assets from "@/pages/Assets";
import Inventory from "@/pages/Inventory";
import CustomerPortal from "@/pages/CustomerPortal";

function Root() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "customer" ? "/portal" : "/app"} replace />;
}

function Guard({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={user.role === "customer" ? "/portal" : "/app"} replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Root />} />
          <Route path="/login" element={<Login />} />
          <Route path="/portal" element={<Guard roles={["customer"]}><CustomerPortal /></Guard>} />
          <Route path="/portal/jobs/:id" element={<Guard roles={["customer"]}><CustomerJobWrapper /></Guard>} />
          <Route path="/app" element={<Guard roles={["admin","coordinator","technician","qa"]}><Layout /></Guard>}>
            <Route index element={<Dashboard />} />
            <Route path="rmas" element={<RMAs />} />
            <Route path="rmas/:id" element={<RMADetailWrapper />} />
            <Route path="jobs" element={<Jobs />} />
            <Route path="jobs/:id" element={<JobDetail />} />
            <Route path="customers" element={<Customers />} />
            <Route path="assets" element={<Assets />} />
            <Route path="inventory" element={<Inventory />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </AuthProvider>
  );
}

// simple RMA detail — reuse JobDetail-style listing of its jobs
function RMADetailWrapper() {
  return <RMADetail />;
}
function CustomerJobWrapper() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <a href="/portal" className="text-sm text-primary hover:underline mb-4 inline-block" data-testid="back-to-portal">← Back to portal</a>
        <JobDetail />
      </div>
    </div>
  );
}

import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { StatusChip } from "@/components/StatusChip";

function RMADetail() {
  const { id } = useParams();
  const [r, setR] = useState(null);
  useEffect(() => { api.get(`/rmas/${id}`).then((res) => setR(res.data)); }, [id]);
  if (!r) return <div className="p-10 text-muted-foreground">Loading…</div>;
  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Return Authorization</div>
        <div className="flex items-center gap-4 mt-1 flex-wrap">
          <h1 className="display text-4xl font-black tracking-tighter mono">{r.rma_no}</h1>
          <StatusChip status={r.status} />
        </div>
        <div className="mt-2 text-sm text-muted-foreground">{r.customer?.name} · PO <span className="mono">{r.customer_po || "—"}</span></div>
      </div>
      <div className="bg-card border border-border">
        <table className="w-full data-table" data-testid="rma-detail-jobs">
          <thead><tr><th>Job No</th><th>ECU / Serial</th><th>Fault</th><th>Priority</th><th>Status</th></tr></thead>
          <tbody>
            {r.jobs.map((j) => (
              <tr key={j.id}>
                <td><Link to={`/app/jobs/${j.id}`} className="mono text-primary hover:underline">{j.job_no}</Link></td>
                <td><div className="text-sm">{j.ecu_type}</div><div className="mono text-[11px] text-muted-foreground">{j.serial_number}</div></td>
                <td className="text-sm max-w-xs truncate">{j.fault_description}</td>
                <td className="text-xs">{j.priority}</td>
                <td><StatusChip status={j.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
