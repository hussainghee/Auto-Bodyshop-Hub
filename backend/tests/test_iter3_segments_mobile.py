"""Phase-1 follow-up backend tests:
- Mobile validation (digits + optional leading +).
- Multi-select segment filters: OR within group, AND across groups.
- Backward compatibility with single legacy filter values.
- GET /api/segments/{id} returns enrichment + ?q= search.
- GET /api/segments/{id}/export returns xlsx with vehicle column populated.
"""
import os
import io
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break
API = f"{BASE_URL}/api"


def H(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def admin_token(s):
    # Don't reseed (other test module may have just done it)
    s.post(f"{API}/seed", timeout=30)
    r = s.post(f"{API}/auth/login",
               json={"email": "admin@autocrm.kw", "password": "admin123"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


# --------------------- Mobile validator ---------------------
class TestMobileValidator:
    def test_letters_rejected(self, s, admin_token):
        r = s.post(f"{API}/customers",
                   json={"name": "TEST_AlphaMobile", "mobile": "abc123"},
                   headers=H(admin_token))
        assert r.status_code == 422, r.text

    def test_with_plus_accepted(self, s, admin_token):
        r = s.post(f"{API}/customers",
                   json={"name": "TEST_PlusMobile", "mobile": "+96599887766"},
                   headers=H(admin_token))
        assert r.status_code == 200, r.text
        # cleanup
        s.delete(f"{API}/customers/{r.json()['id']}", headers=H(admin_token))

    def test_digits_only_accepted(self, s, admin_token):
        r = s.post(f"{API}/customers",
                   json={"name": "TEST_DigitsMobile", "mobile": "12345678"},
                   headers=H(admin_token))
        assert r.status_code == 200, r.text
        s.delete(f"{API}/customers/{r.json()['id']}", headers=H(admin_token))

    def test_space_inside_rejected(self, s, admin_token):
        r = s.post(f"{API}/customers",
                   json={"name": "TEST_SpaceMobile", "mobile": "+ 9659"},
                   headers=H(admin_token))
        assert r.status_code == 422, r.text


# --------------------- Segment multi-select OR/AND ---------------------
class TestSegmentMultiselect:
    def test_makes_or_within_group(self, s, admin_token):
        # Toyota OR Lexus
        r = s.post(f"{API}/segments/preview",
                   json={"makes": ["Toyota", "Lexus"]},
                   headers=H(admin_token))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["count"] >= 1
        # Each returned customer must have a Toyota OR Lexus vehicle. Verify via /vehicles.
        for c in data["customers"][:5]:
            veh = s.get(f"{API}/vehicles", params={"customer_id": c["id"]},
                        headers=H(admin_token)).json()
            makes = {v.get("make", "").lower() for v in veh}
            assert any(m in ("toyota", "lexus") for m in makes), \
                f"Customer {c['name']} has no Toyota/Lexus vehicle: {makes}"

    def test_makes_only_returns_only_matching(self, s, admin_token):
        r_t = s.post(f"{API}/segments/preview",
                     json={"makes": ["Toyota"]}, headers=H(admin_token))
        r_l = s.post(f"{API}/segments/preview",
                     json={"makes": ["Lexus"]}, headers=H(admin_token))
        r_tl = s.post(f"{API}/segments/preview",
                      json={"makes": ["Toyota", "Lexus"]}, headers=H(admin_token))
        assert r_t.status_code == 200 and r_l.status_code == 200 and r_tl.status_code == 200
        # OR of two sets >= each individual; <= sum
        c_t = r_t.json()["count"]
        c_l = r_l.json()["count"]
        c_tl = r_tl.json()["count"]
        assert c_tl >= c_t
        assert c_tl >= c_l
        assert c_tl <= c_t + c_l

    def test_make_and_model_and_across_groups(self, s, admin_token):
        # Toyota Camry only — must be subset of Toyota.
        r_camry = s.post(f"{API}/segments/preview",
                         json={"makes": ["Toyota"], "models": ["Camry"]},
                         headers=H(admin_token))
        assert r_camry.status_code == 200, r_camry.text
        for c in r_camry.json()["customers"][:5]:
            veh = s.get(f"{API}/vehicles", params={"customer_id": c["id"]},
                        headers=H(admin_token)).json()
            # at least one Toyota Camry must be present
            assert any(
                (v.get("make", "").lower() == "toyota" and
                 v.get("model", "").lower() == "camry") for v in veh
            ), f"{c['name']} vehicles {[(v.get('make'), v.get('model')) for v in veh]}"

    def test_years_multiselect(self, s, admin_token):
        r = s.post(f"{API}/segments/preview",
                   json={"years": [2020, 2022, 2024]},
                   headers=H(admin_token))
        assert r.status_code == 200, r.text
        # Combined with make
        r2 = s.post(f"{API}/segments/preview",
                    json={"makes": ["Toyota"], "years": [2020, 2022, 2024]},
                    headers=H(admin_token))
        assert r2.status_code == 200, r2.text
        for c in r2.json()["customers"][:5]:
            veh = s.get(f"{API}/vehicles", params={"customer_id": c["id"]},
                        headers=H(admin_token)).json()
            assert any(
                v.get("make", "").lower() == "toyota" and v.get("year") in [2020, 2022, 2024]
                for v in veh
            ), f"{c['name']} vehicles {[(v.get('make'), v.get('year')) for v in veh]}"

    def test_colors_multiselect(self, s, admin_token):
        r = s.post(f"{API}/segments/preview",
                   json={"colors": ["Black", "White"]}, headers=H(admin_token))
        assert r.status_code == 200, r.text
        # OR semantics: each returned customer must have a Black or White vehicle
        for c in r.json()["customers"][:5]:
            veh = s.get(f"{API}/vehicles", params={"customer_id": c["id"]},
                        headers=H(admin_token)).json()
            cols = {(v.get("color") or "").lower() for v in veh}
            assert any(col in ("black", "white") for col in cols), \
                f"{c['name']} colors={cols}"

    def test_legacy_single_make_backcompat(self, s, admin_token):
        r_legacy = s.post(f"{API}/segments/preview",
                          json={"make": "Toyota"}, headers=H(admin_token))
        r_new = s.post(f"{API}/segments/preview",
                       json={"makes": ["Toyota"]}, headers=H(admin_token))
        assert r_legacy.status_code == 200
        assert r_new.status_code == 200
        assert r_legacy.json()["count"] == r_new.json()["count"]


# --------------------- Segment CRUD + detail + search + export ---------------------
class TestSegmentDetailAndExport:
    @pytest.fixture(scope="class")
    def created(self, s, admin_token):
        body = {
            "name": "TEST_Iter3_Segment",
            "description": "Toyota or Lexus owners",
            "filters": {
                "makes": ["Toyota", "Lexus"],
                "models": [],
                "years": [],
                "colors": [],
                "vehicle_types": [],
                "cities": [],
            },
        }
        r = s.post(f"{API}/segments", json=body, headers=H(admin_token))
        assert r.status_code == 200, r.text
        seg = r.json()
        yield seg
        s.delete(f"{API}/segments/{seg['id']}", headers=H(admin_token))

    def test_get_segment_detail_shape(self, s, admin_token, created):
        r = s.get(f"{API}/segments/{created['id']}", headers=H(admin_token))
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["id", "name", "description", "created_at", "filters",
                  "customers", "customer_count"]:
            assert k in d, f"missing {k}"
        # created_by_name may be empty string but key should exist
        assert "created_by_name" in d
        assert isinstance(d["customers"], list)
        if d["customers"]:
            c0 = d["customers"][0]
            for k in ["vehicles"]:
                assert k in c0, f"customer missing {k}"
            # job_count / total_spend / last_service appear when behavioural filter
            # active. Without behavioural filters they may be absent — that is OK.

    def test_get_segment_q_filter(self, s, admin_token, created):
        # search by 'a' — should return subset
        full = s.get(f"{API}/segments/{created['id']}", headers=H(admin_token)).json()
        if not full["customers"]:
            pytest.skip("No customers in segment to test ?q=")
        sample_name = full["customers"][0]["name"]
        token = sample_name.split()[0][:3].lower()
        r = s.get(f"{API}/segments/{created['id']}",
                  params={"q": token}, headers=H(admin_token))
        assert r.status_code == 200
        for c in r.json()["customers"]:
            assert (token in (c.get("name") or "").lower()
                    or token in (c.get("mobile") or "").lower())

    def test_export_xlsx(self, s, admin_token, created):
        r = s.get(f"{API}/segments/{created['id']}/export", headers=H(admin_token))
        assert r.status_code == 200
        assert "spreadsheet" in r.headers.get("content-type", "")
        # Inspect xlsx via openpyxl
        from openpyxl import load_workbook
        wb = load_workbook(io.BytesIO(r.content))
        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        assert rows, "xlsx empty"
        header = list(rows[0])
        assert "Vehicles" in header, f"header missing Vehicles col: {header}"
        veh_idx = header.index("Vehicles")
        # At least one data row should have a non-empty Vehicles cell
        if len(rows) > 1:
            non_empty = [r[veh_idx] for r in rows[1:] if r[veh_idx]]
            assert non_empty, "no row has a populated Vehicles column"
