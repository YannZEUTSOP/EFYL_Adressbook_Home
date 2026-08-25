from fastapi import FastAPI, APIRouter, HTTPException, Response, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import math
import io
import csv
import json
import hashlib
import secrets
import logging
import bcrypt
import jwt as pyjwt
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Twilio (optional - env-toggleable)
TWILIO_SID = os.environ.get('TWILIO_ACCOUNT_SID', '').strip()
TWILIO_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN', '').strip()
TWILIO_VERIFY_SERVICE = os.environ.get('TWILIO_VERIFY_SERVICE', '').strip()
TWILIO_ENABLED = bool(TWILIO_SID and TWILIO_TOKEN and TWILIO_VERIFY_SERVICE)
twilio_client = None
if TWILIO_ENABLED:
    try:
        from twilio.rest import Client as TwilioClient
        twilio_client = TwilioClient(TWILIO_SID, TWILIO_TOKEN)
    except Exception as e:
        logging.error(f"Twilio init failed: {e}")
        TWILIO_ENABLED = False

app = FastAPI(title="EFYL AddressBook API", version="2.0.0")
api_router = APIRouter(prefix="/api")

# ============ ACCOUNT AUTH (phone + 4-digit PIN) ============
JWT_SECRET = os.environ.get('JWT_SECRET', 'efyl-dev-secret-change-me')
TOKEN_DAYS = 90
# Dummy hash verified for unknown identifiers → constant-time-ish, avoids user enumeration
_DUMMY_PIN_HASH = bcrypt.hashpw(b"0000-dummy-pin", bcrypt.gensalt())


def normalize_phone(p: str) -> str:
    digits = "".join(ch for ch in p if ch.isdigit())
    return f"+{digits}"


def user_id_for_phone(phone: str) -> str:
    # Same format as the historical OTP login → previously synced data stays linked
    return f"user_{phone.replace('+', '').replace(' ', '')}"


def efyl_id_for(phone: str) -> str:
    digest = hashlib.sha256(f"efyl:{phone}".encode("utf-8")).hexdigest()[:6].upper()
    return f"EFYL-{digest}"


def make_token(user_id: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=TOKEN_DAYS)
    return pyjwt.encode({"sub": user_id, "type": "access", "exp": exp},
                        JWT_SECRET, algorithm="HS256")


def user_id_from_auth(authorization: Optional[str]) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Authentication required")
    try:
        payload = pyjwt.decode(authorization[7:], JWT_SECRET, algorithms=["HS256"])
        return str(payload["sub"])
    except Exception:
        raise HTTPException(401, "Invalid or expired token")



