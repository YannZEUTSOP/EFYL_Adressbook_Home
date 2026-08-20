"""
Sprint S4 backend tests
Covers:
  - GET /api/commerces (community map)
  - GET /api/addresses?owner_id with include_public_commerces toggle
  - POST /api/surveys with survey_type=commerce|household propagation to addresses.is_commerce
  - Privacy isolation: household addresses must not leak between owners
  - Direct POST /api/addresses with is_commerce=true must also appear in /api/commerces
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

# Unique per-run IDs to avoid collisions
RUN_ID = str(int(time.time()))[-6:]
USER_A = f"userA_{RUN_ID}"
USER_B = f"userB_{RUN_ID}"

# Addresses created per test scenario
ADDR_A_HOUSE = f"S4-A-HOUSE-{RUN_ID}"     # user A household (private)
ADDR_A_COMM = f"S4-A-COMM-{RUN_ID}"       # user A commerce via survey (public)
ADDR_B_HOUSE = f"S4-B-HOUSE-{RUN_ID}"     # user B household
ADDR_DIRECT = f"S4-DIRECT-COMM-{RUN_ID}"  # direct POST with is_commerce=True


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module", autouse=True)
def _cleanup(client):
    # Pre-clean
    for aid, owner in [
        (ADDR_A_HOUSE, USER_A), (ADDR_A_COMM, USER_A),
        (ADDR_B_HOUSE, USER_B), (ADDR_DIRECT, USER_A),
    ]:
        try:
            client.delete(f"{API}/addresses/{aid}", params={"owner_id": owner}, timeout=10)
        except Exception:
            pass
    yield
    # Final cleanup
    for aid, owner in [
        (ADDR_A_HOUSE, USER_A), (ADDR_A_COMM, USER_A),
        (ADDR_B_HOUSE, USER_B), (ADDR_DIRECT, USER_A),
    ]:
        try:
            client.delete(f"{API}/addresses/{aid}", params={"owner_id": owner}, timeout=10)
        except Exception:
            pass


def _mk_addr(addr_id, owner, is_commerce=False, lat=4.10, lng=9.77):
    return {
        "address_id": addr_id,
        "district": "Bonamoussadi",
        "sector": "S4",
        "street_id": "001",
        "house_number": "1",
        "latitude": lat,
        "longitude": lng,
        "accuracy_meters": 1.0,
        "contact_name": f"TEST_{addr_id}",
        "owner_id": owner,
        "is_commerce": is_commerce,
    }


# ----------------------- Setup: create address fixtures -----------------------
def test_setup_create_user_a_household(client):
    r = client.post(f"{API}/addresses", json=_mk_addr(ADDR_A_HOUSE, USER_A), timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["address_id"] == ADDR_A_HOUSE
    assert d["owner_id"] == USER_A
    assert d["is_commerce"] is False


def test_setup_create_user_a_commerce_via_survey(client):
    # First create address (household by default)
    r = client.post(f"{API}/addresses",
                    json=_mk_addr(ADDR_A_COMM, USER_A, lat=4.11, lng=9.78), timeout=15)
    assert r.status_code == 200, r.text
    assert r.json()["is_commerce"] is False

    # Then submit a commerce survey – must flip is_commerce -> True
    survey_payload = {
        "address_id": ADDR_A_COMM,
        "owner_id": USER_A,
        "survey_type": "commerce",
        "commerce": {
            "name": "TEST_Boutique",
            "owner": "TEST owner",
            "phone": "+237600000001",
            "products": "rice, oil",
            "hours_weekdays": "8-18",
            "hours_saturday": "9-15",
            "hours_sunday": "closed",
        },
    }
    r2 = client.post(f"{API}/surveys", json=survey_payload, timeout=15)
    assert r2.status_code == 200, r2.text
    s = r2.json()
    assert s["survey_type"] == "commerce"
    assert s["is_commerce"] is True

    # Verify is_commerce flipped on the address
    r3 = client.get(f"{API}/addresses/{ADDR_A_COMM}",
                    params={"owner_id": USER_A}, timeout=15)
    assert r3.status_code == 200, r3.text
    assert r3.json()["is_commerce"] is True
    assert r3.json()["has_survey"] is True


def test_setup_create_user_b_household_via_survey(client):
    r = client.post(f"{API}/addresses",
                    json=_mk_addr(ADDR_B_HOUSE, USER_B, lat=4.12, lng=9.79), timeout=15)
    assert r.status_code == 200, r.text

    # Household survey should NOT flip is_commerce
    survey_payload = {
        "address_id": ADDR_B_HOUSE,
        "owner_id": USER_B,
        "survey_type": "household",
        "total_persons": 3,
    }
    r2 = client.post(f"{API}/surveys", json=survey_payload, timeout=15)
    assert r2.status_code == 200, r2.text
    assert r2.json()["is_commerce"] is False

    r3 = client.get(f"{API}/addresses/{ADDR_B_HOUSE}",
                    params={"owner_id": USER_B}, timeout=15)
    assert r3.status_code == 200
    assert r3.json()["is_commerce"] is False
    assert r3.json()["has_survey"] is True


def test_setup_create_direct_commerce(client):
    # Direct POST with is_commerce=true (no survey)
    r = client.post(f"{API}/addresses",
                    json=_mk_addr(ADDR_DIRECT, USER_A, is_commerce=True,
                                  lat=4.13, lng=9.80), timeout=15)
    assert r.status_code == 200, r.text
    assert r.json()["is_commerce"] is True


# ----------------------- /api/commerces endpoint -----------------------
class TestCommercesEndpoint:
    def test_commerces_returns_list(self, client):
        r = client.get(f"{API}/commerces", timeout=15)
        assert r.status_code == 200, r.text
        items = r.json()
        assert isinstance(items, list)
        ids = {i["address_id"] for i in items}
        # Both commerces (survey-driven + direct) must be present
        assert ADDR_A_COMM in ids, f"Commerce via survey not in /commerces: {ids}"
        assert ADDR_DIRECT in ids, f"Direct commerce not in /commerces: {ids}"

    def test_commerces_excludes_households(self, client):
        r = client.get(f"{API}/commerces", timeout=15)
        assert r.status_code == 200
        ids = {i["address_id"] for i in r.json()}
        assert ADDR_A_HOUSE not in ids, "Household leaked into /commerces"
        assert ADDR_B_HOUSE not in ids, "Household leaked into /commerces"

    def test_commerces_all_have_is_commerce_or_public_true(self, client):
        # v3: /commerces now also returns public buildings (is_public=True)
        r = client.get(f"{API}/commerces", timeout=15)
        assert r.status_code == 200
        for item in r.json():
            assert item.get("is_commerce") is True or item.get("is_public") is True or item.get("is_heritage") is True, item


# ----------------------- /api/addresses include_public_commerces -----------------------
class TestAddressesPublicCommercesToggle:
    def test_user_b_sees_user_a_commerce_by_default(self, client):
        """include_public_commerces defaults to True → user B sees A's commerces."""
        r = client.get(f"{API}/addresses",
                       params={"owner_id": USER_B}, timeout=15)
        assert r.status_code == 200, r.text
        ids = {i["address_id"] for i in r.json()}
        assert ADDR_A_COMM in ids, "User B should see user A's commerce"
        assert ADDR_DIRECT in ids, "User B should see direct commerce"
        # And user B's own household
        assert ADDR_B_HOUSE in ids

    def test_user_b_does_not_see_user_a_household(self, client):
        """Privacy: household addresses must NOT leak across owners."""
        r = client.get(f"{API}/addresses",
                       params={"owner_id": USER_B}, timeout=15)
        assert r.status_code == 200
        ids = {i["address_id"] for i in r.json()}
        assert ADDR_A_HOUSE not in ids, \
            "PRIVACY BREACH: user A's household visible to user B"

    def test_include_public_commerces_false_isolates_user(self, client):
        """include_public_commerces=false → only user's own addresses."""
        r = client.get(f"{API}/addresses",
                       params={"owner_id": USER_B,
                               "include_public_commerces": "false"}, timeout=15)
        assert r.status_code == 200, r.text
        ids = {i["address_id"] for i in r.json()}
        assert ADDR_B_HOUSE in ids
        assert ADDR_A_COMM not in ids, "Public commerce leaked when toggle=false"
        assert ADDR_DIRECT not in ids, "Public commerce leaked when toggle=false"
        assert ADDR_A_HOUSE not in ids

    def test_user_a_sees_own_addresses_without_duplicates(self, client):
        """User A is owner of ADDR_A_COMM; it should appear once, not twice."""
        r = client.get(f"{API}/addresses",
                       params={"owner_id": USER_A}, timeout=15)
        assert r.status_code == 200
        items = r.json()
        comm_count = sum(1 for i in items if i["address_id"] == ADDR_A_COMM)
        assert comm_count == 1, f"Duplicate of own commerce in list: {comm_count}"
        direct_count = sum(1 for i in items if i["address_id"] == ADDR_DIRECT)
        assert direct_count == 1, f"Duplicate of direct commerce: {direct_count}"

    def test_guest_default_no_crash_on_empty(self, client):
        """GET /api/addresses with no owner_id must not crash even if empty."""
        # Use a fresh unique owner that has no records
        r = client.get(f"{API}/addresses",
                       params={"owner_id": f"empty_{RUN_ID}",
                               "include_public_commerces": "false"}, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ----------------------- Regression checks -----------------------
class TestRegression:
    def test_health_twilio_disabled(self, client):
        r = client.get(f"{API}/health", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "ok"
        assert body["twilio_enabled"] is False

    def test_otp_mock_flow(self, client):
        phone = f"+2376222{RUN_ID}"
        r1 = client.post(f"{API}/auth/otp/request",
                         json={"phone": phone}, timeout=15)
        assert r1.status_code == 200, r1.text
        assert r1.json()["sent"] is True
        assert r1.json()["demo_code"] == "123456"
        r2 = client.post(f"{API}/auth/otp/verify",
                         json={"phone": phone, "code": "123456"}, timeout=15)
        assert r2.status_code == 200, r2.text
        assert r2.json()["verified"] is True

    def test_otp_rate_limit_3_per_10min(self, client):
        phone = f"+2376333{RUN_ID}"
        statuses = []
        for _ in range(4):
            r = client.post(f"{API}/auth/otp/request",
                            json={"phone": phone}, timeout=15)
            statuses.append(r.status_code)
        # First 3 should be 200, 4th must be 429
        assert statuses[:3] == [200, 200, 200], statuses
        assert statuses[3] == 429, statuses

    def test_verify_haversine_close(self, client):
        # Verify against the survey-flipped commerce address
        r = client.post(f"{API}/verify", json={
            "address_id": ADDR_A_COMM,
            "submitted_lat": 4.11, "submitted_lng": 9.78,
            "submitted_accuracy": 1.0,
        }, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["distance_m"] < 5.0
        assert d["verified"] is True

    def test_sync_bulk_regression(self, client):
        sync_id = f"S4-SYNC-{RUN_ID}"
        items = [_mk_addr(sync_id, USER_A, lat=4.20, lng=9.85)]
        r = client.post(f"{API}/sync", json=items, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["synced"] == 1
        # cleanup
        client.delete(f"{API}/addresses/{sync_id}",
                      params={"owner_id": USER_A}, timeout=10)

    def test_export_csv(self, client):
        r = client.get(f"{API}/export/csv", timeout=20)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        # Header row must include survey_is_commerce
        first_line = r.text.split("\n", 1)[0]
        assert "survey_is_commerce" in first_line

    def test_export_json(self, client):
        r = client.get(f"{API}/export/json", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert "items" in data
        assert "count" in data
        assert isinstance(data["items"], list)
