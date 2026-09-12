import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import {
  Gauge, Users, Cpu, Package, ClipboardText, Wrench,
  SignOut, ShieldCheck, UsersFour,
} from "@phosphor-icons/react";

const NAV = [
  { to: "/app", label: "Dashboard", icon: Gauge, exact: true },
  { to: "/app/rmas", label: "RMAs", icon: ClipboardText },
  { to: "/app/jobs", label: "Repair Jobs", icon: Wrench },
  { to: "/app/customers", label: "Customers", icon: Users },
  { to: "/app/assets", label: "Assets", icon: Cpu },
  { to: "/app/inventory", label: "Inventory", icon: Package, roles: ["admin","coordinator","technician"] },
  { to: "/app/users", label: "Users", icon: UsersFour, roles: ["admin"] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const doLogout = () => { logout(); nav("/login"); };

  const visible = NAV.filter(n => !n.roles || n.roles.includes(user?.role));

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside data-testid="app-sidebar" className="w-60 border-r border-border bg-card flex flex-col shrink-0">
        <div className="h-16 flex items-center px-5 border-b border-border">
          <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center font-bold display text-lg">M</div>
          <div className="ml-3">
            <div className="display font-bold text-sm tracking-tight leading-none">MCONNECT</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-0.5">Repair Ops</div>
          </div>
        </div>
        <nav className="flex-1 py-4 px-2 space-y-0.5">
          {visible.map(({ to, label, icon: Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              data-testid={`nav-${label.toLowerCase().replace(/\s+/g,'-')}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors duration-100 ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`
              }
            >
              <Icon size={18} weight="duotone" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2 mb-3 px-2">
            <div className="w-8 h-8 bg-muted flex items-center justify-center text-xs font-semibold">
              {user?.name?.charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate" data-testid="current-user-name">{user?.name}</div>
              <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1">
                <ShieldCheck size={12} weight="duotone" /> {user?.role}
              </div>
            </div>
          </div>
          <button
            onClick={doLogout}
            data-testid="logout-btn"
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors duration-100"
          >
            <SignOut size={16} weight="duotone" /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
