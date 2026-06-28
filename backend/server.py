from fastapi import FastAPI, APIRouter, HTTPException, Response
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


# Household survey models
class Person(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    phone_or_email: str = ""
    age: int = 0
    gender: Literal["male", "female"] = "male"
    education: Literal["primary", "middle", "high_school", "university", "none"] = "none"
    profession: str = ""
    frequented_place: str = ""


class Commerce(BaseModel):
    name: str = ""
    owner: str = ""
    phone: str = ""
    products: str = ""
    hours_weekdays: str = ""
    hours_saturday: str = ""
    hours_sunday: str = ""


class HouseholdSurvey(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    address_id: str
    owner_id: Optional[str] = "guest"
    survey_type: Literal["household", "commerce"] = "household"
    total_persons: int = 1
    main_income_source: str = ""
    other_income_sources: str = ""
    income_level: Literal["very_low", "low", "medium", "high"] = "low"
    num_phones: int = 0
    has_internet: bool = False
    electricity: Literal["stable", "unstable", "none"] = "none"
    water: Literal["stable", "unstable", "none"] = "none"
    toilets: Literal["flush", "traditional", "other"] = "traditional"
    toilets_other: str = ""
    kitchen_position: Literal["room", "living_room", "separate"] = "room"
    num_living_rooms: int = 0
    num_floors: int = 1
    wall_materials: Literal["concrete", "adobe", "wood", "other"] = "concrete"
    wall_materials_other: str = ""
    has_glass_windows: bool = False
    roof_materials: Literal["metal", "wood", "plastic", "concrete", "other"] = "metal"
    roof_materials_other: str = ""
    vehicles_bicycles: int = 0
    vehicles_motorcycles: int = 0
    vehicles_cars: int = 0
    vehicles_trucks: int = 0
    is_commerce: bool = False
    commerce: Optional[Commerce] = None
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
        pub_query: dict = {"is_commerce": True, "owner_id": {"$ne": owner_id}}
        if q:
            pub_query["$or"] = [
                {"contact_name": {"$regex": q, "$options": "i"}},
                {"address_id": {"$regex": q, "$options": "i"}},
                {"district": {"$regex": q, "$options": "i"}},
            ]
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
    """Returns all public commerce addresses from any user (community map)."""
    query: dict = {"is_commerce": True}
    if q:
        query["$or"] = [
            {"contact_name": {"$regex": q, "$options": "i"}},
            {"address_id": {"$regex": q, "$options": "i"}},
            {"district": {"$regex": q, "$options": "i"}},
        ]
    cursor = db.addresses.find(query, {"_id": 0}).sort("created_at", -1).limit(2000)
    out = []
    async for doc in cursor:
        doc.setdefault("low_accuracy", False)
        doc.setdefault("has_survey", False)
        doc.setdefault("is_commerce", True)
        out.append(Address(**doc))
    return out


@api_router.get("/addresses/{address_id}", response_model=Address)
async def get_address(address_id: str, owner_id: str = "guest"):
    doc = await db.addresses.find_one(
        {"address_id": address_id, "owner_id": owner_id}, {"_id": 0}
    )
    if not doc:
        doc = await db.addresses.find_one({"address_id": address_id}, {"_id": 0})
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
            raise HTTPException(502, f"SMS provider error: {str(e)}")

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


@api_router.post("/auth/otp/verify")
async def otp_verify(payload: OTPVerify):
    phone = payload.phone.strip()
    code = payload.code.strip()

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
            raise HTTPException(502, f"SMS provider error: {str(e)}")
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


# ============ SURVEY ENDPOINTS ============
@api_router.post("/surveys", response_model=HouseholdSurvey)
async def create_survey(payload: HouseholdSurvey):
    survey = payload
    if not survey.id:
        survey.id = str(uuid.uuid4())
    # Propagate type to address: commerce surveys mark the address as public
    survey.is_commerce = (survey.survey_type == "commerce")
    await db.surveys.update_one(
        {"address_id": survey.address_id, "owner_id": survey.owner_id},
        {"$set": survey.dict()},
        upsert=True,
    )
    # mark address with has_survey + is_commerce flags (scoped to owner to avoid cross-user mutation)
    addr_updates = {"has_survey": True, "is_commerce": survey.is_commerce}
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
@api_router.get("/export/csv")
async def export_csv(owner_id: Optional[str] = None):
    """Return all addresses + survey data as a CSV file."""
    query: dict = {}
    if owner_id:
        query["owner_id"] = owner_id

    addresses = []
    async for doc in db.addresses.find(query, {"_id": 0}):
        addresses.append(doc)

    output = io.StringIO()
    writer = csv.writer(output)

    headers = [
        "address_id", "district", "sector", "street_id", "house_number",
        "contact_name", "contact_phone", "notes",
        "latitude", "longitude", "accuracy_meters", "low_accuracy",
        "verified", "flag_count",
        "azimuth_degrees", "lat_raw", "lng_raw", "lat_corrected", "lng_corrected",
        "has_photo", "created_at",
        # survey
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
        "commerce_hours_weekdays", "commerce_hours_saturday", "commerce_hours_sunday",
        "persons_count", "persons_summary",
    ]
    writer.writerow(headers)

    for a in addresses:
        s = await db.surveys.find_one({"address_id": a["address_id"]}, {"_id": 0}) or {}
        commerce = (s.get("commerce") or {}) if s else {}
        persons = s.get("persons", []) if s else []
        persons_summary = "; ".join(
            f"{p.get('name','?')}({p.get('age','?')}|{p.get('gender','?')}|{p.get('education','?')}|{p.get('profession','')})"
            for p in persons
        )
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
            bool(a.get("photo_base64")), a.get("created_at", ""),
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
            commerce.get("hours_weekdays", ""), commerce.get("hours_saturday", ""),
            commerce.get("hours_sunday", ""),
            len(persons), persons_summary,
        ]
        writer.writerow(row)

    csv_content = output.getvalue()
    output.close()
    filename = f"efyl_export_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
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
