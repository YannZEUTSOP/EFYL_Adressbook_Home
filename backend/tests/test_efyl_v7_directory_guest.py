"""EFYL v7 — Répertoire (directory) + Guest identity + admin matricules import.

Covers batch v7 features:
 - GET /api/directory/summary
 - GET /api/directory/entries (filters/search/pagination/sort)
 - GET /api/directory/entry/{address_id}  (privacy contract)
 - POST /api/admin/import/matricules?pin=237237
 - CSV exports (new 4 columns matricule,nav_lat,nav_lng,nav_note before quality_issues)
 - Guest register/device-check/lookup/login (lock, ref, masking)
"""
import io
import csv
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_BACKEND_URL",
                          "https://efyl-address-book.preview.emergentagent.com").rstrip("/")
ADMIN_PIN = "237237"
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- 1) Directory summary ----------
class TestDirectorySummary:
    def test_summary_shape_and_totals(self, api):
        r = api.get(f"{API}/directory/summary", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "counts" in d and "total" in d
        for k in ("household", "commerce", "public", "heritage"):
            assert k in d["counts"] and isinstance(d["counts"][k], int)
        assert d["total"] == sum(d["counts"].values())
        # sanity floor (spec says ~1246 unique addresses)
        assert d["total"] >= 100


# ---------- 2) Directory entries ----------
class TestDirectoryEntries:
    def test_invalid_category_400(self, api):
        r = api.get(f"{API}/directory/entries", params={"category": "unknown"})
        assert r.status_code == 400

    def test_commerce_first_page(self, api):
        r = api.get(f"{API}/directory/entries",
                    params={"category": "commerce", "limit": 5, "offset": 0})
        assert r.status_code == 200
        d = r.json()
        assert d["category"] == "commerce"
        assert isinstance(d["items"], list)
        for it in d["items"]:
            assert it["category"] == "commerce"
            assert "_search" not in it  # internal field must not leak
            for k in ("address_id", "matricule", "name", "district", "sector",
                      "house_number", "lat", "lng", "nav_source"):
                assert k in it

    def test_pagination_stable_total(self, api):
        p1 = api.get(f"{API}/directory/entries",
                     params={"category": "household", "limit": 10, "offset": 0}).json()
        p2 = api.get(f"{API}/directory/entries",
                     params={"category": "household", "limit": 10, "offset": 10}).json()
        assert p1["total"] == p2["total"]
        ids1 = {i["address_id"] for i in p1["items"]}
        ids2 = {i["address_id"] for i in p2["items"]}
        assert ids1.isdisjoint(ids2)

    def test_search_case_and_accent_insensitive(self, api):
        # 'alimentation' should hit commerce entries (from live data)
        r1 = api.get(f"{API}/directory/entries",
                     params={"category": "commerce", "q": "alimentation", "limit": 50})
        r2 = api.get(f"{API}/directory/entries",
                     params={"category": "commerce", "q": "ALIMENTATION", "limit": 50})
        r3 = api.get(f"{API}/directory/entries",
                     params={"category": "commerce", "q": "álïméntätïon", "limit": 50})
        assert r1.status_code == r2.status_code == r3.status_code == 200
        assert r1.json()["total"] == r2.json()["total"] == r3.json()["total"]
        assert r1.json()["total"] >= 1

    def test_multi_word_search(self, api):
        r = api.get(f"{API}/directory/entries",
                    params={"category": "commerce", "q": "alimentation balatchi", "limit": 50})
        assert r.status_code == 200
        # every returned item's normalised search string must include both terms
        for it in r.json()["items"]:
            hay = " ".join(str(v).lower() for v in it.values() if v).replace("é", "e")
            assert "alimentation" in hay
            assert "balatchi" in hay

    def test_sort_near_adds_distance(self, api):
        r = api.get(f"{API}/directory/entries",
                    params={"category": "commerce", "sort": "near",
                            "lat": 5.312, "lng": 10.193, "limit": 5})
        assert r.status_code == 200
        items = r.json()["items"]
        assert items, "expected at least 1 commerce"
        assert "distance_m" in items[0]
        # sorted ascending
        dists = [i["distance_m"] for i in items]
        assert dists == sorted(dists)

    def test_sort_recent(self, api):
        r = api.get(f"{API}/directory/entries",
                    params={"category": "household", "sort": "recent", "limit": 5})
        assert r.status_code == 200
        items = r.json()["items"]
        created = [i.get("created_at", "") for i in items]
        assert created == sorted(created, reverse=True)


# ---------- 3) Directory entry (privacy contract) ----------
class TestDirectoryEntry:
    def test_unknown_returns_404(self, api):
        r = api.get(f"{API}/directory/entry/ZZ-UNKNOWN-XXXX")
        assert r.status_code == 404

    def test_household_privacy(self, api):
        entries = api.get(f"{API}/directory/entries",
                          params={"category": "household", "limit": 1}).json()["items"]
        assert entries
        aid = entries[0]["address_id"]
        e = api.get(f"{API}/directory/entry/{aid}").json()
        assert e["category"] == "household"
        # PRIVACY: household must return details == {}
        assert e["details"] == {}, f"leak: {e['details']}"
        # Also ensure no private keys leaked at top level
        forbidden = ["persons", "total_persons", "income", "num_phones",
                     "materials", "contact_phone"]
        for k in forbidden:
            assert k not in e, f"forbidden field {k} in household entry"

    def test_commerce_details_present(self, api):
        entries = api.get(f"{API}/directory/entries",
                          params={"category": "commerce", "limit": 5}).json()["items"]
        # find a commerce with a matching survey; try each
        found = False
        for it in entries:
            e = api.get(f"{API}/directory/entry/{it['address_id']}").json()
            assert e["category"] == "commerce"
            d = e["details"]
            for k in ("owner", "products", "phone", "hours_weekdays",
                      "hours_saturday", "hours_sunday"):
                assert k in d
            found = True
            break
        assert found

    def test_public_details_present(self, api):
        entries = api.get(f"{API}/directory/entries",
                          params={"category": "public", "limit": 1}).json()["items"]
        assert entries
        e = api.get(f"{API}/directory/entry/{entries[0]['address_id']}").json()
        assert e["category"] == "public"
        d = e["details"]
        for k in ("service_category", "managing_org", "phone", "hours",
                  "capacity_max", "usage_current"):
            assert k in d

    def test_heritage_details_present(self, api):
        entries = api.get(f"{API}/directory/entries",
                          params={"category": "heritage", "limit": 1}).json()["items"]
        assert entries
        e = api.get(f"{API}/directory/entry/{entries[0]['address_id']}").json()
        assert e["category"] == "heritage"
        d = e["details"]
        for k in ("kind", "site_category", "access", "entry_fee",
                  "hours", "photos_allowed", "facilities", "road_access"):
            assert k in d


# ---------- 4) Admin import matricules ----------
@pytest.fixture(scope="module")
def import_target_address(api):
    """Create a throwaway address so we can safely mutate it."""
    aid = f"ZZTEST-{uuid.uuid4().hex[:8].upper()}"
    from motor.motor_asyncio import AsyncIOMotorClient  # noqa
    # We insert via the public API — /api/addresses (POST) if available.
    payload = {
        "address_id": aid,
        "district": "TestDistrict",
        "sector": "Z",
        "street_id": "999",
        "house_number": "1",
        "latitude": 5.31, "longitude": 10.19,
        "accuracy_meters": 8.0,
        "azimuth_degrees": 90,
        "owner_id": "guest-zztest",
    }
    r = api.post(f"{API}/addresses", json=payload, timeout=15)
    assert r.status_code in (200, 201), f"cannot seed address: {r.status_code} {r.text[:200]}"
    yield aid
    # cleanup: no admin delete endpoint — leave rows tagged ZZTEST-*


class TestAdminImportMatricules:
    def test_wrong_pin_403(self, api):
        r = api.post(f"{API}/admin/import/matricules",
                     params={"pin": "000000"},
                     json={"csv_text": "code,matricule\nZZ,MAT1", "dry_run": True})
        assert r.status_code == 403

    def test_missing_address_column_400(self, api):
        csv_text = "foo,bar\n1,2\n"
        r = api.post(f"{API}/admin/import/matricules",
                     params={"pin": ADMIN_PIN},
                     json={"csv_text": csv_text, "dry_run": True})
        assert r.status_code == 400

    def test_nothing_to_import_400(self, api):
        csv_text = "code_adresse\nABC\n"
        r = api.post(f"{API}/admin/import/matricules",
                     params={"pin": ADMIN_PIN},
                     json={"csv_text": csv_text, "dry_run": True})
        assert r.status_code == 400

    def test_dry_run_no_mutation(self, api, import_target_address):
        aid = import_target_address
        csv_text = f"code;matricule;latitude_exacte;longitude_exacte;acces\n{aid};DRY-MAT-1;5.5;10.5;porte bleue\n"
        r = api.post(f"{API}/admin/import/matricules",
                     params={"pin": ADMIN_PIN},
                     json={"csv_text": csv_text, "dry_run": True})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["dry_run"] is True
        assert d["delimiter"] == ";"
        assert d["addresses_matched"] == 1
        # verify not written: entry has no matricule
        # Directory index cache TTL 45s — dry_run must not invalidate cache
        # so we assert against DB directly via entry endpoint (which reads live)
        entry = api.get(f"{API}/directory/entry/{aid}").json()
        assert entry.get("matricule", "") == ""

    def test_real_import_and_search(self, api, import_target_address):
        aid = import_target_address
        mat = f"MAT-{uuid.uuid4().hex[:6].upper()}"
        csv_text = f"code,matricule,nav_lat,nav_lng,nav_note\n{aid},{mat},5.5,10.5,portail rouge\n"
        r = api.post(f"{API}/admin/import/matricules",
                     params={"pin": ADMIN_PIN},
                     json={"csv_text": csv_text, "dry_run": False})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["dry_run"] is False
        assert d["delimiter"] == ","
        assert d["matricules_set"] == 1
        assert d["nav_points_set"] == 1
        # /api/directory/entry/{aid} must show the imported values (cache invalidated)
        entry = api.get(f"{API}/directory/entry/{aid}").json()
        assert entry["matricule"] == mat
        assert entry["nav_note"] == "portail rouge"
        assert entry["nav_source"] == "nav_point"
        assert abs(entry["lat"] - 5.5) < 1e-6
        # search by matricule finds it
        cat = entry["category"]
        s = api.get(f"{API}/directory/entries",
                    params={"category": cat, "q": mat, "limit": 5}).json()
        assert any(i["address_id"] == aid for i in s["items"])

    def test_invalid_coords_reported(self, api, import_target_address):
        aid = import_target_address
        csv_text = f"code,nav_lat,nav_lng\n{aid},not-a-number,10.5\n"
        r = api.post(f"{API}/admin/import/matricules",
                     params={"pin": ADMIN_PIN},
                     json={"csv_text": csv_text, "dry_run": True})
        assert r.status_code == 200
        d = r.json()
        assert any("invalid coordinates" in e for e in d["errors"])

    def test_unknown_code_in_not_found(self, api):
        bogus = "ZZ-DOES-NOT-EXIST-XYZ"
        csv_text = f"code,matricule\n{bogus},X\n"
        r = api.post(f"{API}/admin/import/matricules",
                     params={"pin": ADMIN_PIN},
                     json={"csv_text": csv_text, "dry_run": True})
        assert r.status_code == 200
        d = r.json()
        assert d["not_found_count"] >= 1
        assert bogus in d["not_found_sample"]


# ---------- 5) CSV exports contain new 4 columns ----------
class TestCsvExports:
    def _fetch_csv(self, path):
        r = requests.get(f"{API}{path}", params={"pin": ADMIN_PIN}, timeout=60)
        assert r.status_code == 200, r.text[:400]
        text = r.text.lstrip("\ufeff")
        reader = csv.reader(io.StringIO(text))
        header = next(reader)
        return header

    def test_csv_headers_contain_new_columns(self):
        header = self._fetch_csv("/admin/export/csv")
        for col in ("matricule", "nav_lat", "nav_lng", "nav_note"):
            assert col in header, f"missing {col}: {header}"
        # order: matricule/nav_* must be BEFORE quality_issues
        qi = header.index("quality_issues")
        for col in ("matricule", "nav_lat", "nav_lng", "nav_note"):
            assert header.index(col) < qi

    def test_csv_enriched_headers_contain_new_columns(self):
        header = self._fetch_csv("/admin/export/csv-enriched")
        for col in ("matricule", "nav_lat", "nav_lng", "nav_note"):
            assert col in header
        qi = header.index("quality_issues")
        for col in ("matricule", "nav_lat", "nav_lng", "nav_note"):
            assert header.index(col) < qi
        # auto_completed still last
        assert header[-1] == "auto_completed"


# ---------- 6) Guest register + device-check + restore ----------
class TestGuestRegisterAndDeviceCheck:
    def test_short_name_400(self, api):
        r = api.post(f"{API}/guest/register",
                     json={"name": "A", "device_hash": "h1", "device_id": "d1"})
        assert r.status_code == 400

    def test_register_flow(self, api):
        did = f"qadev-{uuid.uuid4().hex[:8]}"
        dh = f"qahash-{uuid.uuid4().hex[:8]}"
        name = f"QATester-{uuid.uuid4().hex[:4]}"
        r = api.post(f"{API}/guest/register",
                     json={"name": name, "device_hash": dh, "device_id": did,
                           "device_label": "pytest"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["user_id"] == f"guest-{did}"
        assert d["guest_id"].startswith("EFYL-G-") and len(d["guest_id"]) == 13
        pin = d["pin"]
        assert pin.isdigit() and len(pin) == 4
        weak = {"0000","1111","2222","3333","4444","5555","6666","7777",
                "8888","9999","1234","4321","1212","0123"}
        assert pin not in weak
        # Token works on /api/restore
        r2 = api.get(f"{API}/restore",
                     headers={"Authorization": f"Bearer {d['token']}"})
        assert r2.status_code == 200
        # store for later
        pytest.guest_state = {
            "user_id": d["user_id"], "guest_id": d["guest_id"], "pin": pin,
            "device_hash": dh, "device_id": did, "name": name,
        }

    def test_device_check_known(self, api):
        st = pytest.guest_state
        r = api.post(f"{API}/guest/device-check",
                     json={"device_hash": st["device_hash"]})
        assert r.status_code == 200
        d = r.json()
        assert d["known"] is True
        acc = next((a for a in d["accounts"] if not a.get("is_guest") is False or True), None)
        assert acc is not None
        assert "••••" in acc["guest_id_masked"]
        # full guest_id never leaked
        assert st["guest_id"] not in str(d)
        assert acc["same_device"] is True
        assert acc["ref"]
        assert "addresses_count" in acc

    def test_device_check_unknown(self, api):
        r = api.post(f"{API}/guest/device-check",
                     json={"device_hash": f"bogushash-{uuid.uuid4().hex}"})
        assert r.status_code == 200
        assert r.json()["known"] is False


# ---------- 7) Guest lookup ----------
class TestGuestLookup:
    def test_short_name_400(self, api):
        r = api.post(f"{API}/guest/lookup", json={"name": "A"})
        assert r.status_code == 400

    def test_lookup_yann_case_insensitive(self, api):
        for name in ("yann", "YANN", "Yänn"):
            r = api.post(f"{API}/guest/lookup",
                         json={"name": name, "device_hash": "hash-test-1"})
            assert r.status_code == 200, f"{name} → {r.status_code}"
            d = r.json()
            names = [c["name"].lower() for c in d["candidates"]]
            assert any("yann" in n for n in names), f"no yann for '{name}': {names}"
            # masked ids only
            for c in d["candidates"]:
                assert "EFYL-G-F26D19" not in c["guest_id_masked"]
                assert "••••" in c["guest_id_masked"]
            assert d["count"] <= 8


# ---------- 8) Guest login ----------
class TestGuestLogin:
    def test_non_4_digit_400(self, api):
        r = api.post(f"{API}/guest/login",
                     json={"pin": "12", "guest_id": "EFYL-G-F26D19"})
        assert r.status_code == 400

    def test_login_with_guest_id(self, api):
        # login the pre-created Yann test account (PIN 1300)
        r = api.post(f"{API}/guest/login",
                     json={"pin": "1300", "guest_id": "EFYL-G-F26D19",
                           "device_hash": "hash-test-1"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["guest_id"] == "EFYL-G-F26D19"
        # token works
        rr = api.get(f"{API}/restore",
                     headers={"Authorization": f"Bearer {d['token']}"})
        assert rr.status_code == 200

    def test_login_with_ref_from_lookup(self, api):
        look = api.post(f"{API}/guest/lookup",
                        json={"name": "Yann", "device_hash": "hash-test-1"}).json()
        ref = None
        for c in look["candidates"]:
            if "F2" in c["guest_id_masked"] or True:
                ref = c["ref"]
                if "F2" in c["guest_id_masked"]:
                    break
        assert ref
        # Use the Yann candidate specifically
        yann_ref = None
        for c in look["candidates"]:
            if c["name"].lower() == "yann":
                yann_ref = c["ref"]
                break
        assert yann_ref
        r = api.post(f"{API}/guest/login",
                     json={"pin": "1300", "ref": yann_ref,
                           "device_hash": "hash-test-1"})
        assert r.status_code == 200
        assert r.json()["guest_id"] == "EFYL-G-F26D19"

    def test_tampered_ref_401(self, api):
        r = api.post(f"{API}/guest/login",
                     json={"pin": "1300", "ref": "tampered.invalid.token"})
        assert r.status_code == 401

    def test_wrong_pin_401_then_lock_429(self, api):
        """Use a throwaway account (do NOT lock EFYL-G-F26D19)."""
        did = f"lockdev-{uuid.uuid4().hex[:8]}"
        dh = f"lockhash-{uuid.uuid4().hex[:8]}"
        reg = api.post(f"{API}/guest/register",
                       json={"name": f"Lock{uuid.uuid4().hex[:4]}",
                             "device_hash": dh, "device_id": did}).json()
        gid = reg["guest_id"]
        # 5 wrong attempts → 5th (or later) yields 429
        got_lock = False
        for i in range(6):
            r = api.post(f"{API}/guest/login",
                         json={"pin": "9876", "guest_id": gid,
                               "device_hash": dh})
            if r.status_code == 429:
                got_lock = True
                break
            assert r.status_code == 401, f"attempt {i}: {r.status_code} {r.text}"
        # After hitting the threshold, a further attempt with correct pin also 429
        if not got_lock:
            r = api.post(f"{API}/guest/login",
                         json={"pin": reg["pin"], "guest_id": gid,
                               "device_hash": dh})
            assert r.status_code == 429, f"expected lock, got {r.status_code}"
        else:
            r = api.post(f"{API}/guest/login",
                         json={"pin": reg["pin"], "guest_id": gid,
                               "device_hash": dh})
            assert r.status_code == 429
