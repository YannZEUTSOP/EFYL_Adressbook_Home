from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import math
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="EFYL Address Book API")
api_router = APIRouter(prefix="/api")


# ============ MODELS ============
class Address(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    address_id: str  # e.g. "BNA-F034-X156"
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


class AddressUpdate(BaseModel):
    district: Optional[str] = None
    sector: Optional[str] = None
    street_id: Optional[str] = None
    house_number: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None


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


# ============ HELPERS ============
def haversine_m(lat1, lon1, lat2, lon2):
    R = 6371000.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def clean(doc):
    if doc is None:
        return None
    doc.pop("_id", None)
    return doc


# ============ ROUTES ============
@api_router.get("/")
async def root():
    return {"message": "EFYL Address Book API", "version": "1.0.0"}


@api_router.get("/health")
async def health():
    return {"status": "ok"}


# Address CRUD
@api_router.post("/addresses", response_model=Address)
async def create_address(payload: AddressCreate):
    addr = Address(**payload.dict())
    doc = addr.dict()
    # Upsert by address_id+owner_id to keep idempotent
    await db.addresses.update_one(
        {"address_id": addr.address_id, "owner_id": addr.owner_id},
        {"$set": doc},
        upsert=True,
    )
    return addr


@api_router.get("/addresses", response_model=List[Address])
async def list_addresses(owner_id: str = "guest", q: Optional[str] = None):
    query: dict = {"owner_id": owner_id}
    if q:
        query["$or"] = [
            {"contact_name": {"$regex": q, "$options": "i"}},
            {"address_id": {"$regex": q, "$options": "i"}},
            {"district": {"$regex": q, "$options": "i"}},
        ]
    cursor = db.addresses.find(query, {"_id": 0}).sort("created_at", -1).limit(500)
    return [Address(**doc) async for doc in cursor]


@api_router.get("/addresses/{address_id}", response_model=Address)
async def get_address(address_id: str, owner_id: str = "guest"):
    doc = await db.addresses.find_one(
        {"address_id": address_id, "owner_id": owner_id}, {"_id": 0}
    )
    if not doc:
        # Allow public read for any verified address
        doc = await db.addresses.find_one({"address_id": address_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Address not found")
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
    return Address(**doc)


@api_router.delete("/addresses/{address_id}")
async def delete_address(address_id: str, owner_id: str = "guest"):
    result = await db.addresses.delete_one(
        {"address_id": address_id, "owner_id": owner_id}
    )
    return {"deleted": result.deleted_count}


# Sync (bulk push)
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


# Verify
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
    # log
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


# Public addresses near coordinates
@api_router.get("/addresses-nearby")
async def addresses_nearby(lat: float, lng: float, radius_km: float = 5.0):
    cursor = db.addresses.find({}, {"_id": 0}).limit(500)
    out = []
    async for doc in cursor:
        d = haversine_m(lat, lng, doc["latitude"], doc["longitude"]) / 1000.0
        if d <= radius_km:
            doc["distance_km"] = round(d, 3)
            out.append(doc)
    out.sort(key=lambda x: x["distance_km"])
    return out[:100]


# Mock OTP for MVP
@api_router.post("/auth/otp/request")
async def otp_request(payload: OTPRequest):
    # Mock: always return code 123456 for any phone
    code = "123456"
    await db.otp_codes.update_one(
        {"phone": payload.phone},
        {"$set": {"phone": payload.phone, "code": code,
                  "created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"sent": True, "demo_code": code, "phone": payload.phone}


@api_router.post("/auth/otp/verify")
async def otp_verify(payload: OTPVerify):
    rec = await db.otp_codes.find_one({"phone": payload.phone}, {"_id": 0})
    if not rec or rec.get("code") != payload.code:
        raise HTTPException(401, "Invalid code")
    user_id = f"user_{payload.phone.replace('+', '').replace(' ', '')}"
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"user_id": user_id, "phone": payload.phone,
                  "last_login": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"verified": True, "user_id": user_id, "phone": payload.phone}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
