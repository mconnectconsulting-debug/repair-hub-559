import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, LIFECYCLE } from "@/lib/api";
import { StatusChip } from "@/components/StatusChip";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { CheckCircle, Circle, Clock } from "@phosphor-icons/react";

const Section = ({ title, children, action }) => (
  <div className="bg-card border border-border">
    <div className="flex items-center justify-between p-5 border-b border-border">
      <div className="display font-bold tracking-tight text-sm uppercase">{title}</div>
      {action}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

export default function JobDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [job, setJob] = useState(null);
  const [techs, setTechs] = useState([]);
  const load = useCallback(() => api.get(`/jobs/${id}`).then((r) => setJob(r.data)), [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (["admin","coordinator"].includes(user?.role))
      api.get("/users").then((r) => setTechs(r.data.filter((u) => u.role === "technician")));
  }, [user]);

  if (!job) return <div className="p-10 text-muted-foreground">Loading…</div>;

  const canWork = ["admin","coordinator","technician","qa"].includes(user?.role);
  const isCust = user?.role === "customer";

  const act = async (path, body) => {
    try {
      await api.post(`/jobs/${id}${path}`, body || {});
      toast.success("Updated");
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  const currentIdx = LIFECYCLE.indexOf(job.status);

  return (
    <div className="p-8 space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Repair Job</div>
        <div className="flex items-center gap-4 mt-1 flex-wrap">
          <h1 className="display text-4xl font-black tracking-tighter mono">{job.job_no}</h1>
          <StatusChip status={job.status} />
        </div>
        <div className="mt-2 text-sm text-muted-foreground">
          RMA <span className="mono">{job.rma_no}</span> · {job.customer?.name}
        </div>
      </div>

      <div className="bg-card border border-border p-6 overflow-x-auto">
        <div className="flex items-start min-w-max gap-1">
          {LIFECYCLE.map((s, i) => {
            const done = i < currentIdx;
            const active = i === currentIdx;
            return (
              <React.Fragment key={s}>
                <div className="flex flex-col items-center min-w-[92px]">
                  {done ? <CheckCircle size={22} weight="fill" className="text-primary" />
                    : active ? <Clock size={22} weight="fill" className="text-amber-500" />
                    : <Circle size={22} className="text-muted-foreground/40" />}
                  <div className={`mt-2 text-[10.5px] uppercase tracking-wider text-center font-mono ${active ? "text-foreground font-semibold" : done ? "text-primary" : "text-muted-foreground"}`}>
                    {s}
                  </div>
                </div>
                {i < LIFECYCLE.length - 1 && (
                  <div className={`h-0.5 flex-1 mt-[10px] ${i < currentIdx ? "bg-primary" : "bg-border"}`} style={{ minWidth: 28 }}/>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Section title="Fault Report">
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div><div className="text-[10.5px] uppercase tracking-widest text-muted-foreground">ECU</div><div>{job.ecu_type} · {job.manufacturer}</div></div>
              <div><div className="text-[10.5px] uppercase tracking-widest text-muted-foreground">Part / Serial</div><div className="mono">{job.part_number} / {job.serial_number}</div></div>
              <div><div className="text-[10.5px] uppercase tracking-widest text-muted-foreground">Priority</div><div>{job.priority}</div></div>
              <div><div className="text-[10.5px] uppercase tracking-widest text-muted-foreground">Assigned</div><div>{job.assigned_name || "—"}</div></div>
            </div>
            <div className="mt-4 pt-4 border-t border-border">
              <div className="text-[10.5px] uppercase tracking-widest text-muted-foreground mb-1">Fault Description</div>
              <div className="text-sm">{job.fault_description}</div>
            </div>
          </Section>

          {job.assessment ? (
            <Section title="Assessment">
              <div className="space-y-3 text-sm">
                <Field label="Diagnosis" value={job.assessment.diagnosis} />
                <Field label="Root Cause" value={job.assessment.root_cause} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Visual" value={job.assessment.visual_check} />
                  <Field label="Electrical" value={job.assessment.electrical_check} />
                  <Field label="PCB" value={job.assessment.pcb_check} />
                  <Field label="Comms" value={job.assessment.comms_check} />
                </div>
                <div className="pt-3 border-t border-border text-xs text-muted-foreground mono">
                  Outcome: {job.assessment.outcome} · By {job.assessment.by}
                </div>
              </div>
            </Section>
          ) : canWork && ["Received","Submitted","Assessment"].includes(job.status) && (
            <AssessmentForm onSubmit={(v) => act("/assessment", v)} />
          )}

          {job.quote && <QuoteView quote={job.quote} onDecide={(d) => act("/quote/decide", d)} canDecide={isCust || ["admin","coordinator"].includes(user?.role)} />}

          {!job.quote && canWork && job.assessment?.outcome === "Repairable" && (
            <QuoteForm onSubmit={(v) => act("/quote", v)} />
          )}

          {job.tests?.length > 0 && (
            <Section title="Testing">
              <div className="space-y-2 text-sm">
                {job.tests.map((t, i) => (
                  <div key={i} className="flex items-center justify-between border border-border p-3">
                    <div>
                      <div className="font-medium">{t.test_type}</div>
                      <div className="text-xs text-muted-foreground mono">{t.procedure} · by {t.by}</div>
                    </div>
                    <StatusChip status={t.result === "Pass" ? "Ready for Dispatch" : "BER"} />
                  </div>
                ))}
              </div>
            </Section>
          )}
          {canWork && job.status === "Repair In Progress" && (
            <TestForm onSubmit={(v) => act("/test", v)} />
          )}

          {job.qa && (
            <Section title="Quality Assurance">
              <div className="text-sm space-y-2">
                <div>Result: <StatusChip status={job.qa.result === "Pass" ? "Ready for Dispatch" : "BER"} /></div>
                <div className="text-xs text-muted-foreground">By {job.qa.by} — {job.qa.comments || "No comments"}</div>
              </div>
            </Section>
          )}
          {canWork && job.status === "QA" && ["admin","qa"].includes(user?.role) && (
            <QAForm onSubmit={(v) => act("/qa", v)} />
          )}

          {job.dispatch && (
            <Section title="Dispatch">
              <div className="text-sm">
                <div>{job.dispatch.courier} · <span className="mono">{job.dispatch.tracking_no}</span></div>
                <div className="text-xs text-muted-foreground mt-1">{job.dispatch.delivery_notes}</div>
              </div>
            </Section>
          )}
          {canWork && job.status === "Ready for Dispatch" && ["admin","coordinator"].includes(user?.role) && (
            <DispatchForm onSubmit={(v) => act("/dispatch", v)} />
          )}
        </div>

        <div className="space-y-6">
          <Section title="Actions">
            <div className="space-y-2">
              {job.status === "Submitted" && ["admin","coordinator","technician"].includes(user?.role) && (
                <button onClick={() => act("/receive")} data-testid="action-receive" className="w-full py-2 bg-primary text-primary-foreground rounded-md text-sm">Mark Received</button>
              )}
              {!job.assigned_to && ["admin","coordinator"].includes(user?.role) && techs.length > 0 && (
                <div>
                  <label className="text-[10.5px] uppercase tracking-widest text-muted-foreground">Assign Technician</label>
                  <select onChange={(e) => e.target.value && act("/assign", { technician_id: e.target.value })} data-testid="action-assign"
                    className="w-full mt-1 px-3 py-2 bg-muted/50 border border-border rounded-md text-sm">
                    <option value="">Select…</option>
                    {techs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}
              {job.status === "Dispatched" && ["admin","coordinator"].includes(user?.role) && (
                <button onClick={() => act("/close")} data-testid="action-close" className="w-full py-2 bg-primary text-primary-foreground rounded-md text-sm">Close Job</button>
              )}
            </div>
          </Section>

          <Section title="Activity Log">
            <div className="space-y-3">
              {job.events?.map((e) => (
                <div key={e.id} className="border-l-2 border-primary/40 pl-3 py-1">
                  <div className="text-sm font-medium">{e.event}</div>
                  {e.note && <div className="text-xs text-muted-foreground">{e.note}</div>}
                  <div className="text-[10.5px] uppercase tracking-widest text-muted-foreground mono mt-1">
                    {new Date(e.at).toLocaleString("en-SG")} · {e.user_name}
                  </div>
                </div>
              ))}
              {(!job.events || job.events.length === 0) && <div className="text-xs text-muted-foreground">No events yet</div>}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

const Field = ({ label, value }) => (
  <div><div className="text-[10.5px] uppercase tracking-widest text-muted-foreground">{label}</div><div className="text-sm">{value}</div></div>
);

function AssessmentForm({ onSubmit }) {
  const [f, setF] = useState({
    visual_check: "", electrical_check: "", pcb_check: "", comms_check: "",
    diagnosis: "", root_cause: "", outcome: "Repairable", estimated_hours: 2,
  });
  const upd = (k, v) => setF({ ...f, [k]: v });
  return (
    <Section title="Complete Assessment">
      <div className="grid grid-cols-2 gap-3">
        {[["visual_check","Visual"],["electrical_check","Electrical"],["pcb_check","PCB"],["comms_check","Comms"]].map(([k,l]) => (
          <textarea key={k} placeholder={l} rows={2} value={f[k]} onChange={(e) => upd(k, e.target.value)}
            className="px-2 py-1.5 bg-muted/50 border border-border rounded text-sm" data-testid={`assess-${k}`} />
        ))}
      </div>
      <textarea placeholder="Diagnosis" rows={2} value={f.diagnosis} onChange={(e) => upd("diagnosis", e.target.value)}
        className="w-full mt-3 px-2 py-1.5 bg-muted/50 border border-border rounded text-sm" data-testid="assess-diagnosis" />
      <textarea placeholder="Root cause" rows={2} value={f.root_cause} onChange={(e) => upd("root_cause", e.target.value)}
        className="w-full mt-3 px-2 py-1.5 bg-muted/50 border border-border rounded text-sm" data-testid="assess-root" />
      <div className="grid grid-cols-2 gap-3 mt-3">
        <select value={f.outcome} onChange={(e) => upd("outcome", e.target.value)}
          className="px-2 py-1.5 bg-muted/50 border border-border rounded text-sm" data-testid="assess-outcome">
          {["Repairable","Refurbishable","Further Diagnosis","BER","Not Repairable","NFF"].map(o => <option key={o}>{o}</option>)}
        </select>
        <input type="number" step="0.5" placeholder="Est. hours" value={f.estimated_hours}
          onChange={(e) => upd("estimated_hours", parseFloat(e.target.value))}
          className="px-2 py-1.5 bg-muted/50 border border-border rounded font-mono text-sm" />
      </div>
      <button onClick={() => onSubmit(f)} data-testid="assess-submit"
        className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">Save Assessment</button>
    </Section>
  );
}

function QuoteForm({ onSubmit }) {
  const [lines, setLines] = useState([{ description: "Skilled labour", qty: 2, unit_price: 85, line_type: "Labour" }]);
  const upd = (i, k, v) => setLines(lines.map((l, idx) => idx === i ? { ...l, [k]: k === "qty" || k === "unit_price" ? parseFloat(v||0) : v } : l));
  const total = lines.reduce((s, l) => s + l.qty * l.unit_price, 0);
  return (
    <Section title="Build Quotation">
      <div className="space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-center">
            <input value={l.description} onChange={(e) => upd(i,"description",e.target.value)}
              placeholder="Description" className="col-span-5 px-2 py-1.5 bg-muted/50 border border-border rounded text-sm" />
            <select value={l.line_type} onChange={(e) => upd(i,"line_type",e.target.value)}
              className="col-span-2 px-2 py-1.5 bg-muted/50 border border-border rounded text-sm">
              {["Part","Labour","Fee"].map(t => <option key={t}>{t}</option>)}
            </select>
            <input type="number" value={l.qty} onChange={(e) => upd(i,"qty",e.target.value)}
              className="col-span-2 px-2 py-1.5 bg-muted/50 border border-border rounded font-mono text-sm" />
            <input type="number" value={l.unit_price} onChange={(e) => upd(i,"unit_price",e.target.value)}
              className="col-span-3 px-2 py-1.5 bg-muted/50 border border-border rounded font-mono text-sm" />
          </div>
        ))}
      </div>
      <button onClick={() => setLines([...lines, { description: "", qty: 1, unit_price: 0, line_type: "Part" }])}
        className="mt-2 text-xs text-primary hover:underline">+ Add line</button>
      <div className="mt-4 flex items-center justify-between pt-3 border-t border-border">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Subtotal (before tax)</div>
        <div className="mono font-bold text-lg">${total.toFixed(2)}</div>
      </div>
      <button onClick={() => onSubmit({ lines, tax_percent: 9, warranty_months: 6, valid_days: 30 })}
        data-testid="quote-submit"
        className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">Issue Quotation</button>
    </Section>
  );
}

function QuoteView({ quote, onDecide, canDecide }) {
  return (
    <Section title={`Quotation ${quote.quote_no}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b border-border">
            <th className="pb-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">Item</th>
            <th className="pb-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">Type</th>
            <th className="pb-2 font-medium text-muted-foreground text-xs uppercase tracking-wider text-right">Qty</th>
            <th className="pb-2 font-medium text-muted-foreground text-xs uppercase tracking-wider text-right">Unit</th>
            <th className="pb-2 font-medium text-muted-foreground text-xs uppercase tracking-wider text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {quote.lines.map((l, i) => (
            <tr key={i} className="border-b border-border">
              <td className="py-2">{l.description}</td>
              <td className="py-2 text-xs text-muted-foreground">{l.line_type}</td>
              <td className="py-2 text-right mono">{l.qty}</td>
              <td className="py-2 text-right mono">${l.unit_price.toFixed(2)}</td>
              <td className="py-2 text-right mono">${(l.qty*l.unit_price).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex justify-end">
        <div className="text-right space-y-1 mono">
          <div className="text-sm text-muted-foreground">Subtotal <span className="ml-4">${quote.subtotal.toFixed(2)}</span></div>
          <div className="text-sm text-muted-foreground">GST {quote.tax_percent}% <span className="ml-4">${quote.tax.toFixed(2)}</span></div>
          <div className="text-lg font-bold border-t border-border pt-1">Total <span className="ml-4">${quote.total.toFixed(2)}</span></div>
        </div>
      </div>
      {quote.decision ? (
        <div className="mt-4 pt-3 border-t border-border text-sm">
          Decision: <span className={quote.decision === "Approved" ? "text-emerald-500" : "text-red-500"}>{quote.decision}</span>
          <span className="text-muted-foreground ml-2 text-xs">by {quote.decision_by}</span>
        </div>
      ) : canDecide && (
        <div className="mt-4 pt-3 border-t border-border flex gap-2">
          <button onClick={() => onDecide({ decision: "Approved", customer_po: "PO-" + Date.now() })}
            data-testid="quote-approve"
            className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm">Approve</button>
          <button onClick={() => onDecide({ decision: "Rejected" })} data-testid="quote-reject"
            className="px-4 py-2 border border-border text-sm rounded-md">Reject</button>
        </div>
      )}
    </Section>
  );
}

function TestForm({ onSubmit }) {
  const [f, setF] = useState({ test_type: "Functional", procedure: "TP-FUNC-01", parameters: "", result: "Pass", remarks: "" });
  return (
    <Section title="Record Test">
      <div className="grid grid-cols-2 gap-3">
        <input value={f.test_type} onChange={(e) => setF({...f, test_type: e.target.value})} placeholder="Test type"
          className="px-2 py-1.5 bg-muted/50 border border-border rounded text-sm" data-testid="test-type" />
        <input value={f.procedure} onChange={(e) => setF({...f, procedure: e.target.value})} placeholder="Procedure"
          className="px-2 py-1.5 bg-muted/50 border border-border rounded font-mono text-sm" />
      </div>
      <select value={f.result} onChange={(e) => setF({...f, result: e.target.value})}
        className="w-full mt-3 px-2 py-1.5 bg-muted/50 border border-border rounded text-sm" data-testid="test-result">
        <option>Pass</option><option>Fail</option>
      </select>
      <button onClick={() => onSubmit(f)} data-testid="test-submit"
        className="mt-3 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">Save Test</button>
    </Section>
  );
}

function QAForm({ onSubmit }) {
  const [f, setF] = useState({ workmanship_ok: true, docs_complete: true, test_review_ok: true, result: "Pass", comments: "" });
  return (
    <Section title="QA Review">
      <div className="space-y-2 text-sm">
        {[["workmanship_ok","Workmanship OK"],["docs_complete","Docs complete"],["test_review_ok","Test review OK"]].map(([k,l]) => (
          <label key={k} className="flex items-center gap-2">
            <input type="checkbox" checked={f[k]} onChange={(e) => setF({...f, [k]: e.target.checked})} />
            {l}
          </label>
        ))}
        <textarea placeholder="Comments" value={f.comments} onChange={(e) => setF({...f, comments: e.target.value})}
          className="w-full mt-2 px-2 py-1.5 bg-muted/50 border border-border rounded text-sm" rows={2} />
        <select value={f.result} onChange={(e) => setF({...f, result: e.target.value})}
          className="px-2 py-1.5 bg-muted/50 border border-border rounded text-sm" data-testid="qa-result">
          <option>Pass</option><option>Fail</option>
        </select>
      </div>
      <button onClick={() => onSubmit(f)} data-testid="qa-submit"
        className="mt-3 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">Submit QA</button>
    </Section>
  );
}

function DispatchForm({ onSubmit }) {
  const [f, setF] = useState({ courier: "DHL", tracking_no: "", delivery_notes: "" });
  return (
    <Section title="Dispatch">
      <div className="grid grid-cols-2 gap-3">
        <input value={f.courier} onChange={(e) => setF({...f, courier: e.target.value})} placeholder="Courier"
          className="px-2 py-1.5 bg-muted/50 border border-border rounded text-sm" data-testid="dispatch-courier" />
        <input value={f.tracking_no} onChange={(e) => setF({...f, tracking_no: e.target.value})} placeholder="Tracking No"
          className="px-2 py-1.5 bg-muted/50 border border-border rounded font-mono text-sm" data-testid="dispatch-tracking" />
      </div>
      <button onClick={() => onSubmit(f)} data-testid="dispatch-submit"
        className="mt-3 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">Dispatch</button>
    </Section>
  );
}
