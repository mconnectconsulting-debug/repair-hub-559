import React from "react";
import { STATUS_COLORS } from "@/lib/api";

export const StatusChip = ({ status, testid }) => (
  <span
    data-testid={testid || `status-chip-${status}`}
    className={`status-chip border ${STATUS_COLORS[status] || "bg-zinc-500/10 text-zinc-500 border-zinc-500/30"}`}
  >
    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
    {status}
  </span>
);
