"""
EFYL AddressBook v2.0.0 backend tests
Covers new v2 features: low_accuracy + extra address fields, household surveys,
commerce, persons, CSV/JSON export, OTP rate limit, OTP code consumption,
has_survey propagation, delete cascade.
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

TEST_ADDRESS_ID = "TEST-X001-X001"
# unique per run so the OTP rate-limit window doesn't leak between runs
_RUN_ID = str(int(time.time()))[-6:]
TEST_PHONE_RATE = f"+2376000{_RUN_ID}"
TEST_PHONE_CONSUME = f"+2376001{_RUN_ID}"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module", autouse=True)
def _clean(client):
    # pre cleanup
    try:
        client.delete(f"{API}/addresses/{TEST_ADDRESS_ID}", timeout=10)
    except Exception:
        pass
    yield
    try:
        client.delete(f"{API}/addresses/{TEST_ADDRESS_ID}", timeout=10)
    except Exception:
        pass


# ============ HEALTH ============
def test_health_v2_twilio_flag(client):
    r = client.get(f"{API}/health", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") == "ok"
    # Twilio is not configured in this env → expect False
    assert data.get("twilio_enabled") is False


# ============ ADDRESS v2 (extra fields) ============
class TestAddressV2:
    def test_01_create_address_with_v2_fields(self, client):
        payload = {
            "address_id": TEST_ADDRESS_ID,
            "district": "Test",
            "sector": "X",
            "street_id": "001",
            "house_number": "001",
            "latitude": 4.0951,
            "longitude": 9.7679,
            "accuracy_meters": 5.5,
            "low_accuracy": True,
            "azimuth_degrees": 47.3,
            "lat_raw": 4.0951,
            "lng_raw": 9.7679,
            "lat_corrected": 4.09515,
            "lng_corrected": 9.76795,
        }
        r = client.post(f"{API}/addresses", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["low_accuracy"] is True
        assert d["azimuth_degrees"] == 47.3
        assert d["lat_corrected"] == 4.09515
        assert d["lng_corrected"] == 9.76795
        assert d["has_survey"] is False
        assert "_id" not in d

    def test_02_list_shows_low_accuracy(self, client):
        r = client.get(f"{API}/addresses", params={"owner_id": "guest"}, timeout=15)
        assert r.status_code == 200
        items = r.json()
        match = next((i for i in items if i["address_id"] == TEST_ADDRESS_ID), None)
        assert match is not None
        assert match["low_accuracy"] is True
        assert match["azimuth_degrees"] == 47.3

    def test_03_get_address_has_v2_fields(self, client):
        r = client.get(f"{API}/addresses/{TEST_ADDRESS_ID}", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["low_accuracy"] is True
        assert d["azimuth_degrees"] == 47.3


# ============ SURVEY ============
class TestSurvey:
    survey_payload = {
        "address_id": TEST_ADDRESS_ID,
        "owner_id": "guest",
        "total_persons": 4,
        "main_income_source": "Commerce",
        "income_level": "medium",
        "num_phones": 3,
        "has_internet": True,
        "electricity": "stable",
        "water": "unstable",
        "toilets": "flush",
        "toilets_other": "",
        "kitchen_position": "separate",
        "num_living_rooms": 3,
        "num_floors": 2,
        "wall_materials": "concrete",
        "wall_materials_other": "",
        "has_glass_windows": True,
        "roof_materials": "metal",
        "roof_materials_other": "",
        "vehicles_bicycles": 1,
        "vehicles_motorcycles": 2,
        "vehicles_cars": 1,
        "vehicles_trucks": 0,
        "is_commerce": True,
        "commerce": {
            "name": "Test Shop",
            "owner": "Test Owner",
            "phone": "+237600000000",
            "products": "Food",
            "hours_weekdays": "8-20",
            "hours_saturday": "8-22",
            "hours_sunday": "closed",
        },
        "persons": [{
            "name": "Person 1", "age": 35, "gender": "male",
            "education": "university", "profession": "Manager",
            "frequented_place": "Office",
        }],
    }

    def test_01_create_survey(self, client):
        r = client.post(f"{API}/surveys", json=self.survey_payload, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["address_id"] == TEST_ADDRESS_ID
        assert d["total_persons"] == 4
        assert d["commerce"]["name"] == "Test Shop"
        assert len(d["persons"]) == 1
        assert d["persons"][0]["profession"] == "Manager"

    def test_02_get_survey(self, client):
        r = client.get(f"{API}/surveys/{TEST_ADDRESS_ID}", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["address_id"] == TEST_ADDRESS_ID
        assert d["commerce"]["phone"] == "+237600000000"
        assert d["persons"][0]["name"] == "Person 1"

    def test_03_address_has_survey_flag(self, client):
        r = client.get(f"{API}/addresses/{TEST_ADDRESS_ID}", timeout=15)
        assert r.status_code == 200
        assert r.json()["has_survey"] is True


# ============ EXPORTS ============
class TestExport:
    def test_csv_export(self, client):
        r = client.get(f"{API}/export/csv", timeout=20)
        assert r.status_code == 200, r.text
        ctype = r.headers.get("content-type", "")
        assert "text/csv" in ctype, ctype
        body = r.text
        first_line = body.splitlines()[0]
        for col in ("address_id", "low_accuracy", "azimuth_degrees",
                    "survey_total_persons", "commerce_name", "persons_summary"):
            assert col in first_line, f"Missing column '{col}' in CSV header"
        # our test address should be in there
        assert TEST_ADDRESS_ID in body

    def test_json_export(self, client):
        r = client.get(f"{API}/export/json", timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "exported_at" in d
        assert "count" in d
        assert isinstance(d["items"], list)
        match = next((i for i in d["items"] if i["address_id"] == TEST_ADDRESS_ID), None)
        assert match is not None
        assert "survey" in match
        assert match["survey"]["total_persons"] == 4
        assert match["survey"]["commerce"]["name"] == "Test Shop"


# ============ OTP RATE LIMIT + CONSUMPTION ============
class TestOTPv2:
    def test_otp_rate_limit_429(self, client):
        # 3 within window allowed → 4th returns 429
        # Use a unique phone to avoid clobbering other tests
        for i in range(3):
            r = client.post(f"{API}/auth/otp/request",
                            json={"phone": TEST_PHONE_RATE}, timeout=15)
            assert r.status_code == 200, f"req {i}: {r.text}"
            assert r.json()["demo_code"] == "123456"
        r4 = client.post(f"{API}/auth/otp/request",
                         json={"phone": TEST_PHONE_RATE}, timeout=15)
        assert r4.status_code == 429, r4.text

    def test_otp_code_consumed_on_success(self, client):
        # Request once then verify, then re-verify (should 401 because code consumed)
        r1 = client.post(f"{API}/auth/otp/request",
                         json={"phone": TEST_PHONE_CONSUME}, timeout=15)
        assert r1.status_code == 200, r1.text
        assert r1.json().get("method") == "mock"
        assert r1.json().get("demo_code") == "123456"

        r2 = client.post(f"{API}/auth/otp/verify",
                         json={"phone": TEST_PHONE_CONSUME, "code": "123456"},
                         timeout=15)
        assert r2.status_code == 200, r2.text
        assert r2.json()["verified"] is True

        # second verify with same code → should now be 401 (consumed)
        r3 = client.post(f"{API}/auth/otp/verify",
                         json={"phone": TEST_PHONE_CONSUME, "code": "123456"},
                         timeout=15)
        assert r3.status_code == 401, r3.text


# ============ SYNC + VERIFY (still works) ============
def test_sync_still_works(client):
    payload = [{
        "address_id": "TEST-SYNC-V2-001",
        "district": "Test", "sector": "X", "street_id": "099",
        "house_number": "099", "latitude": 4.10, "longitude": 9.78,
        "accuracy_meters": 1.0,
    }]
    r = client.post(f"{API}/sync", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json()["synced"] == 1
    client.delete(f"{API}/addresses/TEST-SYNC-V2-001", timeout=10)


def test_verify_still_works(client):
    r = client.post(f"{API}/verify", json={
        "address_id": TEST_ADDRESS_ID,
        "submitted_lat": 4.0951, "submitted_lng": 9.7679,
        "submitted_accuracy": 1.0,
    }, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["distance_m"] < 5.0
    assert d["verified"] is True


# ============ DELETE CASCADE (survey removed too) ============
def test_zz_delete_address_removes_survey(client):
    r = client.delete(f"{API}/addresses/{TEST_ADDRESS_ID}", timeout=15)
    assert r.status_code == 200
    # address gone
    r2 = client.get(f"{API}/addresses/{TEST_ADDRESS_ID}", timeout=15)
    assert r2.status_code == 404
    # survey gone too
    r3 = client.get(f"{API}/surveys/{TEST_ADDRESS_ID}", timeout=15)
    assert r3.status_code == 404
