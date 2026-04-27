"""Backend regression tests for AutoCRM Kuwait Iteration 2."""
import os
from datetime import datetime, timedelta, timezone

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback for test infra (read frontend .env directly)
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break
API = f"{BASE_URL}/api"


# ---------------- Fixtures ----------------
@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def reseed(s):
    r = s.post(f"{API}/seed", params={"reseed": "true"}, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("seeded") is True
    assert data.get("vehicle_makes") == 30
    return data


@pytest.fixture(scope="module")
def admin_token(s, reseed):
    r = s.post(f"{API}/auth/login", json={"email": "admin@autocrm.kw", "password": "admin123"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def sales_token(s, reseed):
    r = s.post(f"{API}/auth/login", json={"email": "sales@autocrm.kw", "password": "sales123"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def tech_token(s, reseed):
    r = s.post(f"{API}/auth/login", json={"email": "tech@autocrm.kw", "password": "tech123"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def H(t):
    return {"Authorization": f"Bearer {t}"}


# ---------------- Auth & Seed ----------------
def test_seed(reseed):
    assert reseed["users"] == 3
    assert reseed["vehicle_types"] == 4
    assert reseed["services"] >= 10
    assert reseed["vehicle_makes"] == 30


# ---------------- Vehicle Makes ----------------
def test_makes_list_returns_30(s, admin_token):
    r = s.get(f"{API}/vehicle-makes", headers=H(admin_token))
    assert r.status_code == 200
    makes = r.json()
    assert len(makes) == 30
    labels = {m["label"]: m for m in makes}
    assert "Mitsubishi" in labels
    mitsu_models = labels["Mitsubishi"]["models"]
    for expected in ["Pajero", "Outlander", "Lancer", "ASX", "L200"]:
        assert expected in mitsu_models


def test_makes_create_admin_only(s, admin_token, sales_token):
    # sales forbidden
    r = s.post(f"{API}/vehicle-makes", json={"label": "TEST_BrandSales", "models": ["X"]}, headers=H(sales_token))
    assert r.status_code == 403
    # admin allowed
    r = s.post(f"{API}/vehicle-makes", json={"label": "TEST_BrandAdmin", "models": ["X1", "X2"]}, headers=H(admin_token))
    assert r.status_code == 200
    mid = r.json()["id"]
    # cleanup
    s.delete(f"{API}/vehicle-makes/{mid}", headers=H(admin_token))


# ---------------- Customers ----------------
def test_customer_minimal_no_email_address_notes(s, sales_token):
    """Regression: Customer save with ONLY name+mobile must succeed."""
    r = s.post(f"{API}/customers",
               json={"name": "TEST_MinimalCust", "mobile": "+96500000001"},
               headers=H(sales_token))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["name"] == "TEST_MinimalCust"
    assert body["email"] is None
    assert body["address"] is None
    assert body["notes"] is None
    # GET to verify persisted
    cid = body["id"]
    g = s.get(f"{API}/customers/{cid}", headers=H(sales_token))
    assert g.status_code == 200
    assert g.json()["mobile"] == "+96500000001"


def test_customer_inline_vehicles(s, sales_token):
    payload = {
        "name": "TEST_InlineCust",
        "mobile": "+96500000002",
        "vehicles": [
            {"vehicle_type": "sedan", "make": "Toyota", "model": "Camry", "plate": "AAA1"},
            {"vehicle_type": "suv", "make": "Lexus", "model": "LX 600", "plate": "BBB2"},
        ],
    }
    r = s.post(f"{API}/customers", json=payload, headers=H(sales_token))
    assert r.status_code == 200
    cid = r.json()["id"]
    g = s.get(f"{API}/customers/{cid}", headers=H(sales_token)).json()
    assert len(g["vehicles"]) == 2
    plates = {v["plate"] for v in g["vehicles"]}
    assert plates == {"AAA1", "BBB2"}


# ---------------- Quotation expiry & convert ----------------
@pytest.fixture(scope="module")
def services(s, admin_token):
    return s.get(f"{API}/services", headers=H(admin_token)).json()


@pytest.fixture(scope="module")
def existing_customer(s, admin_token):
    cs = s.get(f"{API}/customers", headers=H(admin_token)).json()
    # pick one with a vehicle
    for c in cs:
        veh = s.get(f"{API}/vehicles", params={"customer_id": c["id"]}, headers=H(admin_token)).json()
        if veh:
            return c, veh[0]
    pytest.skip("No seeded customer with vehicle found")


def _qline(svc, qty=1, unit=10.0):
    return {"service_id": svc["id"], "service_name": svc["name"],
            "quantity": qty, "unit_price": unit, "selected_areas": [],
            "line_total": qty * unit}


def test_quotation_expiry_future(s, sales_token, services, existing_customer):
    cust, veh = existing_customer
    future = (datetime.now(timezone.utc) + timedelta(days=10)).date().isoformat()
    svc = next(x for x in services if x["pricing_mode"] == "fixed")
    payload = {"customer_id": cust["id"], "vehicle_id": veh["id"],
               "lines": [_qline(svc, 1, svc.get("fixed_price") or 5.0)],
               "discount": 0, "tax_rate": 0, "valid_until": future}
    r = s.post(f"{API}/quotations", json=payload, headers=H(sales_token))
    assert r.status_code == 200, r.text
    q = r.json()
    assert q["is_expired"] is False
    # listing
    lst = s.get(f"{API}/quotations", headers=H(sales_token)).json()
    found = next(x for x in lst if x["id"] == q["id"])
    assert found["is_expired"] is False


def test_quotation_expiry_past(s, sales_token, services, existing_customer):
    cust, veh = existing_customer
    past = (datetime.now(timezone.utc) - timedelta(days=5)).date().isoformat()
    svc = next(x for x in services if x["pricing_mode"] == "fixed")
    payload = {"customer_id": cust["id"], "vehicle_id": veh["id"],
               "lines": [_qline(svc, 1, 5.0)],
               "discount": 0, "tax_rate": 0, "valid_until": past}
    r = s.post(f"{API}/quotations", json=payload, headers=H(sales_token))
    assert r.status_code == 200
    assert r.json()["is_expired"] is True


@pytest.fixture(scope="module")
def converted_job(s, sales_token, services, existing_customer):
    cust, veh = existing_customer
    svc_panel = next(x for x in services if x["pricing_mode"] == "per_panel")
    payload = {"customer_id": cust["id"], "vehicle_id": veh["id"],
               "lines": [_qline(svc_panel, 1, 50.0)],
               "discount": 0, "tax_rate": 0,
               "valid_until": (datetime.now(timezone.utc) + timedelta(days=30)).date().isoformat()}
    qr = s.post(f"{API}/quotations", json=payload, headers=H(sales_token))
    qid = qr.json()["id"]
    cv = s.post(f"{API}/quotations/{qid}/convert", headers=H(sales_token))
    assert cv.status_code == 200, cv.text
    job = cv.json()
    assert job["status"] == "confirmed"
    assert "signature" not in job
    return job


def test_convert_creates_confirmed_job(converted_job):
    assert converted_job["status"] == "confirmed"
    assert converted_job.get("invoice_number") is None


# ---------------- Timer ----------------
def test_timer_start_progresses_status(s, admin_token, converted_job):
    jid = converted_job["id"]
    r = s.post(f"{API}/jobs/{jid}/timer/start", headers=H(admin_token))
    assert r.status_code == 200
    j = r.json()
    assert j["timer_running"] is True
    assert j["status"] == "in_progress"


def test_timer_stop_records_seconds(s, admin_token, converted_job):
    jid = converted_job["id"]
    import time as _t
    _t.sleep(1.2)
    r = s.post(f"{API}/jobs/{jid}/timer/stop", headers=H(admin_token))
    assert r.status_code == 200
    j = r.json()
    assert j["timer_running"] is False
    assert j["total_seconds"] >= 1


# ---------------- Payments ----------------
def test_payment_cash_partial(s, admin_token, converted_job):
    jid = converted_job["id"]
    r = s.post(f"{API}/jobs/{jid}/payments",
               json={"method": "cash", "amount": 5.000},
               headers=H(admin_token))
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["total_paid"] == 5.000
    assert j["payment_status"] == "partial"
    assert j["balance_due"] > 0


def test_payment_knet_no_authcode_fails(s, admin_token, converted_job):
    jid = converted_job["id"]
    r = s.post(f"{API}/jobs/{jid}/payments",
               json={"method": "knet", "amount": 1.000},
               headers=H(admin_token))
    assert r.status_code == 400
    assert "auth code" in r.text.lower() or "auth_code" in r.text.lower()


def test_payment_creditcard_no_authcode_fails(s, admin_token, converted_job):
    jid = converted_job["id"]
    r = s.post(f"{API}/jobs/{jid}/payments",
               json={"method": "credit_card", "amount": 1.000},
               headers=H(admin_token))
    assert r.status_code == 400


def test_payment_knet_with_authcode_balance_paid(s, admin_token, converted_job):
    """Pay remaining balance via knet → status becomes paid."""
    jid = converted_job["id"]
    cur = s.get(f"{API}/jobs/{jid}", headers=H(admin_token)).json()
    bal = cur["balance_due"]
    assert bal > 0
    r = s.post(f"{API}/jobs/{jid}/payments",
               json={"method": "knet", "amount": bal, "auth_code": "KNET123"},
               headers=H(admin_token))
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["payment_status"] == "paid"
    assert abs(j["balance_due"]) < 0.005
    # auth_code stored
    pmts = j["payments"]
    knet_p = next(p for p in pmts if p["method"] == "knet")
    assert knet_p["auth_code"] == "KNET123"


def test_payment_delete_admin_only(s, sales_token, admin_token, converted_job):
    jid = converted_job["id"]
    j = s.get(f"{API}/jobs/{jid}", headers=H(admin_token)).json()
    pid = j["payments"][0]["id"]
    # sales forbidden
    r = s.delete(f"{API}/jobs/{jid}/payments/{pid}", headers=H(sales_token))
    assert r.status_code == 403


# ---------------- Invoice edit & completion ----------------
def test_invoice_edit_recalculates(s, admin_token, converted_job):
    jid = converted_job["id"]
    r = s.patch(f"{API}/jobs/{jid}/invoice",
                json={"discount": 1.0, "tax_rate": 5},
                headers=H(admin_token))
    assert r.status_code == 200
    j = r.json()
    sub = j["subtotal"]
    expected_tax = round((sub - 1.0) * 0.05 + 1e-9, 3)
    expected_total = round((sub - 1.0) + expected_tax + 1e-9, 3)
    assert j["discount"] == 1.0
    assert j["tax_rate"] == 5
    assert abs(j["tax_amount"] - expected_tax) < 0.005
    assert abs(j["total"] - expected_total) < 0.005


def test_complete_job_generates_invoice_number(s, admin_token, converted_job):
    jid = converted_job["id"]
    r = s.post(f"{API}/jobs/{jid}/status",
               json={"status": "completed"},
               headers=H(admin_token))
    assert r.status_code == 200
    j = r.json()
    assert j["status"] == "completed"
    assert j.get("invoice_number", "").startswith("INV-")
    assert j.get("completed_at")


# ---------------- Notifications ----------------
def test_notifications_shape(s, admin_token):
    r = s.get(f"{API}/notifications", headers=H(admin_token))
    assert r.status_code == 200
    n = r.json()
    for k in ["low_stock", "overdue_jobs", "pending_quotations",
              "expired_quotations", "outstanding_jobs", "count", "total_outstanding"]:
        assert k in n
    assert isinstance(n["count"], int)


# ---------------- Reports ----------------
def test_reports_sales(s, admin_token):
    r = s.get(f"{API}/reports/sales",
              params={"start": "2026-01-01", "end": "2026-12-31"},
              headers=H(admin_token))
    assert r.status_code == 200
    rep = r.json()
    for k in ["total_revenue", "total_collected", "by_service", "by_method"]:
        assert k in rep
    methods = {x["method"] for x in rep["by_method"]}
    assert {"cash", "knet", "credit_card"}.issubset(methods)


def test_reports_pnl(s, admin_token):
    r = s.get(f"{API}/reports/pnl", headers=H(admin_token))
    assert r.status_code == 200
    rep = r.json()
    for k in ["revenue", "discounts_given", "tax_collected", "cogs", "gross_profit"]:
        assert k in rep


def test_reports_jobs_grouping(s, admin_token):
    r = s.get(f"{API}/reports/jobs", headers=H(admin_token))
    assert r.status_code == 200
    assert "by_status" in r.json()


def test_reports_customer_history(s, admin_token, existing_customer):
    cust, _ = existing_customer
    r = s.get(f"{API}/reports/customer-history/{cust['id']}", headers=H(admin_token))
    assert r.status_code == 200
    rep = r.json()
    for k in ["jobs", "quotations", "total_spent", "visits"]:
        assert k in rep


def test_pnl_admin_only(s, sales_token):
    r = s.get(f"{API}/reports/pnl", headers=H(sales_token))
    assert r.status_code == 403
