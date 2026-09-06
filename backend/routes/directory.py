"""EFYL Répertoire (public directory) — read-only, privacy-filtered access to
the central registry, plus the admin CSV import used to attach matricules and
exact navigation points provided by the field cartography partner.

Privacy rule (see EFYL_STOCKAGE_ET_SCENARIOS_FR.md §3): the directory never
exposes household life data (persons, income, phones, materials...). Only what
is needed to FIND a place is returned.
"""
import csv
import io
import time
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from shared import check_pin, db, norm_text

router = APIRouter(prefix="/api")

CATEGORIES = ("household", "commerce", "public", "heritage")
_CACHE: Dict[str, Any] = {}
_CACHE_TTL = 45  # seconds — keeps typing in the search bar instant


def category_of(a: dict) -> str:
    if a.get("is_heritage"):
        return "heritage"
    if a.get("is_public"):
        return "public"
    if a.get("is_commerce"):
        return "commerce"
    return "household"


def _category_query(category: str) -> dict:
    if category == "heritage":
        return {"is_heritage": True}
    if category == "public":
        return {"is_public": True, "is_heritage": {"$ne": True}}
    if category == "commerce":
        return {"is_commerce": True, "is_public": {"$ne": True}, "is_heritage": {"$ne": True}}
    return {"is_commerce": {"$ne": True}, "is_public": {"$ne": True}, "is_heritage": {"$ne": True}}


def _survey_name(s: dict, category: str) -> str:
    if not s:
        return ""
    if category == "commerce":
        return (s.get("commerce") or {}).get("name", "") or ""
    if category == "public":
        return (s.get("public_service") or {}).get("name", "") or ""
    if category == "heritage":
        return (s.get("heritage") or {}).get("name", "") or ""
    return s.get("family_name", "") or ""


def _fallback_name(a: dict, category: str) -> str:
    if a.get("contact_name"):
        return str(a["contact_name"])
    label = {"household": "Foyer", "commerce": "Commerce",
             "public": "Service public", "heritage": "Site"}[category]
    house = a.get("house_number") or a.get("address_id", "")
    return f"{label} {house}".strip()


def _nav_point(a: dict) -> Dict[str, Optional[float]]:
    """Best known point to guide someone to the door:
    surveyed navigation point > satellite-corrected GPS > raw GPS."""
    if a.get("nav_lat") is not None and a.get("nav_lng") is not None:
        return {"lat": a["nav_lat"], "lng": a["nav_lng"], "source": "nav_point"}
    if a.get("lat_corrected") is not None and a.get("lng_corrected") is not None:
        return {"lat": a["lat_corrected"], "lng": a["lng_corrected"], "source": "corrected"}
    return {"lat": a.get("latitude"), "lng": a.get("longitude"), "source": "gps"}


async def _build_index(category: str) -> List[dict]:
    """One deduplicated, name-resolved row per address of the category."""
    addrs: List[dict] = []
    cursor = db.addresses.find(
        _category_query(category),
        {"_id": 0, "photos": 0, "photo_base64": 0},
    )
    async for a in cursor:
        addrs.append(a)

    # Duplicate address codes can exist across devices → keep the richest row
    best: Dict[str, dict] = {}
    for a in addrs:
        aid = a.get("address_id")
        if not aid:
            continue
        cur = best.get(aid)
        if cur is None:
            best[aid] = a
            continue
        score = (1 if a.get("has_survey") else 0, a.get("created_at", ""))
        cur_score = (1 if cur.get("has_survey") else 0, cur.get("created_at", ""))
        if score > cur_score:
            best[aid] = a

    ids = list(best.keys())
    names: Dict[str, str] = {}
    if ids:
        scursor = db.surveys.find(
            {"address_id": {"$in": ids}},
            {"_id": 0, "address_id": 1, "survey_type": 1, "family_name": 1,
             "commerce.name": 1, "public_service.name": 1, "heritage.name": 1},
        )
        async for s in scursor:
            nm = _survey_name(s, category)
            if nm and not names.get(s["address_id"]):
                names[s["address_id"]] = nm

    out: List[dict] = []
    for aid, a in best.items():
        name = names.get(aid) or _fallback_name(a, category)
        nav = _nav_point(a)
        out.append({
            "address_id": aid,
            "matricule": a.get("matricule", "") or "",
            "name": name,
            "district": a.get("district", "") or "",
            "sector": a.get("sector", "") or "",
            "street_id": a.get("street_id", "") or "",
            "house_number": a.get("house_number", "") or "",
            "category": category,
            "lat": nav["lat"],
            "lng": nav["lng"],
            "nav_source": nav["source"],
            "verified": bool(a.get("verified")),
            "has_survey": bool(a.get("has_survey")),
            "created_at": a.get("created_at", ""),
            "_search": norm_text(
                f"{name} {a.get('matricule','')} {aid} {a.get('district','')} "
                f"{a.get('sector','')} {a.get('house_number','')}"
            ),
        })
    out.sort(key=lambda r: norm_text(r["name"]))
    return out


