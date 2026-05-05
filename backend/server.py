"""Automotive Service CRM - FastAPI Backend.
Kuwait market (KWD currency). JWT auth with role-based access.
"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid
import shutil
import logging
import bcrypt
import jwt
from pathlib import Path
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime, timezone, timedelta

from kuwait_seed_data import KUWAIT_MAKES_MODELS

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ.get("JWT_SECRET", "change-me-in-prod-automotive-crm-kw")
JWT_ALG = "HS256"
JWT_EXP_HOURS = 24 * 7

app = FastAPI(title="Automotive Service CRM", version="1.1.0")
api = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

# ---------------- Helpers ----------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def new_id() -> str:
    return str(uuid.uuid4())

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def make_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id, "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXP_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    if not creds:
        raise HTTPException(401, "Missing token")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user

def require_roles(*roles: str):
    async def check(user=Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, f"Requires role: {', '.join(roles)}")
        return user
    return check

def audit(user, doc: dict, creating: bool = True):
    ts = now_iso()
    if creating:
        doc["created_by"] = user["id"]
        doc["created_at"] = ts
    doc["updated_by"] = user["id"]
    doc["updated_at"] = ts
    return doc

def round3(n: float) -> float:
    return round(n + 1e-9, 3)

def clean_str(s: Optional[str]) -> Optional[str]:
    if s is None:
        return None
    s = s.strip()
    return s or None

# ---------------- Models ----------------
class LoginIn(BaseModel):
    email: Optional[str] = None  # email OR mobile accepted
    mobile: Optional[str] = None
    password: str

class UserCreate(BaseModel):
    # New mobile-based format
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    mobile: Optional[str] = None
    role_id: Optional[str] = None
    is_master: Optional[bool] = False
    active: Optional[bool] = True
    # Legacy / fallback
    name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    mobile: Optional[str] = None
    role_id: Optional[str] = None
    is_master: Optional[bool] = None
    name: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None
    active: Optional[bool] = None

# Permission keys grouped into logical modules
PERMISSION_KEYS = [
    "dashboard", "customers", "segments", "vehicles", "quotations", "jobs",
    "inventory_categories", "inventory_products", "services", "reports",
    "settings_roles", "settings_users", "settings_vehicle_management", "system_settings",
]

class RoleIn(BaseModel):
    name: str
    description: Optional[str] = None
    active: bool = True
    permissions: Dict[str, bool] = {}  # key -> can_access

class VehicleBrandIn(BaseModel):
    name: str
    active: bool = True

class VehicleModelIn(BaseModel):
    brand_id: str
    name: str
    vehicle_type: Optional[str] = None
    active: bool = True

class FeatureTogglesIn(BaseModel):
    payment_gateway_enabled: bool = False
    whatsapp_enabled: bool = False
    email_smtp_enabled: bool = False
    payment_cash: bool = True
    payment_knet: bool = True
    payment_card: bool = True
    payment_bank_transfer: bool = False
    payment_other: bool = False

class IntegrationConfigIn(BaseModel):
    """Generic settings blob for an integration provider; secrets are stored
    encrypted-at-rest (we only mask on return)."""
    enabled: bool = False
    fields: Dict[str, Any] = {}

class CustomerVehicleIn(BaseModel):
    vehicle_type: str
    make: str
    model: str
    year: Optional[int] = None
    plate: Optional[str] = None
    vin: Optional[str] = None
    color: Optional[str] = None

class CustomerIn(BaseModel):
    name: str
    mobile: str
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    notes: Optional[str] = None
    preferred_contact: Literal["mobile", "email", "whatsapp"] = "mobile"
    vehicles: List[CustomerVehicleIn] = []

    @field_validator("mobile")
    @classmethod
    def _mobile_numeric(cls, v: str) -> str:
        s = (v or "").strip()
        # Allow optional leading + then digits only (KW numbers often start with +965)
        core = s[1:] if s.startswith("+") else s
        if not core or not core.isdigit():
            raise ValueError("Mobile must contain digits only (an optional leading '+' is allowed).")
        return s

class VehicleIn(BaseModel):
    customer_id: str
    vehicle_type: str
    make: str
    model: str
    year: Optional[int] = None
    plate: Optional[str] = None
    vin: Optional[str] = None
    color: Optional[str] = None

class VehicleTypeIn(BaseModel):
    key: str
    label: str
    panels: List[Dict[str, Any]] = []
    glass_areas: List[Dict[str, Any]] = []

class VehicleMakeIn(BaseModel):
    label: str
    models: List[str] = []

class ServiceIn(BaseModel):
    name: str
    category: str  # legacy / display label (now free-form)
    category_id: Optional[str] = None  # new FK to service_categories
    pricing_mode: Literal["per_vehicle_type", "per_panel", "per_glass_area", "full_vehicle", "fixed"]
    description: Optional[str] = None
    fixed_price: Optional[float] = None
    vehicle_type_prices: Dict[str, float] = {}
    panel_prices: Dict[str, Dict[str, float]] = {}
    glass_prices: Dict[str, Dict[str, float]] = {}
    full_vehicle_prices: Dict[str, float] = {}
    is_bundle: bool = False
    bundle_items: List[str] = []  # service IDs included in bundle (display only)
    active: bool = True
    requires_panel: Optional[bool] = None  # derived from pricing_mode if None
    requires_glass: Optional[bool] = None
    applicable_vehicle_types: List[str] = []  # empty = all

class QuotationLineIn(BaseModel):
    service_id: str
    service_name: str
    description: Optional[str] = None
    quantity: float = 1
    unit_price: float
    selected_areas: List[str] = []
    line_total: float

class QuotationIn(BaseModel):
    customer_id: str
    vehicle_id: str
    lines: List[QuotationLineIn]
    discount: float = 0  # resolved KWD amount (back-compat)
    discount_type: Optional[Literal["amount", "percent"]] = None
    discount_value: Optional[float] = None  # raw input (KWD if amount, % if percent)
    tax_rate: float = 0
    notes: Optional[str] = None
    valid_until: Optional[str] = None  # ISO date

class QuotationStatusIn(BaseModel):
    status: Literal["draft", "sent", "approved", "rejected"]

class JobStatusIn(BaseModel):
    status: Literal["draft", "confirmed", "in_progress", "completed", "cancelled"]

class JobChecklistIn(BaseModel):
    items: List[Dict[str, Any]]

class JobAssignIn(BaseModel):
    technician_id: str

class JobInvoiceEditIn(BaseModel):
    discount: Optional[float] = None
    discount_type: Optional[Literal["amount", "percent"]] = None
    discount_value: Optional[float] = None
    tax_rate: Optional[float] = None
    notes: Optional[str] = None

class PaymentIn(BaseModel):
    method: Literal["cash", "knet", "credit_card"]
    amount: float
    auth_code: Optional[str] = None
    notes: Optional[str] = None

class ConsumedItem(BaseModel):
    inventory_id: Optional[str] = None
    sku: Optional[str] = None
    name: str
    qty: float
    unit: Optional[str] = None
    notes: Optional[str] = None

class LineConsumptionIn(BaseModel):
    line_index: int
    consumed_inventory: List[ConsumedItem] = []

class JobInternalNotesIn(BaseModel):
    internal_notes: Optional[str] = None

class InventoryIn(BaseModel):
    sku: str
    name: str
    category: Optional[str] = None  # legacy free-text
    category_id: Optional[str] = None  # new FK to inventory_categories
    unit: str = "pcs"
    cost_price: float = 0
    selling_price: float = 0
    stock_qty: float = 0
    low_stock_threshold: float = 5
    active: bool = True
    reorder_level: Optional[float] = None  # alias for low_stock_threshold

class InventoryCategoryIn(BaseModel):
    name: str
    description: Optional[str] = None
    active: bool = True

class ServiceCategoryIn(BaseModel):
    name: str
    description: Optional[str] = None
    active: bool = True

class AppointmentIn(BaseModel):
    customer_id: str
    vehicle_id: Optional[str] = None
    service_label: str
    start: str
    end: Optional[str] = None
    notes: Optional[str] = None

# ---------------- Auth ----------------
@api.post("/auth/login")
async def login(body: LoginIn):
    ident_email = (body.email or "").strip().lower() or None
    ident_mobile = (body.mobile or body.email or "").strip()
    # Treat as mobile if it starts with + or is digits-only
    user = None
    if ident_email and "@" in ident_email:
        user = await db.users.find_one({"email": ident_email})
    if not user and ident_mobile:
        # Mobile lookup ignores leading + and spaces
        m_norm = ident_mobile.replace(" ", "")
        user = await db.users.find_one({"$or": [{"mobile": m_norm}, {"mobile": "+" + m_norm.lstrip("+")}]})
    if not user or not verify_password(body.password, user.get("password", "")):
        raise HTTPException(401, "Invalid credentials")
    if user.get("active") is False:
        raise HTTPException(403, "Account disabled")
    token = make_token(user["id"], user.get("role", "admin"))
    user.pop("_id", None); user.pop("password", None)
    # Embed permissions for instant UI gating
    user["permissions"] = await _resolve_permissions(user)
    return {"token": token, "user": user}

@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    user["permissions"] = await _resolve_permissions(user)
    return user

# ---------------- Users ----------------
async def _resolve_permissions(user: dict) -> Dict[str, bool]:
    """Master admins get all true. Otherwise look up role permissions."""
    if user.get("is_master"):
        return {k: True for k in PERMISSION_KEYS}
    rid = user.get("role_id")
    if rid:
        role = await db.roles.find_one({"id": rid}, {"_id": 0, "permissions": 1, "active": 1})
        if role and role.get("active") is not False:
            return {k: bool(role.get("permissions", {}).get(k, False)) for k in PERMISSION_KEYS}
    # Legacy fallback: admin → all; sales → most; tech → jobs only
    legacy = user.get("role")
    if legacy == "admin":
        return {k: True for k in PERMISSION_KEYS if k != "system_settings"}
    if legacy == "sales":
        return {k: k in {"dashboard","customers","segments","vehicles","quotations","jobs",
                         "inventory_categories","inventory_products","reports"} for k in PERMISSION_KEYS}
    if legacy == "technician":
        return {k: k in {"dashboard","jobs"} for k in PERMISSION_KEYS}
    return {k: False for k in PERMISSION_KEYS}

def _user_full_name(u: dict) -> str:
    fn = u.get("first_name") or ""
    ln = u.get("last_name") or ""
    full = f"{fn} {ln}".strip()
    return full or u.get("name") or u.get("email") or ""

async def _enrich_user(u: dict) -> dict:
    if u.get("role_id"):
        r = await db.roles.find_one({"id": u["role_id"]}, {"_id": 0, "name": 1})
        if r: u["role_name"] = r["name"]
    return u

@api.get("/users")
async def list_users(user=Depends(get_current_user)):
    if not (user.get("is_master") or user.get("role") == "admin"):
        # Allow other roles only minimal fields for filter dropdowns (creator filter)
        rows = await db.users.find({}, {"_id": 0, "id": 1, "name": 1, "first_name": 1, "last_name": 1}).to_list(500)
        for r in rows:
            r["name"] = _user_full_name(r) or r.get("name") or ""
        return rows
    rows = await db.users.find({}, {"_id": 0, "password": 0}).to_list(500)
    for r in rows:
        r["name"] = _user_full_name(r) or r.get("name") or ""
        await _enrich_user(r)
    return rows

@api.get("/users/technicians")
async def list_techs(user=Depends(get_current_user)):
    return await db.users.find({"role": "technician"}, {"_id": 0, "password": 0}).to_list(500)

@api.post("/users")
async def create_user(body: UserCreate, user=Depends(require_roles("admin"))):
    fn = (body.first_name or "").strip()
    ln = (body.last_name or "").strip()
    name = body.name or f"{fn} {ln}".strip() or "Unnamed"
    mobile = (body.mobile or "").strip()
    email = (body.email or "").strip().lower() or None
    if not email and not mobile:
        raise HTTPException(400, "Provide mobile (or email) for the user.")
    if email and await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already exists")
    if mobile and await db.users.find_one({"mobile": mobile}):
        raise HTTPException(400, "Mobile already exists")
    pwd = body.password or "wetworks123"  # default temp; admin should set
    doc = {
        "id": new_id(), "name": name,
        "first_name": fn or None, "last_name": ln or None,
        "email": email, "mobile": mobile or None,
        "role_id": body.role_id, "is_master": bool(body.is_master),
        "role": body.role or "sales",  # legacy field for back-compat
        "password": hash_password(pwd), "active": body.active if body.active is not None else True,
    }
    audit(user, doc)
    await db.users.insert_one(doc.copy())
    doc.pop("password", None)
    await _enrich_user(doc)
    return doc

@api.patch("/users/{uid}")
async def update_user(uid: str, body: UserUpdate, user=Depends(require_roles("admin"))):
    upd = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if "password" in upd:
        upd["password"] = hash_password(upd["password"])
    if "first_name" in upd or "last_name" in upd or "name" in upd:
        cur = await db.users.find_one({"id": uid}, {"_id": 0, "first_name": 1, "last_name": 1, "name": 1})
        if cur:
            fn = upd.get("first_name", cur.get("first_name") or "")
            ln = upd.get("last_name", cur.get("last_name") or "")
            full = f"{fn} {ln}".strip()
            if full: upd["name"] = full
    # Only existing master can grant master
    if "is_master" in upd and upd["is_master"] and not user.get("is_master"):
        raise HTTPException(403, "Only a master admin can grant master privileges.")
    audit(user, upd, creating=False)
    await db.users.update_one({"id": uid}, {"$set": upd})
    out = await db.users.find_one({"id": uid}, {"_id": 0, "password": 0})
    return await _enrich_user(out) if out else out

@api.delete("/users/{uid}")
async def delete_user(uid: str, user=Depends(require_roles("admin"))):
    target = await db.users.find_one({"id": uid}, {"_id": 0, "is_master": 1})
    if target and target.get("is_master") and not user.get("is_master"):
        raise HTTPException(403, "Cannot delete a master admin")
    if target and target.get("is_master"):
        # Don't allow self-delete of last master
        masters = await db.users.count_documents({"is_master": True, "active": {"$ne": False}})
        if masters <= 1:
            raise HTTPException(400, "Cannot delete the last master admin")
    await db.users.delete_one({"id": uid})
    return {"ok": True}

# ---------------- Roles ----------------
@api.get("/roles")
async def list_roles(user=Depends(get_current_user)):
    rows = await db.roles.find({}, {"_id": 0}).sort("name", 1).to_list(500)
    # Count users per role
    rids = [r["id"] for r in rows]
    counts = {}
    if rids:
        agg = db.users.aggregate([
            {"$match": {"role_id": {"$in": rids}}},
            {"$group": {"_id": "$role_id", "n": {"$sum": 1}}},
        ])
        counts = {r["_id"]: r["n"] async for r in agg}
    for r in rows:
        r["user_count"] = counts.get(r["id"], 0)
    return rows

@api.post("/roles")
async def create_role(body: RoleIn, user=Depends(require_roles("admin"))):
    if await db.roles.find_one({"name": body.name.strip()}):
        raise HTTPException(400, "Role name already exists")
    perms = {k: bool(body.permissions.get(k, False)) for k in PERMISSION_KEYS}
    doc = {"id": new_id(), "name": body.name.strip(),
           "description": clean_str(body.description), "active": body.active,
           "permissions": perms}
    audit(user, doc)
    await db.roles.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc

@api.patch("/roles/{rid}")
async def update_role(rid: str, body: RoleIn, user=Depends(require_roles("admin"))):
    perms = {k: bool(body.permissions.get(k, False)) for k in PERMISSION_KEYS}
    upd = {"name": body.name.strip(), "description": clean_str(body.description),
           "active": body.active, "permissions": perms}
    audit(user, upd, creating=False)
    await db.roles.update_one({"id": rid}, {"$set": upd})
    return await db.roles.find_one({"id": rid}, {"_id": 0})

@api.delete("/roles/{rid}")
async def delete_role(rid: str, user=Depends(require_roles("admin"))):
    linked = await db.users.count_documents({"role_id": rid})
    if linked:
        raise HTTPException(400, f"Cannot delete: {linked} user(s) assigned. Reassign first or mark inactive.")
    await db.roles.delete_one({"id": rid})
    return {"ok": True}

@api.get("/permission-keys")
async def get_permission_keys(user=Depends(get_current_user)):
    return PERMISSION_KEYS

# ---------------- Vehicle Brands & Models (Phase 4 management) ----------------
@api.get("/vehicle-brands")
async def list_brands(q: Optional[str] = None, user=Depends(get_current_user)):
    flt: Dict[str, Any] = {}
    if q:
        flt["name"] = {"$regex": q, "$options": "i"}
    rows = await db.vehicle_brands.find(flt, {"_id": 0}).sort("name", 1).to_list(2000)
    bids = [r["id"] for r in rows]
    counts = {}
    if bids:
        agg = db.vehicle_models.aggregate([
            {"$match": {"brand_id": {"$in": bids}}},
            {"$group": {"_id": "$brand_id", "n": {"$sum": 1}}},
        ])
        counts = {r["_id"]: r["n"] async for r in agg}
    for r in rows:
        r["model_count"] = counts.get(r["id"], 0)
    return rows

@api.post("/vehicle-brands")
async def create_brand(body: VehicleBrandIn, user=Depends(require_roles("admin"))):
    if await db.vehicle_brands.find_one({"name": body.name.strip()}):
        raise HTTPException(400, "Brand already exists")
    doc = {"id": new_id(), "name": body.name.strip(), "active": body.active}
    audit(user, doc)
    await db.vehicle_brands.insert_one(doc.copy())
    doc.pop("_id", None); return doc

@api.patch("/vehicle-brands/{bid}")
async def update_brand(bid: str, body: VehicleBrandIn, user=Depends(require_roles("admin"))):
    upd = {"name": body.name.strip(), "active": body.active}
    audit(user, upd, creating=False)
    await db.vehicle_brands.update_one({"id": bid}, {"$set": upd})
    return await db.vehicle_brands.find_one({"id": bid}, {"_id": 0})

@api.delete("/vehicle-brands/{bid}")
async def delete_brand(bid: str, user=Depends(require_roles("admin"))):
    cnt = await db.vehicle_models.count_documents({"brand_id": bid})
    if cnt:
        raise HTTPException(400, f"Cannot delete: {cnt} model(s) under this brand. Delete models first or mark brand inactive.")
    brand = await db.vehicle_brands.find_one({"id": bid}, {"_id": 0, "name": 1})
    if brand:
        v = await db.vehicles.count_documents({"make": brand["name"]})
        if v:
            raise HTTPException(400, f"Cannot delete: {v} vehicle(s) reference this brand.")
    await db.vehicle_brands.delete_one({"id": bid})
    return {"ok": True}

@api.get("/vehicle-models")
async def list_models(brand_id: Optional[str] = None, user=Depends(get_current_user)):
    flt: Dict[str, Any] = {}
    if brand_id:
        flt["brand_id"] = brand_id
    rows = await db.vehicle_models.find(flt, {"_id": 0}).sort("name", 1).to_list(5000)
    return rows

@api.post("/vehicle-models")
async def create_model(body: VehicleModelIn, user=Depends(require_roles("admin"))):
    brand = await db.vehicle_brands.find_one({"id": body.brand_id}, {"_id": 0, "name": 1})
    if not brand:
        raise HTTPException(400, "Brand not found")
    if await db.vehicle_models.find_one({"brand_id": body.brand_id, "name": body.name.strip()}):
        raise HTTPException(400, "Model already exists for this brand")
    doc = {"id": new_id(), "brand_id": body.brand_id, "brand_name": brand["name"],
           "name": body.name.strip(), "vehicle_type": body.vehicle_type,
           "active": body.active}
    audit(user, doc)
    await db.vehicle_models.insert_one(doc.copy())
    doc.pop("_id", None); return doc

@api.patch("/vehicle-models/{mid}")
async def update_model(mid: str, body: VehicleModelIn, user=Depends(require_roles("admin"))):
    brand = await db.vehicle_brands.find_one({"id": body.brand_id}, {"_id": 0, "name": 1})
    if not brand:
        raise HTTPException(400, "Brand not found")
    upd = {"brand_id": body.brand_id, "brand_name": brand["name"],
           "name": body.name.strip(), "vehicle_type": body.vehicle_type,
           "active": body.active}
    audit(user, upd, creating=False)
    await db.vehicle_models.update_one({"id": mid}, {"$set": upd})
    return await db.vehicle_models.find_one({"id": mid}, {"_id": 0})

@api.delete("/vehicle-models/{mid}")
async def delete_model(mid: str, user=Depends(require_roles("admin"))):
    m = await db.vehicle_models.find_one({"id": mid}, {"_id": 0, "name": 1, "brand_name": 1})
    if m:
        v = await db.vehicles.count_documents({"make": m["brand_name"], "model": m["name"]})
        if v:
            raise HTTPException(400, f"Cannot delete: {v} vehicle(s) use this model. Mark inactive instead.")
    await db.vehicle_models.delete_one({"id": mid})
    return {"ok": True}

# ---------------- System Settings (Master Admin only) ----------------
def _mask_secret(v: Any) -> Any:
    if not v: return v
    s = str(v)
    if len(s) <= 4: return "•" * len(s)
    return s[:2] + "•" * (len(s) - 6) + s[-4:]

SECRET_KEYS = {"api_key", "api_secret", "access_token", "secret", "password", "smtp_password", "webhook_secret"}

def _mask_integration(cfg: dict) -> dict:
    out = {**cfg}
    fields = dict(out.get("fields") or {})
    for k in list(fields.keys()):
        if k.lower() in SECRET_KEYS or k.lower().endswith("_secret") or k.lower().endswith("_token"):
            fields[k] = _mask_secret(fields[k])
    out["fields"] = fields
    return out

def _require_master(user):
    if not user.get("is_master"):
        raise HTTPException(403, "Master admin only")

@api.get("/system-settings")
async def get_system_settings(user=Depends(get_current_user)):
    # Anyone authed can read feature flags (used to gate UI), but secrets are masked
    doc = await db.system_settings.find_one({"_id": "singleton"}, {"_id": 0}) or {}
    toggles = doc.get("toggles") or FeatureTogglesIn().model_dump()
    integrations = {}
    for name, cfg in (doc.get("integrations") or {}).items():
        integrations[name] = _mask_integration(cfg)
    return {"toggles": toggles, "integrations": integrations,
            "is_master": bool(user.get("is_master"))}

@api.put("/system-settings/toggles")
async def update_toggles(body: FeatureTogglesIn, user=Depends(get_current_user)):
    _require_master(user)
    await db.system_settings.update_one(
        {"_id": "singleton"},
        {"$set": {"toggles": body.model_dump(), "updated_at": now_iso(), "updated_by": user["id"]}},
        upsert=True,
    )
    return body.model_dump()

@api.put("/system-settings/integrations/{name}")
async def update_integration(name: str, body: IntegrationConfigIn, user=Depends(get_current_user)):
    _require_master(user)
    name = name.strip().lower()
    allowed = {"tap", "myfatoorah", "ottu", "whatsapp", "email_smtp"}
    if name not in allowed:
        raise HTTPException(400, f"Unknown integration: must be one of {', '.join(allowed)}")
    # Don't overwrite secrets if client sent the masked value (contains •)
    existing = await db.system_settings.find_one({"_id": "singleton"}, {"_id": 0, "integrations": 1}) or {}
    cur_fields = ((existing.get("integrations") or {}).get(name) or {}).get("fields", {})
    new_fields = dict(body.fields or {})
    for k, v in list(new_fields.items()):
        if isinstance(v, str) and "•" in v and k in cur_fields:
            new_fields[k] = cur_fields[k]
    cfg = {"enabled": body.enabled, "fields": new_fields, "updated_at": now_iso(), "updated_by": user["id"]}
    await db.system_settings.update_one(
        {"_id": "singleton"},
        {"$set": {f"integrations.{name}": cfg}},
        upsert=True,
    )
    return _mask_integration(cfg)

# ---------------- Customers ----------------
@api.get("/customers")
async def list_customers(q: Optional[str] = None, user=Depends(get_current_user)):
    flt: Dict[str, Any] = {}
    if q:
        flt["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"mobile": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
        ]
    return await db.customers.find(flt, {"_id": 0}).sort("created_at", -1).to_list(2000)

@api.post("/customers")
async def create_customer(body: CustomerIn, user=Depends(require_roles("admin", "sales"))):
    doc = {
        "id": new_id(),
        "name": body.name.strip(),
        "mobile": body.mobile.strip(),
        "email": clean_str(body.email),
        "address": clean_str(body.address),
        "city": clean_str(body.city),
        "notes": clean_str(body.notes),
        "preferred_contact": body.preferred_contact,
    }
    audit(user, doc)
    await db.customers.insert_one(doc.copy())
    # inline vehicles
    for v in body.vehicles or []:
        veh = v.model_dump()
        veh["id"] = new_id()
        veh["customer_id"] = doc["id"]
        audit(user, veh)
        await db.vehicles.insert_one(veh.copy())
    doc.pop("_id", None)
    return doc

@api.get("/customers/{cid}")
async def get_customer(cid: str, user=Depends(get_current_user)):
    c = await db.customers.find_one({"id": cid}, {"_id": 0})
    if not c:
        raise HTTPException(404)
    c["vehicles"] = await db.vehicles.find({"customer_id": cid}, {"_id": 0}).to_list(200)
    c["quotations"] = await db.quotations.find({"customer_id": cid}, {"_id": 0}).sort("created_at", -1).to_list(200)
    c["jobs"] = await db.jobs.find({"customer_id": cid}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return c

@api.patch("/customers/{cid}")
async def update_customer(cid: str, body: CustomerIn, user=Depends(require_roles("admin", "sales"))):
    upd = {
        "name": body.name.strip(), "mobile": body.mobile.strip(),
        "email": clean_str(body.email), "address": clean_str(body.address),
        "city": clean_str(body.city),
        "notes": clean_str(body.notes), "preferred_contact": body.preferred_contact,
    }
    audit(user, upd, creating=False)
    await db.customers.update_one({"id": cid}, {"$set": upd})
    return await db.customers.find_one({"id": cid}, {"_id": 0})

@api.delete("/customers/{cid}")
async def delete_customer(cid: str, user=Depends(require_roles("admin"))):
    await db.customers.delete_one({"id": cid})
    await db.vehicles.delete_many({"customer_id": cid})
    return {"ok": True}

# ---------------- Vehicles ----------------
@api.get("/vehicles")
async def list_vehicles(customer_id: Optional[str] = None,
                        q: Optional[str] = None,
                        make: Optional[str] = None,
                        model: Optional[str] = None,
                        year: Optional[int] = None,
                        vehicle_type: Optional[str] = None,
                        color: Optional[str] = None,
                        start: Optional[str] = None,
                        end: Optional[str] = None,
                        user=Depends(get_current_user)):
    flt: Dict[str, Any] = {}
    if customer_id: flt["customer_id"] = customer_id
    if make: flt["make"] = {"$regex": f"^{make}$", "$options": "i"}
    if model: flt["model"] = {"$regex": f"^{model}$", "$options": "i"}
    if year: flt["year"] = year
    if vehicle_type: flt["vehicle_type"] = vehicle_type
    if color: flt["color"] = {"$regex": f"^{color}$", "$options": "i"}
    if start or end:
        rng: Dict[str, Any] = {}
        if start: rng["$gte"] = start
        if end: rng["$lte"] = end + "T23:59:59.999"
        flt["created_at"] = rng
    rows = await db.vehicles.find(flt, {"_id": 0}).sort("created_at", -1).to_list(5000)
    if q:
        ql = q.lower()
        # enrich with customer name/mobile for search
        cust_ids = list({r["customer_id"] for r in rows if r.get("customer_id")})
        custs = await db.customers.find({"id": {"$in": cust_ids}}, {"_id": 0, "id": 1, "name": 1, "mobile": 1}).to_list(2000) if cust_ids else []
        cmap = {c["id"]: c for c in custs}
        def matches(v):
            hay = " ".join([
                str(v.get("make", "")), str(v.get("model", "")),
                str(v.get("year", "") or ""), str(v.get("plate", "") or ""),
                str(v.get("vin", "") or ""),
                cmap.get(v.get("customer_id"), {}).get("name", "") or "",
                cmap.get(v.get("customer_id"), {}).get("mobile", "") or "",
            ]).lower()
            return ql in hay
        rows = [r for r in rows if matches(r)]
    return rows

@api.post("/vehicles")
async def create_vehicle(body: VehicleIn, user=Depends(require_roles("admin", "sales"))):
    doc = body.model_dump(); doc["id"] = new_id()
    audit(user, doc)
    await db.vehicles.insert_one(doc.copy())
    doc.pop("_id", None); return doc

@api.get("/vehicles/{vid}")
async def get_vehicle(vid: str, user=Depends(get_current_user)):
    v = await db.vehicles.find_one({"id": vid}, {"_id": 0})
    if not v:
        raise HTTPException(404)
    v["jobs"] = await db.jobs.find({"vehicle_id": vid}, {"_id": 0}).sort("created_at", -1).to_list(100)
    v["quotations"] = await db.quotations.find({"vehicle_id": vid}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return v

@api.patch("/vehicles/{vid}")
async def update_vehicle(vid: str, body: VehicleIn, user=Depends(require_roles("admin", "sales"))):
    upd = body.model_dump()
    audit(user, upd, creating=False)
    await db.vehicles.update_one({"id": vid}, {"$set": upd})
    return await db.vehicles.find_one({"id": vid}, {"_id": 0})

@api.delete("/vehicles/{vid}")
async def delete_vehicle(vid: str, user=Depends(require_roles("admin", "sales"))):
    await db.vehicles.delete_one({"id": vid})
    return {"ok": True}

# ---------------- Vehicle Types ----------------
@api.get("/vehicle-types")
async def list_vt(user=Depends(get_current_user)):
    return await db.vehicle_types.find({}, {"_id": 0}).to_list(100)

@api.post("/vehicle-types")
async def create_vt(body: VehicleTypeIn, user=Depends(require_roles("admin"))):
    if await db.vehicle_types.find_one({"key": body.key}):
        raise HTTPException(400, "Key exists")
    doc = body.model_dump(); doc["id"] = new_id(); audit(user, doc)
    await db.vehicle_types.insert_one(doc.copy())
    doc.pop("_id", None); return doc

@api.patch("/vehicle-types/{vid}")
async def update_vt(vid: str, body: VehicleTypeIn, user=Depends(require_roles("admin"))):
    upd = body.model_dump(); audit(user, upd, creating=False)
    await db.vehicle_types.update_one({"id": vid}, {"$set": upd})
    return await db.vehicle_types.find_one({"id": vid}, {"_id": 0})

@api.delete("/vehicle-types/{vid}")
async def delete_vt(vid: str, user=Depends(require_roles("admin"))):
    await db.vehicle_types.delete_one({"id": vid})
    return {"ok": True}

# ---------------- Vehicle Makes ----------------
@api.get("/vehicle-makes")
async def list_makes(user=Depends(get_current_user)):
    return await db.vehicle_makes.find({}, {"_id": 0}).sort("label", 1).to_list(500)

@api.post("/vehicle-makes")
async def create_make(body: VehicleMakeIn, user=Depends(require_roles("admin"))):
    if await db.vehicle_makes.find_one({"label": body.label}):
        raise HTTPException(400, "Make already exists")
    doc = {"id": new_id(), "label": body.label.strip(), "models": [m.strip() for m in body.models if m.strip()]}
    audit(user, doc)
    await db.vehicle_makes.insert_one(doc.copy())
    doc.pop("_id", None); return doc

@api.patch("/vehicle-makes/{mid}")
async def update_make(mid: str, body: VehicleMakeIn, user=Depends(require_roles("admin"))):
    upd = {"label": body.label.strip(), "models": [m.strip() for m in body.models if m.strip()]}
    audit(user, upd, creating=False)
    await db.vehicle_makes.update_one({"id": mid}, {"$set": upd})
    return await db.vehicle_makes.find_one({"id": mid}, {"_id": 0})

@api.delete("/vehicle-makes/{mid}")
async def delete_make(mid: str, user=Depends(require_roles("admin"))):
    await db.vehicle_makes.delete_one({"id": mid})
    return {"ok": True}

# ---------------- Services ----------------
@api.get("/services")
async def list_services(user=Depends(get_current_user)):
    return await db.services.find({}, {"_id": 0}).to_list(500)

@api.post("/services")
async def create_service(body: ServiceIn, user=Depends(require_roles("admin"))):
    doc = body.model_dump(); doc["id"] = new_id(); audit(user, doc)
    await db.services.insert_one(doc.copy())
    doc.pop("_id", None); return doc

@api.patch("/services/{sid}")
async def update_service(sid: str, body: ServiceIn, user=Depends(require_roles("admin"))):
    upd = body.model_dump(); audit(user, upd, creating=False)
    await db.services.update_one({"id": sid}, {"$set": upd})
    return await db.services.find_one({"id": sid}, {"_id": 0})

@api.delete("/services/{sid}")
async def delete_service(sid: str, user=Depends(require_roles("admin"))):
    await db.services.delete_one({"id": sid})
    return {"ok": True}

# ---------------- Quotations ----------------
def _resolve_discount(lines, discount_type, discount_value, fallback_amount):
    """Return KWD discount amount given a type+value (or fallback to legacy KWD amount)."""
    sub = sum(l["line_total"] for l in lines)
    if discount_type == "percent" and discount_value is not None:
        pct = max(min(discount_value, 100), 0)  # cap at 100%
        return round3(max(sub, 0) * pct / 100)
    if discount_type == "amount" and discount_value is not None:
        return round3(max(discount_value, 0))
    return round3(max(fallback_amount or 0, 0))

def _calc_totals(lines, discount, tax_rate, discount_type=None, discount_value=None):
    sub = sum(l["line_total"] for l in lines)
    disc_amt = _resolve_discount(lines, discount_type, discount_value, discount)
    disc_amt = min(disc_amt, sub)
    after_disc = max(sub - disc_amt, 0)
    tax_amount = round3(after_disc * (tax_rate / 100))
    total = round3(after_disc + tax_amount)
    return {"subtotal": round3(sub), "discount": disc_amt,
            "discount_type": discount_type or ("percent" if (discount_value is not None and discount_type == "percent") else "amount"),
            "discount_value": discount_value if discount_value is not None else disc_amt,
            "tax_rate": tax_rate, "tax_amount": tax_amount, "total": total}

async def _next_seq(name: str) -> int:
    res = await db.counters.find_one_and_update(
        {"_id": name}, {"$inc": {"seq": 1}}, upsert=True, return_document=True
    )
    return res["seq"] if res else 1

def _is_expired(q: dict) -> bool:
    vu = q.get("valid_until")
    if not vu:
        return False
    if q.get("status") in ("approved", "rejected"):
        return False
    try:
        exp = datetime.fromisoformat(vu.replace("Z", "+00:00")) if "T" in vu else datetime.fromisoformat(vu + "T23:59:59+00:00")
    except Exception:
        return False
    return datetime.now(timezone.utc) > exp

@api.get("/quotations")
async def list_quotations(
    q: Optional[str] = None,
    status_: Optional[str] = Query(None, alias="status"),
    creator: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    user=Depends(get_current_user),
):
    flt: Dict[str, Any] = {}
    if status_: flt["status"] = status_
    if creator: flt["created_by"] = creator
    if start or end:
        rng: Dict[str, Any] = {}
        if start: rng["$gte"] = start
        if end: rng["$lte"] = end + "T23:59:59.999"
        flt["created_at"] = rng
    if q:
        # Pre-resolve customer/vehicle ids matching q
        ql_re = {"$regex": q, "$options": "i"}
        cust_ids = [c["id"] for c in await db.customers.find(
            {"$or": [{"name": ql_re}, {"mobile": ql_re}]}, {"id": 1, "_id": 0}).to_list(2000)]
        veh_ids = [v["id"] for v in await db.vehicles.find(
            {"plate": ql_re}, {"id": 1, "_id": 0}).to_list(2000)]
        flt["$or"] = [
            {"number": ql_re},
            {"customer_id": {"$in": cust_ids}},
            {"vehicle_id": {"$in": veh_ids}},
        ]
    rows = await db.quotations.find(flt, {"_id": 0}).sort("created_at", -1).to_list(2000)
    # Enrich with creator name
    user_ids = list({r.get("created_by") for r in rows if r.get("created_by")})
    users = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(500) if user_ids else []
    uname = {u["id"]: u["name"] for u in users}
    for r in rows:
        r["is_expired"] = _is_expired(r)
        r["created_by_name"] = uname.get(r.get("created_by"), "")
    return rows

@api.post("/quotations")
async def create_quotation(body: QuotationIn, user=Depends(require_roles("admin", "sales"))):
    lines = [l.model_dump() for l in body.lines]
    totals = _calc_totals(lines, body.discount, body.tax_rate, body.discount_type, body.discount_value)
    seq = await _next_seq("quotation")
    doc = {
        "id": new_id(), "number": f"QT-{seq:05d}",
        "customer_id": body.customer_id, "vehicle_id": body.vehicle_id,
        "lines": lines, **totals, "notes": body.notes,
        "status": "draft", "valid_until": body.valid_until,
    }
    audit(user, doc)
    await db.quotations.insert_one(doc.copy())
    doc.pop("_id", None)
    doc["is_expired"] = _is_expired(doc)
    doc["created_by_name"] = user.get("name", "")
    return doc

@api.get("/quotations/{qid}")
async def get_quotation(qid: str, user=Depends(get_current_user)):
    q = await db.quotations.find_one({"id": qid}, {"_id": 0})
    if not q: raise HTTPException(404)
    q["customer"] = await db.customers.find_one({"id": q["customer_id"]}, {"_id": 0})
    q["vehicle"] = await db.vehicles.find_one({"id": q["vehicle_id"]}, {"_id": 0})
    q["is_expired"] = _is_expired(q)
    if q.get("created_by"):
        creator = await db.users.find_one({"id": q["created_by"]}, {"_id": 0, "password": 0})
        q["creator"] = creator
        q["created_by_name"] = creator.get("name", "") if creator else ""
    # Linked job (if any)
    linked_job = await db.jobs.find_one({"quotation_id": qid}, {"_id": 0, "id": 1, "number": 1})
    if linked_job:
        q["linked_job_id"] = linked_job["id"]
        q["linked_job_number"] = linked_job["number"]
    return q

@api.patch("/quotations/{qid}")
async def update_quotation(qid: str, body: QuotationIn, user=Depends(require_roles("admin", "sales"))):
    lines = [l.model_dump() for l in body.lines]
    totals = _calc_totals(lines, body.discount, body.tax_rate, body.discount_type, body.discount_value)
    upd = {"customer_id": body.customer_id, "vehicle_id": body.vehicle_id,
           "lines": lines, **totals, "notes": body.notes, "valid_until": body.valid_until}
    audit(user, upd, creating=False)
    await db.quotations.update_one({"id": qid}, {"$set": upd})
    return await db.quotations.find_one({"id": qid}, {"_id": 0})

@api.post("/quotations/{qid}/status")
async def quotation_status(qid: str, body: QuotationStatusIn, user=Depends(require_roles("admin", "sales"))):
    q = await db.quotations.find_one({"id": qid}, {"_id": 0})
    if not q: raise HTTPException(404)
    upd = {"status": body.status}
    audit(user, upd, creating=False)
    await db.quotations.update_one({"id": qid}, {"$set": upd})
    job_id = None; job_number = None
    if body.status == "approved":
        # Auto-create job card if not already linked (idempotent)
        existing = await db.jobs.find_one({"quotation_id": qid}, {"_id": 0, "id": 1, "number": 1})
        if existing:
            job_id, job_number = existing["id"], existing["number"]
        else:
            seq = await _next_seq("job")
            job = {
                "id": new_id(), "number": f"JC-{seq:05d}",
                "quotation_id": qid, "quotation_number": q.get("number"),
                "customer_id": q["customer_id"], "vehicle_id": q["vehicle_id"],
                "lines": q["lines"], "subtotal": q["subtotal"], "discount": q["discount"],
                "discount_type": q.get("discount_type"), "discount_value": q.get("discount_value"),
                "tax_rate": q["tax_rate"], "tax_amount": q["tax_amount"], "total": q["total"],
                "status": "confirmed", "technician_id": None,
                "checklist": [], "before_photos": [], "after_photos": [],
                "payments": [], "time_entries": [],
                "invoice_number": None, "completed_at": None,
                "notes": q.get("notes"),
            }
            audit(user, job)
            await db.jobs.insert_one(job.copy())
            job_id, job_number = job["id"], job["number"]
    res = await db.quotations.find_one({"id": qid}, {"_id": 0})
    if job_id:
        res["job_id"] = job_id
        res["job_number"] = job_number
    return res

@api.delete("/quotations/{qid}")
async def delete_quotation(qid: str, user=Depends(require_roles("admin"))):
    await db.quotations.delete_one({"id": qid})
    return {"ok": True}

@api.post("/quotations/{qid}/convert")
async def convert_to_job(qid: str, user=Depends(require_roles("admin", "sales"))):
    q = await db.quotations.find_one({"id": qid}, {"_id": 0})
    if not q: raise HTTPException(404)
    existing = await db.jobs.find_one({"quotation_id": qid}, {"_id": 0})
    if existing:
        existing.pop("_id", None)
        return _enrich_job(existing) if "_enrich_job" in globals() else existing
    seq = await _next_seq("job")
    job = {
        "id": new_id(), "number": f"JC-{seq:05d}",
        "quotation_id": qid, "quotation_number": q.get("number"),
        "customer_id": q["customer_id"], "vehicle_id": q["vehicle_id"],
        "lines": q["lines"], "subtotal": q["subtotal"], "discount": q["discount"],
        "discount_type": q.get("discount_type"), "discount_value": q.get("discount_value"),
        "tax_rate": q["tax_rate"], "tax_amount": q["tax_amount"], "total": q["total"],
        "status": "confirmed", "technician_id": None,
        "checklist": [], "before_photos": [], "after_photos": [],
        "payments": [], "time_entries": [],
        "invoice_number": None, "completed_at": None,
        "notes": q.get("notes"),
    }
    audit(user, job)
    await db.jobs.insert_one(job.copy())
    await db.quotations.update_one({"id": qid}, {"$set": {"status": "approved", "updated_at": now_iso()}})
    job.pop("_id", None); return job

# ---------------- Jobs ----------------
def _job_payment_summary(job):
    paid = round3(sum(p.get("amount", 0) for p in job.get("payments", [])))
    bal = round3(job.get("total", 0) - paid)
    if paid <= 0:
        st = "unpaid"
    elif bal <= 0.001:
        st = "paid"
    else:
        st = "partial"
    return paid, bal, st

def _job_time_summary(job):
    total = 0
    for t in job.get("time_entries", []):
        total += t.get("duration_seconds", 0) or 0
    running = next((t for t in job.get("time_entries", []) if t.get("end") is None), None)
    return total, running

def _enrich_job(job):
    paid, bal, st = _job_payment_summary(job)
    job["total_paid"] = paid
    job["balance_due"] = bal
    job["payment_status"] = st
    total_sec, running = _job_time_summary(job)
    job["total_seconds"] = total_sec
    job["timer_running"] = running is not None
    return job

@api.get("/jobs")
async def list_jobs(
    status_: Optional[str] = Query(None, alias="status"),
    technician_id: Optional[str] = None,
    q: Optional[str] = None,
    creator: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    user=Depends(get_current_user),
):
    flt: Dict[str, Any] = {}
    if status_: flt["status"] = status_
    if technician_id: flt["technician_id"] = technician_id
    if user["role"] == "technician":
        flt["technician_id"] = user["id"]
    if creator: flt["created_by"] = creator
    if start or end:
        rng: Dict[str, Any] = {}
        if start: rng["$gte"] = start
        if end: rng["$lte"] = end + "T23:59:59.999"
        flt["created_at"] = rng
    if q:
        ql_re = {"$regex": q, "$options": "i"}
        cust_ids = [c["id"] for c in await db.customers.find(
            {"$or": [{"name": ql_re}, {"mobile": ql_re}]}, {"id": 1, "_id": 0}).to_list(2000)]
        veh_ids = [v["id"] for v in await db.vehicles.find(
            {"plate": ql_re}, {"id": 1, "_id": 0}).to_list(2000)]
        flt["$or"] = [
            {"number": ql_re},
            {"invoice_number": ql_re},
            {"quotation_number": ql_re},
            {"customer_id": {"$in": cust_ids}},
            {"vehicle_id": {"$in": veh_ids}},
        ]
    rows = await db.jobs.find(flt, {"_id": 0}).sort("created_at", -1).to_list(2000)
    user_ids = list({r.get("created_by") for r in rows if r.get("created_by")})
    users = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(500) if user_ids else []
    uname = {u["id"]: u["name"] for u in users}
    enriched = []
    for r in rows:
        r["created_by_name"] = uname.get(r.get("created_by"), "")
        if "quotation_number" not in r:
            r["quotation_number"] = None
        enriched.append(_enrich_job(r))
    return enriched

@api.get("/jobs/{jid}")
async def get_job(jid: str, user=Depends(get_current_user)):
    j = await db.jobs.find_one({"id": jid}, {"_id": 0})
    if not j: raise HTTPException(404)
    if user["role"] == "technician" and j.get("technician_id") != user["id"]:
        raise HTTPException(403, "Not assigned")
    j["customer"] = await db.customers.find_one({"id": j["customer_id"]}, {"_id": 0})
    j["vehicle"] = await db.vehicles.find_one({"id": j["vehicle_id"]}, {"_id": 0})
    if j.get("technician_id"):
        j["technician"] = await db.users.find_one({"id": j["technician_id"]}, {"_id": 0, "password": 0})
    if j.get("created_by"):
        creator = await db.users.find_one({"id": j["created_by"]}, {"_id": 0, "password": 0})
        j["creator"] = creator
        j["created_by_name"] = creator.get("name", "") if creator else ""
    if j.get("quotation_id") and not j.get("quotation_number"):
        q = await db.quotations.find_one({"id": j["quotation_id"]}, {"_id": 0, "number": 1})
        if q: j["quotation_number"] = q.get("number")
    return _enrich_job(j)

@api.patch("/jobs/{jid}/invoice")
async def edit_invoice(jid: str, body: JobInvoiceEditIn, user=Depends(require_roles("admin", "sales"))):
    job = await db.jobs.find_one({"id": jid})
    if not job: raise HTTPException(404)
    tax_rate = body.tax_rate if body.tax_rate is not None else job.get("tax_rate", 0)
    # Resolve discount: client-supplied type/value wins; else if a legacy 'discount' float
    # was sent, treat as type='amount' RESET; else fall back to whatever is on the job.
    if body.discount_type is not None or body.discount_value is not None:
        dt = body.discount_type if body.discount_type is not None else "amount"
        dv = body.discount_value if body.discount_value is not None else (body.discount or 0)
        discount_legacy = body.discount if body.discount is not None else job.get("discount", 0)
    elif body.discount is not None:
        dt = "amount"; dv = body.discount; discount_legacy = body.discount
    else:
        dt = job.get("discount_type")
        dv = job.get("discount_value")
        discount_legacy = job.get("discount", 0)
    totals = _calc_totals(job.get("lines", []), discount_legacy, tax_rate, dt, dv)
    upd = {**totals}
    if body.notes is not None:
        upd["notes"] = body.notes
    audit(user, upd, creating=False)
    await db.jobs.update_one({"id": jid}, {"$set": upd})
    return _enrich_job(await db.jobs.find_one({"id": jid}, {"_id": 0}))

@api.post("/jobs/{jid}/status")
async def job_status(jid: str, body: JobStatusIn, user=Depends(get_current_user)):
    job = await db.jobs.find_one({"id": jid})
    if not job: raise HTTPException(404)
    if user["role"] == "technician" and job.get("technician_id") != user["id"]:
        raise HTTPException(403, "Not assigned")
    upd: Dict[str, Any] = {"status": body.status}
    audit(user, upd, creating=False)
    if body.status == "completed":
        if not job.get("invoice_number"):
            seq = await _next_seq("invoice")
            upd["invoice_number"] = f"INV-{seq:05d}"
        upd["completed_at"] = now_iso()
        # stop running timer if any
        entries = job.get("time_entries", [])
        for e in entries:
            if e.get("end") is None:
                e["end"] = now_iso()
                start = datetime.fromisoformat(e["start"])
                e["duration_seconds"] = int((datetime.now(timezone.utc) - start).total_seconds())
        upd["time_entries"] = entries
        # deduct any consumed inventory
        for line in job.get("lines", []):
            for inv in line.get("consumed_inventory", []) or []:
                await db.inventory.update_one({"id": inv["id"]}, {"$inc": {"stock_qty": -inv.get("qty", 0)}})
    await db.jobs.update_one({"id": jid}, {"$set": upd})
    return _enrich_job(await db.jobs.find_one({"id": jid}, {"_id": 0}))

@api.post("/jobs/{jid}/assign")
async def assign_job(jid: str, body: JobAssignIn, user=Depends(require_roles("admin", "sales"))):
    upd = {"technician_id": body.technician_id}
    audit(user, upd, creating=False)
    await db.jobs.update_one({"id": jid}, {"$set": upd})
    return _enrich_job(await db.jobs.find_one({"id": jid}, {"_id": 0}))

@api.post("/jobs/{jid}/checklist")
async def job_checklist(jid: str, body: JobChecklistIn, user=Depends(get_current_user)):
    upd = {"checklist": body.items}
    audit(user, upd, creating=False)
    await db.jobs.update_one({"id": jid}, {"$set": upd})
    return _enrich_job(await db.jobs.find_one({"id": jid}, {"_id": 0}))

@api.post("/jobs/{jid}/photos")
async def job_photos(jid: str, kind: str = Query(..., regex="^(before|after)$"),
                     file: UploadFile = File(...), user=Depends(get_current_user)):
    ext = (file.filename or "img.jpg").split(".")[-1]
    fname = f"{new_id()}.{ext}"
    fpath = UPLOAD_DIR / fname
    with fpath.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    url = f"/api/files/{fname}"
    field = "before_photos" if kind == "before" else "after_photos"
    await db.jobs.update_one({"id": jid}, {"$push": {field: url}, "$set": {"updated_at": now_iso(), "updated_by": user["id"]}})
    return {"url": url}

# Payments
@api.post("/jobs/{jid}/payments")
async def add_payment(jid: str, body: PaymentIn, user=Depends(require_roles("admin", "sales"))):
    job = await db.jobs.find_one({"id": jid})
    if not job: raise HTTPException(404)
    if body.method in ("knet", "credit_card") and not (body.auth_code or "").strip():
        raise HTTPException(400, f"Auth code required for {body.method}")
    if body.amount <= 0:
        raise HTTPException(400, "Amount must be > 0")
    payment = {
        "id": new_id(), "method": body.method, "amount": round3(body.amount),
        "auth_code": clean_str(body.auth_code), "notes": clean_str(body.notes),
        "recorded_by": user["id"], "recorded_at": now_iso(),
    }
    await db.jobs.update_one({"id": jid}, {"$push": {"payments": payment}, "$set": {"updated_at": now_iso(), "updated_by": user["id"]}})
    return _enrich_job(await db.jobs.find_one({"id": jid}, {"_id": 0}))

@api.delete("/jobs/{jid}/payments/{pid}")
async def delete_payment(jid: str, pid: str, user=Depends(require_roles("admin"))):
    await db.jobs.update_one({"id": jid}, {"$pull": {"payments": {"id": pid}}})
    return _enrich_job(await db.jobs.find_one({"id": jid}, {"_id": 0}))

@api.post("/jobs/{jid}/line-consumption")
async def set_line_consumption(jid: str, body: LineConsumptionIn, user=Depends(get_current_user)):
    job = await db.jobs.find_one({"id": jid})
    if not job: raise HTTPException(404)
    if user["role"] == "technician" and job.get("technician_id") != user["id"]:
        raise HTTPException(403, "Not assigned")
    lines = list(job.get("lines", []))
    if body.line_index < 0 or body.line_index >= len(lines):
        raise HTTPException(400, "Invalid line_index")
    lines[body.line_index]["consumed_inventory"] = [c.model_dump() for c in body.consumed_inventory]
    upd = {"lines": lines}
    audit(user, upd, creating=False)
    await db.jobs.update_one({"id": jid}, {"$set": upd})
    return _enrich_job(await db.jobs.find_one({"id": jid}, {"_id": 0}))

@api.patch("/jobs/{jid}/internal-notes")
async def set_internal_notes(jid: str, body: JobInternalNotesIn, user=Depends(get_current_user)):
    job = await db.jobs.find_one({"id": jid})
    if not job: raise HTTPException(404)
    if user["role"] == "technician" and job.get("technician_id") != user["id"]:
        raise HTTPException(403, "Not assigned")
    upd = {"internal_notes": clean_str(body.internal_notes)}
    audit(user, upd, creating=False)
    await db.jobs.update_one({"id": jid}, {"$set": upd})
    return _enrich_job(await db.jobs.find_one({"id": jid}, {"_id": 0}))

# Timer
@api.post("/jobs/{jid}/timer/start")
async def timer_start(jid: str, user=Depends(get_current_user)):
    job = await db.jobs.find_one({"id": jid})
    if not job: raise HTTPException(404)
    if user["role"] == "technician" and job.get("technician_id") != user["id"]:
        raise HTTPException(403, "Not assigned")
    # close any running entry first
    entries = job.get("time_entries", [])
    for e in entries:
        if e.get("end") is None:
            e["end"] = now_iso()
            start = datetime.fromisoformat(e["start"])
            e["duration_seconds"] = int((datetime.now(timezone.utc) - start).total_seconds())
    entries.append({"id": new_id(), "technician_id": user["id"], "start": now_iso(), "end": None, "duration_seconds": 0})
    await db.jobs.update_one({"id": jid}, {"$set": {"time_entries": entries, "updated_at": now_iso()}})
    if job.get("status") == "confirmed":
        await db.jobs.update_one({"id": jid}, {"$set": {"status": "in_progress"}})
    return _enrich_job(await db.jobs.find_one({"id": jid}, {"_id": 0}))

@api.post("/jobs/{jid}/timer/stop")
async def timer_stop(jid: str, user=Depends(get_current_user)):
    job = await db.jobs.find_one({"id": jid})
    if not job: raise HTTPException(404)
    entries = job.get("time_entries", [])
    for e in entries:
        if e.get("end") is None:
            e["end"] = now_iso()
            start = datetime.fromisoformat(e["start"])
            e["duration_seconds"] = int((datetime.now(timezone.utc) - start).total_seconds())
    await db.jobs.update_one({"id": jid}, {"$set": {"time_entries": entries, "updated_at": now_iso()}})
    return _enrich_job(await db.jobs.find_one({"id": jid}, {"_id": 0}))

@api.post("/uploads/area")
async def upload_area_image(file: UploadFile = File(...), user=Depends(get_current_user)):
    ext = (file.filename or "img.jpg").split(".")[-1]
    fname = f"{new_id()}.{ext}"
    with (UPLOAD_DIR / fname).open("wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"url": f"/api/files/{fname}"}

# ---------------- Inventory Categories ----------------
async def _ensure_default_inv_category() -> str:
    """Returns id of the 'Uncategorized' inventory category, creating it if missing."""
    cat = await db.inventory_categories.find_one({"name": "Uncategorized"}, {"_id": 0})
    if cat:
        return cat["id"]
    doc = {"id": new_id(), "name": "Uncategorized", "description": "Default category for unclassified items",
           "active": True, "created_at": now_iso(), "updated_at": now_iso(), "is_default": True}
    await db.inventory_categories.insert_one(doc.copy())
    return doc["id"]

@api.get("/inventory-categories")
async def list_inv_categories(q: Optional[str] = None, user=Depends(get_current_user)):
    flt: Dict[str, Any] = {}
    if q: flt["name"] = {"$regex": q, "$options": "i"}
    rows = await db.inventory_categories.find(flt, {"_id": 0}).sort("name", 1).to_list(500)
    user_ids = list({r.get("created_by") for r in rows if r.get("created_by")})
    users = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(500) if user_ids else []
    uname = {u["id"]: u["name"] for u in users}
    cat_ids = [r["id"] for r in rows]
    counts = {}
    if cat_ids:
        agg = db.inventory.aggregate([
            {"$match": {"category_id": {"$in": cat_ids}}},
            {"$group": {"_id": "$category_id", "n": {"$sum": 1}}},
        ])
        counts = {r["_id"]: r["n"] async for r in agg}
    for r in rows:
        r["created_by_name"] = uname.get(r.get("created_by"), "")
        r["product_count"] = counts.get(r["id"], 0)
    return rows

@api.post("/inventory-categories")
async def create_inv_category(body: InventoryCategoryIn, user=Depends(require_roles("admin", "sales"))):
    if await db.inventory_categories.find_one({"name": body.name.strip()}):
        raise HTTPException(400, "Category name already exists")
    doc = {"id": new_id(), "name": body.name.strip(),
           "description": clean_str(body.description), "active": body.active}
    audit(user, doc)
    await db.inventory_categories.insert_one(doc.copy())
    doc.pop("_id", None); return doc

@api.patch("/inventory-categories/{cid}")
async def update_inv_category(cid: str, body: InventoryCategoryIn, user=Depends(require_roles("admin", "sales"))):
    upd = {"name": body.name.strip(), "description": clean_str(body.description), "active": body.active}
    audit(user, upd, creating=False)
    await db.inventory_categories.update_one({"id": cid}, {"$set": upd})
    return await db.inventory_categories.find_one({"id": cid}, {"_id": 0})

@api.delete("/inventory-categories/{cid}")
async def delete_inv_category(cid: str, user=Depends(require_roles("admin"))):
    cat = await db.inventory_categories.find_one({"id": cid}, {"_id": 0})
    if not cat: raise HTTPException(404)
    if cat.get("is_default"):
        raise HTTPException(400, "Cannot delete the default category. You can mark it inactive instead.")
    linked = await db.inventory.count_documents({"category_id": cid})
    if linked:
        raise HTTPException(400, f"Cannot delete: {linked} product(s) linked. Mark inactive or reassign products.")
    await db.inventory_categories.delete_one({"id": cid})
    return {"ok": True}

@api.get("/export/inventory-categories")
async def export_inv_categories(q: Optional[str] = None, user=Depends(require_roles("admin", "sales"))):
    flt: Dict[str, Any] = {}
    if q: flt["name"] = {"$regex": q, "$options": "i"}
    rows = await db.inventory_categories.find(flt, {"_id": 0}).sort("name", 1).to_list(500)
    cat_ids = [r["id"] for r in rows]
    counts = {}
    if cat_ids:
        agg = db.inventory.aggregate([
            {"$match": {"category_id": {"$in": cat_ids}}},
            {"$group": {"_id": "$category_id", "n": {"$sum": 1}}},
        ])
        counts = {r["_id"]: r["n"] async for r in agg}
    wb = Workbook(); ws = wb.active; ws.title = "Inventory Categories"
    ws.append(["Name", "Description", "Status", "Products", "Created At"])
    for r in rows:
        ws.append([r.get("name"), r.get("description") or "",
                   "Active" if r.get("active", True) else "Inactive",
                   counts.get(r["id"], 0), r.get("created_at") or ""])
    return _xlsx_stream(wb, f"inventory_categories_{datetime.now().strftime('%Y%m%d')}.xlsx")

# ---------------- Service Categories ----------------
@api.get("/service-categories")
async def list_svc_categories(q: Optional[str] = None, user=Depends(get_current_user)):
    flt: Dict[str, Any] = {}
    if q: flt["name"] = {"$regex": q, "$options": "i"}
    rows = await db.service_categories.find(flt, {"_id": 0}).sort("name", 1).to_list(500)
    user_ids = list({r.get("created_by") for r in rows if r.get("created_by")})
    users = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(500) if user_ids else []
    uname = {u["id"]: u["name"] for u in users}
    cat_ids = [r["id"] for r in rows]
    counts = {}
    if cat_ids:
        agg = db.services.aggregate([
            {"$match": {"category_id": {"$in": cat_ids}}},
            {"$group": {"_id": "$category_id", "n": {"$sum": 1}}},
        ])
        counts = {r["_id"]: r["n"] async for r in agg}
    for r in rows:
        r["created_by_name"] = uname.get(r.get("created_by"), "")
        r["service_count"] = counts.get(r["id"], 0)
    return rows

@api.post("/service-categories")
async def create_svc_category(body: ServiceCategoryIn, user=Depends(require_roles("admin"))):
    if await db.service_categories.find_one({"name": body.name.strip()}):
        raise HTTPException(400, "Category name already exists")
    doc = {"id": new_id(), "name": body.name.strip(),
           "description": clean_str(body.description), "active": body.active}
    audit(user, doc)
    await db.service_categories.insert_one(doc.copy())
    doc.pop("_id", None); return doc

@api.patch("/service-categories/{cid}")
async def update_svc_category(cid: str, body: ServiceCategoryIn, user=Depends(require_roles("admin"))):
    upd = {"name": body.name.strip(), "description": clean_str(body.description), "active": body.active}
    audit(user, upd, creating=False)
    await db.service_categories.update_one({"id": cid}, {"$set": upd})
    return await db.service_categories.find_one({"id": cid}, {"_id": 0})

@api.delete("/service-categories/{cid}")
async def delete_svc_category(cid: str, user=Depends(require_roles("admin"))):
    linked = await db.services.count_documents({"category_id": cid})
    if linked:
        raise HTTPException(400, f"Cannot delete: {linked} service(s) linked. Mark inactive or reassign services.")
    await db.service_categories.delete_one({"id": cid})
    return {"ok": True}

# ---------------- Inventory ----------------
@api.get("/inventory")
async def list_inventory(q: Optional[str] = None, category_id: Optional[str] = None,
                         status_: Optional[str] = Query(None, alias="status"),
                         user=Depends(get_current_user)):
    flt: Dict[str, Any] = {}
    if category_id and category_id != "all":
        flt["category_id"] = category_id
    if status_ == "active": flt["active"] = {"$ne": False}
    elif status_ == "inactive": flt["active"] = False
    rows = await db.inventory.find(flt, {"_id": 0}).sort("name", 1).to_list(2000)
    if q:
        ql = q.lower()
        rows = [r for r in rows if ql in (r.get("sku") or "").lower()
                or ql in (r.get("name") or "").lower()
                or ql in (r.get("category") or "").lower()
                or ql in str(r.get("selling_price") or "")
                or ql in str(r.get("cost_price") or "")]
    # enrich with category name
    cat_ids = list({r["category_id"] for r in rows if r.get("category_id")})
    cats = await db.inventory_categories.find({"id": {"$in": cat_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(500) if cat_ids else []
    cmap = {c["id"]: c["name"] for c in cats}
    for r in rows:
        r["category_name"] = cmap.get(r.get("category_id"), r.get("category") or "")
        r["reorder_level"] = r.get("reorder_level", r.get("low_stock_threshold", 0))
    return rows

async def _migrate_inv_to_default():
    """One-time migration: items without category_id → default category."""
    default_id = await _ensure_default_inv_category()
    await db.inventory.update_many(
        {"$or": [{"category_id": {"$exists": False}}, {"category_id": None}, {"category_id": ""}]},
        {"$set": {"category_id": default_id, "active": True}})

@api.post("/inventory")
async def create_inv(body: InventoryIn, user=Depends(require_roles("admin", "sales"))):
    doc = body.model_dump()
    if not doc.get("category_id"):
        doc["category_id"] = await _ensure_default_inv_category()
    if doc.get("reorder_level") is not None:
        doc["low_stock_threshold"] = doc["reorder_level"]
    doc["id"] = new_id(); audit(user, doc)
    await db.inventory.insert_one(doc.copy())
    doc.pop("_id", None); return doc

@api.patch("/inventory/{iid}")
async def update_inv(iid: str, body: InventoryIn, user=Depends(require_roles("admin", "sales"))):
    upd = body.model_dump()
    if not upd.get("category_id"):
        upd["category_id"] = await _ensure_default_inv_category()
    if upd.get("reorder_level") is not None:
        upd["low_stock_threshold"] = upd["reorder_level"]
    audit(user, upd, creating=False)
    await db.inventory.update_one({"id": iid}, {"$set": upd})
    return await db.inventory.find_one({"id": iid}, {"_id": 0})

@api.delete("/inventory/{iid}")
async def delete_inv(iid: str, user=Depends(require_roles("admin"))):
    await db.inventory.delete_one({"id": iid})
    return {"ok": True}

@api.get("/export/inventory")
async def export_inventory(q: Optional[str] = None, category_id: Optional[str] = None,
                           status_: Optional[str] = Query(None, alias="status"),
                           user=Depends(require_roles("admin", "sales"))):
    flt: Dict[str, Any] = {}
    if category_id and category_id != "all":
        flt["category_id"] = category_id
    if status_ == "active": flt["active"] = {"$ne": False}
    elif status_ == "inactive": flt["active"] = False
    rows = await db.inventory.find(flt, {"_id": 0}).sort("name", 1).to_list(10000)
    if q:
        ql = q.lower()
        rows = [r for r in rows if ql in (r.get("sku") or "").lower()
                or ql in (r.get("name") or "").lower()
                or ql in (r.get("category") or "").lower()]
    cats = await db.inventory_categories.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(500)
    cmap = {c["id"]: c["name"] for c in cats}
    wb = Workbook(); ws = wb.active; ws.title = "Inventory"
    ws.append(["SKU", "Name", "Category", "Unit", "Cost Price (KWD)", "Selling Price (KWD)",
               "Stock Qty", "Reorder Level", "Status", "Created At"])
    for r in rows:
        cat_name = cmap.get(r.get("category_id"), r.get("category") or "")
        ws.append([r.get("sku"), r.get("name"), cat_name, r.get("unit"),
                   r.get("cost_price", 0), r.get("selling_price", 0),
                   r.get("stock_qty", 0),
                   r.get("reorder_level", r.get("low_stock_threshold", 0)),
                   "Active" if r.get("active", True) else "Inactive",
                   r.get("created_at") or ""])
    suffix = ""
    if category_id and category_id != "all":
        cn = cmap.get(category_id, "category"); suffix = "_" + "".join(ch for ch in cn if ch.isalnum())
    return _xlsx_stream(wb, f"inventory{suffix}_{datetime.now().strftime('%Y%m%d')}.xlsx")

# ---------------- Appointments ----------------
@api.get("/appointments")
async def list_appts(user=Depends(get_current_user)):
    return await db.appointments.find({}, {"_id": 0}).sort("start", 1).to_list(2000)

@api.post("/appointments")
async def create_appt(body: AppointmentIn, user=Depends(require_roles("admin", "sales"))):
    doc = body.model_dump(); doc["id"] = new_id(); audit(user, doc)
    await db.appointments.insert_one(doc.copy())
    doc.pop("_id", None); return doc

@api.patch("/appointments/{aid}")
async def update_appt(aid: str, body: AppointmentIn, user=Depends(require_roles("admin", "sales"))):
    upd = body.model_dump(); audit(user, upd, creating=False)
    await db.appointments.update_one({"id": aid}, {"$set": upd})
    return await db.appointments.find_one({"id": aid}, {"_id": 0})

@api.delete("/appointments/{aid}")
async def delete_appt(aid: str, user=Depends(require_roles("admin", "sales"))):
    await db.appointments.delete_one({"id": aid})
    return {"ok": True}

# ---------------- Notifications ----------------
@api.get("/notifications")
async def notifications(user=Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    three_days = (now - timedelta(days=3)).isoformat()
    seven_days = (now - timedelta(days=7)).isoformat()
    five_days = (now - timedelta(days=5)).isoformat()

    low_stock = await db.inventory.find(
        {"$expr": {"$lte": ["$stock_qty", "$low_stock_threshold"]}}, {"_id": 0}
    ).to_list(50)
    overdue_inprog = await db.jobs.find(
        {"status": "in_progress", "updated_at": {"$lt": three_days}}, {"_id": 0}
    ).to_list(50)
    overdue_confirmed = await db.jobs.find(
        {"status": "confirmed", "created_at": {"$lt": seven_days}}, {"_id": 0}
    ).to_list(50)
    pending_q = await db.quotations.find(
        {"status": "sent", "updated_at": {"$lt": five_days}}, {"_id": 0}
    ).to_list(50)
    # outstanding A/R: completed jobs not fully paid
    completed = await db.jobs.find({"status": "completed"}, {"_id": 0}).to_list(2000)
    outstanding = []
    total_outstanding = 0.0
    for j in completed:
        paid = sum(p.get("amount", 0) for p in j.get("payments", []))
        bal = round3(j.get("total", 0) - paid)
        if bal > 0.001:
            outstanding.append({"id": j["id"], "number": j.get("number"), "invoice_number": j.get("invoice_number"),
                                "customer_id": j["customer_id"], "balance": bal, "total": j.get("total", 0)})
            total_outstanding += bal
    # expired quotations
    all_q = await db.quotations.find({"status": {"$in": ["draft", "sent"]}}, {"_id": 0}).to_list(500)
    expired_quotes = [q for q in all_q if _is_expired(q)]
    return {
        "low_stock": low_stock,
        "overdue_jobs": overdue_inprog + overdue_confirmed,
        "pending_quotations": pending_q,
        "expired_quotations": expired_quotes,
        "outstanding_jobs": outstanding,
        "total_outstanding": round3(total_outstanding),
        "count": len(low_stock) + len(overdue_inprog) + len(overdue_confirmed) + len(pending_q) + len(expired_quotes) + len(outstanding),
    }

@api.get("/reports/payments")
async def payments_report(
    start: Optional[str] = None, end: Optional[str] = None,
    method: Optional[str] = None,
    received_by: Optional[str] = None,
    user=Depends(require_roles("admin", "sales")),
):
    # Default to TODAY if no date range supplied
    if not start and not end:
        today = datetime.now(timezone.utc).date().isoformat()
        start = today; end = today
    rng_lo = start + "T00:00:00" if start else None
    rng_hi = (end + "T23:59:59.999") if end else None
    jobs = await db.jobs.find({"payments.0": {"$exists": True}}, {"_id": 0}).to_list(20000)
    cust_ids = list({j["customer_id"] for j in jobs if j.get("customer_id")})
    veh_ids = list({j["vehicle_id"] for j in jobs if j.get("vehicle_id")})
    custs = await db.customers.find({"id": {"$in": cust_ids}}, {"_id": 0, "id": 1, "name": 1, "mobile": 1}).to_list(5000) if cust_ids else []
    vehs = await db.vehicles.find({"id": {"$in": veh_ids}}, {"_id": 0, "id": 1, "plate": 1, "make": 1, "model": 1}).to_list(5000) if veh_ids else []
    cmap = {c["id"]: c for c in custs}
    vmap = {v["id"]: v for v in vehs}
    user_ids = list({p.get("recorded_by") for j in jobs for p in j.get("payments", []) if p.get("recorded_by")})
    users_docs = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(500) if user_ids else []
    umap = {u["id"]: u["name"] for u in users_docs}

    flat: List[Dict[str, Any]] = []
    for j in jobs:
        cust = cmap.get(j.get("customer_id"), {})
        veh = vmap.get(j.get("vehicle_id"), {})
        for p in j.get("payments", []):
            ra = p.get("recorded_at") or ""
            if rng_lo and (not ra or ra < rng_lo): continue
            if rng_hi and (not ra or ra > rng_hi): continue
            if method and method != "all" and p.get("method") != method: continue
            if received_by and received_by != "all" and p.get("recorded_by") != received_by: continue
            flat.append({
                "payment_id": p.get("id"),
                "payment_date": ra,
                "method": p.get("method"),
                "amount": round3(p.get("amount", 0)),
                "auth_code": p.get("auth_code") or "",
                "job_id": j.get("id"),
                "job_number": j.get("number"),
                "invoice_number": j.get("invoice_number") or "",
                "customer_name": cust.get("name") or "",
                "customer_mobile": cust.get("mobile") or "",
                "vehicle_plate": veh.get("plate") or "",
                "vehicle_label": f"{veh.get('make','')} {veh.get('model','')}".strip(),
                "received_by_id": p.get("recorded_by") or "",
                "received_by": umap.get(p.get("recorded_by"), ""),
                "balance_due": round3(j.get("total", 0) - sum(x.get("amount", 0) for x in j.get("payments", []))),
                "job_total": j.get("total", 0),
            })
    flat.sort(key=lambda x: x["payment_date"], reverse=True)
    by_method: Dict[str, float] = {"cash": 0, "knet": 0, "credit_card": 0}
    for p in flat:
        by_method[p["method"]] = by_method.get(p["method"], 0) + p["amount"]
    return {
        "payments": flat,
        "total_amount": round3(sum(p["amount"] for p in flat)),
        "count": len(flat),
        "by_method": [{"method": k, "amount": round3(v)} for k, v in by_method.items()],
        "filters": {"start": start, "end": end, "method": method or "all", "received_by": received_by or "all"},
    }

@api.get("/reports/payments/export")
async def payments_export(
    start: Optional[str] = None, end: Optional[str] = None,
    method: Optional[str] = None, received_by: Optional[str] = None,
    user=Depends(require_roles("admin", "sales")),
):
    data = await payments_report(start, end, method, received_by, user)
    wb = Workbook(); ws = wb.active; ws.title = "Payments"
    ws.append(["Payment Date", "Job #", "Invoice #", "Customer Name", "Mobile",
               "Vehicle Plate", "Vehicle", "Payment Mode", "Auth Code",
               "Amount (KWD)", "Job Total (KWD)", "Balance Due (KWD)", "Received By"])
    for p in data["payments"]:
        ws.append([p["payment_date"], p["job_number"], p["invoice_number"],
                   p["customer_name"], p["customer_mobile"], p["vehicle_plate"],
                   p["vehicle_label"], p["method"], p["auth_code"],
                   p["amount"], p["job_total"], p["balance_due"], p["received_by"]])
    # Summary footer
    ws.append([])
    ws.append(["", "", "", "", "", "", "", "TOTAL", "", data["total_amount"]])
    return _xlsx_stream(wb, f"payments_{(start or 'all')}_{(end or 'all')}.xlsx")

# ---------------- Reports ----------------
def _date_filter(start, end):
    rng: Dict[str, Any] = {}
    if start: rng["$gte"] = start
    if end: rng["$lte"] = end + "T23:59:59.999"
    return rng

@api.get("/reports/dashboard")
async def dashboard(user=Depends(get_current_user)):
    today = datetime.now(timezone.utc).date().isoformat()
    today_start = today + "T00:00:00"
    today_end = today + "T23:59:59.999"
    todays_jobs = await db.jobs.count_documents({"created_at": {"$gte": today_start, "$lte": today_end}})
    pending_jobs = await db.jobs.count_documents({"status": {"$in": ["confirmed", "in_progress"]}})
    completed_today = await db.jobs.find(
        {"status": "completed", "completed_at": {"$gte": today_start, "$lte": today_end}}, {"_id": 0}
    ).to_list(1000)
    revenue_today = round3(sum(j.get("total", 0) for j in completed_today))
    customers_count = await db.customers.count_documents({})
    low_stock = await db.inventory.find(
        {"$expr": {"$lte": ["$stock_qty", "$low_stock_threshold"]}}, {"_id": 0}
    ).to_list(50)
    # 7 day series
    series = []
    for i in range(6, -1, -1):
        d = (datetime.now(timezone.utc) - timedelta(days=i)).date().isoformat()
        s = d + "T00:00:00"; e = d + "T23:59:59.999"
        jobs = await db.jobs.find({"status": "completed", "completed_at": {"$gte": s, "$lte": e}}, {"_id": 0}).to_list(500)
        series.append({"date": d, "revenue": round3(sum(j.get("total", 0) for j in jobs))})
    # outstanding A/R
    completed_all = await db.jobs.find({"status": "completed"}, {"_id": 0}).to_list(5000)
    outstanding = 0.0
    for j in completed_all:
        paid = sum(p.get("amount", 0) for p in j.get("payments", []))
        bal = j.get("total", 0) - paid
        if bal > 0.001:
            outstanding += bal
    return {
        "todays_jobs": todays_jobs, "pending_jobs": pending_jobs,
        "revenue_today": revenue_today, "customers_count": customers_count,
        "low_stock": low_stock, "revenue_series": series,
        "outstanding_total": round3(outstanding),
    }

@api.get("/reports/sales")
async def sales_report(start: Optional[str] = None, end: Optional[str] = None, user=Depends(require_roles("admin", "sales"))):
    flt: Dict[str, Any] = {"status": "completed"}
    df = _date_filter(start, end)
    if df: flt["completed_at"] = df
    jobs = await db.jobs.find(flt, {"_id": 0}).to_list(10000)
    by_service: Dict[str, float] = {}
    by_method: Dict[str, float] = {"cash": 0, "knet": 0, "credit_card": 0}
    for j in jobs:
        for line in j.get("lines", []):
            by_service[line["service_name"]] = by_service.get(line["service_name"], 0) + line.get("line_total", 0)
        for p in j.get("payments", []):
            by_method[p["method"]] = by_method.get(p["method"], 0) + p.get("amount", 0)
    total_revenue = round3(sum(j.get("total", 0) for j in jobs))
    total_collected = round3(sum(v for v in by_method.values()))
    return {"jobs": jobs, "total_revenue": total_revenue,
            "total_collected": total_collected,
            "by_service": [{"service": k, "amount": round3(v)} for k, v in sorted(by_service.items(), key=lambda x: -x[1])],
            "by_method": [{"method": k, "amount": round3(v)} for k, v in by_method.items()]}

@api.get("/reports/jobs")
async def jobs_report(start: Optional[str] = None, end: Optional[str] = None, user=Depends(get_current_user)):
    flt: Dict[str, Any] = {}
    df = _date_filter(start, end)
    if df: flt["created_at"] = df
    jobs = await db.jobs.find(flt, {"_id": 0}).to_list(10000)
    by_status: Dict[str, int] = {}
    for j in jobs:
        by_status[j["status"]] = by_status.get(j["status"], 0) + 1
    return {"jobs": jobs, "by_status": [{"status": k, "count": v} for k, v in by_status.items()]}

@api.get("/reports/inventory")
async def inv_report(user=Depends(get_current_user)):
    items = await db.inventory.find({}, {"_id": 0}).to_list(2000)
    total_value = round3(sum(i.get("stock_qty", 0) * i.get("cost_price", 0) for i in items))
    low = [i for i in items if i.get("stock_qty", 0) <= i.get("low_stock_threshold", 0)]
    return {"items": items, "total_stock_value": total_value, "low_stock": low}

@api.get("/reports/pnl")
async def pnl_report(start: Optional[str] = None, end: Optional[str] = None, user=Depends(require_roles("admin"))):
    flt: Dict[str, Any] = {"status": "completed"}
    df = _date_filter(start, end)
    if df: flt["completed_at"] = df
    jobs = await db.jobs.find(flt, {"_id": 0}).to_list(10000)
    revenue = round3(sum(j.get("total", 0) for j in jobs))
    discounts = round3(sum(j.get("discount", 0) for j in jobs))
    tax_collected = round3(sum(j.get("tax_amount", 0) for j in jobs))
    # COGS approximation: sum of consumed_inventory cost_price * qty
    cogs = 0.0
    for j in jobs:
        for line in j.get("lines", []):
            for inv in line.get("consumed_inventory", []) or []:
                inv_doc = await db.inventory.find_one({"id": inv["id"]}, {"_id": 0})
                if inv_doc:
                    cogs += inv_doc.get("cost_price", 0) * inv.get("qty", 0)
    cogs = round3(cogs)
    gross_profit = round3(revenue - cogs)
    return {
        "revenue": revenue, "discounts_given": discounts, "tax_collected": tax_collected,
        "cogs": cogs, "gross_profit": gross_profit, "job_count": len(jobs),
        "net_profit": gross_profit,  # without expenses tracking
    }

@api.get("/reports/customer-history/{cid}")
async def customer_history(cid: str, start: Optional[str] = None, end: Optional[str] = None, user=Depends(get_current_user)):
    flt: Dict[str, Any] = {"customer_id": cid}
    df = _date_filter(start, end)
    if df: flt["created_at"] = df
    jobs = await db.jobs.find(flt, {"_id": 0}).sort("created_at", -1).to_list(2000)
    quotations = await db.quotations.find(flt, {"_id": 0}).sort("created_at", -1).to_list(2000)
    total_spent = round3(sum(j.get("total", 0) for j in jobs if j.get("status") == "completed"))
    return {"jobs": jobs, "quotations": quotations, "total_spent": total_spent, "visits": len([j for j in jobs if j.get("status") == "completed"])}

# ---------------- Excel Import/Export ----------------
from io import BytesIO
from fastapi.responses import StreamingResponse
from openpyxl import Workbook, load_workbook

def _xlsx_stream(wb, filename: str):
    buf = BytesIO()
    wb.save(buf); buf.seek(0)
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": f"attachment; filename={filename}"})

@api.get("/export/customers")
async def export_customers(q: Optional[str] = None, user=Depends(require_roles("admin", "sales"))):
    flt: Dict[str, Any] = {}
    if q:
        flt["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"mobile": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
        ]
    customers = await db.customers.find(flt, {"_id": 0}).sort("created_at", -1).to_list(10000)
    wb = Workbook(); ws = wb.active; ws.title = "Customers"
    headers = ["Name", "Mobile", "Email", "Address", "City", "Notes", "Preferred Contact", "Created At"]
    ws.append(headers)
    for c in customers:
        ws.append([c.get("name"), c.get("mobile"), c.get("email") or "",
                   c.get("address") or "", c.get("city") or "", c.get("notes") or "",
                   c.get("preferred_contact") or "", c.get("created_at") or ""])
    return _xlsx_stream(wb, f"customers_{datetime.now().strftime('%Y%m%d')}.xlsx")

@api.post("/import/customers")
async def import_customers(file: UploadFile = File(...), user=Depends(require_roles("admin", "sales"))):
    try:
        content = await file.read()
        wb = load_workbook(BytesIO(content), read_only=True, data_only=True)
    except Exception as e:
        raise HTTPException(400, f"Invalid xlsx: {e}")
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return {"created": 0, "errors": ["Empty file"]}
    header = [str(h or "").strip().lower() for h in rows[0]]
    def col(r, *names):
        for n in names:
            if n in header:
                v = r[header.index(n)]
                return str(v).strip() if v is not None else ""
        return ""
    created, skipped, errors = 0, 0, []
    for i, r in enumerate(rows[1:], start=2):
        if not r or all(v is None or str(v).strip() == "" for v in r):
            continue
        name = col(r, "name", "customer name")
        mobile = col(r, "mobile", "mobile number", "phone")
        if not name or not mobile:
            errors.append(f"Row {i}: Name and Mobile are required")
            continue
        if await db.customers.find_one({"mobile": mobile}):
            skipped += 1
            continue
        doc = {
            "id": new_id(), "name": name, "mobile": mobile,
            "email": col(r, "email") or None,
            "address": col(r, "address") or None,
            "city": col(r, "city", "area") or None,
            "notes": col(r, "notes") or None,
            "preferred_contact": (col(r, "preferred contact", "preferred_contact") or "mobile").lower(),
        }
        if doc["preferred_contact"] not in ("mobile", "email", "whatsapp"):
            doc["preferred_contact"] = "mobile"
        audit(user, doc)
        await db.customers.insert_one(doc.copy())
        created += 1
    return {"created": created, "skipped_duplicates": skipped, "errors": errors,
            "total_rows": len(rows) - 1}

@api.get("/export/vehicles")
async def export_vehicles(q: Optional[str] = None, make: Optional[str] = None,
                          model: Optional[str] = None, year: Optional[int] = None,
                          vehicle_type: Optional[str] = None, color: Optional[str] = None,
                          start: Optional[str] = None, end: Optional[str] = None,
                          user=Depends(require_roles("admin", "sales"))):
    flt: Dict[str, Any] = {}
    if make: flt["make"] = {"$regex": f"^{make}$", "$options": "i"}
    if model: flt["model"] = {"$regex": f"^{model}$", "$options": "i"}
    if year: flt["year"] = year
    if vehicle_type: flt["vehicle_type"] = vehicle_type
    if color: flt["color"] = {"$regex": f"^{color}$", "$options": "i"}
    if start or end:
        rng: Dict[str, Any] = {}
        if start: rng["$gte"] = start
        if end: rng["$lte"] = end + "T23:59:59.999"
        flt["created_at"] = rng
    vehicles = await db.vehicles.find(flt, {"_id": 0}).sort("created_at", -1).to_list(20000)
    cust_ids = list({v["customer_id"] for v in vehicles if v.get("customer_id")})
    custs = await db.customers.find({"id": {"$in": cust_ids}}, {"_id": 0}).to_list(5000) if cust_ids else []
    cmap = {c["id"]: c for c in custs}
    if q:
        ql = q.lower()
        def m(v):
            hay = " ".join([str(v.get(k, "") or "") for k in ("make", "model", "year", "plate", "vin")] +
                           [cmap.get(v.get("customer_id"), {}).get("name", "") or "",
                            cmap.get(v.get("customer_id"), {}).get("mobile", "") or ""]).lower()
            return ql in hay
        vehicles = [v for v in vehicles if m(v)]
    wb = Workbook(); ws = wb.active; ws.title = "Vehicles"
    ws.append(["Make", "Model", "Year", "Plate", "VIN/Chassis", "Color", "Type",
               "Customer Name", "Customer Mobile", "Created At"])
    for v in vehicles:
        c = cmap.get(v.get("customer_id"), {})
        ws.append([v.get("make"), v.get("model"), v.get("year") or "",
                   v.get("plate") or "", v.get("vin") or "", v.get("color") or "",
                   v.get("vehicle_type") or "", c.get("name") or "", c.get("mobile") or "",
                   v.get("created_at") or ""])
    return _xlsx_stream(wb, f"vehicles_{datetime.now().strftime('%Y%m%d')}.xlsx")

# ---------------- Segments ----------------
class SegmentFilter(BaseModel):
    # Multi-select arrays (preferred). Single-value fields kept for back-compat.
    makes: List[str] = []
    models: List[str] = []
    years: List[int] = []
    colors: List[str] = []
    vehicle_types: List[str] = []
    cities: List[str] = []

    make: Optional[str] = None
    model: Optional[str] = None
    year_min: Optional[int] = None
    year_max: Optional[int] = None
    color: Optional[str] = None
    vehicle_type: Optional[str] = None
    created_after: Optional[str] = None
    created_before: Optional[str] = None
    city: Optional[str] = None
    has_vehicles: Optional[bool] = None
    recent_days: Optional[int] = None
    # Behavioural filters (joined via jobs collection)
    last_service_after: Optional[str] = None  # ISO date YYYY-MM-DD
    last_service_before: Optional[str] = None
    min_total_spend: Optional[float] = None
    max_total_spend: Optional[float] = None
    min_job_count: Optional[int] = None
    max_job_count: Optional[int] = None

class SegmentIn(BaseModel):
    name: str
    description: Optional[str] = None
    filters: SegmentFilter = Field(default_factory=SegmentFilter)

async def _apply_segment_filters(f: SegmentFilter):
    # Normalise: merge legacy single fields into lists (OR-within-group semantics)
    makes = [m for m in (f.makes or []) if m]
    if f.make: makes.append(f.make)
    models = [m for m in (f.models or []) if m]
    if f.model: models.append(f.model)
    years = list(f.years or [])
    colors = [c for c in (f.colors or []) if c]
    if f.color: colors.append(f.color)
    vts = [v for v in (f.vehicle_types or []) if v]
    if f.vehicle_type: vts.append(f.vehicle_type)
    cities = [c for c in (f.cities or []) if c]
    if f.city: cities.append(f.city)

    cust_flt: Dict[str, Any] = {}
    if cities:
        cust_flt["$or"] = []
        for ci in cities:
            cust_flt["$or"].append({"city": {"$regex": ci, "$options": "i"}})
            cust_flt["$or"].append({"address": {"$regex": ci, "$options": "i"}})
    if f.created_after or f.created_before or f.recent_days:
        rng: Dict[str, Any] = {}
        if f.created_after: rng["$gte"] = f.created_after
        if f.created_before: rng["$lte"] = f.created_before + "T23:59:59.999"
        if f.recent_days:
            cutoff = (datetime.now(timezone.utc) - timedelta(days=f.recent_days)).isoformat()
            rng["$gte"] = max(rng.get("$gte", ""), cutoff) if rng.get("$gte") else cutoff
        cust_flt["created_at"] = rng
    customers = await db.customers.find(cust_flt, {"_id": 0}).to_list(10000)

    veh_filters_active = bool(makes or models or years or colors or vts or f.year_min or f.year_max)
    if veh_filters_active or f.has_vehicles is not None:
        and_clauses: List[Dict[str, Any]] = []
        if makes:
            and_clauses.append({"$or": [{"make": {"$regex": f"^{m}$", "$options": "i"}} for m in makes]})
        if models:
            and_clauses.append({"$or": [{"model": {"$regex": f"^{m}$", "$options": "i"}} for m in models]})
        if colors:
            and_clauses.append({"$or": [{"color": {"$regex": f"^{c}$", "$options": "i"}} for c in colors]})
        if vts:
            and_clauses.append({"vehicle_type": {"$in": vts}})
        if years:
            and_clauses.append({"year": {"$in": years}})
        elif f.year_min or f.year_max:
            yr: Dict[str, Any] = {}
            if f.year_min: yr["$gte"] = f.year_min
            if f.year_max: yr["$lte"] = f.year_max
            and_clauses.append({"year": yr})
        vflt = {"$and": and_clauses} if and_clauses else {}
        vehicles = await db.vehicles.find(vflt, {"_id": 0}).to_list(20000)
        cust_ids_with_match = {v["customer_id"] for v in vehicles}
        if veh_filters_active:
            customers = [c for c in customers if c["id"] in cust_ids_with_match]
        if f.has_vehicles is True and not veh_filters_active:
            all_veh = await db.vehicles.find({}, {"customer_id": 1, "_id": 0}).to_list(20000)
            any_ids = {v["customer_id"] for v in all_veh}
            customers = [c for c in customers if c["id"] in any_ids]
        elif f.has_vehicles is False:
            all_veh = await db.vehicles.find({}, {"customer_id": 1, "_id": 0}).to_list(20000)
            any_ids = {v["customer_id"] for v in all_veh}
            customers = [c for c in customers if c["id"] not in any_ids]

    # Behavioural filters (jobs aggregation)
    behavioural_active = any([
        f.last_service_after, f.last_service_before,
        f.min_total_spend is not None, f.max_total_spend is not None,
        f.min_job_count is not None, f.max_job_count is not None,
    ])
    if behavioural_active and customers:
        cust_id_list = [c["id"] for c in customers]
        jobs_cur = db.jobs.aggregate([
            {"$match": {"customer_id": {"$in": cust_id_list}}},
            {"$group": {
                "_id": "$customer_id",
                "job_count": {"$sum": 1},
                "total_spend": {"$sum": {"$ifNull": ["$totals.total", 0]}},
                "last_service": {"$max": {
                    "$cond": [{"$eq": ["$status", "completed"]}, "$completed_at", None]
                }},
            }},
        ])
        stats = {row["_id"]: row async for row in jobs_cur}
        las = f.last_service_after
        lbs = (f.last_service_before + "T23:59:59.999") if f.last_service_before else None

        def keep(c):
            s = stats.get(c["id"], {"job_count": 0, "total_spend": 0.0, "last_service": None})
            if f.min_job_count is not None and s["job_count"] < f.min_job_count: return False
            if f.max_job_count is not None and s["job_count"] > f.max_job_count: return False
            if f.min_total_spend is not None and (s["total_spend"] or 0) < f.min_total_spend: return False
            if f.max_total_spend is not None and (s["total_spend"] or 0) > f.max_total_spend: return False
            if las or lbs:
                ls = s.get("last_service")
                if not ls: return False
                if las and ls < las: return False
                if lbs and ls > lbs: return False
            return True

        customers = [c for c in customers if keep(c)]
        # Annotate with stats for preview
        for c in customers:
            s = stats.get(c["id"], {"job_count": 0, "total_spend": 0.0, "last_service": None})
            c["job_count"] = s["job_count"]
            c["total_spend"] = round3(s["total_spend"] or 0)
            c["last_service"] = s["last_service"]
    return customers

@api.post("/segments/preview")
async def segment_preview(body: SegmentFilter, user=Depends(require_roles("admin", "sales"))):
    customers = await _apply_segment_filters(body)
    return {"count": len(customers), "customers": customers}

@api.get("/segments")
async def list_segments(user=Depends(require_roles("admin", "sales"))):
    rows = await db.segments.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    for r in rows:
        by = await db.users.find_one({"id": r.get("created_by")}, {"_id": 0, "name": 1})
        r["created_by_name"] = by.get("name") if by else ""
    return rows

@api.post("/segments")
async def create_segment(body: SegmentIn, user=Depends(require_roles("admin", "sales"))):
    customers = await _apply_segment_filters(body.filters)
    doc = {
        "id": new_id(), "name": body.name.strip(),
        "description": clean_str(body.description),
        "filters": body.filters.model_dump(),
        "customer_count": len(customers),
    }
    audit(user, doc)
    await db.segments.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc

@api.get("/segments/{sid}")
async def get_segment(sid: str, q: Optional[str] = None, user=Depends(require_roles("admin", "sales"))):
    s = await db.segments.find_one({"id": sid}, {"_id": 0})
    if not s: raise HTTPException(404)
    by = await db.users.find_one({"id": s.get("created_by")}, {"_id": 0, "name": 1})
    s["created_by_name"] = by.get("name") if by else ""
    customers = await _apply_segment_filters(SegmentFilter(**s["filters"]))
    # Enrich with vehicles (first match) for the segment detail view
    cids = [c["id"] for c in customers]
    vehs = await db.vehicles.find({"customer_id": {"$in": cids}}, {"_id": 0}).to_list(20000) if cids else []
    by_cust: Dict[str, List[Dict[str, Any]]] = {}
    for v in vehs:
        by_cust.setdefault(v["customer_id"], []).append(v)
    for c in customers:
        c["vehicles"] = by_cust.get(c["id"], [])
    if q:
        ql = q.lower().strip()
        customers = [c for c in customers if ql in (c.get("name") or "").lower() or ql in (c.get("mobile") or "").lower()]
    s["customers"] = customers
    s["customer_count"] = len(customers)
    return s

@api.delete("/segments/{sid}")
async def delete_segment(sid: str, user=Depends(require_roles("admin"))):
    await db.segments.delete_one({"id": sid})
    return {"ok": True}

@api.get("/segments/{sid}/export")
async def export_segment(sid: str, user=Depends(require_roles("admin", "sales"))):
    s = await db.segments.find_one({"id": sid}, {"_id": 0})
    if not s: raise HTTPException(404)
    customers = await _apply_segment_filters(SegmentFilter(**s["filters"]))
    cids = [c["id"] for c in customers]
    vehs = await db.vehicles.find({"customer_id": {"$in": cids}}, {"_id": 0}).to_list(20000) if cids else []
    by_cust: Dict[str, List[Dict[str, Any]]] = {}
    for v in vehs:
        by_cust.setdefault(v["customer_id"], []).append(v)
    wb = Workbook(); ws = wb.active; ws.title = (s["name"] or "Segment")[:31]
    ws.append(["Name", "Mobile", "Email", "Address", "City", "Vehicles", "Notes",
               "Preferred Contact", "Job Count", "Total Spend (KWD)", "Last Service", "Created At"])
    for c in customers:
        veh_str = "; ".join([f"{v.get('make','')} {v.get('model','')}".strip() for v in by_cust.get(c["id"], [])])
        ws.append([c.get("name"), c.get("mobile"), c.get("email") or "",
                   c.get("address") or "", c.get("city") or "", veh_str,
                   c.get("notes") or "", c.get("preferred_contact") or "",
                   c.get("job_count") if c.get("job_count") is not None else "",
                   c.get("total_spend") if c.get("total_spend") is not None else "",
                   c.get("last_service") or "",
                   c.get("created_at") or ""])
    safe = "".join(ch for ch in s["name"] if ch.isalnum() or ch in ("-", "_")) or "segment"
    return _xlsx_stream(wb, f"segment_{safe}_{datetime.now().strftime('%Y%m%d')}.xlsx")

# ---------------- File serving ----------------
@api.get("/files/{fname}")
async def get_file(fname: str):
    from fastapi.responses import FileResponse
    fp = UPLOAD_DIR / fname
    if not fp.exists():
        raise HTTPException(404)
    return FileResponse(fp)

# ---------------- Seed ----------------
@api.post("/seed")
async def seed(reseed: bool = False, user=Depends(get_current_user) if False else None):
    if not reseed and await db.users.count_documents({}) > 0:
        return {"seeded": False, "message": "Already seeded. Pass ?reseed=true to overwrite."}
    if reseed:
        for c in ["users", "customers", "vehicles", "vehicle_types", "vehicle_makes",
                  "services", "quotations", "jobs", "inventory", "appointments", "counters"]:
            await db[c].delete_many({})

    users = [
        {"id": new_id(), "name": "Ahmad Al-Sabah", "email": "admin@autocrm.kw",
         "password": hash_password("admin123"), "role": "admin", "active": True,
         "created_at": now_iso(), "updated_at": now_iso()},
        {"id": new_id(), "name": "Yusuf Front Desk", "email": "sales@autocrm.kw",
         "password": hash_password("sales123"), "role": "sales", "active": True,
         "created_at": now_iso(), "updated_at": now_iso()},
        {"id": new_id(), "name": "Khalid Technician", "email": "tech@autocrm.kw",
         "password": hash_password("tech123"), "role": "technician", "active": True,
         "created_at": now_iso(), "updated_at": now_iso()},
    ]
    await db.users.insert_many([u.copy() for u in users])

    sedan_panels = [
        {"id": "hood", "label": "Hood", "number": 1},
        {"id": "roof", "label": "Roof", "number": 2},
        {"id": "trunk", "label": "Trunk", "number": 3},
        {"id": "front_bumper", "label": "Front Bumper", "number": 4},
        {"id": "rear_bumper", "label": "Rear Bumper", "number": 5},
        {"id": "fl_door", "label": "Front Left Door", "number": 6},
        {"id": "fr_door", "label": "Front Right Door", "number": 7},
        {"id": "rl_door", "label": "Rear Left Door", "number": 8},
        {"id": "rr_door", "label": "Rear Right Door", "number": 9},
        {"id": "fl_fender", "label": "Front Left Fender", "number": 10},
        {"id": "fr_fender", "label": "Front Right Fender", "number": 11},
        {"id": "rl_qpanel", "label": "Rear Left Quarter", "number": 12},
        {"id": "rr_qpanel", "label": "Rear Right Quarter", "number": 13},
    ]
    sedan_glass = [
        {"id": "windshield", "label": "Windshield", "number": 1},
        {"id": "rear_glass", "label": "Rear Glass", "number": 2},
        {"id": "fl_glass", "label": "Front Left Window", "number": 3},
        {"id": "fr_glass", "label": "Front Right Window", "number": 4},
        {"id": "rl_glass", "label": "Rear Left Window", "number": 5},
        {"id": "rr_glass", "label": "Rear Right Window", "number": 6},
        {"id": "sunroof", "label": "Sunroof", "number": 7},
    ]
    vts = [
        {"id": new_id(), "key": "sedan", "label": "Sedan", "panels": sedan_panels, "glass_areas": sedan_glass},
        {"id": new_id(), "key": "suv", "label": "SUV", "panels": sedan_panels, "glass_areas": sedan_glass},
        {"id": new_id(), "key": "truck", "label": "Truck", "panels": sedan_panels[:11], "glass_areas": sedan_glass[:6]},
        {"id": new_id(), "key": "boat", "label": "Boat",
         "panels": [{"id": "hull", "label": "Hull", "number": 1}, {"id": "deck", "label": "Deck", "number": 2}],
         "glass_areas": [{"id": "windshield", "label": "Windshield", "number": 1}]},
    ]
    for vt in vts:
        vt["created_at"] = now_iso(); vt["updated_at"] = now_iso()
    await db.vehicle_types.insert_many([v.copy() for v in vts])

    # Vehicle makes
    makes_docs = []
    for m in KUWAIT_MAKES_MODELS:
        makes_docs.append({"id": new_id(), "label": m["label"], "models": m["models"],
                           "created_at": now_iso(), "updated_at": now_iso()})
    await db.vehicle_makes.insert_many([m.copy() for m in makes_docs])

    panel_price_sedan = {p["id"]: 12.000 for p in sedan_panels}
    panel_price_suv = {p["id"]: 15.000 for p in sedan_panels}
    panel_price_truck = {p["id"]: 18.000 for p in sedan_panels[:11]}
    panel_price_boat = {"hull": 80.000, "deck": 40.000}
    glass_price_sedan = {g["id"]: 8.000 for g in sedan_glass}
    glass_price_suv = {g["id"]: 10.000 for g in sedan_glass}

    services = [
        {"id": new_id(), "name": "Paint Protection Film (PPF)", "category": "paint_protection",
         "pricing_mode": "per_panel",
         "panel_prices": {"sedan": panel_price_sedan, "suv": panel_price_suv, "truck": panel_price_truck, "boat": panel_price_boat},
         "vehicle_type_prices": {}, "glass_prices": {}, "full_vehicle_prices": {}, "fixed_price": None,
         "is_bundle": False, "bundle_items": [],
         "description": "Per-panel paint protection film", "active": True},
        {"id": new_id(), "name": "Full Body Paint Protection", "category": "paint_protection",
         "pricing_mode": "full_vehicle",
         "full_vehicle_prices": {"sedan": 180.000, "suv": 240.000, "truck": 300.000, "boat": 500.000},
         "vehicle_type_prices": {}, "panel_prices": {}, "glass_prices": {}, "fixed_price": None,
         "is_bundle": False, "bundle_items": [],
         "description": "Full vehicle PPF package", "active": True},
        {"id": new_id(), "name": "Window Tint", "category": "tint",
         "pricing_mode": "per_glass_area",
         "glass_prices": {"sedan": glass_price_sedan, "suv": glass_price_suv, "truck": glass_price_sedan, "boat": {"windshield": 12.000}},
         "vehicle_type_prices": {}, "panel_prices": {}, "full_vehicle_prices": {}, "fixed_price": None,
         "is_bundle": False, "bundle_items": [],
         "description": "Per-glass-area tinting", "active": True},
        {"id": new_id(), "name": "Full Vehicle Tint Package", "category": "tint",
         "pricing_mode": "full_vehicle",
         "full_vehicle_prices": {"sedan": 45.000, "suv": 55.000, "truck": 50.000, "boat": 30.000},
         "vehicle_type_prices": {}, "panel_prices": {}, "glass_prices": {}, "fixed_price": None,
         "is_bundle": False, "bundle_items": [],
         "description": "All glass tint package", "active": True},
        {"id": new_id(), "name": "Full Body Paint", "category": "full_body_paint",
         "pricing_mode": "full_vehicle",
         "full_vehicle_prices": {"sedan": 350.000, "suv": 450.000, "truck": 500.000, "boat": 800.000},
         "vehicle_type_prices": {}, "panel_prices": {}, "glass_prices": {}, "fixed_price": None,
         "is_bundle": False, "bundle_items": [],
         "description": "Repaint full body", "active": True},
        {"id": new_id(), "name": "Panel Repaint", "category": "full_body_paint",
         "pricing_mode": "per_panel",
         "panel_prices": {"sedan": {p["id"]: 25.000 for p in sedan_panels},
                          "suv": {p["id"]: 30.000 for p in sedan_panels},
                          "truck": {p["id"]: 35.000 for p in sedan_panels[:11]},
                          "boat": {"hull": 150.000, "deck": 80.000}},
         "vehicle_type_prices": {}, "glass_prices": {}, "full_vehicle_prices": {}, "fixed_price": None,
         "is_bundle": False, "bundle_items": [],
         "description": "Per-panel repaint", "active": True},
        {"id": new_id(), "name": "Standard Car Wash", "category": "car_wash",
         "pricing_mode": "fixed", "fixed_price": 4.500,
         "vehicle_type_prices": {}, "panel_prices": {}, "glass_prices": {}, "full_vehicle_prices": {},
         "is_bundle": False, "bundle_items": [],
         "description": "Exterior wash", "active": True},
        {"id": new_id(), "name": "Premium Car Wash", "category": "car_wash",
         "pricing_mode": "per_vehicle_type",
         "vehicle_type_prices": {"sedan": 8.000, "suv": 10.000, "truck": 12.000, "boat": 20.000},
         "panel_prices": {}, "glass_prices": {}, "full_vehicle_prices": {}, "fixed_price": None,
         "is_bundle": False, "bundle_items": [],
         "description": "Wash + interior + wax", "active": True},
        {"id": new_id(), "name": "Mobile Car Wash", "category": "mobile_car_wash",
         "pricing_mode": "per_vehicle_type",
         "vehicle_type_prices": {"sedan": 12.000, "suv": 15.000, "truck": 18.000, "boat": 25.000},
         "panel_prices": {}, "glass_prices": {}, "full_vehicle_prices": {}, "fixed_price": None,
         "is_bundle": False, "bundle_items": [],
         "description": "We come to your location", "active": True},
        {"id": new_id(), "name": "Detail Plus Bundle", "category": "bundle",
         "pricing_mode": "per_vehicle_type",
         "vehicle_type_prices": {"sedan": 60.000, "suv": 80.000, "truck": 90.000, "boat": 120.000},
         "panel_prices": {}, "glass_prices": {}, "full_vehicle_prices": {}, "fixed_price": None,
         "is_bundle": True, "bundle_items": ["Premium Car Wash", "Full Vehicle Tint Package"],
         "description": "Premium wash + full tint at 20% off", "active": True},
    ]
    for s in services:
        s["created_at"] = now_iso(); s["updated_at"] = now_iso()
    await db.services.insert_many([s.copy() for s in services])

    customers = [
        {"id": new_id(), "name": "Mohammed Al-Rashid", "mobile": "+96599887766",
         "email": "m.rashid@example.kw", "address": "Salmiya, Block 10",
         "preferred_contact": "whatsapp", "notes": "VIP customer",
         "created_at": now_iso(), "updated_at": now_iso()},
        {"id": new_id(), "name": "Fatima Al-Saleh", "mobile": "+96566554433",
         "email": "fatima@example.kw", "address": "Hawalli, Block 4",
         "preferred_contact": "mobile", "notes": None,
         "created_at": now_iso(), "updated_at": now_iso()},
    ]
    await db.customers.insert_many([c.copy() for c in customers])

    vehicles = [
        {"id": new_id(), "customer_id": customers[0]["id"], "vehicle_type": "suv",
         "make": "Land Rover", "model": "Range Rover", "year": 2023, "plate": "12345",
         "vin": "SALGS2VF8DA000001", "color": "Black",
         "created_at": now_iso(), "updated_at": now_iso()},
        {"id": new_id(), "customer_id": customers[1]["id"], "vehicle_type": "sedan",
         "make": "Lexus", "model": "ES 350", "year": 2024, "plate": "67890",
         "vin": "JTHBK1GG2A2123456", "color": "White",
         "created_at": now_iso(), "updated_at": now_iso()},
    ]
    await db.vehicles.insert_many([v.copy() for v in vehicles])

    inventory = [
        {"id": new_id(), "sku": "PPF-001", "name": "PPF Roll 1.52m x 15m",
         "category": "Paint Protection", "unit": "roll", "cost_price": 120.000,
         "selling_price": 220.000, "stock_qty": 8, "low_stock_threshold": 3,
         "created_at": now_iso(), "updated_at": now_iso()},
        {"id": new_id(), "sku": "TINT-35", "name": "Tint Film 35% (1.52m)",
         "category": "Tint", "unit": "roll", "cost_price": 25.000,
         "selling_price": 50.000, "stock_qty": 15, "low_stock_threshold": 5,
         "created_at": now_iso(), "updated_at": now_iso()},
        {"id": new_id(), "sku": "WASH-SHAMP", "name": "Premium Car Shampoo 5L",
         "category": "Car Wash", "unit": "bottle", "cost_price": 6.000,
         "selling_price": 12.000, "stock_qty": 4, "low_stock_threshold": 5,
         "created_at": now_iso(), "updated_at": now_iso()},
        {"id": new_id(), "sku": "WAX-CARN", "name": "Carnauba Wax",
         "category": "Detailing", "unit": "tin", "cost_price": 8.000,
         "selling_price": 18.000, "stock_qty": 12, "low_stock_threshold": 4,
         "created_at": now_iso(), "updated_at": now_iso()},
    ]
    await db.inventory.insert_many([i.copy() for i in inventory])
    # Phase 3: ensure migration runs immediately so Uncategorized.product_count is correct
    await _migrate_inv_to_default()

    return {"seeded": True, "users": len(users), "vehicle_types": len(vts),
            "vehicle_makes": len(makes_docs), "services": len(services),
            "customers": len(customers), "inventory": len(inventory)}

# ---------------- Mount ----------------
app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup():
    # Phase 3: ensure default inventory category and migrate legacy items
    try:
        await _migrate_inv_to_default()
    except Exception as e:
        logger.warning(f"Inventory migration skipped: {e}")
    # Phase 4: seed Administrator role + promote existing admin user(s) to master
    try:
        await _phase4_migrate()
    except Exception as e:
        logger.warning(f"Phase 4 migration skipped: {e}")

async def _phase4_migrate():
    # Ensure singleton system_settings exists with conservative defaults
    if not await db.system_settings.find_one({"_id": "singleton"}):
        await db.system_settings.insert_one({
            "_id": "singleton",
            "toggles": FeatureTogglesIn().model_dump(),
            "integrations": {},
        })
    # Seed an "Administrator" role with all permissions if no roles exist
    if await db.roles.count_documents({}) == 0:
        admin_role = {
            "id": new_id(), "name": "Administrator",
            "description": "Full access (auto-created on first run)",
            "active": True,
            "permissions": {k: True for k in PERMISSION_KEYS},
            "created_at": now_iso(), "updated_at": now_iso(),
        }
        await db.roles.insert_one(admin_role)
    admin_role = await db.roles.find_one({"name": "Administrator"}, {"_id": 0, "id": 1})
    if admin_role:
        # Promote any existing 'admin' to is_master=True (first-time migration)
        await db.users.update_many(
            {"role": "admin", "is_master": {"$exists": False}},
            {"$set": {"is_master": True, "role_id": admin_role["id"]}})
        # Backfill role_id for any user without one (legacy admin/sales/tech users)
        await db.users.update_many(
            {"role_id": {"$exists": False}},
            {"$set": {"role_id": admin_role["id"]}})

@app.on_event("shutdown")
async def shutdown():
    client.close()
