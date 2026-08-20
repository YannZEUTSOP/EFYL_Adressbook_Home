"""
EFYL AddressBook v6 — Iteration 9 batch tests
Features under test:
 - GET /api/admin/address/{address_id}?pin=237237 → {address, survey}
     * wrong pin → 403, unknown id → 404
     * FOT-A-001-777 → address returned, survey null
     * newly-seeded surveyed household → survey with persons+places included
 - POST /api/surveys accepts:
     * commerce.workers (int)
     * public_service.workers/capacity_max/usage_current/hours
     * person.no_places = True
 - GET /api/admin/export/csv?pin=237237 → new CSV columns present,
   quality_issues flags no_survey / persons_count_mismatch /
   missing_persons_places / missing_azimuth
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
PIN = "237237"

_RUN = str(int(time.time()))[-8:]
OWNER = f"tester_qa_{_RUN}"

# Address IDs (unique per run)
ADDR_NO_SURVEY   = f"TEST-QA-NOSVY-{_RUN}"       # no survey → no_survey + missing_azimuth
ADDR_MISMATCH    = f"TEST-QA-MISMATCH-{_RUN}"    # household, declared=3 recorded=1 → mismatch
ADDR_NO_PLACES   = f"TEST-QA-NOPLACES-{_RUN}"    # person with no places & no_places False → flag
ADDR_COMMERCE    = f"TEST-QA-COMMERCE-{_RUN}"    # commerce with workers
ADDR_PUBLIC      = f"TEST-QA-PUBLIC-{_RUN}"      # public service with all fields
EXISTING_ADDR_ID = "FOT-A-001-777"


@pytest.fixture(scope="module")
def s():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    yield session
    # cleanup
    for aid in (ADDR_NO_SURVEY, ADDR_MISMATCH, ADDR_NO_PLACES,
                ADDR_COMMERCE, ADDR_PUBLIC):
        try:
            session.delete(f"{API}/addresses/{aid}",
                           params={"owner_id": OWNER}, timeout=10)
        except Exception:
            pass


def _create_address(s, aid, **extra):
    payload = {
        "address_id": aid,
        "district": "QA", "sector": "A", "street_id": "001",
        "house_number": "1",
        "latitude": 5.0, "longitude": 10.0,
        "accuracy_meters": 3.0,
        "owner_id": OWNER,
    }
    payload.update(extra)
    r = s.post(f"{API}/addresses", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


# ================= admin/address =================
class TestAdminAddressLookup:
    def test_01_wrong_pin_returns_403(self, s):
        r = s.get(f"{API}/admin/address/{EXISTING_ADDR_ID}",
                  params={"pin": "000000"}, timeout=15)
        assert r.status_code == 403, r.text

    def test_02_unknown_id_returns_404(self, s):
        r = s.get(f"{API}/admin/address/DOES-NOT-EXIST-XYZ-{_RUN}",
                  params={"pin": PIN}, timeout=15)
        assert r.status_code == 404, r.text

    def test_03_existing_no_survey_returns_null_survey(self, s):
        r = s.get(f"{API}/admin/address/{EXISTING_ADDR_ID}",
                  params={"pin": PIN}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "address" in d and "survey" in d
        assert d["address"]["address_id"] == EXISTING_ADDR_ID
        # per problem statement FOT-A-001-777 has no survey
        assert d["survey"] is None, f"expected null survey, got {d['survey']!r}"

    def test_04_surveyed_household_returns_persons_and_places(self, s):
        _create_address(s, ADDR_NO_PLACES, azimuth_degrees=90)
        survey = {
            "address_id": ADDR_NO_PLACES,
            "owner_id": OWNER,
            "survey_type": "household",
            "family_name": "QA Family",
            "total_persons": 1,
            "persons": [{
                "id": "p1", "name": "Ana", "age": 25, "gender": "female",
                "education": "university", "profession": "dev",
                "places": [{"category": "school", "name": "Univ. Ydé",
                            "frequency": "daily", "reason": "study"}],
                "no_places": False,
            }],
        }
        r = s.post(f"{API}/surveys", json=survey, timeout=15)
        assert r.status_code == 200, r.text
        r = s.get(f"{API}/admin/address/{ADDR_NO_PLACES}",
                  params={"pin": PIN}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["survey"] is not None
        assert d["survey"]["family_name"] == "QA Family"
        persons = d["survey"]["persons"]
        assert len(persons) == 1
        assert persons[0]["name"] == "Ana"
        assert persons[0]["places"][0]["name"] == "Univ. Ydé"


# ================= surveys with new fields =================
class TestSurveyNewFields:
    def test_01_commerce_workers_persisted(self, s):
        _create_address(s, ADDR_COMMERCE, azimuth_degrees=45)
        survey = {
            "address_id": ADDR_COMMERCE,
            "owner_id": OWNER,
            "survey_type": "commerce",
            "commerce": {
                "name": "QA Shop", "owner": "QA", "phone": "+237600000001",
                "products": "food", "workers": 3,
                "hours_weekdays": "08:00-18:00",
                "hours_saturday": "", "hours_sunday": "",
            },
        }
        r = s.post(f"{API}/surveys", json=survey, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["commerce"]["workers"] == 3
        assert d["is_commerce"] is True

    def test_02_public_all_new_fields_persisted(self, s):
        _create_address(s, ADDR_PUBLIC, azimuth_degrees=180)
        survey = {
            "address_id": ADDR_PUBLIC,
            "owner_id": OWNER,
            "survey_type": "public",
            "public_service": {
                "name": "QA School", "category": "school",
                "managing_org": "MINEDUB", "phone": "+237611111111",
                "workers": 12, "capacity_max": "400 élèves",
                "usage_current": "320 élèves", "hours": "07:30-15:30",
            },
        }
        r = s.post(f"{API}/surveys", json=survey, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        ps = d["public_service"]
        assert ps["workers"] == 12
        assert ps["capacity_max"] == "400 élèves"
        assert ps["usage_current"] == "320 élèves"
        assert ps["hours"] == "07:30-15:30"
        assert ps["managing_org"] == "MINEDUB"
        assert d["is_public"] is True

    def test_03_person_no_places_true_persisted(self, s):
        # Reuse an address without survey
        _create_address(s, ADDR_MISMATCH, azimuth_degrees=270)
        survey = {
            "address_id": ADDR_MISMATCH,
            "owner_id": OWNER,
            "survey_type": "household",
            "total_persons": 3,   # declared 3
            "persons": [{         # recorded 1 → mismatch (used later for CSV test)
                "id": "p1", "name": "Baby", "age": 1, "gender": "female",
                "education": "none", "profession": "",
                "places": [], "no_places": True,
            }],
        }
        r = s.post(f"{API}/surveys", json=survey, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["persons"][0]["no_places"] is True
        assert d["persons"][0]["places"] == []


# ================= CSV export columns & quality_issues =================
class TestAdminCSV:
    @pytest.fixture(scope="class")
    def csv_text(self, s):
        # Ensure ADDR_NO_SURVEY exists with NO azimuth and NO survey (no_survey + missing_azimuth flags)
        _create_address(s, ADDR_NO_SURVEY)  # azimuth omitted → None
        # NO_PLACES address: create a fresh survey where person has no places & no_places=False → missing_persons_places
        survey = {
            "address_id": ADDR_NO_PLACES,
            "owner_id": OWNER,
            "survey_type": "household",
            "total_persons": 1,
            "persons": [{
                "id": "p1", "name": "SoloNoPlaces", "age": 30,
                "gender": "male", "education": "primary",
                "places": [], "no_places": False,
            }],
        }
        r = s.post(f"{API}/surveys", json=survey, timeout=15)
        assert r.status_code == 200
        r = s.get(f"{API}/admin/export/csv", params={"pin": PIN}, timeout=60)
        assert r.status_code == 200, r.text
        assert "text/csv" in r.headers.get("content-type", "")
        return r.text

    def test_01_new_columns_present(self, csv_text):
        header = csv_text.splitlines()[0]
        for col in ("commerce_workers", "public_workers",
                    "public_capacity_max", "public_usage_current",
                    "public_hours", "quality_issues"):
            assert col in header, f"missing column {col}"
        # quality_issues must be the LAST column per spec
        cols = header.split(",")
        assert cols[-1] == "quality_issues", f"quality_issues not last, got {cols[-1]}"

    def _row_for(self, csv_text, aid):
        import csv as _csv, io as _io
        reader = _csv.reader(_io.StringIO(csv_text))
        rows = list(reader)
        header = rows[0]
        idx = header.index("address_id")
        for r in rows[1:]:
            if r[idx] == aid:
                return dict(zip(header, r))
        return None

    def test_02_no_survey_flag(self, csv_text):
        row = self._row_for(csv_text, ADDR_NO_SURVEY)
        assert row is not None, f"row {ADDR_NO_SURVEY} not found"
        issues = row["quality_issues"].split("|")
        assert "no_survey" in issues, f"expected no_survey in {issues}"
        assert "missing_azimuth" in issues, f"expected missing_azimuth in {issues}"

    def test_03_persons_count_mismatch_flag(self, csv_text):
        row = self._row_for(csv_text, ADDR_MISMATCH)
        assert row is not None, f"row {ADDR_MISMATCH} not found"
        issues = row["quality_issues"].split("|")
        assert "persons_count_mismatch" in issues, f"issues={issues}"

    def test_04_missing_persons_places_flag(self, csv_text):
        row = self._row_for(csv_text, ADDR_NO_PLACES)
        assert row is not None
        issues = row["quality_issues"].split("|")
        assert "missing_persons_places" in issues, f"issues={issues}"

    def test_05_missing_azimuth_flag_isolated(self, csv_text):
        # ADDR_NO_SURVEY has no azimuth → missing_azimuth flagged
        row = self._row_for(csv_text, ADDR_NO_SURVEY)
        issues = row["quality_issues"].split("|")
        assert "missing_azimuth" in issues

    def test_06_commerce_workers_and_public_fields_in_row(self, csv_text):
        crow = self._row_for(csv_text, ADDR_COMMERCE)
        assert crow is not None
        assert crow["commerce_workers"] == "3"
        prow = self._row_for(csv_text, ADDR_PUBLIC)
        assert prow is not None
        assert prow["public_workers"] == "12"
        assert prow["public_capacity_max"] == "400 élèves"
        assert prow["public_usage_current"] == "320 élèves"
        assert prow["public_hours"] == "07:30-15:30"


# ================= Regression =================
class TestRegression:
    def test_01_health(self, s):
        r = s.get(f"{API}/health", timeout=15)
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_02_restore_requires_token(self, s):
        r = s.get(f"{API}/restore", timeout=15)
        assert r.status_code == 401

    def test_03_login_existing_still_works(self, s):
        r = s.post(f"{API}/auth/login",
                   json={"identifier": "+237699000111", "pin": "1234"},
                   timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["efyl_id"] == "EFYL-90AF88"