async def _index(category: str) -> List[dict]:
    hit = _CACHE.get(category)
    if hit and (time.time() - hit[0]) < _CACHE_TTL:
        return hit[1]
    rows = await _build_index(category)
    _CACHE[category] = (time.time(), rows)
    return rows


def _invalidate_cache() -> None:
    _CACHE.clear()


@router.get("/directory/summary")
async def directory_summary():
    """Counts per category for the directory home screen."""
    counts = {}
    for c in CATEGORIES:
        counts[c] = len(await _index(c))
    return {"counts": counts, "total": sum(counts.values())}


@router.get("/directory/entries")
async def directory_entries(
    category: str,
    q: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    sort: str = "name",
):
    """Searchable registry of a category. Search matches the recorded name,
    the matricule, the address code, the district/sector and the house number."""
    if category not in CATEGORIES:
        raise HTTPException(400, "Unknown category")
    rows = await _index(category)
    needle = norm_text(q)
    if needle:
        terms = [tk for tk in needle.split(" ") if tk]
        rows = [r for r in rows if all(tk in r["_search"] for tk in terms)]

    if sort == "near" and lat is not None and lng is not None:
        def dist(r):
            if r["lat"] is None or r["lng"] is None:
                return 10 ** 9
            dlat = (r["lat"] - lat) * 111320.0
            dlng = (r["lng"] - lng) * 111320.0 * 0.9  # ~cos(lat) around 5-6°N
            return (dlat * dlat + dlng * dlng) ** 0.5
        rows = sorted(rows, key=dist)
        rows = [{**r, "distance_m": round(dist(r))} for r in rows]
    elif sort == "recent":
        rows = sorted(rows, key=lambda r: r.get("created_at", ""), reverse=True)

    total = len(rows)
    page = rows[max(0, offset): max(0, offset) + max(1, min(limit, 200))]
    return {
        "category": category,
        "total": total,
        "offset": offset,
        "items": [{k: v for k, v in r.items() if k != "_search"} for r in page],
    }


@router.get("/directory/entry/{address_id}")
async def directory_entry(address_id: str):
    """Privacy-filtered public record of one place + guidance data."""
    addrs = []
    cursor = db.addresses.find({"address_id": address_id}, {"_id": 0})
    async for a in cursor:
        addrs.append(a)
    if not addrs:
        raise HTTPException(404, "Address not found in the registry")
    addrs.sort(key=lambda a: (1 if a.get("has_survey") else 0, a.get("created_at", "")), reverse=True)
    a = addrs[0]
    category = category_of(a)

    survey = await db.surveys.find_one(
        {"address_id": address_id, "owner_id": a.get("owner_id")}, {"_id": 0}
    ) or await db.surveys.find_one({"address_id": address_id}, {"_id": 0}) or {}

    name = _survey_name(survey, category) or _fallback_name(a, category)
    nav = _nav_point(a)

    details: Dict[str, Any] = {}
    if category == "commerce":
        c = survey.get("commerce") or {}
        details = {
            "owner": c.get("owner", ""),
            "products": c.get("products", ""),
            "phone": c.get("phone", ""),
            "hours_weekdays": c.get("hours_weekdays", ""),
            "hours_saturday": c.get("hours_saturday", ""),
            "hours_sunday": c.get("hours_sunday", ""),
        }
    elif category == "public":
        p = survey.get("public_service") or {}
        details = {
            "service_category": p.get("category", ""),
            "service_category_other": p.get("category_other", ""),
            "managing_org": p.get("managing_org", ""),
            "phone": p.get("phone", ""),
            "hours": p.get("hours", ""),
            "capacity_max": p.get("capacity_max", ""),
            "usage_current": p.get("usage_current", ""),
            "notes": p.get("notes", ""),
        }
    elif category == "heritage":
        h = survey.get("heritage") or {}
        details = {
            "kind": h.get("kind", ""),
            "site_category": h.get("category", ""),
            "site_category_other": h.get("category_other", ""),
            "description": h.get("description", ""),
            "manager": h.get("manager", ""),
            "phone": h.get("phone", ""),
            "access": h.get("access", ""),
            "entry_fee": h.get("entry_fee", ""),
            "hours": h.get("hours", ""),
            "best_period": h.get("best_period", ""),
            "photos_allowed": h.get("photos_allowed"),
            "restrictions": h.get("restrictions", ""),
            "facilities": h.get("facilities", ""),
            "road_access": h.get("road_access", ""),
        }
    # household → nothing from the survey is shareable (privacy by design)

    first_photo = None
    photos = a.get("photos") or []
    if photos and photos[0].get("base64"):
        first_photo = photos[0]["base64"]
    elif a.get("photo_base64"):
        first_photo = a["photo_base64"]

    return {
        "address_id": address_id,
        "matricule": a.get("matricule", "") or "",
        "name": name,
        "category": category,
        "district": a.get("district", "") or "",
        "sector": a.get("sector", "") or "",
        "street_id": a.get("street_id", "") or "",
        "house_number": a.get("house_number", "") or "",
        "access_hint": a.get("notes", "") or "",
        "nav_note": a.get("nav_note", "") or "",
        "azimuth_degrees": a.get("azimuth_degrees"),
        "lat": nav["lat"],
        "lng": nav["lng"],
        "nav_source": nav["source"],
        "accuracy_meters": a.get("accuracy_meters"),
        "verified": bool(a.get("verified")),
        "created_at": a.get("created_at", ""),
        "photo_base64": first_photo,
        "details": details,
    }


