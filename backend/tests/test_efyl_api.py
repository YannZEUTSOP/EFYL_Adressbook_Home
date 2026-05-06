"""
EFYL Address Book backend tests
Covers: health, addresses CRUD, sync, verify, OTP auth, nearby
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL",
                          "https://efyl-address-book.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

TEST_ADDRESS_ID = "TEST-A001-X001"
TEST_PHONE = "+237600000001"


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# Cleanup pre-existing test data
@pytest.fixture(scope="session", autouse=True)
def _pre_clean(client):
    try:
        client.delete(f"{API}/addresses/{TEST_ADDRESS_ID}", timeout=10)
    except Exception:
        pass
    yield
    # final cleanup
    try:
        client.delete(f"{API}/addresses/{TEST_ADDRESS_ID}", timeout=10)
    except Exception:
        pass


# ============ HEALTH ============
def test_health(client):
    r = client.get(f"{API}/health", timeout=15)
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# ============ ADDRESSES CRUD ============
class TestAddresses:
    def test_01_create_address(self, client):
        payload = {
            "address_id": TEST_ADDRESS_ID,
            "district": "Bonamoussadi",
            "sector": "A",
            "street_id": "001",
            "house_number": "001",
            "latitude": 4.0951,
            "longitude": 9.7679,
            "accuracy_meters": 0.9,
            "contact_name": "Test User",
        }
        r = client.post(f"{API}/addresses", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["address_id"] == TEST_ADDRESS_ID
        assert data["contact_name"] == "Test User"
        assert data["latitude"] == 4.0951
        assert data["owner_id"] == "guest"
        assert "_id" not in data

    def test_02_list_addresses(self, client):
        r = client.get(f"{API}/addresses", params={"owner_id": "guest"}, timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        ids = [i["address_id"] for i in items]
        assert TEST_ADDRESS_ID in ids

    def test_03_get_address(self, client):
        r = client.get(f"{API}/addresses/{TEST_ADDRESS_ID}", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["address_id"] == TEST_ADDRESS_ID
        assert data["contact_name"] == "Test User"

    def test_04_update_address(self, client):
        r = client.put(f"{API}/addresses/{TEST_ADDRESS_ID}",
                       json={"contact_name": "Updated Name"}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["contact_name"] == "Updated Name"

        # Verify persisted via GET
        r2 = client.get(f"{API}/addresses/{TEST_ADDRESS_ID}", timeout=15)
        assert r2.status_code == 200
        assert r2.json()["contact_name"] == "Updated Name"


# ============ SYNC ============
def test_sync_bulk(client):
    items = [
        {
            "address_id": "TEST-SYNC-001",
            "district": "Bonamoussadi", "sector": "B", "street_id": "010",
            "house_number": "010", "latitude": 4.10, "longitude": 9.78,
            "accuracy_meters": 1.2, "contact_name": "Sync Test",
        },
        {
            "address_id": "TEST-SYNC-002",
            "district": "Bonamoussadi", "sector": "B", "street_id": "011",
            "house_number": "011", "latitude": 4.11, "longitude": 9.79,
            "accuracy_meters": 1.5, "contact_name": "Sync Test 2",
        },
    ]
    r = client.post(f"{API}/sync", json=items, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("synced") == 2
    assert "timestamp" in data
    # cleanup
    for it in items:
        client.delete(f"{API}/addresses/{it['address_id']}", timeout=10)


# ============ VERIFY ============
class TestVerify:
    def test_verify_close_match(self, client):
        # Same coordinates → should be verified
        r = client.post(f"{API}/verify", json={
            "address_id": TEST_ADDRESS_ID,
            "submitted_lat": 4.0951, "submitted_lng": 9.7679,
            "submitted_accuracy": 1.0,
        }, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["verified"] is True
        assert d["flagged"] is False
        assert d["distance_m"] < 5.0

    def test_verify_far_flagged(self, client):
        r = client.post(f"{API}/verify", json={
            "address_id": TEST_ADDRESS_ID,
            "submitted_lat": 4.10, "submitted_lng": 9.78,
            "submitted_accuracy": 1.0,
        }, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["flagged"] is True
        assert d["verified"] is False
        assert d["distance_m"] > 10.0

    def test_verify_unknown_address(self, client):
        r = client.post(f"{API}/verify", json={
            "address_id": "TEST-DOES-NOT-EXIST-9999",
            "submitted_lat": 4.0, "submitted_lng": 9.0,
            "submitted_accuracy": 1.0,
        }, timeout=15)
        assert r.status_code == 404


# ============ NEARBY ============
def test_addresses_nearby(client):
    r = client.get(f"{API}/addresses-nearby",
                   params={"lat": 4.095, "lng": 9.767, "radius_km": 10},
                   timeout=15)
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    if items:
        assert "distance_km" in items[0]
        assert all(i["distance_km"] <= 10 for i in items)


# ============ OTP AUTH ============
class TestOTP:
    def test_otp_request(self, client):
        r = client.post(f"{API}/auth/otp/request",
                        json={"phone": TEST_PHONE}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["sent"] is True
        assert d["demo_code"] == "123456"
        assert d["phone"] == TEST_PHONE

    def test_otp_verify_success(self, client):
        # ensure code is set
        client.post(f"{API}/auth/otp/request", json={"phone": TEST_PHONE}, timeout=15)
        r = client.post(f"{API}/auth/otp/verify",
                        json={"phone": TEST_PHONE, "code": "123456"}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["verified"] is True
        assert d["phone"] == TEST_PHONE
        assert d["user_id"].startswith("user_")

    def test_otp_verify_wrong_code(self, client):
        client.post(f"{API}/auth/otp/request", json={"phone": TEST_PHONE}, timeout=15)
        r = client.post(f"{API}/auth/otp/verify",
                        json={"phone": TEST_PHONE, "code": "000000"}, timeout=15)
        assert r.status_code == 401


# ============ DELETE (last) ============
def test_zz_delete_address(client):
    r = client.delete(f"{API}/addresses/{TEST_ADDRESS_ID}", timeout=15)
    assert r.status_code == 200
    assert r.json().get("deleted") == 1
    # GET should now 404
    r2 = client.get(f"{API}/addresses/{TEST_ADDRESS_ID}", timeout=15)
    assert r2.status_code == 404
