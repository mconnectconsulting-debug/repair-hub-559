import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("mc_token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

export const STATUS_COLORS = {
  Draft: "bg-zinc-500/10 text-zinc-500 border-zinc-500/30",
  Submitted: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  Received: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  Assessment: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  "Awaiting Approval": "bg-orange-500/10 text-orange-500 border-orange-500/30",
  "Repair In Progress": "bg-violet-500/10 text-violet-500 border-violet-500/30",
  Testing: "bg-cyan-500/10 text-cyan-500 border-cyan-500/30",
  QA: "bg-cyan-500/10 text-cyan-500 border-cyan-500/30",
  "Ready for Dispatch": "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  Dispatched: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  Closed: "bg-teal-500/10 text-teal-500 border-teal-500/30",
  Cancelled: "bg-red-500/10 text-red-500 border-red-500/30",
  BER: "bg-red-500/10 text-red-500 border-red-500/30",
};

export const LIFECYCLE = [
  "Submitted", "Received", "Assessment", "Awaiting Approval",
  "Repair In Progress", "Testing", "QA", "Ready for Dispatch",
  "Dispatched", "Closed",
];