# ============ MODELS ============
class Address(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    address_id: str
    district: str
    sector: str
    street_id: str
    house_number: str
    latitude: float
    longitude: float
    accuracy_meters: float
    contact_name: Optional[str] = ""
    contact_phone: Optional[str] = ""
    notes: Optional[str] = ""
    owner_id: Optional[str] = "guest"
    verified: bool = False
    flag_count: int = 0
    low_accuracy: bool = False
    # Week 3 extras
    azimuth_degrees: Optional[float] = None
    photo_base64: Optional[str] = None
    lat_raw: Optional[float] = None
    lng_raw: Optional[float] = None
    lat_corrected: Optional[float] = None
    lng_corrected: Optional[float] = None
    has_survey: bool = False
    is_commerce: bool = False  # public visibility when True
    is_public: bool = False    # public service/building — also publicly visible
    is_heritage: bool = False  # sacred/tourist site — also publicly visible
    owner_name: str = ""       # surveyor display name (tracking)
    photos: Optional[List[dict]] = None  # [{base64, lat, lng, bearing, taken_at}]
    photos_count: Optional[int] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class AddressCreate(BaseModel):
    address_id: str
    district: str
    sector: str
    street_id: str
    house_number: str
    latitude: float
    longitude: float
    accuracy_meters: float
    contact_name: Optional[str] = ""
    contact_phone: Optional[str] = ""
    notes: Optional[str] = ""
    owner_id: Optional[str] = "guest"
    low_accuracy: Optional[bool] = False
    azimuth_degrees: Optional[float] = None
    photo_base64: Optional[str] = None
    lat_raw: Optional[float] = None
    lng_raw: Optional[float] = None
    lat_corrected: Optional[float] = None
    lng_corrected: Optional[float] = None
    is_commerce: Optional[bool] = False
    is_public: Optional[bool] = False
    is_heritage: Optional[bool] = False
    owner_name: Optional[str] = ""
    photos: Optional[List[dict]] = None
    photos_count: Optional[int] = None


class AddressUpdate(BaseModel):
    district: Optional[str] = None
    sector: Optional[str] = None
    street_id: Optional[str] = None
    house_number: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None
    azimuth_degrees: Optional[float] = None
    photo_base64: Optional[str] = None
    lat_corrected: Optional[float] = None
    lng_corrected: Optional[float] = None
    is_commerce: Optional[bool] = None
    is_public: Optional[bool] = None
    is_heritage: Optional[bool] = None
    owner_name: Optional[str] = None
    photos: Optional[List[dict]] = None


class VerifyRequest(BaseModel):
    address_id: str
    submitted_lat: float
    submitted_lng: float
    submitted_accuracy: float
    user_id: Optional[str] = "guest"


class OTPRequest(BaseModel):
    phone: str


class OTPVerify(BaseModel):
    phone: str
    code: str


class RegisterRequest(BaseModel):
    phone: str
    name: str
    pin: str
    code: str  # OTP code verified server-side


class LoginRequest(BaseModel):
    identifier: str  # phone number or EFYL-XXXXXX id
    pin: str


# Household survey models
class Person(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    phone_or_email: str = ""
    age: int = 0
    gender: str = ""       # male | female  ("" = not selected yet)
    education: str = ""    # primary | middle | high_school | university | none
    profession: str = ""
    frequented_place: str = ""
    places: List[dict] = []   # [{category, name, frequency, reason}]
    no_places: bool = False   # explicit "does not travel" (baby, elderly...)


class Commerce(BaseModel):
    name: str = ""
    owner: str = ""
    phone: str = ""
    products: str = ""
    workers: int = 0
    hours_weekdays: str = ""
    hours_saturday: str = ""
    hours_sunday: str = ""


class PublicService(BaseModel):
    name: str = ""
    category: str = ""        # school|health|government|community|water_point|antenna|religious|other
    category_other: str = ""
    managing_org: str = ""
    phone: str = ""
    workers: Optional[int] = None    # teachers, doctors, agents... (None = not answered)
    capacity_max: str = ""           # e.g. "400 élèves", "25 lits"
    usage_current: str = ""          # e.g. "320 élèves inscrits", "40 patients/jour"
    hours: str = ""                  # "HH:MM-HH:MM" | "closed" | ""
    notes: str = ""


class HeritageSite(BaseModel):
    name: str = ""
    kind: str = ""             # sacred | tourist | both
    category: str = ""         # chiefdom|sacred_forest|worship|tomb|waterfall|cave|museum|monument|viewpoint|craft_market|other
    category_other: str = ""
    description: str = ""
    manager: str = ""
    access: str = ""           # free | paid | permission
    entry_fee: str = ""
    hours: str = ""
    best_period: str = ""
    photos_allowed: Optional[bool] = None
    restrictions: str = ""
    facilities: str = ""
    road_access: str = ""      # good | average | difficult
    phone: str = ""
    notes: str = ""


class HouseholdSurvey(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    address_id: str
    owner_id: Optional[str] = "guest"
    survey_type: str = "household"   # household | commerce | public | heritage
    family_name: str = ""
    total_persons: int = 1
    main_income_source: str = ""
    other_income_sources: str = ""
    income_level: str = ""           # very_low|low|medium|high ("" = not answered)
    num_phones: int = 0
    has_internet: Optional[bool] = None
    electricity: str = ""            # stable|unstable|none
    water: str = ""                  # stable|unstable|none
    toilets: str = ""                # flush|traditional|other
    toilets_other: str = ""
    kitchen_position: str = ""       # room|living_room|separate
    num_living_rooms: int = 1
    num_floors: int = 1
    wall_materials: str = ""         # concrete|adobe|wood|other
    wall_materials_other: str = ""
    has_glass_windows: Optional[bool] = None
    roof_materials: str = ""         # metal|wood|plastic|concrete|other
    roof_materials_other: str = ""
    vehicles_bicycles: int = 0
    vehicles_motorcycles: int = 0
    vehicles_cars: int = 0
    vehicles_trucks: int = 0
    is_commerce: bool = False
    is_public: bool = False
    is_heritage: bool = False
    commerce: Optional[Commerce] = None
    public_service: Optional[PublicService] = None
    heritage: Optional[HeritageSite] = None
    persons: List[Person] = []
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ============ HELPERS ============
def haversine_m(lat1, lon1, lat2, lon2):
    R = 6371000.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def hash_otp(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


# ============ ROUTES ============
@api_router.get("/")
async def root():
    return {"message": "EFYL AddressBook API", "version": "2.0.0",
            "twilio_enabled": TWILIO_ENABLED}


@api_router.get("/health")
async def health():
    return {"status": "ok", "twilio_enabled": TWILIO_ENABLED}


# Address CRUD
@api_router.post("/addresses", response_model=Address)
async def create_address(payload: AddressCreate):
    addr = Address(**payload.dict())
    addr.has_survey = False  # will flip when survey is created
    # check existing
    existing = await db.addresses.find_one(
        {"address_id": addr.address_id, "owner_id": addr.owner_id}, {"_id": 0}
    )
    if existing:
        addr.has_survey = existing.get("has_survey", False)
    await db.addresses.update_one(
        {"address_id": addr.address_id, "owner_id": addr.owner_id},
        {"$set": addr.dict()},
        upsert=True,
    )
    return addr


@api_router.get("/addresses", response_model=List[Address])
async def list_addresses(owner_id: str = "guest", q: Optional[str] = None,
                         include_public_commerces: bool = True):
    """Returns user's own addresses + (optionally) all public commerce addresses
    from any user. This is what enables community-wide commerce mapping."""
    own_query: dict = {"owner_id": owner_id}
    if q:
        own_query["$or"] = [
            {"contact_name": {"$regex": q, "$options": "i"}},
            {"address_id": {"$regex": q, "$options": "i"}},
            {"district": {"$regex": q, "$options": "i"}},
        ]
    seen_ids = set()
    out: List[Address] = []

    cursor = db.addresses.find(own_query, {"_id": 0}).sort("created_at", -1).limit(500)
    async for doc in cursor:
        doc.setdefault("low_accuracy", False)
        doc.setdefault("has_survey", False)
        doc.setdefault("is_commerce", False)
        out.append(Address(**doc))
        seen_ids.add(doc["address_id"])

    if include_public_commerces:
        pub_query: dict = {
            "owner_id": {"$ne": owner_id},
            "$or": [{"is_commerce": True}, {"is_public": True}, {"is_heritage": True}],
        }
        if q:
            pub_query = {"$and": [
                pub_query,
                {"$or": [
                    {"contact_name": {"$regex": q, "$options": "i"}},
                    {"address_id": {"$regex": q, "$options": "i"}},
                    {"district": {"$regex": q, "$options": "i"}},
                ]},
            ]}
        cursor2 = db.addresses.find(pub_query, {"_id": 0}).sort("created_at", -1).limit(500)
        async for doc in cursor2:
            if doc["address_id"] in seen_ids:
                continue
            doc.setdefault("low_accuracy", False)
            doc.setdefault("has_survey", False)
            doc.setdefault("is_commerce", True)
            out.append(Address(**doc))
            seen_ids.add(doc["address_id"])

    return out


@api_router.get("/commerces", response_model=List[Address])
async def list_commerces(q: Optional[str] = None):
    """Returns all public places (commerces + public services + heritage sites) from any user (community map)."""
    query: dict = {"$or": [{"is_commerce": True}, {"is_public": True}, {"is_heritage": True}]}
    if q:
        query = {"$and": [
            query,
            {"$or": [
                {"contact_name": {"$regex": q, "$options": "i"}},
                {"address_id": {"$regex": q, "$options": "i"}},
                {"district": {"$regex": q, "$options": "i"}},
            ]},
        ]}
    cursor = db.addresses.find(query, {"_id": 0}).sort("created_at", -1).limit(2000)
    out = []
    async for doc in cursor:
        doc.setdefault("low_accuracy", False)
        doc.setdefault("has_survey", False)
        doc.setdefault("is_commerce", False)
        out.append(Address(**doc))
    return out


@api_router.get("/addresses/{address_id}", response_model=Address)
async def get_address(address_id: str, owner_id: str = "guest"):
    doc = await db.addresses.find_one(
        {"address_id": address_id, "owner_id": owner_id}, {"_id": 0}
    )
    if not doc:
        # Cross-owner fallback restricted to community-visible records only
        # (households are private — see EFYL_STOCKAGE_ET_SCENARIOS_FR.md §3)
        doc = await db.addresses.find_one(
            {"address_id": address_id,
             "$or": [{"is_commerce": True}, {"is_public": True}, {"is_heritage": True}]},
            {"_id": 0},
        )
    if not doc:
        raise HTTPException(404, "Address not found")
    doc.setdefault("low_accuracy", False)
    doc.setdefault("has_survey", False)
    return Address(**doc)


@api_router.put("/addresses/{address_id}", response_model=Address)
async def update_address(address_id: str, payload: AddressUpdate, owner_id: str = "guest"):
    updates = {k: v for k, v in payload.dict().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No fields to update")
    await db.addresses.update_one(
        {"address_id": address_id, "owner_id": owner_id},
        {"$set": updates},
    )
    doc = await db.addresses.find_one(
        {"address_id": address_id, "owner_id": owner_id}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(404, "Address not found")
    doc.setdefault("low_accuracy", False)
    doc.setdefault("has_survey", False)
    return Address(**doc)


@api_router.delete("/addresses/{address_id}")
async def delete_address(address_id: str, owner_id: str = "guest"):
    result = await db.addresses.delete_one(
        {"address_id": address_id, "owner_id": owner_id}
    )
    # also remove linked survey
    await db.surveys.delete_many({"address_id": address_id, "owner_id": owner_id})
    return {"deleted": result.deleted_count}


@api_router.post("/sync")
async def sync_bulk(items: List[AddressCreate]):
    created = 0
    for it in items:
        addr = Address(**it.dict())
        await db.addresses.update_one(
            {"address_id": addr.address_id, "owner_id": addr.owner_id},
            {"$set": addr.dict()},
            upsert=True,
        )
        created += 1
    return {"synced": created, "timestamp": datetime.now(timezone.utc).isoformat()}


@api_router.post("/verify")
async def verify_address(payload: VerifyRequest):
    doc = await db.addresses.find_one({"address_id": payload.address_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Address not found")
    distance = haversine_m(
        doc["latitude"], doc["longitude"],
        payload.submitted_lat, payload.submitted_lng,
    )
    flagged = distance > 10.0
    update: dict = {}
    if flagged:
        update["$inc"] = {"flag_count": 1}
    else:
        update["$set"] = {"verified": True}
    await db.addresses.update_one({"address_id": payload.address_id}, update)
    await db.flags.insert_one({
        "id": str(uuid.uuid4()),
        "address_id": payload.address_id,
        "user_id": payload.user_id,
        "distance_m": distance,
        "flagged": flagged,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {
        "distance_m": round(distance, 2),
        "flagged": flagged,
        "verified": not flagged,
    }


@api_router.get("/addresses-nearby")
async def addresses_nearby(lat: float, lng: float, radius_km: float = 5.0):
    cursor = db.addresses.find({}, {"_id": 0}).limit(500)
    out = []
    async for doc in cursor:
        d = haversine_m(lat, lng, doc["latitude"], doc["longitude"]) / 1000.0
        if d <= radius_km:
            doc.setdefault("low_accuracy", False)
            doc.setdefault("has_survey", False)
            doc["distance_km"] = round(d, 3)
            out.append(doc)
    out.sort(key=lambda x: x["distance_km"])
    return out[:100]


# ============ AUTH (Twilio or Mock) ============
@api_router.post("/auth/otp/request")
async def otp_request(payload: OTPRequest):
    phone = payload.phone.strip()
    # Rate limiting: 3 requests / 10 min
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
    recent = await db.otp_attempts.count_documents({
        "phone": phone,
        "created_at": {"$gte": cutoff},
    })
    if recent >= 3:
        raise HTTPException(429, "Too many requests. Please wait 10 minutes.")

    await db.otp_attempts.insert_one({
        "phone": phone,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    if TWILIO_ENABLED and twilio_client:
        try:
            twilio_client.verify.v2.services(TWILIO_VERIFY_SERVICE).verifications.create(
                to=phone, channel="sms"
            )
            return {"sent": True, "method": "twilio", "phone": phone}
        except Exception as e:
            logging.error(f"Twilio send failed: {e}")
            raise HTTPException(400, f"SMS provider error: {str(e)}")

    # Fallback: mock OTP
    code = f"{secrets.randbelow(1000000):06d}"
    # For predictable demo: always 123456 in mock mode
    code = "123456"
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    await db.otp_codes.update_one(
        {"phone": phone},
        {"$set": {
            "phone": phone,
            "code_hash": hash_otp(code),
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"sent": True, "method": "mock", "demo_code": code, "phone": phone}


async def _consume_otp(phone: str, code: str) -> None:
    """Server-side OTP verification (Twilio Verify or mock). Raises on failure."""
    if TWILIO_ENABLED and twilio_client:
        try:
            check = twilio_client.verify.v2.services(
                TWILIO_VERIFY_SERVICE
            ).verification_checks.create(to=phone, code=code)
            if check.status != "approved":
                raise HTTPException(401, "Invalid code")
        except HTTPException:
            raise
        except Exception as e:
            logging.error(f"Twilio verify failed: {e}")
            raise HTTPException(400, f"SMS provider error: {str(e)}")
    else:
        rec = await db.otp_codes.find_one({"phone": phone}, {"_id": 0})
        if not rec:
            raise HTTPException(401, "Invalid code")
        if rec.get("expires_at") and rec["expires_at"] < datetime.now(timezone.utc).isoformat():
            raise HTTPException(401, "Code expired")
        if rec.get("code_hash") != hash_otp(code):
            raise HTTPException(401, "Invalid code")
        # consume the code
        await db.otp_codes.delete_one({"phone": phone})


@api_router.post("/auth/otp/verify")
async def otp_verify(payload: OTPVerify):
    phone = payload.phone.strip()
    code = payload.code.strip()
    await _consume_otp(phone, code)

    user_id = f"user_{phone.replace('+', '').replace(' ', '')}"
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "user_id": user_id,
            "phone": phone,
            "last_login": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"verified": True, "user_id": user_id, "phone": phone}


# ============ ACCOUNT (register / login / restore) ============
@api_router.post("/auth/register")
async def auth_register(payload: RegisterRequest):
    phone = normalize_phone(payload.phone)
    pin = payload.pin.strip()
    name = payload.name.strip()
    if not (pin.isdigit() and len(pin) == 4):
        raise HTTPException(400, "PIN must be exactly 4 digits")
    if not name:
        raise HTTPException(400, "Name is required")
    user_id = user_id_for_phone(phone)
    existing = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if existing and existing.get("pin_hash"):
        raise HTTPException(409, "Account already exists — use login")
    # Verify the OTP server-side (never trust a client-side flag)
    await _consume_otp(phone, payload.code.strip())
    now_iso = datetime.now(timezone.utc).isoformat()
    efyl_id = efyl_id_for(phone)
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "user_id": user_id,
            "efyl_id": efyl_id,
            "phone": phone,
            "name": name,
            "pin_hash": bcrypt.hashpw(pin.encode("utf-8"), bcrypt.gensalt()).decode("utf-8"),
            "failed_pin_attempts": 0,
            "locked_until": None,
            "last_login": now_iso,
        }, "$setOnInsert": {"created_at": now_iso}},
        upsert=True,
    )
    return {"user_id": user_id, "efyl_id": efyl_id, "name": name,
            "phone": phone, "token": make_token(user_id)}


@api_router.post("/auth/login")
async def auth_login(payload: LoginRequest):
    ident = payload.identifier.strip()
    pin = payload.pin.strip()
    if ident.upper().startswith("EFYL-"):
        query: dict = {"efyl_id": ident.upper()}
    else:
        digits = "".join(ch for ch in ident if ch.isdigit())
        query = {"$or": [
            {"user_id": f"user_{digits}"},
            {"user_id": ident},
            {"phone": f"+{digits}"},
        ]}
    user = await db.users.find_one(query, {"_id": 0})
    if not user or not user.get("pin_hash"):
        bcrypt.checkpw(pin.encode("utf-8"), _DUMMY_PIN_HASH)  # anti-enumeration
        raise HTTPException(401, "Invalid credentials")
    now = datetime.now(timezone.utc)
    locked = user.get("locked_until")
    if locked and locked > now.isoformat():
        raise HTTPException(429, "Too many attempts. Try again in 15 minutes.")
    if not bcrypt.checkpw(pin.encode("utf-8"), user["pin_hash"].encode("utf-8")):
        fails = int(user.get("failed_pin_attempts", 0)) + 1
        upd: dict = {"failed_pin_attempts": fails}
        if fails >= 5:
            upd = {"failed_pin_attempts": 0,
                   "locked_until": (now + timedelta(minutes=15)).isoformat()}
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": upd})
        raise HTTPException(401, "Invalid credentials")
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"failed_pin_attempts": 0, "locked_until": None,
                  "last_login": now.isoformat()}},
    )
    return {"user_id": user["user_id"],
            "efyl_id": user.get("efyl_id") or efyl_id_for(user.get("phone", "")),
            "name": user.get("name", ""),
            "phone": user.get("phone", ""),
            "token": make_token(user["user_id"])}


@api_router.get("/restore")
async def restore_account(authorization: Optional[str] = Header(None)):
    """Returns everything the authenticated user has synced to the central
    registry (addresses incl. photos + surveys) so a new device can rebuild
    the local address book after login."""
    user_id = user_id_from_auth(authorization)
    addresses = []
    cursor = db.addresses.find({"owner_id": user_id}, {"_id": 0}).sort("created_at", -1).limit(2000)
    async for doc in cursor:
        doc.setdefault("low_accuracy", False)
        doc.setdefault("has_survey", False)
        addresses.append(doc)
    surveys = []
    scursor = db.surveys.find({"owner_id": user_id}, {"_id": 0}).limit(2000)
    async for doc in scursor:
        surveys.append(doc)
    user = await db.users.find_one(
        {"user_id": user_id},
        {"_id": 0, "user_id": 1, "efyl_id": 1, "name": 1, "phone": 1, "created_at": 1},
    )
    return {"user": user, "addresses": addresses, "surveys": surveys}


# ============ SURVEY ENDPOINTS ============
@api_router.post("/surveys", response_model=HouseholdSurvey)
async def create_survey(payload: HouseholdSurvey):
    survey = payload
    if not survey.id:
        survey.id = str(uuid.uuid4())
    # Propagate type to address: commerce, public & heritage surveys mark the address as publicly visible
    survey.is_commerce = (survey.survey_type == "commerce")
    survey.is_public = (survey.survey_type == "public")
    survey.is_heritage = (survey.survey_type == "heritage")
    await db.surveys.update_one(
        {"address_id": survey.address_id, "owner_id": survey.owner_id},
        {"$set": survey.dict()},
        upsert=True,
    )
    # mark address with has_survey + is_commerce flags (scoped to owner to avoid cross-user mutation)
    addr_updates = {
        "has_survey": True,
        "is_commerce": survey.is_commerce,
        "is_public": survey.is_public,
        "is_heritage": survey.is_heritage,
    }
    await db.addresses.update_many(
        {"address_id": survey.address_id, "owner_id": survey.owner_id},
        {"$set": addr_updates},
    )
    return survey


@api_router.get("/surveys/{address_id}", response_model=HouseholdSurvey)
async def get_survey(address_id: str, owner_id: str = "guest"):
    doc = await db.surveys.find_one(
        {"address_id": address_id, "owner_id": owner_id}, {"_id": 0}
    )
    if not doc:
        doc = await db.surveys.find_one({"address_id": address_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Survey not found")
    return HouseholdSurvey(**doc)


@api_router.delete("/surveys/{address_id}")
async def delete_survey(address_id: str, owner_id: str = "guest"):
    r = await db.surveys.delete_many({"address_id": address_id, "owner_id": owner_id})
    await db.addresses.update_many(
        {"address_id": address_id},
        {"$set": {"has_survey": False}},
    )
    return {"deleted": r.deleted_count}


# ============ EXPORT CSV ============
async def _build_csv_content(addresses: List[dict], enrich: bool = False) -> str:
    """Shared CSV builder used by /export/csv and /admin/export/csv.
    When enrich=True (read-only ENRICHED COPY), recovers data that was recorded
    'one way or another': azimuth from photo compass bearings, frequented places
    from the legacy free-text field, declared-persons coherence — and flags every
    auto-recovered field in the auto_completed column. The database is NEVER modified."""
    output = io.StringIO()
    writer = csv.writer(output)

    headers = [
        "address_id", "district", "sector", "street_id", "house_number",
        "contact_name", "contact_phone", "notes",
        "latitude", "longitude", "accuracy_meters", "low_accuracy",
        "verified", "flag_count",
        "azimuth_degrees", "lat_raw", "lng_raw", "lat_corrected", "lng_corrected",
        "has_photo", "photos_count", "created_at",
        "owner_id", "owner_name",
        # survey
        "survey_type", "family_name",
        "survey_total_persons", "survey_main_income", "survey_other_income",
        "survey_income_level", "survey_num_phones", "survey_has_internet",
        "survey_electricity", "survey_water", "survey_toilets", "survey_toilets_other",
        "survey_kitchen_position", "survey_num_living_rooms", "survey_num_floors",
        "survey_wall_materials", "survey_wall_other",
        "survey_has_glass_windows",
        "survey_roof_materials", "survey_roof_other",
        "survey_vehicles_bicycles", "survey_vehicles_motorcycles",
        "survey_vehicles_cars", "survey_vehicles_trucks",
        "survey_is_commerce",
        "commerce_name", "commerce_owner", "commerce_phone", "commerce_products",
        "commerce_workers",
        "commerce_hours_weekdays", "commerce_hours_saturday", "commerce_hours_sunday",
        "public_name", "public_category", "public_category_other",
        "public_managing_org", "public_phone",
        "public_workers", "public_capacity_max", "public_usage_current", "public_hours",
        "public_notes",
        "heritage_name", "heritage_kind", "heritage_category", "heritage_category_other",
        "heritage_access", "heritage_entry_fee", "heritage_hours",
        "heritage_photos_allowed", "heritage_facilities", "heritage_road_access",
        "heritage_manager", "heritage_phone", "heritage_notes",
        "persons_count", "persons_summary", "persons_places",
        "quality_issues",
    ]
    if enrich:
        headers.append("auto_completed")
    writer.writerow(headers)

    for a in addresses:
        # Prefer the survey made by the row's owner (duplicate address codes can
        # exist across devices), then fall back to any survey for that code.
        s = await db.surveys.find_one(
            {"address_id": a["address_id"], "owner_id": a.get("owner_id")}, {"_id": 0}
        ) or await db.surveys.find_one({"address_id": a["address_id"]}, {"_id": 0}) or {}
        commerce = (s.get("commerce") or {}) if s else {}
        public = (s.get("public_service") or {}) if s else {}
        heritage = (s.get("heritage") or {}) if s else {}
        persons = s.get("persons", []) if s else []
        auto: List[str] = []
        if enrich:
            if a.get("_orphan_survey"):
                auto.append("orphan_survey_no_address")
            # Azimuth recovered from the compass bearing stored with each photo
            if a.get("azimuth_degrees") in (None, ""):
                bearings = [p.get("bearing") for p in (a.get("photos") or [])
                            if p.get("bearing") not in (None, "")]
                if bearings:
                    a = {**a, "azimuth_degrees": bearings[0]}
                    auto.append("azimuth_from_photo_bearing")
            # Frequented places recovered from the legacy free-text field
            if persons:
                fixed = []
                changed = False
                for p in persons:
                    if not (p.get("places") or []) and (p.get("frequented_place") or "").strip():
                        p = {**p, "places": [{
                            "category": "", "name": p["frequented_place"].strip(),
                            "frequency": "", "reason": "reconstitué depuis l'ancien champ texte",
                        }]}
                        changed = True
                    fixed.append(p)
                if changed:
                    persons = fixed
                    auto.append("places_from_legacy_text")
            # Declared total lower than the actually recorded list → trust the list
            if s and int(s.get("total_persons") or 0) < len(persons):
                s = {**s, "total_persons": len(persons)}
                auto.append("total_persons_from_list")
        persons_summary = "; ".join(
            f"{p.get('name','?')}({p.get('age','?')}|{p.get('gender','?')}|{p.get('education','?')}|{p.get('profession','')})"
            for p in persons
        )
        persons_places = " || ".join(
            f"{p.get('name','?')}: " + "; ".join(
                f"[{pl.get('category','')}] {pl.get('name','')} ({pl.get('frequency','')}) {pl.get('reason','')}"
                for pl in (p.get("places") or [])
            )
            for p in persons if (p.get("places") or [])
        )
        # Data-quality flags per row (mirrors the analysts' nightly QA report)
        issues = []
        if not s:
            issues.append("no_survey")
        if a.get("azimuth_degrees") in (None, ""):
            issues.append("missing_azimuth")
        if s:
            stype = s.get("survey_type", "household")
            if stype == "household":
                if int(s.get("total_persons") or 0) != len(persons):
                    issues.append("persons_count_mismatch")
                if any(not (p.get("places") or []) and not p.get("no_places") for p in persons):
                    issues.append("missing_persons_places")
            elif stype == "commerce":
                if not int(commerce.get("workers") or 0):
                    issues.append("missing_commerce_workers")
                if not commerce.get("products"):
                    issues.append("missing_commerce_products")
                if not (commerce.get("hours_weekdays") or commerce.get("hours_saturday") or commerce.get("hours_sunday")):
                    issues.append("missing_commerce_hours")
            elif stype == "public":
                if not public.get("managing_org"):
                    issues.append("missing_public_managing_org")
                if not public.get("phone"):
                    issues.append("missing_public_phone")
                if public.get("workers") in (None, ""):
                    issues.append("missing_public_workers")
                if not public.get("capacity_max"):
                    issues.append("missing_public_capacity")
                if not public.get("usage_current"):
                    issues.append("missing_public_usage")
                if not public.get("hours"):
                    issues.append("missing_public_hours")
        row = [
            a.get("address_id", ""), a.get("district", ""), a.get("sector", ""),
            a.get("street_id", ""), a.get("house_number", ""),
            a.get("contact_name", ""), a.get("contact_phone", ""), a.get("notes", ""),
            a.get("latitude", ""), a.get("longitude", ""),
            a.get("accuracy_meters", ""), a.get("low_accuracy", False),
            a.get("verified", False), a.get("flag_count", 0),
            a.get("azimuth_degrees", ""),
            a.get("lat_raw", ""), a.get("lng_raw", ""),
            a.get("lat_corrected", ""), a.get("lng_corrected", ""),
            bool(a.get("photo_base64")), len(a.get("photos") or []), a.get("created_at", ""),
            a.get("owner_id", ""), a.get("owner_name", ""),
            s.get("survey_type", ""), s.get("family_name", ""),
            s.get("total_persons", ""), s.get("main_income_source", ""),
            s.get("other_income_sources", ""), s.get("income_level", ""),
            s.get("num_phones", ""), s.get("has_internet", ""),
            s.get("electricity", ""), s.get("water", ""),
            s.get("toilets", ""), s.get("toilets_other", ""),
            s.get("kitchen_position", ""), s.get("num_living_rooms", ""),
            s.get("num_floors", ""),
            s.get("wall_materials", ""), s.get("wall_materials_other", ""),
            s.get("has_glass_windows", ""),
            s.get("roof_materials", ""), s.get("roof_materials_other", ""),
            s.get("vehicles_bicycles", ""), s.get("vehicles_motorcycles", ""),
            s.get("vehicles_cars", ""), s.get("vehicles_trucks", ""),
            s.get("is_commerce", ""),
            commerce.get("name", ""), commerce.get("owner", ""),
            commerce.get("phone", ""), commerce.get("products", ""),
            commerce.get("workers", ""),
            commerce.get("hours_weekdays", ""), commerce.get("hours_saturday", ""),
            commerce.get("hours_sunday", ""),
            public.get("name", ""), public.get("category", ""), public.get("category_other", ""),
            public.get("managing_org", ""), public.get("phone", ""),
            public.get("workers", ""), public.get("capacity_max", ""),
            public.get("usage_current", ""), public.get("hours", ""),
            public.get("notes", ""),
            heritage.get("name", ""), heritage.get("kind", ""), heritage.get("category", ""),
            heritage.get("category_other", ""),
            heritage.get("access", ""), heritage.get("entry_fee", ""), heritage.get("hours", ""),
            heritage.get("photos_allowed", ""), heritage.get("facilities", ""), heritage.get("road_access", ""),
            heritage.get("manager", ""), heritage.get("phone", ""), heritage.get("notes", ""),
            len(persons), persons_summary, persons_places,
            "|".join(issues),
        ]
        if enrich:
            row.append("|".join(auto))
        writer.writerow(row)

    content = output.getvalue()
    output.close()
    return content


@api_router.get("/export/csv")
async def export_csv(owner_id: Optional[str] = None):
    """Return all addresses + survey data as a CSV file."""
    query: dict = {}
    if owner_id:
        query["owner_id"] = owner_id

    addresses = []
    async for doc in db.addresses.find(query, {"_id": 0}):
        addresses.append(doc)

    csv_content = await _build_csv_content(addresses)
    filename = f"efyl_export_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ============ ADMIN DASHBOARD (PIN-protected) ============
ADMIN_PIN = os.environ.get('ADMIN_PIN', '237237')


def _check_pin(pin: str):
    if pin != ADMIN_PIN:
        raise HTTPException(403, "Invalid admin PIN")


@api_router.get("/admin/overview")
async def admin_overview(pin: str):
    """Global stats + per-surveyor breakdown for the project owner."""
    _check_pin(pin)
    now = datetime.now(timezone.utc)
    today_str = now.strftime('%Y-%m-%d')
    week_ago = (now - timedelta(days=7)).isoformat()

    addresses = []
    async for doc in db.addresses.find({}, {"_id": 0, "photo_base64": 0, "photos": 0}):
        addresses.append(doc)

    total = len(addresses)
    by_type = {"household": 0, "commerce": 0, "public": 0, "heritage": 0}
    users: dict = {}
    today_count = 0
    week_count = 0
    for a in addresses:
        if a.get("is_heritage"):
            by_type["heritage"] += 1
        elif a.get("is_public"):
            by_type["public"] += 1
        elif a.get("is_commerce"):
            by_type["commerce"] += 1
        else:
            by_type["household"] += 1
        created = a.get("created_at", "")
        if created.startswith(today_str):
            today_count += 1
        if created >= week_ago:
            week_count += 1
        oid = a.get("owner_id", "guest")
        u = users.setdefault(oid, {
            "owner_id": oid, "owner_name": "", "total": 0, "today": 0, "last_activity": "",
        })
        u["total"] += 1
        if a.get("owner_name") and not u["owner_name"]:
            u["owner_name"] = a["owner_name"]
        if created.startswith(today_str):
            u["today"] += 1
        if created > u["last_activity"]:
            u["last_activity"] = created

    surveys_count = await db.surveys.count_documents({})
    persons_count = 0
    async for s in db.surveys.find({}, {"_id": 0, "persons": 1}):
        persons_count += len(s.get("persons") or [])

    users_list = sorted(users.values(), key=lambda u: u["last_activity"], reverse=True)
    active_24h = sum(
        1 for u in users_list
        if u["last_activity"] and u["last_activity"] >= (now - timedelta(hours=24)).isoformat()
    )
    return {
        "total_addresses": total,
        "by_type": by_type,
        "surveys_count": surveys_count,
        "persons_count": persons_count,
        "today_count": today_count,
        "week_count": week_count,
        "active_users_24h": active_24h,
        "users": users_list,
        "generated_at": now.isoformat(),
    }


@api_router.get("/admin/addresses")
async def admin_addresses(pin: str, limit: int = 300):
    """All addresses from ALL surveyors (photos stripped), newest first, with survey summary."""
    _check_pin(pin)
    out = []
    cursor = db.addresses.find({}, {"_id": 0, "photo_base64": 0}).sort("created_at", -1).limit(limit)
    async for a in cursor:
        photos = a.pop("photos", None)
        a["photos_count"] = len(photos or [])
        s = await db.surveys.find_one(
            {"address_id": a["address_id"]},
            {"_id": 0, "survey_type": 1, "family_name": 1, "persons": 1,
             "commerce.name": 1, "public_service.name": 1, "heritage.name": 1},
        )
        if s:
            a["survey_type"] = s.get("survey_type", "")
            a["survey_name"] = (
                s.get("family_name")
                or (s.get("commerce") or {}).get("name")
                or (s.get("public_service") or {}).get("name")
                or (s.get("heritage") or {}).get("name")
                or ""
            )
            a["persons_count"] = len(s.get("persons") or [])
        out.append(a)
    return out


@api_router.get("/admin/address/{address_id}")
async def admin_address_full(address_id: str, pin: str):
    """Complete record of one building: address + full survey answers + persons
    with their frequented places. Used by the admin dashboard search."""
    _check_pin(pin)
    addr = await db.addresses.find_one(
        {"address_id": address_id}, {"_id": 0, "photo_base64": 0, "photos": 0}
    )
    if not addr:
        raise HTTPException(404, "Address not found")
    survey = await db.surveys.find_one({"address_id": address_id}, {"_id": 0})
    return {"address": addr, "survey": survey}


@api_router.get("/admin/export/csv")
async def admin_export_csv(pin: str):
    """Full CSV of ALL surveyors' data (owner columns included)."""
    _check_pin(pin)
    addresses = []
    async for doc in db.addresses.find({}, {"_id": 0}):
        addresses.append(doc)
    csv_content = await _build_csv_content(addresses)
    filename = f"efyl_admin_export_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api_router.get("/admin/docs/questionnaires.pdf")
async def admin_docs_questionnaires(pin: str, lang: str = "fr"):
    """Read-only download of the full questionnaire reference PDF (all survey
    questions). Generated by /app/scripts/generate_questionnaire_pdf*.py."""
    _check_pin(pin)
    suffix = "EN" if lang.lower() == "en" else "FR"
    path = f"/app/memory/EFYL_Questionnaires_Complets_{suffix}.pdf"
    if not os.path.exists(path):
        raise HTTPException(404, "PDF not generated")
    with open(path, "rb") as f:
        content = f.read()
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="EFYL_Questionnaires_Complets_{suffix}.pdf"'},
    )


@api_router.get("/admin/export/csv-enriched")
async def admin_export_csv_enriched(pin: str):
    """Read-only ENRICHED COPY of the admin CSV (auto-recovery of data recorded
    'one way or another'). The normal export and the database stay untouched."""
    _check_pin(pin)
    addresses = []
    addr_ids = set()
    async for doc in db.addresses.find({}, {"_id": 0}):
        addresses.append(doc)
        addr_ids.add(doc["address_id"])
    # Surveys without any address row (orphans) would otherwise be invisible
    seen_orphans = set()
    async for sdoc in db.surveys.find({}, {"_id": 0, "address_id": 1}):
        aid = sdoc.get("address_id")
        if aid and aid not in addr_ids and aid not in seen_orphans:
            seen_orphans.add(aid)
            addresses.append({"address_id": aid, "_orphan_survey": True})
    csv_content = await _build_csv_content(addresses, enrich=True)
    filename = f"efyl_admin_export_ENRICHI_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api_router.get("/export/json")
async def export_json(owner_id: Optional[str] = None):
    """Return all addresses + survey data as JSON file (for app-side download)."""
    query: dict = {}
    if owner_id:
        query["owner_id"] = owner_id

    addresses = []
    async for doc in db.addresses.find(query, {"_id": 0}):
        s = await db.surveys.find_one({"address_id": doc["address_id"]}, {"_id": 0})
        doc["survey"] = s
        addresses.append(doc)

    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "count": len(addresses),
        "items": addresses,
    }


# ============ DOCS / GUIDES DOWNLOAD ============
DOCS_DIR = Path("/app/memory")

@api_router.get("/docs/list")
async def list_docs():
    """List all downloadable documents available."""
    if not DOCS_DIR.exists():
        return {"docs": []}
    items = []
    for p in sorted(DOCS_DIR.iterdir()):
        if p.is_file() and p.suffix.lower() in (".pdf", ".xlsx", ".md", ".csv", ".json"):
            items.append({
                "filename": p.name,
                "size_bytes": p.stat().st_size,
                "url": f"/api/docs/download/{p.name}",
            })
    return {"docs": items}


@api_router.get("/docs/download/{filename}")
async def download_doc(filename: str):
    """Stream a document file from /app/memory. Restricted to known extensions."""
    from fastapi.responses import FileResponse
    safe = Path(filename).name  # avoid traversal
    target = DOCS_DIR / safe
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="Document non trouvé")
    if target.suffix.lower() not in (".pdf", ".xlsx", ".md", ".csv", ".json"):
        raise HTTPException(status_code=400, detail="Extension non autorisée")
    media_map = {
        ".pdf": "application/pdf",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".md": "text/markdown",
        ".csv": "text/csv",
        ".json": "application/json",
    }
    return FileResponse(
        path=str(target),
        media_type=media_map[target.suffix.lower()],
        filename=safe,
    )


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