# ============ ADMIN IMPORT (matricules + exact navigation points) ============
class ImportRequest(BaseModel):
    csv_text: str
    dry_run: bool = False


_ALIASES = {
    "address_id": ["address_id", "addressid", "code", "code_adresse", "codeadresse",
                   "adresse", "address", "id_adresse", "code_efyl"],
    "matricule": ["matricule", "matricules", "mat", "numero_matricule",
                  "n_matricule", "registration", "matricula"],
    "nav_lat": ["nav_lat", "navlat", "lat_nav", "latitude_exacte", "lat_exacte",
                "lat_exact", "door_lat", "latitude_porte", "latitud"],
    "nav_lng": ["nav_lng", "navlng", "lng_nav", "longitude_exacte", "lng_exacte",
                "lng_exact", "lon_exact", "door_lng", "longitude_porte", "longitud"],
    "nav_note": ["nav_note", "acces", "access", "instructions", "itineraire",
                 "note_navigation", "indication", "indications", "observacion"],
}


def _map_headers(fieldnames: List[str]) -> Dict[str, str]:
    mapping: Dict[str, str] = {}
    for raw in fieldnames or []:
        key = norm_text(raw).replace(" ", "_").replace("-", "_")
        for target, aliases in _ALIASES.items():
            if key in aliases and target not in mapping:
                mapping[target] = raw
    return mapping


@router.post("/admin/import/matricules")
async def admin_import_matricules(payload: ImportRequest, pin: str):
    """Attach matricules and/or exact navigation points to existing addresses.

    Accepts a CSV (comma or semicolon separated) with a column identifying the
    address (address_id / code / code_adresse) and any of: matricule, nav_lat,
    nav_lng, nav_note. Only these fields are ever written — survey answers and
    GPS measurements recorded in the field are never overwritten."""
    check_pin(pin)
    text = payload.csv_text.lstrip("\ufeff")
    if not text.strip():
        raise HTTPException(400, "Empty CSV")
    sample = text[:4096]
    delimiter = ";" if sample.count(";") > sample.count(",") else ","
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    mapping = _map_headers(reader.fieldnames or [])
    if "address_id" not in mapping:
        raise HTTPException(
            400,
            "No address column found. Expected one of: address_id, code, code_adresse. "
            f"Columns seen: {reader.fieldnames}",
        )
    if not any(k in mapping for k in ("matricule", "nav_lat", "nav_lng", "nav_note")):
        raise HTTPException(
            400,
            "Nothing to import. Expected at least one of: matricule, nav_lat, nav_lng, nav_note. "
            f"Columns seen: {reader.fieldnames}",
        )

    rows = 0
    matched = 0
    updated_matricule = 0
    updated_nav = 0
    not_found_count = 0
    not_found: List[str] = []
    errors: List[str] = []

    for row in reader:
        rows += 1
        aid = (row.get(mapping["address_id"]) or "").strip()
        if not aid:
            continue
        updates: Dict[str, Any] = {}
        if "matricule" in mapping:
            mat = (row.get(mapping["matricule"]) or "").strip()
            if mat:
                updates["matricule"] = mat
        if "nav_note" in mapping:
            note = (row.get(mapping["nav_note"]) or "").strip()
            if note:
                updates["nav_note"] = note
        if "nav_lat" in mapping and "nav_lng" in mapping:
            raw_lat = (row.get(mapping["nav_lat"]) or "").strip().replace(",", ".")
            raw_lng = (row.get(mapping["nav_lng"]) or "").strip().replace(",", ".")
            if raw_lat and raw_lng:
                try:
                    updates["nav_lat"] = float(raw_lat)
                    updates["nav_lng"] = float(raw_lng)
                except ValueError:
                    if len(errors) < 10:
                        errors.append(f"{aid}: invalid coordinates '{raw_lat},{raw_lng}'")
        if not updates:
            continue
        exists = await db.addresses.count_documents({"address_id": aid}, limit=1)
        if not exists:
            not_found_count += 1
            if len(not_found) < 30:
                not_found.append(aid)
            continue
        matched += 1
        if not payload.dry_run:
            await db.addresses.update_many({"address_id": aid}, {"$set": updates})
        if "matricule" in updates:
            updated_matricule += 1
        if "nav_lat" in updates:
            updated_nav += 1

    if not payload.dry_run:
        _invalidate_cache()
    return {
        "dry_run": payload.dry_run,
        "columns_detected": mapping,
        "delimiter": delimiter,
        "rows_read": rows,
        "addresses_matched": matched,
        "matricules_set": updated_matricule,
        "nav_points_set": updated_nav,
        "not_found_count": not_found_count,
        "not_found_sample": not_found,
        "errors": errors,
    }
