"""
EFYL AddressBook v5 — Account system (phone + PIN + JWT) + /restore tests.
Backend features under test:
 - POST /api/auth/register (OTP-gated, 4-digit PIN, bcrypt hash, JWT return)
 - POST /api/auth/login (phone OR EFYL-XXXXXX id, wrong PIN → 401, lockout at 5)
 - GET  /api/restore (Bearer JWT → user + addresses(with photos) + surveys)
 - POST /api/sync bulk + photos_count regression
 - Regression: /addresses, /surveys, /admin/overview?pin=237237
"""
import os
import time
import random
import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://efyl-address-book.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

# Existing seeded account per problem statement (do NOT delete)
EXISTING_PHONE = "+237699000111"
EXISTING_PIN = "1234"
EXISTING_EFYL = "EFYL-90AF88"
EXISTING_ADDR_ID = "FOT-A-001-777"

# Fresh phone numbers for register tests — rate limit is 3/10min per phone
_RUN = str(int(time.time()))[-8:]
_R = random.randint(1000, 9999)
FRESH_PHONE_1 = f"+2376{_RUN[:8]}"           # unique
FRESH_PHONE_2 = f"+237690{_R}{_RUN[-4:]}"    # unique
FRESH_PHONE_3 = f"+237691{_R}{_RUN[-4:]}"    # unique
FRESH_PHONE_LOCK = f"+237692{_R}{_RUN[-4:]}" # for lockout test


@pytest.fixture(scope="module")
def s():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


def _otp_request(s, phone):
    r = s.post(f"{API}/auth/otp/request", json={"phone": phone}, timeout=15)
    return r


def _register(s, phone, name, pin, code="123456"):
    _otp_request(s, phone)
    return s.post(
        f"{API}/auth/register",
        json={"phone": phone, "name": name, "pin": pin, "code": code},
        timeout=15,
    )


# ================= Health =================
def test_00_health(s):
    r = s.get(f"{API}/health", timeout=10)
    assert r.status_code == 200
    j = r.json()
    assert j["status"] == "ok"
    assert j.get("twilio_enabled") is False, "Twilio must be MOCKED for this test run"


# ================= REGISTER =================
class TestRegister:
    def test_01_register_happy_path(self, s):
        r = _register(s, FRESH_PHONE_1, "New User 1", "4321")
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("user_id", "efyl_id", "name", "phone", "token"):
            assert k in d
        assert d["name"] == "New User 1"
        assert d["efyl_id"].startswith("EFYL-")
        assert len(d["efyl_id"]) == 11  # EFYL- + 6 hex
        assert d["token"].count(".") == 2, "token must be JWT (3 parts)"
        # persist for later tests
        pytest.new_user = d  # type: ignore[attr-defined]

    def test_02_invalid_pin_format(self, s):
        # OTP first to isolate the PIN validation
        _otp_request(s, FRESH_PHONE_2)
        r = s.post(f"{API}/auth/register", json={
            "phone": FRESH_PHONE_2, "name": "X", "pin": "12", "code": "123456"
        }, timeout=15)
        assert r.status_code == 400, r.text

    def test_03_duplicate_account(self, s):
        # try to re-register FRESH_PHONE_1 which is now taken
        _otp_request(s, FRESH_PHONE_1)
        r = s.post(f"{API}/auth/register", json={
            "phone": FRESH_PHONE_1, "name": "Dup", "pin": "9999", "code": "123456"
        }, timeout=15)
        assert r.status_code == 409, r.text

    def test_04_bad_otp(self, s):
        _otp_request(s, FRESH_PHONE_3)
        r = s.post(f"{API}/auth/register", json={
            "phone": FRESH_PHONE_3, "name": "Y", "pin": "1111", "code": "000000"
        }, timeout=15)
        assert r.status_code == 401, r.text


