"""
EFYL AddressBook v4 (Message-241 batch) — new backend feature tests:
- Admin dashboard endpoint (GET /api/admin/overview) with PIN gate
- Heritage survey (survey_type='heritage') propagation to is_heritage on address,
  visibility on /commerces and cross-user in /addresses
- Public survey remote-fetch path used by the "blank community detail" bugfix:
  GET /api/addresses/{id} (no owner filter) must return an address owned by
  someone else if it is public.
- CSV regression (heritage columns present)
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
HER_ADDR_ID = f"TEST-HER-{_RUN}"
REMOTE_PUB_ADDR_ID = f"TEST-REMOTE-PUB-{_RUN}"
OWNER_A = f"tester_a_{_RUN}"
OWNER_B = f"tester_b_{_RUN}"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module", autouse=True)
def _cleanup(client):
    for aid, owner in [(HER_ADDR_ID, OWNER_A), (REMOTE_PUB_ADDR_ID, OWNER_A)]:
        try:
            client.delete(f"{API}/addresses/{aid}", params={"owner_id": owner}, timeout=10)
        except Exception:
            pass
    yield
    for aid, owner in [(HER_ADDR_ID, OWNER_A), (REMOTE_PUB_ADDR_ID, OWNER_A)]:
        try:
            client.delete(f"{API}/addresses/{aid}", params={"owner_id": owner}, timeout=10)
        except Exception:
            pass


def _mk_address(client, address_id, owner_id):
    payload = {
        "address_id": address_id,
        "district": "Fotouni",
        "sector": "A",
        "street_id": "001",
        "house_number": "010",
        "latitude": 5.3223,
        "longitude": 10.2272,
        "accuracy_meters": 3.0,
        "owner_id": owner_id,
        "owner_name": "Field Tester Alice",
    }
    r = client.post(f"{API}/addresses", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


# ============ ADMIN DASHBOARD ============
class TestAdminDashboard:
    def test_01_admin_overview_wrong_pin_denied(self, client):
        r = client.get(f"{API}/admin/overview", params={"pin": "000000"}, timeout=10)
        assert r.status_code in (401, 403), r.text

    def test_02_admin_overview_missing_pin_denied(self, client):
        r = client.get(f"{API}/admin/overview", timeout=10)
        # FastAPI returns 422 (missing query) or 403 depending on impl
        assert r.status_code in (401, 403, 422)

    def test_03_admin_overview_correct_pin_returns_stats(self, client):
        r = client.get(f"{API}/admin/overview", params={"pin": "237237"}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        # required keys
        for k in ("total_addresses", "by_type", "surveys_count", "persons_count",
                  "today_count", "week_count", "active_users_24h", "users",
                  "generated_at"):
            assert k in d, f"Missing key {k}"
        # by_type has 4 categories now (heritage added)
        for cat in ("household", "commerce", "public", "heritage"):
            assert cat in d["by_type"], f"Missing category {cat}"
        assert isinstance(d["users"], list)
        assert isinstance(d["total_addresses"], int)

    def test_04_admin_addresses_pin_gate(self, client):
        r = client.get(f"{API}/admin/addresses", params={"pin": "wrong"}, timeout=10)
        assert r.status_code in (401, 403)
        r = client.get(f"{API}/admin/addresses", params={"pin": "237237"}, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ============ HERITAGE SURVEY FLOW ============
class TestHeritageSurveyFlow:
    def test_01_create_heritage_survey_marks_address(self, client):
        _mk_address(client, HER_ADDR_ID, OWNER_A)
        survey = {
            "address_id": HER_ADDR_ID,
            "owner_id": OWNER_A,
            "survey_type": "heritage",
            "heritage": {
                "name": "Chefferie Fotouni",
                "kind": "both",
                "category": "chiefdom",
                "category_other": "",
                "description": "Historic chieftaincy",
                "manager": "Chef Traditionnel",
                "access": "paid",
                "entry_fee": "1000 FCFA",
                "hours": "08:00-17:00",
                "best_period": "dry season",
                "photos_allowed": True,
                "restrictions": "no shoes inside",
                "facilities": "parking; toilets",
                "road_access": "average",
                "phone": "+237690000000",
                "notes": "",
            },
            "persons": [],
        }
        r = client.post(f"{API}/surveys", json=survey, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["survey_type"] == "heritage"
        assert d["is_heritage"] is True
        assert d["is_public"] is False
        assert d["is_commerce"] is False
        assert d["heritage"]["name"] == "Chefferie Fotouni"
        assert d["heritage"]["access"] == "paid"
        assert d["heritage"]["entry_fee"] == "1000 FCFA"
        assert d["heritage"]["photos_allowed"] is True

    def test_02_address_now_is_heritage(self, client):
        r = client.get(f"{API}/addresses/{HER_ADDR_ID}",
                       params={"owner_id": OWNER_A}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["is_heritage"] is True
        assert d["has_survey"] is True

    def test_03_commerces_endpoint_includes_heritage(self, client):
        r = client.get(f"{API}/commerces", timeout=15)
        assert r.status_code == 200
        found = next((i for i in r.json() if i["address_id"] == HER_ADDR_ID), None)
        assert found is not None, "Heritage site missing from /commerces"
        assert found["is_heritage"] is True

    def test_04_other_users_see_heritage_via_addresses(self, client):
        r = client.get(f"{API}/addresses", params={"owner_id": OWNER_B}, timeout=15)
        assert r.status_code == 200
        found = next((i for i in r.json() if i["address_id"] == HER_ADDR_ID), None)
        assert found is not None
        assert found["is_heritage"] is True


# ============ BLANK-SCREEN BUGFIX: remote public detail fetch ============
class TestRemotePublicAddressFetch:
    """Reproduces the field-tester flow of iteration 7:
    tester A creates a PUBLIC address. Guest (a different owner_id) opens the
    detail page → the app calls GET /api/addresses/{id} (no owner) and must
    receive that address, otherwise the page renders 'not found' / blank.
    """

    def test_01_create_and_public_survey(self, client):
        _mk_address(client, REMOTE_PUB_ADDR_ID, OWNER_A)
        survey = {
            "address_id": REMOTE_PUB_ADDR_ID,
            "owner_id": OWNER_A,
            "survey_type": "public",
            "public_service": {
                "name": "Ecole Fotouni TEST-PUB",
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
        assert r.json()["is_public"] is True

    def test_02_get_address_without_owner_fallback(self, client):
        """Frontend calls Api.getAddress(id) → GET /api/addresses/{id}
        WITHOUT owner_id when the address is not local; endpoint must fallback
        to any owner (the code path `doc = ... .find_one({address_id: id})`)."""
        # No owner_id at all
        r = client.get(f"{API}/addresses/{REMOTE_PUB_ADDR_ID}", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["address_id"] == REMOTE_PUB_ADDR_ID
        assert d["is_public"] is True

    def test_03_get_address_with_wrong_owner_still_returns(self, client):
        r = client.get(
            f"{API}/addresses/{REMOTE_PUB_ADDR_ID}",
            params={"owner_id": OWNER_B},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json()["address_id"] == REMOTE_PUB_ADDR_ID


# ============ CSV HERITAGE COLUMNS ============
class TestCsvHeritageColumns:
    def test_01_admin_csv_has_heritage_columns(self, client):
        r = client.get(f"{API}/admin/export/csv", params={"pin": "237237"}, timeout=25)
        assert r.status_code == 200
        header = r.text.splitlines()[0]
        for col in ("heritage_name", "heritage_kind", "heritage_category",
                    "heritage_access", "heritage_entry_fee", "heritage_photos_allowed",
                    "heritage_road_access", "persons_places"):
            assert col in header, f"Missing CSV column: {col}"
        # Our heritage row should be present
        her_line = next((l for l in r.text.splitlines() if HER_ADDR_ID in l), None)
        assert her_line is not None
        assert "Chefferie Fotouni" in her_line
        assert "chiefdom" in her_line


# ============ SANITY ============
def test_health(client):
    r = client.get(f"{API}/health", timeout=15)
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
