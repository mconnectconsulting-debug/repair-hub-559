# MConnect Repair Services Management CRM — PRD

## Problem Statement
Build a full-stack repair-management CRM based on MConnect V1 (scope) and V2 (build spec). Manages the end-to-end repair lifecycle of ECUs / repairable electronic components, with serial-level traceability, workshop execution, quality assurance, dispatch, customer portal, and management analytics.

## Architecture
- **Backend**: FastAPI + Motor (MongoDB). JWT auth (Bearer). Role-based access via `require_roles`. Automatic idempotent seed on startup when users collection is empty.
- **Frontend**: React 19 + React Router 7 + Tailwind + Shadcn UI + Recharts + Phosphor Icons + Sonner. Axios client with token interceptor. Space Grotesk (display) / IBM Plex Sans (body) / IBM Plex Mono (identifiers).
- **Deployment**: Backend on `0.0.0.0:8001` under supervisor. All API routes prefixed `/api`. Frontend uses `REACT_APP_BACKEND_URL` from env.

## User Personas
- **Admin** — full access, configuration
- **Coordinator** — customer/RMA/dispatch flow, quotations
- **Technician** — assigned jobs, assessment, repair, testing
- **QA Approver** — quality release, cannot self-approve
- **Customer** — portal-only, tenant-scoped (submit RMA, approve quotes, track status)

## Implemented (2026-02)
- JWT auth with 5 seeded roles; login page with quick demo access
- Sidebar-based internal CRM app + separate light-themed customer portal
- Customers / Depots / Vehicles / Assets registry with serial-level tracking
- RMA creation (multi-item) → auto-generates repair job per unit → reuses existing asset by serial
- Repair Job lifecycle: Submitted → Received → Assessment → Awaiting Approval → Repair In Progress → Testing → QA → Ready for Dispatch → Dispatched → Closed
- Assessment form with 4 checks + diagnosis/root cause + outcome (Repairable/Refurbishable/BER/NFF/etc.)
- Quotation builder with parts/labour/fee lines, GST, revisions, customer-approval workflow
- Testing entries (Pass returns to QA, Fail loops back to repair)
- QA checklist with cross-role guard (technician cannot self-approve)
- Dispatch record + Close job
- Inventory master + stock transactions (Receipt / Issue / Return / Adjustment) with negative-stock guard
- Dashboard: 6 KPI metrics, status-pipeline bar chart, recent jobs
- Customer Portal: metric cards, pending-quote approval banner, all jobs history, submit new RMA
- Full activity/event log per job (audit trail)
- Sample seed: 3 customers, 3 depots, 5 vehicles, 6 assets, 5 users, 5 inventory items, 6 RMAs across all lifecycle stages including a pending-quote for the demo customer

## Prioritized Backlog (Phase 2)
- **P0** Warranty return workflow + warranty case linkage to original job
- **P0** Purchasing: PR → PO → Goods Receipt → PO closure
- **P1** File attachments per RMA/job (photos, PDFs) with private storage
- **P1** Advanced analytics: cost/savings per customer, failure trends, SLA breaches
- **P1** Email notifications on status changes (Resend)
- **P2** Barcode/QR label printing for assets
- **P2** Data import/export (CSV/XLSX) with validation
- **P2** Configurable numbering formats and SLA rules
- **P2** Audit-log viewer and admin user/role management UI

## Test Credentials
See `/app/memory/test_credentials.md`.
