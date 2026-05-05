"""Phase 2 backend tests for Wetworks CRM (quotations, jobs, idempotent approval).

Covers:
- GET /api/quotations search (q, status, creator, start, end) + created_by_name
- GET /api/quotations/{id} returns customer/vehicle/creator/created_by_name + linked_job_id/number
- POST /api/quotations with discount_type=percent/amount/none → _calc_totals
- POST /api/quotations/{id}/status approved auto-creates JC + idempotent
- POST /api/quotations/{id}/convert is idempotent
- GET /api/jobs filters and enrichment (created_by_name, quotation_number)
- GET /api/jobs/{id} enrichment + payments
- PATCH /api/jobs/{id}/invoice with discount_type=percent
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://vehicle-care-crm.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": "admin@autocrm.kw", "password": "admin123"}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin(admin_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def seed_ids(admin):
    """Pick a customer / vehicle / service for creating test quotations."""
    cust = admin.get(f"{API}/customers", timeout=15).json()
    assert isinstance(cust, list) and cust, "no customers seeded"
    customer_id = cust[0]["id"]
    veh = admin.get(f"{API}/vehicles", params={"customer_id": customer_id}, timeout=15).json()
    if not veh:
        veh = admin.get(f"{API}/vehicles", timeout=15).json()
        # fallback: pick any vehicle and that vehicle's customer
        customer_id = veh[0]["customer_id"]
    vehicle_id = veh[0]["id"]
    svcs = admin.get(f"{API}/services", timeout=15).json()
    assert svcs
    service = svcs[0]
    return {"customer_id": customer_id, "vehicle_id": vehicle_id, "service": service}


# ---------- list /api/quotations filters & created_by_name ----------
class TestQuotationsList:
    def test_list_returns_created_by_name(self, admin):
        r = admin.get(f"{API}/quotations", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert data, "expected seed quotations"
        # every row should contain created_by_name (string or None ok, but key must exist)
        for row in data:
            assert "created_by_name" in row, f"missing created_by_name on {row.get('number')}"

    def test_filter_status_draft(self, admin):
        r = admin.get(f"{API}/quotations", params={"status": "draft"}, timeout=15)
        assert r.status_code == 200
        for row in r.json():
            assert row["status"] == "draft"

    def test_filter_q_by_number(self, admin):
        all_q = admin.get(f"{API}/quotations", timeout=15).json()
        target = all_q[0]["number"]
        r = admin.get(f"{API}/quotations", params={"q": target}, timeout=15)
        assert r.status_code == 200
        nums = [x["number"] for x in r.json()]
        assert target in nums

    def test_filter_creator(self, admin):
        # any creator id in the list
        all_q = admin.get(f"{API}/quotations", timeout=15).json()
        creator = all_q[0].get("created_by")
        if not creator:
            pytest.skip("seed quotation has no created_by")
        r = admin.get(f"{API}/quotations", params={"creator": creator}, timeout=15)
        assert r.status_code == 200
        for row in r.json():
            assert row.get("created_by") == creator

    def test_filter_date_range(self, admin):
        r = admin.get(f"{API}/quotations", params={"start": "2020-01-01", "end": "2099-12-31"}, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- detail enrichment ----------
class TestQuotationDetail:
    def test_detail_enrichment(self, admin):
        all_q = admin.get(f"{API}/quotations", timeout=15).json()
        # pick QT-00002 (approved with linked job per seed) if present, else first
        target = next((q for q in all_q if q["number"] == "QT-00002"), all_q[0])
        r = admin.get(f"{API}/quotations/{target['id']}", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "customer" in d and isinstance(d["customer"], dict)
        assert "vehicle" in d and isinstance(d["vehicle"], dict)
        assert "created_by_name" in d
        # if approved + has a linked job, expose linked_job_id/number
        if d.get("status") == "approved":
            # tolerate either nulls (no JC yet) or proper linkage
            assert "linked_job_id" in d
            assert "linked_job_number" in d


# ---------- create quotation discount math ----------
class TestQuotationCreateDiscount:
    def _payload(self, seed, discount_type=None, discount_value=None):
        svc = seed["service"]
        line = {
            "service_id": svc["id"],
            "service_name": svc.get("name") or svc.get("name_en") or "Service",
            "category": svc.get("category", "general"),
            "qty": 1,
            "unit_price": 100.0,  # so subtotal=100 KWD
            "line_total": 100.0,
        }
        body = {
            "customer_id": seed["customer_id"],
            "vehicle_id": seed["vehicle_id"],
            "lines": [line],
            "tax_rate": 0,
            "notes": "TEST_phase2_discount",
        }
        if discount_type is not None:
            body["discount_type"] = discount_type
        if discount_value is not None:
            body["discount_value"] = discount_value
        return body

    def test_no_discount(self, admin, seed_ids):
        r = admin.post(f"{API}/quotations", json=self._payload(seed_ids), timeout=20)
        assert r.status_code in (200, 201), r.text
        q = r.json()
        assert abs(q["subtotal"] - 100.0) < 0.01
        assert abs(q.get("discount", 0) - 0) < 0.01
        # no discount → grand total ≈ subtotal (+tax 0)
        assert abs(q["total"] - 100.0) < 0.01

    def test_percent_discount(self, admin, seed_ids):
        body = self._payload(seed_ids, "percent", 10)
        r = admin.post(f"{API}/quotations", json=body, timeout=20)
        assert r.status_code in (200, 201), r.text
        q = r.json()
        assert abs(q["subtotal"] - 100.0) < 0.01
        assert abs(q["discount"] - 10.0) < 0.01, f"expected 10 KWD discount, got {q['discount']}"
        assert abs(q["total"] - 90.0) < 0.01

    def test_amount_discount(self, admin, seed_ids):
        body = self._payload(seed_ids, "amount", 5)
        r = admin.post(f"{API}/quotations", json=body, timeout=20)
        assert r.status_code in (200, 201), r.text
        q = r.json()
        assert abs(q["discount"] - 5.0) < 0.01
        assert abs(q["total"] - 95.0) < 0.01


# ---------- approval idempotence ----------
class TestApprovalIdempotent:
    def test_first_approval_creates_jc_second_returns_same(self, admin, seed_ids):
        # create a fresh draft quotation specifically for this test
        svc = seed_ids["service"]
        body = {
            "customer_id": seed_ids["customer_id"],
            "vehicle_id": seed_ids["vehicle_id"],
            "lines": [{
                "service_id": svc["id"],
                "service_name": svc.get("name") or "Service",
                "category": svc.get("category", "general"),
                "qty": 1,
                "unit_price": 50.0,
                "line_total": 50.0,
            }],
            "tax_rate": 0,
            "notes": "TEST_phase2_approval",
        }
        c = admin.post(f"{API}/quotations", json=body, timeout=20)
        assert c.status_code in (200, 201), c.text
        qid = c.json()["id"]

        # 1st approval
        r1 = admin.post(f"{API}/quotations/{qid}/status", json={"status": "approved"}, timeout=20)
        assert r1.status_code == 200, r1.text
        j1 = r1.json()
        assert j1.get("status") == "approved"
        assert j1.get("job_id"), f"expected job_id on first approval, got {j1}"
        assert j1.get("job_number"), f"expected job_number on first approval, got {j1}"
        first_job_id = j1["job_id"]

        # 2nd approval — must NOT create a duplicate
        r2 = admin.post(f"{API}/quotations/{qid}/status", json={"status": "approved"}, timeout=20)
        assert r2.status_code == 200, r2.text
        j2 = r2.json()
        assert j2.get("job_id") == first_job_id, f"duplicate job created! {j1} vs {j2}"

        # convert endpoint must also be idempotent
        r3 = admin.post(f"{API}/quotations/{qid}/convert", json={}, timeout=20)
        assert r3.status_code in (200, 201), r3.text
        j3 = r3.json()
        # convert should return same job
        returned_job_id = j3.get("job_id") or j3.get("id")
        assert returned_job_id == first_job_id, f"convert created duplicate job: {j3}"


# ---------- jobs list & filters ----------
class TestJobsList:
    def test_list_enrichment(self, admin):
        r = admin.get(f"{API}/jobs", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and data
        for row in data:
            assert "created_by_name" in row, f"job {row.get('number')} missing created_by_name"
            # quotation_number should be present when the job is linked to a quotation
            if row.get("quotation_id"):
                assert row.get("quotation_number"), (
                    f"job {row.get('number')} has quotation_id but no quotation_number"
                )

    def test_filter_q(self, admin):
        all_j = admin.get(f"{API}/jobs", timeout=15).json()
        target = all_j[0]["number"]
        r = admin.get(f"{API}/jobs", params={"q": target}, timeout=15)
        assert r.status_code == 200
        assert any(x["number"] == target for x in r.json())

    def test_filter_status_creator_dates(self, admin):
        r = admin.get(f"{API}/jobs", params={"status": "open", "start": "2020-01-01", "end": "2099-12-31"}, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- job detail enrichment + invoice discount math ----------
class TestJobDetail:
    def test_detail_enrichment(self, admin):
        all_j = admin.get(f"{API}/jobs", timeout=15).json()
        # pick a job that has quotation linkage (most should after seeded approvals)
        target = next((j for j in all_j if j.get("quotation_id")), all_j[0])
        r = admin.get(f"{API}/jobs/{target['id']}", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "created_by_name" in d
        assert "quotation_number" in d
        # totals payment fields
        for k in ("total", "total_paid", "balance_due", "payment_status"):
            assert k in d, f"job detail missing {k}"

    def test_invoice_percent_discount(self, admin):
        # find any job with items / invoice editable
        all_j = admin.get(f"{API}/jobs", timeout=15).json()
        # try each until PATCH succeeds
        last_err = None
        for jrow in all_j:
            jid = jrow["id"]
            d = admin.get(f"{API}/jobs/{jid}", timeout=15).json()
            subtotal = d.get("subtotal") or 0
            if subtotal <= 0:
                continue
            r = admin.patch(
                f"{API}/jobs/{jid}/invoice",
                json={"discount_type": "percent", "discount_value": 10, "tax_rate": d.get("tax_rate", 0)},
                timeout=20,
            )
            if r.status_code != 200:
                last_err = (jid, r.status_code, r.text)
                continue
            res = r.json()
            expected_disc = round(subtotal * 0.10, 3)
            assert abs(res.get("discount", 0) - expected_disc) < 0.02, (
                f"expected discount≈{expected_disc}, got {res.get('discount')}"
            )
            return
        pytest.fail(f"no job invoice was patchable. last_err={last_err}")
