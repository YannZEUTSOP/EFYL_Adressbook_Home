"""Shared infrastructure for the EFYL API modules (db, tokens, helpers).

Keeps the newer route modules (directory, guest identity) free of circular
imports with server.py while guaranteeing they issue tokens the existing
/api/restore endpoint can validate (same secret, same claims).
"""
import os
import re
import hashlib
import unicodedata
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

import jwt as pyjwt
from dotenv import load_dotenv
from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'efyl-dev-secret-change-me')
TOKEN_DAYS = 90
ADMIN_PIN = os.environ.get('ADMIN_PIN', '237237')


def check_pin(pin: str) -> None:
    if pin != ADMIN_PIN:
        raise HTTPException(403, "Invalid admin PIN")


def make_token(user_id: str, days: int = TOKEN_DAYS) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=days)
    return pyjwt.encode({"sub": user_id, "type": "access", "exp": exp},
                        JWT_SECRET, algorithm="HS256")


def make_ref_token(user_id: str, minutes: int = 15) -> str:
    """Short-lived opaque reference to an account, so the directory of guest
    candidates never has to expose a full guest identifier."""
    exp = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    return pyjwt.encode({"sub": user_id, "type": "guest_ref", "exp": exp},
                        JWT_SECRET, algorithm="HS256")


def read_ref_token(ref: str) -> str:
    try:
        payload = pyjwt.decode(ref, JWT_SECRET, algorithms=["HS256"])
    except Exception:
        raise HTTPException(401, "Expired selection — search again")
    if payload.get("type") != "guest_ref":
        raise HTTPException(401, "Invalid selection")
    return str(payload["sub"])


def norm_text(s: Optional[str]) -> str:
    """Lowercase + accent-insensitive normalisation used for every search
    (field workers type 'yann', 'Yann' or 'YÄNN' indifferently)."""
    if not s:
        return ""
    decomposed = unicodedata.normalize("NFD", str(s))
    stripped = "".join(c for c in decomposed if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", stripped).strip().lower()


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