# ================= LOGIN =================
class TestLogin:
    def test_01_login_with_phone_existing(self, s):
        r = s.post(f"{API}/auth/login",
                   json={"identifier": EXISTING_PHONE, "pin": EXISTING_PIN}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["efyl_id"] == EXISTING_EFYL
        assert d["name"] == "Testeur Fotouni"
        assert d["phone"] == EXISTING_PHONE
        assert d["token"]
        pytest.existing_token = d["token"]  # type: ignore[attr-defined]

    def test_02_login_with_phone_spaces_tolerated(self, s):
        formatted = "+237 6 99 00 01 11"
        r = s.post(f"{API}/auth/login",
                   json={"identifier": formatted, "pin": EXISTING_PIN}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["efyl_id"] == EXISTING_EFYL

    def test_03_login_with_efyl_id(self, s):
        r = s.post(f"{API}/auth/login",
                   json={"identifier": EXISTING_EFYL, "pin": EXISTING_PIN}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["efyl_id"] == EXISTING_EFYL

    def test_04_login_with_efyl_id_lowercase(self, s):
        r = s.post(f"{API}/auth/login",
                   json={"identifier": EXISTING_EFYL.lower(), "pin": EXISTING_PIN}, timeout=15)
        assert r.status_code == 200, r.text

    def test_05_wrong_pin_returns_401_generic(self, s):
        # Use the freshly registered user to avoid affecting the seeded account
        u = getattr(pytest, "new_user", None)
        assert u
        r = s.post(f"{API}/auth/login",
                   json={"identifier": u["phone"], "pin": "0000"}, timeout=15)
        assert r.status_code == 401, r.text
        # no enumeration signal
        detail = r.json().get("detail", "").lower()
        assert "credentials" in detail or "invalid" in detail

    def test_06_unknown_identifier_returns_401(self, s):
        r = s.post(f"{API}/auth/login",
                   json={"identifier": "+2370000000000", "pin": "1234"}, timeout=15)
        assert r.status_code == 401, r.text

    def test_07_lockout_after_5_wrong_pins(self, s):
        # Register a throwaway account then hammer it with wrong PIN
        r = _register(s, FRESH_PHONE_LOCK, "LockMe", "1357")
        assert r.status_code == 200, r.text
        for i in range(5):
            r = s.post(f"{API}/auth/login",
                       json={"identifier": FRESH_PHONE_LOCK, "pin": "0000"}, timeout=15)
            assert r.status_code == 401, f"attempt {i}: {r.text}"
        # 6th attempt (even with correct PIN) should be locked
        r = s.post(f"{API}/auth/login",
                   json={"identifier": FRESH_PHONE_LOCK, "pin": "1357"}, timeout=15)
        assert r.status_code == 429, f"expected 429 lockout, got {r.status_code} {r.text}"


# ================= RESTORE =================
class TestRestore:
    def test_01_restore_requires_token(self, s):
        r = s.get(f"{API}/restore", timeout=15)
        assert r.status_code == 401, r.text

    def test_02_restore_invalid_token(self, s):
        r = s.get(f"{API}/restore",
                  headers={"Authorization": "Bearer not-a-jwt"}, timeout=15)
        assert r.status_code == 401, r.text

    def test_03_restore_existing_account_returns_data(self, s):
        token = getattr(pytest, "existing_token", None)
        assert token, "Login test must run first"
        r = s.get(f"{API}/restore",
                  headers={"Authorization": f"Bearer {token}"}, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "user" in d and "addresses" in d and "surveys" in d
        assert d["user"]["efyl_id"] == EXISTING_EFYL
        # pin_hash must NOT be exposed
        assert "pin_hash" not in d["user"]
        # Existing seed address must be there
        addr_ids = [a.get("address_id") for a in d["addresses"]]
        assert EXISTING_ADDR_ID in addr_ids, f"Missing seed address {EXISTING_ADDR_ID} in {addr_ids}"
        # And the photos array must be present in the payload (WITH photos, per spec)
        seed = next(a for a in d["addresses"] if a["address_id"] == EXISTING_ADDR_ID)
        assert isinstance(seed.get("photos"), list), "photos must be array"
        assert len(seed["photos"]) >= 1, "seed should have >=1 photo"


# ================= SYNC + photos_count regression =================
class TestSyncRegression:
    ADDR_ID = f"TEST-SYNC-{_RUN}"
    OWNER = f"tester_sync_{_RUN}"

    def test_01_sync_bulk_with_photos(self, s):
        payload = [{
            "address_id": self.ADDR_ID,
            "district": "Test", "sector": "A", "street_id": "001",
            "house_number": "1",
            "latitude": 5.1, "longitude": 10.1,
            "accuracy_meters": 3.0,
            "owner_id": self.OWNER,
            "photos": [{"base64": "AAAA", "lat": 5.1, "lng": 10.1,
                        "bearing": 0, "taken_at": "2026-01-01"}],
            "photos_count": 1,
        }]
        r = s.post(f"{API}/sync", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["synced"] == 1

    def test_02_get_address_shows_photos_count(self, s):
        r = s.get(f"{API}/addresses/{self.ADDR_ID}",
                  params={"owner_id": self.OWNER}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["photos_count"] == 1
        assert d["photos"] and len(d["photos"]) == 1

    def test_99_cleanup(self, s):
        s.delete(f"{API}/addresses/{self.ADDR_ID}",
                 params={"owner_id": self.OWNER}, timeout=10)


# ================= REGRESSION: CRUD + admin =================
class TestRegression:
    ADDR_ID = f"TEST-REG-{_RUN}"
    OWNER = f"tester_reg_{_RUN}"

    def test_01_create_address(self, s):
        r = s.post(f"{API}/addresses", json={
            "address_id": self.ADDR_ID,
            "district": "R", "sector": "A", "street_id": "001",
            "house_number": "1",
            "latitude": 5.0, "longitude": 10.0,
            "accuracy_meters": 3.0,
            "owner_id": self.OWNER,
        }, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["address_id"] == self.ADDR_ID

    def test_02_list_addresses(self, s):
        r = s.get(f"{API}/addresses", params={"owner_id": self.OWNER}, timeout=15)
        assert r.status_code == 200
        assert any(a["address_id"] == self.ADDR_ID for a in r.json())

    def test_03_admin_overview(self, s):
        r = s.get(f"{API}/admin/overview", params={"pin": "237237"}, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["total_addresses"] >= 1
        assert set(d["by_type"].keys()) >= {"household", "commerce", "public", "heritage"}

    def test_04_surveys_get_missing_returns_404(self, s):
        r = s.get(f"{API}/surveys/does-not-exist-xyz",
                  params={"owner_id": "guest"}, timeout=15)
        assert r.status_code == 404

    def test_99_cleanup(self, s):
        s.delete(f"{API}/addresses/{self.ADDR_ID}",
                 params={"owner_id": self.OWNER}, timeout=10)
