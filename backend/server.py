from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'mconnect-dev-secret-change-me')
JWT_ALGO = 'HS256'
JWT_EXP_HOURS = 24 * 7

app = FastAPI(title="MConnect Repair Services API")
api = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)


# ============ HELPERS ============
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def sign_token(payload: dict) -> str:
    data = {**payload, "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXP_HOURS)}
    return jwt.encode(data, JWT_SECRET, algorithm=JWT_ALGO)


async def current_user(cred: Optional[HTTPAuthorizationCredentials] = Depends(bearer)):
    if not cred:
        raise HTTPException(401, "Not authenticated")
    try:
        data = jwt.decode(cred.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": data["sub"]}, {"_id": 0, "password_hash": 0})
    if not user or not user.get("is_active", True):
        raise HTTPException(401, "User not found")
    return user


def require_roles(*roles):
    async def _dep(user=Depends(current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, f"Requires role: {roles}")
        return user
    return _dep


def gen_number(prefix: str, seq: int) -> str:
    yr = datetime.now(timezone.utc).year
    return f"{prefix}-{yr}-{seq:05d}"


async def next_seq(name: str) -> int:
    doc = await db.counters.find_one_and_update(
        {"_id": name}, {"$inc": {"seq": 1}}, upsert=True, return_document=True
    )
    return doc["seq"] if doc else 1


# ============ MODELS ============
Role = Literal["admin", "coordinator", "technician", "qa", "customer"]

RMA_STATUSES = [
    "Draft", "Submitted", "Received", "Assessment", "Awaiting Approval",
    "Repair In Progress", "Testing", "QA", "Ready for Dispatch",
    "Dispatched", "Closed", "Cancelled", "BER"
]


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str
    customer_id: Optional[str] = None
    is_active: bool = True


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class CustomerIn(BaseModel):
    name: str
    code: str
    industry: Optional[str] = "Transport"
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None


class DepotIn(BaseModel):
    customer_id: str
    name: str
    location: Optional[str] = None
    contact_person: Optional[str] = None


class VehicleIn(BaseModel):
    customer_id: str
    depot_id: Optional[str] = None
    plate_no: str
    model: Optional[str] = None
    manufacturer: Optional[str] = None
    fleet_group: Optional[str] = None


class AssetIn(BaseModel):
    customer_id: str
    vehicle_id: Optional[str] = None
    category: str = "ECU"
    ecu_type: str
    manufacturer: str
    part_number: str
    serial_number: str
    hw_version: Optional[str] = None
    sw_version: Optional[str] = None


class RMAItemIn(BaseModel):
    ecu_type: str
    manufacturer: str
    part_number: str
    serial_number: str
    fault_description: str
    priority: Literal["Low", "Normal", "High", "Critical"] = "Normal"


class RMAIn(BaseModel):
    customer_id: str
    depot_id: Optional[str] = None
    vehicle_id: Optional[str] = None
    customer_po: Optional[str] = None
    items: List[RMAItemIn]


class AssessmentIn(BaseModel):
    visual_check: str
    electrical_check: str
    pcb_check: str
    comms_check: str
    diagnosis: str
    root_cause: str
    outcome: Literal["Repairable", "Refurbishable", "Further Diagnosis", "BER", "Not Repairable", "NFF"]
    estimated_hours: float = 1.0


class QuoteLineIn(BaseModel):
    description: str
    qty: float = 1
    unit_price: float
    line_type: Literal["Part", "Labour", "Fee"] = "Part"


class QuoteIn(BaseModel):
    lines: List[QuoteLineIn]
    tax_percent: float = 9.0
    warranty_months: int = 6
    valid_days: int = 30
    notes: Optional[str] = None


class QuoteDecisionIn(BaseModel):
    decision: Literal["Approved", "Rejected"]
    customer_po: Optional[str] = None
    remarks: Optional[str] = None


class TestIn(BaseModel):
    test_type: str
    procedure: str
    parameters: Optional[str] = None
    result: Literal["Pass", "Fail"]
    remarks: Optional[str] = None


class QAIn(BaseModel):
    workmanship_ok: bool
    docs_complete: bool
    test_review_ok: bool
    result: Literal["Pass", "Fail"]
    comments: Optional[str] = None


class DispatchIn(BaseModel):
    dispatch_method: Literal["Courier", "In Person"] = "Courier"
    courier: Optional[str] = None
    tracking_no: Optional[str] = None
    delivery_date: Optional[str] = None
    received_by: Optional[str] = None
    delivery_notes: Optional[str] = None


class ItemIn(BaseModel):
    code: str
    description: str
    category: str
    uom: str = "PC"
    unit_cost: float = 0
    reorder_level: float = 0
    on_hand: float = 0


class StockTxnIn(BaseModel):
    item_id: str
    txn_type: Literal["Receipt", "Issue", "Return", "Adjustment"]
    qty: float
    job_id: Optional[str] = None
    reason: Optional[str] = None


# ============ AUTH ============
@api.post("/auth/login")
async def login(payload: LoginIn):
    u = await db.users.find_one({"email": payload.email.lower()})
    if not u or not verify_pw(payload.password, u.get("password_hash", "")):
        raise HTTPException(401, "Invalid credentials")
    if not u.get("is_active", True):
        raise HTTPException(403, "Account disabled")
    token = sign_token({"sub": u["id"], "role": u["role"]})
    return {
        "token": token,
        "user": {k: u[k] for k in ["id", "email", "name", "role", "customer_id"] if k in u},
    }


@api.get("/auth/me")
async def me(user=Depends(current_user)):
    return user


# ============ CUSTOMERS / DEPOTS / VEHICLES ============
def scope_customer(user):
    if user["role"] == "customer":
        return {"customer_id": user.get("customer_id")}
    return {}


@api.get("/customers")
async def list_customers(user=Depends(current_user)):
    q = {"id": user["customer_id"]} if user["role"] == "customer" else {}
    return await db.customers.find(q, {"_id": 0}).to_list(1000)


@api.post("/customers")
async def create_customer(data: CustomerIn, user=Depends(require_roles("admin", "coordinator"))):
    doc = {"id": new_id(), **data.model_dump(), "created_at": now_iso()}
    await db.customers.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.get("/depots")
async def list_depots(customer_id: Optional[str] = None, user=Depends(current_user)):
    q = {}
    if customer_id:
        q["customer_id"] = customer_id
    if user["role"] == "customer":
        q["customer_id"] = user["customer_id"]
    return await db.depots.find(q, {"_id": 0}).to_list(1000)


@api.post("/depots")
async def create_depot(data: DepotIn, user=Depends(require_roles("admin", "coordinator"))):
    doc = {"id": new_id(), **data.model_dump(), "created_at": now_iso()}
    await db.depots.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.get("/vehicles")
async def list_vehicles(customer_id: Optional[str] = None, user=Depends(current_user)):
    q = {}
    if customer_id:
        q["customer_id"] = customer_id
    if user["role"] == "customer":
        q["customer_id"] = user["customer_id"]
    return await db.vehicles.find(q, {"_id": 0}).to_list(2000)


@api.post("/vehicles")
async def create_vehicle(data: VehicleIn, user=Depends(require_roles("admin", "coordinator"))):
    doc = {"id": new_id(), **data.model_dump(), "created_at": now_iso()}
    await db.vehicles.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


# ============ ASSETS ============
@api.get("/assets")
async def list_assets(customer_id: Optional[str] = None, user=Depends(current_user)):
    q = {}
    if customer_id:
        q["customer_id"] = customer_id
    if user["role"] == "customer":
        q["customer_id"] = user["customer_id"]
    return await db.assets.find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)


@api.get("/assets/{asset_id}")
async def get_asset(asset_id: str, user=Depends(current_user)):
    a = await db.assets.find_one({"id": asset_id}, {"_id": 0})
    if not a:
        raise HTTPException(404, "Not found")
    if user["role"] == "customer" and a["customer_id"] != user["customer_id"]:
        raise HTTPException(403, "Forbidden")
    history = await db.repair_jobs.find({"asset_id": asset_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    a["repair_history"] = history
    return a


@api.post("/assets")
async def create_asset(data: AssetIn, user=Depends(require_roles("admin", "coordinator", "technician"))):
    existing = await db.assets.find_one({"serial_number": data.serial_number})
    if existing:
        raise HTTPException(409, f"Asset with serial {data.serial_number} already exists")
    doc = {"id": new_id(), **data.model_dump(), "status": "Active", "created_at": now_iso()}
    await db.assets.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


# ============ RMA & REPAIR JOBS ============
async def _log_event(job_id: str, user, event: str, note: Optional[str] = None):
    await db.job_events.insert_one({
        "id": new_id(), "job_id": job_id, "event": event, "note": note,
        "user_id": user["id"], "user_name": user["name"], "at": now_iso(),
    })


@api.get("/rmas")
async def list_rmas(status_filter: Optional[str] = None, user=Depends(current_user)):
    q = {}
    if status_filter:
        q["status"] = status_filter
    if user["role"] == "customer":
        q["customer_id"] = user["customer_id"]
    rmas = await db.rmas.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    # attach job counts
    for r in rmas:
        r["job_count"] = await db.repair_jobs.count_documents({"rma_id": r["id"]})
    return rmas


@api.post("/rmas")
async def create_rma(data: RMAIn, user=Depends(current_user)):
    # customers can create for their own org only
    if user["role"] == "customer" and data.customer_id != user["customer_id"]:
        raise HTTPException(403, "Forbidden")
    seq = await next_seq("rma")
    rma_id = new_id()
    rma_no = gen_number("RMA", seq)
    rma_doc = {
        "id": rma_id, "rma_no": rma_no,
        "customer_id": data.customer_id, "depot_id": data.depot_id, "vehicle_id": data.vehicle_id,
        "customer_po": data.customer_po,
        "status": "Submitted",
        "created_by": user["id"], "created_at": now_iso(),
    }
    await db.rmas.insert_one(rma_doc)

    # create a job per item
    jobs = []
    for item in data.items:
        # find or create asset
        asset = await db.assets.find_one({"serial_number": item.serial_number})
        if not asset:
            asset = {
                "id": new_id(), "customer_id": data.customer_id, "vehicle_id": data.vehicle_id,
                "category": "ECU", "ecu_type": item.ecu_type, "manufacturer": item.manufacturer,
                "part_number": item.part_number, "serial_number": item.serial_number,
                "status": "Active", "created_at": now_iso(),
            }
            await db.assets.insert_one(asset)
        job_seq = await next_seq("job")
        job = {
            "id": new_id(), "job_no": gen_number("JOB", job_seq),
            "rma_id": rma_id, "rma_no": rma_no,
            "customer_id": data.customer_id, "asset_id": asset["id"],
            "ecu_type": item.ecu_type, "manufacturer": item.manufacturer,
            "part_number": item.part_number, "serial_number": item.serial_number,
            "fault_description": item.fault_description, "priority": item.priority,
            "status": "Submitted",
            "assessment": None, "quote": None, "tests": [], "qa": None, "dispatch": None,
            "assigned_to": None,
            "created_by": user["id"], "created_at": now_iso(),
        }
        await db.repair_jobs.insert_one(job)
        await _log_event(job["id"], user, "RMA Submitted", f"Fault: {item.fault_description}")
        jobs.append({k: v for k, v in job.items() if k != "_id"})

    return {**{k: v for k, v in rma_doc.items() if k != "_id"}, "jobs": jobs}


@api.get("/rmas/{rma_id}")
async def get_rma(rma_id: str, user=Depends(current_user)):
    r = await db.rmas.find_one({"id": rma_id}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Not found")
    if user["role"] == "customer" and r["customer_id"] != user["customer_id"]:
        raise HTTPException(403, "Forbidden")
    r["jobs"] = await db.repair_jobs.find({"rma_id": rma_id}, {"_id": 0}).to_list(100)
    r["customer"] = await db.customers.find_one({"id": r["customer_id"]}, {"_id": 0})
    return r


@api.get("/jobs")
async def list_jobs(status_filter: Optional[str] = None, assigned_to: Optional[str] = None,
                    user=Depends(current_user)):
    q = {}
    if status_filter:
        q["status"] = status_filter
    if assigned_to:
        q["assigned_to"] = assigned_to
    if user["role"] == "customer":
        q["customer_id"] = user["customer_id"]
    if user["role"] == "technician":
        q["assigned_to"] = user["id"]
    return await db.repair_jobs.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.get("/jobs/{job_id}")
async def get_job(job_id: str, user=Depends(current_user)):
    j = await db.repair_jobs.find_one({"id": job_id}, {"_id": 0})
    if not j:
        raise HTTPException(404, "Not found")
    if user["role"] == "customer" and j["customer_id"] != user["customer_id"]:
        raise HTTPException(403, "Forbidden")
    # Only admin and customer see commercial data (quotes, POs, revenue)
    if user["role"] not in ("admin", "customer"):
        j.pop("quote", None)
    j["events"] = await db.job_events.find({"job_id": job_id}, {"_id": 0}).sort("at", -1).to_list(500)
    j["customer"] = await db.customers.find_one({"id": j["customer_id"]}, {"_id": 0})
    return j


async def _update_job(job_id: str, patch: dict):
    patch["updated_at"] = now_iso()
    await db.repair_jobs.update_one({"id": job_id}, {"$set": patch})


@api.post("/jobs/{job_id}/receive")
async def job_receive(job_id: str, user=Depends(require_roles("admin", "coordinator", "technician"))):
    await _update_job(job_id, {"status": "Received"})
    await _log_event(job_id, user, "Received at Workshop")
    return {"ok": True}


@api.post("/jobs/{job_id}/assign")
async def job_assign(job_id: str, body: dict, user=Depends(require_roles("admin", "coordinator"))):
    tech_id = body.get("technician_id")
    tech = await db.users.find_one({"id": tech_id}) if tech_id else None
    if not tech:
        raise HTTPException(400, "Invalid technician")
    await _update_job(job_id, {"assigned_to": tech_id, "assigned_name": tech["name"]})
    await _log_event(job_id, user, "Technician Assigned", tech["name"])
    return {"ok": True}


@api.post("/jobs/{job_id}/assessment")
async def job_assessment(job_id: str, data: AssessmentIn,
                         user=Depends(require_roles("admin", "technician"))):
    doc = {**data.model_dump(), "by": user["name"], "at": now_iso()}
    new_status = "Assessment"
    if data.outcome in ("BER", "Not Repairable", "NFF"):
        new_status = "BER" if data.outcome == "BER" else "Cancelled"
    else:
        new_status = "Awaiting Approval"
    await _update_job(job_id, {"assessment": doc, "status": new_status})
    await _log_event(job_id, user, "Assessment Completed", f"Outcome: {data.outcome}")
    return {"ok": True, "status": new_status}


@api.post("/jobs/{job_id}/quote")
async def job_quote(job_id: str, data: QuoteIn,
                    user=Depends(require_roles("admin"))):
    subtotal = sum(l.qty * l.unit_price for l in data.lines)
    tax = round(subtotal * data.tax_percent / 100, 2)
    total = round(subtotal + tax, 2)
    seq = await next_seq("quote")
    quote = {
        "quote_no": gen_number("QT", seq),
        "revision": 1,
        "lines": [l.model_dump() for l in data.lines],
        "subtotal": round(subtotal, 2), "tax_percent": data.tax_percent, "tax": tax, "total": total,
        "warranty_months": data.warranty_months, "valid_days": data.valid_days, "notes": data.notes,
        "decision": None, "decision_at": None, "customer_po": None,
        "by": user["name"], "at": now_iso(),
    }
    await _update_job(job_id, {"quote": quote, "status": "Awaiting Approval"})
    await _log_event(job_id, user, "Quotation Issued", f"{quote['quote_no']} • Total ${total:.2f}")
    return quote


@api.post("/jobs/{job_id}/quote/decide")
async def job_quote_decide(job_id: str, data: QuoteDecisionIn, user=Depends(current_user)):
    j = await db.repair_jobs.find_one({"id": job_id})
    if not j or not j.get("quote"):
        raise HTTPException(400, "No quote to decide")
    if user["role"] not in ("admin", "customer"):
        raise HTTPException(403, "Only admin or customer can decide on a quote")
    if user["role"] == "customer" and j["customer_id"] != user["customer_id"]:
        raise HTTPException(403, "Forbidden")
    quote = j["quote"]
    quote["decision"] = data.decision
    quote["decision_at"] = now_iso()
    quote["customer_po"] = data.customer_po
    quote["decision_by"] = user["name"]
    quote["remarks"] = data.remarks
    new_status = "Repair In Progress" if data.decision == "Approved" else "Cancelled"
    await _update_job(job_id, {"quote": quote, "status": new_status})
    await _log_event(job_id, user, f"Quote {data.decision}", data.remarks)
    return {"ok": True, "status": new_status}


@api.post("/jobs/{job_id}/test")
async def job_test(job_id: str, data: TestIn,
                   user=Depends(require_roles("admin", "technician"))):
    entry = {**data.model_dump(), "by": user["name"], "at": now_iso()}
    j = await db.repair_jobs.find_one({"id": job_id})
    tests = list(j.get("tests") or []) + [entry]
    new_status = "QA" if data.result == "Pass" else "Repair In Progress"
    await _update_job(job_id, {"tests": tests, "status": new_status})
    await _log_event(job_id, user, f"Test {data.result}", data.test_type)
    return {"ok": True, "status": new_status}


@api.post("/jobs/{job_id}/qa")
async def job_qa(job_id: str, data: QAIn, user=Depends(require_roles("admin", "qa"))):
    entry = {**data.model_dump(), "by": user["name"], "at": now_iso()}
    new_status = "Ready for Dispatch" if data.result == "Pass" else "Repair In Progress"
    await _update_job(job_id, {"qa": entry, "status": new_status})
    await _log_event(job_id, user, f"QA {data.result}", data.comments)
    return {"ok": True, "status": new_status}


@api.post("/jobs/{job_id}/dispatch")
async def job_dispatch(job_id: str, data: DispatchIn,
                       user=Depends(require_roles("admin", "coordinator"))):
    entry = {**data.model_dump(), "by": user["name"], "at": now_iso()}
    await _update_job(job_id, {"dispatch": entry, "status": "Dispatched"})
    if data.dispatch_method == "In Person":
        note = f"In person to {data.received_by or '—'} on {data.delivery_date or '—'}"
    else:
        note = f"{data.courier or '—'} • {data.tracking_no or '—'}"
    await _log_event(job_id, user, "Dispatched", note)
    return {"ok": True}


@api.post("/jobs/{job_id}/close")
async def job_close(job_id: str, user=Depends(require_roles("admin", "coordinator"))):
    await _update_job(job_id, {"status": "Closed", "closed_at": now_iso()})
    await _log_event(job_id, user, "Job Closed")
    return {"ok": True}


# ============ INVENTORY ============
@api.get("/inventory")
async def list_inventory(user=Depends(current_user)):
    if user["role"] == "customer":
        raise HTTPException(403, "Forbidden")
    return await db.inventory.find({}, {"_id": 0}).to_list(2000)


@api.post("/inventory")
async def create_item(data: ItemIn, user=Depends(require_roles("admin", "coordinator"))):
    if await db.inventory.find_one({"code": data.code}):
        raise HTTPException(409, "Item code exists")
    doc = {"id": new_id(), **data.model_dump(), "created_at": now_iso()}
    await db.inventory.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.post("/inventory/txn")
async def stock_txn(data: StockTxnIn, user=Depends(require_roles("admin", "coordinator", "technician"))):
    item = await db.inventory.find_one({"id": data.item_id})
    if not item:
        raise HTTPException(404, "Item not found")
    delta = data.qty if data.txn_type in ("Receipt", "Return") else -data.qty
    if data.txn_type == "Adjustment":
        delta = data.qty
    new_qty = float(item.get("on_hand", 0)) + delta
    if new_qty < 0:
        raise HTTPException(400, "Insufficient stock")
    await db.inventory.update_one({"id": data.item_id}, {"$set": {"on_hand": new_qty}})
    txn = {
        "id": new_id(), **data.model_dump(),
        "item_code": item["code"], "item_description": item["description"],
        "by": user["name"], "at": now_iso(),
    }
    await db.stock_txns.insert_one(txn)
    if data.job_id:
        await _log_event(data.job_id, user, f"Stock {data.txn_type}",
                         f"{item['code']} × {data.qty}")
    return {k: v for k, v in txn.items() if k != "_id"}


@api.get("/inventory/txns")
async def list_txns(user=Depends(require_roles("admin", "coordinator", "technician"))):
    return await db.stock_txns.find({}, {"_id": 0}).sort("at", -1).to_list(500)


# ============ DASHBOARD ============
@api.get("/dashboard")
async def dashboard(user=Depends(current_user)):
    scope = {}
    if user["role"] == "customer":
        scope = {"customer_id": user["customer_id"]}

    total = await db.repair_jobs.count_documents(scope)
    open_jobs = await db.repair_jobs.count_documents(
        {**scope, "status": {"$nin": ["Closed", "Cancelled", "Dispatched"]}}
    )

    by_status = {}
    for s in RMA_STATUSES:
        by_status[s] = await db.repair_jobs.count_documents({**scope, "status": s})

    ready = await db.repair_jobs.count_documents({**scope, "status": "Ready for Dispatch"})
    awaiting_approval = await db.repair_jobs.count_documents({**scope, "status": "Awaiting Approval"})
    in_repair = await db.repair_jobs.count_documents({**scope, "status": "Repair In Progress"})
    closed_this_month = await db.repair_jobs.count_documents({
        **scope, "status": "Closed",
        "closed_at": {"$gte": (datetime.now(timezone.utc).replace(day=1)).isoformat()}
    })

    # revenue (approved quotes) — only admin and customer see commercial data
    revenue = 0
    if user["role"] in ("admin", "customer"):
        pipeline_rev = [
            {"$match": {**scope, "quote.decision": "Approved"}},
            {"$group": {"_id": None, "total": {"$sum": "$quote.total"}}},
        ]
        rev_docs = await db.repair_jobs.aggregate(pipeline_rev).to_list(1)
        revenue = rev_docs[0]["total"] if rev_docs else 0

    customers_ct = await db.customers.count_documents({})
    assets_ct = await db.assets.count_documents(scope if user["role"] == "customer" else {})

    recent = await db.repair_jobs.find(scope, {"_id": 0}).sort("created_at", -1).limit(8).to_list(8)

    return {
        "total_jobs": total, "open_jobs": open_jobs, "ready_for_dispatch": ready,
        "awaiting_approval": awaiting_approval, "in_repair": in_repair,
        "closed_this_month": closed_this_month,
        "revenue_approved": (round(revenue, 2) if user["role"] in ("admin", "customer") else None),
        "customers": customers_ct, "assets": assets_ct,
        "by_status": by_status, "recent_jobs": recent,
    }


# ============ USERS (admin) ============
@api.get("/users")
async def list_users(user=Depends(require_roles("admin", "coordinator"))):
    return await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)


# ============ SEED ============
async def seed_if_empty():
    if await db.users.count_documents({}) > 0:
        return
    logger.info("Seeding database...")

    # customers
    cust1 = {"id": new_id(), "name": "SBS Transit Pte Ltd", "code": "SBS", "industry": "Public Transport",
             "contact_email": "ops@sbstransit.demo", "contact_phone": "+65 6555 0100",
             "address": "205 Braddell Rd, Singapore", "created_at": now_iso()}
    cust2 = {"id": new_id(), "name": "Fleetline Logistics", "code": "FLL", "industry": "Logistics",
             "contact_email": "fleet@fleetline.demo", "contact_phone": "+65 6555 0200",
             "address": "12 Jurong Port Rd, Singapore", "created_at": now_iso()}
    cust3 = {"id": new_id(), "name": "MetroRail Systems", "code": "MRS", "industry": "Rail",
             "contact_email": "ops@metrorail.demo", "contact_phone": "+65 6555 0300",
             "address": "39 Kim Keat Rd, Singapore", "created_at": now_iso()}
    await db.customers.insert_many([cust1, cust2, cust3])

    # users
    users = [
        {"id": new_id(), "email": "admin@mconnect.demo", "name": "Alex Admin", "role": "admin",
         "password_hash": hash_pw("admin123"), "customer_id": None, "is_active": True, "created_at": now_iso()},
        {"id": new_id(), "email": "coord@mconnect.demo", "name": "Chen Coordinator", "role": "coordinator",
         "password_hash": hash_pw("coord123"), "customer_id": None, "is_active": True, "created_at": now_iso()},
        {"id": new_id(), "email": "tech@mconnect.demo", "name": "Tariq Technician", "role": "technician",
         "password_hash": hash_pw("tech123"), "customer_id": None, "is_active": True, "created_at": now_iso()},
        {"id": new_id(), "email": "qa@mconnect.demo", "name": "Qiao Quality", "role": "qa",
         "password_hash": hash_pw("qa123"), "customer_id": None, "is_active": True, "created_at": now_iso()},
        {"id": new_id(), "email": "customer@sbs.demo", "name": "Sam Customer (SBS)", "role": "customer",
         "password_hash": hash_pw("cust123"), "customer_id": cust1["id"], "is_active": True, "created_at": now_iso()},
    ]
    await db.users.insert_many(users)
    tech_id = users[2]["id"]

    # depots & vehicles
    depots = [
        {"id": new_id(), "customer_id": cust1["id"], "name": "Ang Mo Kio Depot", "location": "Ang Mo Kio",
         "contact_person": "Mr Tan", "created_at": now_iso()},
        {"id": new_id(), "customer_id": cust1["id"], "name": "Bedok Depot", "location": "Bedok",
         "contact_person": "Ms Lim", "created_at": now_iso()},
        {"id": new_id(), "customer_id": cust2["id"], "name": "Jurong Yard", "location": "Jurong West",
         "contact_person": "Mr Rao", "created_at": now_iso()},
    ]
    await db.depots.insert_many(depots)

    vehicles = []
    for i, plate in enumerate(["SBS7231X", "SBS8814H", "SBS9012K", "GBL2231T", "GBL3345P"]):
        vehicles.append({
            "id": new_id(),
            "customer_id": cust1["id"] if plate.startswith("SBS") else cust2["id"],
            "depot_id": depots[0]["id"] if plate.startswith("SBS") else depots[2]["id"],
            "plate_no": plate, "model": "Volvo B9TL" if i % 2 == 0 else "MAN NL323F",
            "manufacturer": "Volvo" if i % 2 == 0 else "MAN",
            "fleet_group": "Fleet A", "created_at": now_iso(),
        })
    await db.vehicles.insert_many(vehicles)

    # assets
    assets = []
    for i, sn in enumerate(["ECU-0091-A2", "ECU-0091-B7", "GEP-2201-X", "PCM-4402-Q", "GEP-2201-Y", "TCU-8080-Z"]):
        assets.append({
            "id": new_id(),
            "customer_id": cust1["id"] if i < 3 else cust2["id"],
            "vehicle_id": vehicles[i % len(vehicles)]["id"],
            "category": "ECU", "ecu_type": "Engine ECU" if i % 2 == 0 else "Transmission ECU",
            "manufacturer": "Bosch" if i % 2 == 0 else "ZF",
            "part_number": f"BX-{1000+i}",
            "serial_number": sn, "hw_version": "v2.1", "sw_version": "3.4.1",
            "status": "Active", "created_at": now_iso(),
        })
    await db.assets.insert_many(assets)

    # inventory
    items = [
        {"id": new_id(), "code": "CAP-100UF", "description": "Capacitor 100µF 25V", "category": "Capacitor",
         "uom": "PC", "unit_cost": 0.45, "reorder_level": 100, "on_hand": 320, "created_at": now_iso()},
        {"id": new_id(), "code": "MOSFET-N50", "description": "N-Channel MOSFET 50V", "category": "IC",
         "uom": "PC", "unit_cost": 1.20, "reorder_level": 50, "on_hand": 78, "created_at": now_iso()},
        {"id": new_id(), "code": "CONN-16P", "description": "16-pin Connector Header", "category": "Connector",
         "uom": "PC", "unit_cost": 3.10, "reorder_level": 40, "on_hand": 22, "created_at": now_iso()},
        {"id": new_id(), "code": "PCB-BLANK-A", "description": "Blank PCB Type A", "category": "PCB",
         "uom": "PC", "unit_cost": 22.00, "reorder_level": 15, "on_hand": 40, "created_at": now_iso()},
        {"id": new_id(), "code": "SOLDER-LEAD-FREE", "description": "Lead-free solder wire 0.5mm",
         "category": "Consumable", "uom": "ROLL", "unit_cost": 18.50, "reorder_level": 10,
         "on_hand": 24, "created_at": now_iso()},
    ]
    await db.inventory.insert_many(items)

    # seed a couple of RMAs at different stages
    admin = users[0]

    async def _mk_rma(cust, vehicle, asset, fault, priority, stage):
        seq = await next_seq("rma")
        rma_no = gen_number("RMA", seq)
        rma_id = new_id()
        await db.rmas.insert_one({
            "id": rma_id, "rma_no": rma_no, "customer_id": cust["id"],
            "vehicle_id": vehicle["id"], "customer_po": "PO-" + str(1000 + seq),
            "status": stage, "created_by": admin["id"], "created_at": now_iso(),
        })
        job_seq = await next_seq("job")
        job_id = new_id()
        job = {
            "id": job_id, "job_no": gen_number("JOB", job_seq),
            "rma_id": rma_id, "rma_no": rma_no,
            "customer_id": cust["id"], "asset_id": asset["id"],
            "ecu_type": asset["ecu_type"], "manufacturer": asset["manufacturer"],
            "part_number": asset["part_number"], "serial_number": asset["serial_number"],
            "fault_description": fault, "priority": priority, "status": stage,
            "assessment": None, "quote": None, "tests": [], "qa": None, "dispatch": None,
            "assigned_to": tech_id if stage not in ("Submitted",) else None,
            "assigned_name": "Tariq Technician" if stage not in ("Submitted",) else None,
            "created_by": admin["id"], "created_at": now_iso(),
        }
        # progressive artifacts
        if stage in ("Awaiting Approval", "Repair In Progress", "Testing", "QA", "Ready for Dispatch", "Closed"):
            job["assessment"] = {
                "visual_check": "Minor board scorch near power stage.",
                "electrical_check": "Short between VCC and GND on rail 2.",
                "pcb_check": "Cap C14 bulging.",
                "comms_check": "CAN bus unresponsive.",
                "diagnosis": "Power stage failure due to failed capacitor.",
                "root_cause": "Component aging + heat cycling.",
                "outcome": "Repairable", "estimated_hours": 2.5,
                "by": "Tariq Technician", "at": now_iso(),
            }
        if stage in ("Awaiting Approval", "Repair In Progress", "Testing", "QA", "Ready for Dispatch", "Closed"):
            job["quote"] = {
                "quote_no": gen_number("QT", await next_seq("quote")), "revision": 1,
                "lines": [
                    {"description": "Capacitor 100µF 25V", "qty": 4, "unit_price": 1.5, "line_type": "Part"},
                    {"description": "Skilled labour (bench)", "qty": 2.5, "unit_price": 85, "line_type": "Labour"},
                    {"description": "Diagnostic fee", "qty": 1, "unit_price": 45, "line_type": "Fee"},
                ],
                "subtotal": 6 + 212.5 + 45, "tax_percent": 9,
                "tax": round((6 + 212.5 + 45) * 0.09, 2),
                "total": round((6 + 212.5 + 45) * 1.09, 2),
                "warranty_months": 6, "valid_days": 30, "notes": "Standard bench repair.",
                "decision": "Approved" if stage != "Awaiting Approval" else None,
                "decision_at": now_iso() if stage != "Awaiting Approval" else None,
                "customer_po": ("PO-" + str(1000 + seq)) if stage != "Awaiting Approval" else None,
                "decision_by": "Sam Customer (SBS)" if stage != "Awaiting Approval" else None,
                "by": "Chen Coordinator", "at": now_iso(),
            }
        if stage in ("QA", "Ready for Dispatch", "Closed"):
            job["tests"] = [{
                "test_type": "Functional", "procedure": "TP-ECU-FUNC-01",
                "parameters": "12V, 25°C", "result": "Pass",
                "remarks": "All I/O passed", "by": "Tariq Technician", "at": now_iso()
            }]
        if stage in ("Ready for Dispatch", "Closed"):
            job["qa"] = {"workmanship_ok": True, "docs_complete": True, "test_review_ok": True,
                         "result": "Pass", "comments": "Approved for release",
                         "by": "Qiao Quality", "at": now_iso()}
        if stage == "Closed":
            job["dispatch"] = {"courier": "DHL", "tracking_no": "DHL2039193", "delivery_notes": "Delivered",
                               "by": "Chen Coordinator", "at": now_iso()}
            job["closed_at"] = now_iso()
        await db.repair_jobs.insert_one(job)
        await db.job_events.insert_one({
            "id": new_id(), "job_id": job_id, "event": "RMA Submitted",
            "note": fault, "user_id": admin["id"], "user_name": admin["name"], "at": now_iso(),
        })

    await _mk_rma(cust1, vehicles[0], assets[0], "Engine ECU not communicating on CAN bus", "High", "Submitted")
    await _mk_rma(cust1, vehicles[1], assets[1], "Intermittent stall, MIL on", "Normal", "Awaiting Approval")
    await _mk_rma(cust1, vehicles[2], assets[2], "GPS unit resetting randomly", "High", "Repair In Progress")
    await _mk_rma(cust2, vehicles[3], assets[3], "Power module dead on start", "Critical", "QA")
    await _mk_rma(cust2, vehicles[4], assets[4], "GPS drift over 200m", "Normal", "Ready for Dispatch")
    await _mk_rma(cust1, vehicles[0], assets[5], "Transmission harsh shift", "High", "Closed")

    logger.info("Seed complete.")


# register routes
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def _startup():
    await seed_if_empty()


@app.on_event("shutdown")
async def _shutdown():
    client.close()
