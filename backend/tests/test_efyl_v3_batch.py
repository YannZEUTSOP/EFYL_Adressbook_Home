"""
EFYL AddressBook v3 batch tests — covers the new field-tester batch:
1. Public-service surveys (survey_type='public') — is_public propagation, /commerces inclusion, cross-user visibility in /addresses
2. Relaxed household models — empty strings + None must be accepted (no 422)
3. Multi-photo address create/read + new CSV columns (survey_type, photos_count, public_name, public_category)
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://efyl-address-book.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

_RUN = str(int(time.time()))[-6:]
PUB_ADDR_ID = f"TEST-PUB-{_RUN}"
COM_ADDR_ID = f"TEST-COM-{_RUN}"
PHOTO_ADDR_ID = f"TEST-PHOTO-{_RUN}"
OWNER_A = f"user_a_{_RUN}"
OWNER_B = f"user_b_{_RUN}"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module", autouse=True)
def _cleanup(client):
    for aid, owner in [
        (PUB_ADDR_ID, OWNER_A),
        (COM_ADDR_ID, OWNER_A),
        (PHOTO_ADDR_ID, OWNER_A),
    ]:
        try:
            client.delete(f"{API}/addresses/{aid}", params={"owner_id": owner}, timeout=10)
        except Exception:
            pass
    yield
    for aid, owner in [
        (PUB_ADDR_ID, OWNER_A),
        (COM_ADDR_ID, OWNER_A),
        (PHOTO_ADDR_ID, OWNER_A),
    ]:
        try:
            client.delete(f"{API}/addresses/{aid}", params={"owner_id": owner}, timeout=10)
        except Exception:
            pass


def _mk_address(client, address_id, owner_id):
    payload = {
        "address_id": address_id,
        "district": "Test",
        "sector": "X",
        "street_id": "001",
        "house_number": "010",
        "latitude": 5.3223,
        "longitude": 10.2272,
        "accuracy_meters": 3.0,
        "owner_id": owner_id,
    }
    r = client.post(f"{API}/addresses", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


# ============ PUBLIC SURVEY FLOW ============
class TestPublicSurveyFlow:
    def test_01_create_public_survey_marks_address_public(self, client):
        _mk_address(client, PUB_ADDR_ID, OWNER_A)
        survey = {
            "address_id": PUB_ADDR_ID,
            "owner_id": OWNER_A,
            "survey_type": "public",
            "public_service": {
                "name": "Ecole Publique de Fotouni",
                "category": "school",
                "category_other": "",
                "managing_org": "MINEDUB",
                "phone": "",
                "notes": "",
            },
            "persons": [],
        }
        r = client.post(f"{API}/surveys", json=survey, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["survey_type"] == "public"
        assert d["is_public"] is True
        assert d["is_commerce"] is False
        assert d["public_service"]["name"] == "Ecole Publique de Fotouni"
        assert d["public_service"]["category"] == "school"

    def test_02_address_now_is_public(self, client):
        r = client.get(f"{API}/addresses/{PUB_ADDR_ID}",
                       params={"owner_id": OWNER_A}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["is_public"] is True
        assert d["has_survey"] is True

    def test_03_commerces_endpoint_includes_public(self, client):
        r = client.get(f"{API}/commerces", timeout=15)
        assert r.status_code == 200
        items = r.json()
        found = next((i for i in items if i["address_id"] == PUB_ADDR_ID), None)
        assert found is not None, "Public building missing from /commerces community feed"
        assert found["is_public"] is True

    def test_04_other_users_see_public_via_addresses(self, client):
        # As OWNER_B, listing addresses should surface OWNER_A's public building
        r = client.get(f"{API}/addresses",
                       params={"owner_id": OWNER_B}, timeout=15)
        assert r.status_code == 200
        items = r.json()
        found = next((i for i in items if i["address_id"] == PUB_ADDR_ID), None)
        assert found is not None, (
            "OWNER_B should see OWNER_A's public building through include_public_commerces"
        )
        assert found["is_public"] is True


# ============ RELAXED HOUSEHOLD FIELDS ============
class TestRelaxedHouseholdFields:
    def test_01_empty_strings_and_none_accepted(self, client):
        """Field tester feedback (3): household survey must not force literal values;
        empty strings + None must round-trip cleanly (no 422)."""
        _mk_address(client, COM_ADDR_ID, OWNER_A)
        payload = {
            "address_id": COM_ADDR_ID,
            "owner_id": OWNER_A,
            "survey_type": "commerce",
            "total_persons": 1,
            "main_income_source": "",
            "other_income_sources": "",
            "income_level": "",
            "num_phones": 0,
            "has_internet": None,
            "electricity": "",
            "water": "",
            "toilets": "",
            "toilets_other": "",
            "kitchen_position": "",
            "num_living_rooms": 0,
            "num_floors": 0,
            "wall_materials": "",
            "wall_materials_other": "",
            "has_glass_windows": None,
            "roof_materials": "",
            "roof_materials_other": "",
            "vehicles_bicycles": 0,
            "vehicles_motorcycles": 0,
            "vehicles_cars": 0,
            "vehicles_trucks": 0,
            "commerce": {
                "name": "Test Shop",
                "owner": "Alice",
                "phone": "+237600000000",
                "products": "Boissons, Épicerie",
                "hours_weekdays": "08:00-18:00",
                "hours_saturday": "08:00-14:00",
                "hours_sunday": "closed",
            },
            "persons": [],
        }
        r = client.post(f"{API}/surveys", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["survey_type"] == "commerce"
        assert d["is_commerce"] is True
        assert d["income_level"] == ""
        assert d["electricity"] == ""
        assert d["has_internet"] is None

    def test_02_commerce_address_public_via_commerces(self, client):
        r = client.get(f"{API}/commerces", timeout=15)
        assert r.status_code == 200
        found = next((i for i in r.json() if i["address_id"] == COM_ADDR_ID), None)
        assert found is not None
        assert found["is_commerce"] is True


# ============ PHOTOS + CSV COLUMNS ============
class TestPhotosAndCsv:
    def test_01_create_address_with_photos_list(self, client):
        payload = {
            "address_id": PHOTO_ADDR_ID,
            "district": "Test",
            "sector": "X",
            "street_id": "001",
            "house_number": "P1",
            "latitude": 5.3223,
            "longitude": 10.2272,
            "accuracy_meters": 4.0,
            "owner_id": OWNER_A,
            "photos": [
                {
                    "base64": "data:image/jpeg;base64,AAAA",
                    "lat": 5.3223,
                    "lng": 10.2272,
                    "bearing": 137.5,
                    "taken_at": "2026-01-15T10:00:00Z",
                },
                {
                    "base64": "data:image/jpeg;base64,BBBB",
                    "lat": 5.3224,
                    "lng": 10.2273,
                    "bearing": 45.0,
                    "taken_at": "2026-01-15T10:01:00Z",
                },
            ],
        }
        r = client.post(f"{API}/addresses", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d.get("photos"), list)
        assert len(d["photos"]) == 2
        assert d["photos"][0]["bearing"] == 137.5

    def test_02_get_address_returns_photos(self, client):
        r = client.get(f"{API}/addresses/{PHOTO_ADDR_ID}",
                       params={"owner_id": OWNER_A}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert len(d["photos"]) == 2

    def test_03_csv_has_new_columns_and_data(self, client):
        r = client.get(f"{API}/export/csv", timeout=25)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        body = r.text
        header = body.splitlines()[0]
        for col in ("survey_type", "photos_count", "public_name", "public_category"):
            assert col in header, f"Missing CSV column: {col}"
        # our PUB address should have public_name+public_category populated
        pub_line = next((l for l in body.splitlines() if PUB_ADDR_ID in l), None)
        assert pub_line is not None
        assert "Ecole Publique de Fotouni" in pub_line
        assert "school" in pub_line
        assert ",public," in pub_line  # survey_type value
        # PHOTO address should have photos_count = 2
        photo_line = next((l for l in body.splitlines() if PHOTO_ADDR_ID in l), None)
        assert photo_line is not None
        assert ",2," in photo_line  # photos_count column value


# ============ SANITY: existing endpoints still work ============
def test_health_still_ok(client):
    r = client.get(f"{API}/health", timeout=15)
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
