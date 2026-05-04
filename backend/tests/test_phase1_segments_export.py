"""Phase 1 backend tests: Excel export/import and Segments (incl. behavioural filters)."""
import os
from io import BytesIO

import pytest
import requests
from openpyxl import Workbook

with open("/app/frontend/.env") as f:
    for line in f:
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
            break
API = f"{BASE_URL}/api"
XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def admin_token(s):
    # ensure seed exists (idempotent: only seeds if no users)
    s.post(f"{API}/seed", timeout=30)
    r = s.post(f"{API}/auth/login",
               json={"email": "admin@autocrm.kw", "password": "admin123"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def sales_token(s):
    r = s.post(f"{API}/auth/login",
               json={"email": "sales@autocrm.kw", "password": "sales123"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def H(t):
    return {"Authorization": f"Bearer {t}"}


# ---------------- Customer export ----------------
def test_export_customers_xlsx(s, admin_token):
    r = s.get(f"{API}/export/customers", headers=H(admin_token), timeout=30)
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith(XLSX_MIME)
    # binary xlsx files start with PK zip header
    assert r.content[:2] == b"PK"
    assert "attachment" in r.headers.get("content-disposition", "")


# ---------------- Vehicle export with filters ----------------
def test_export_vehicles_with_filters(s, admin_token):
    r = s.get(f"{API}/export/vehicles", params={"make": "Toyota"},
              headers=H(admin_token), timeout=30)
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith(XLSX_MIME)
    assert r.content[:2] == b"PK"


def test_export_vehicles_year_filter(s, admin_token):
    r = s.get(f"{API}/export/vehicles", params={"year": 2020},
              headers=H(admin_token), timeout=30)
    assert r.status_code == 200
    assert r.content[:2] == b"PK"


# ---------------- Customer import (with duplicate skip) ----------------
def _build_xlsx(rows):
    wb = Workbook(); ws = wb.active; ws.append(["Name", "Mobile", "Email"])
    for row in rows:
        ws.append(row)
    buf = BytesIO(); wb.save(buf); buf.seek(0)
    return buf.getvalue()


def test_import_customers_creates_then_skips_duplicates(s, admin_token):
    xlsx_bytes = _build_xlsx([
        ["TEST_ImportA", "+96577000001", "a@test.kw"],
        ["TEST_ImportB", "+96577000002", "b@test.kw"],
    ])
    files = {"file": ("import.xlsx", xlsx_bytes, XLSX_MIME)}
    # First import
    r1 = s.post(f"{API}/import/customers", files=files, headers=H(admin_token), timeout=30)
    assert r1.status_code == 200, r1.text
    body1 = r1.json()
    assert body1["created"] >= 1  # at least one new (could be 2 if first run, less if reseeded)
    assert body1.get("total_rows") == 2

    # Second import of same file → should all be duplicates by mobile
    files2 = {"file": ("import.xlsx", xlsx_bytes, XLSX_MIME)}
    r2 = s.post(f"{API}/import/customers", files=files2, headers=H(admin_token), timeout=30)
    assert r2.status_code == 200, r2.text
    body2 = r2.json()
    assert body2["skipped_duplicates"] == 2
    assert body2["created"] == 0


# ---------------- Segments preview ----------------
def test_segments_preview_empty_filter_returns_all(s, sales_token, admin_token):
    total = len(s.get(f"{API}/customers", headers=H(admin_token)).json())
    r = s.post(f"{API}/segments/preview", json={}, headers=H(sales_token), timeout=20)
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == total


def test_segments_preview_min_total_spend_no_high_spenders(s, sales_token):
    r = s.post(f"{API}/segments/preview", json={"min_total_spend": 1000},
               headers=H(sales_token), timeout=20)
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 0


def test_segments_preview_min_job_count_annotates(s, sales_token):
    r = s.post(f"{API}/segments/preview", json={"min_job_count": 1},
               headers=H(sales_token), timeout=20)
    assert r.status_code == 200
    body = r.json()
    # Customers with jobs should be annotated
    for c in body["customers"]:
        assert "job_count" in c
        assert "total_spend" in c
        assert "last_service" in c
        assert c["job_count"] >= 1


def test_segments_preview_last_service_after(s, sales_token):
    r = s.post(f"{API}/segments/preview",
               json={"last_service_after": "2020-01-01"},
               headers=H(sales_token), timeout=20)
    assert r.status_code == 200
    body = r.json()
    # All returned customers should have last_service annotated
    for c in body["customers"]:
        assert c.get("last_service") is not None


# ---------------- Segment CRUD ----------------
@pytest.fixture(scope="module")
def created_segment_id(s, sales_token):
    r = s.post(f"{API}/segments",
               json={"name": "TEST_Phase1Segment", "description": "test",
                     "filters": {"min_job_count": 0}},
               headers=H(sales_token), timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["name"] == "TEST_Phase1Segment"
    assert "id" in body
    assert "customer_count" in body
    return body["id"]


def test_segments_list_contains_created(s, sales_token, created_segment_id):
    r = s.get(f"{API}/segments", headers=H(sales_token), timeout=20)
    assert r.status_code == 200
    rows = r.json()
    ids = [x["id"] for x in rows]
    assert created_segment_id in ids


def test_segment_export_xlsx(s, sales_token, created_segment_id):
    r = s.get(f"{API}/segments/{created_segment_id}/export",
              headers=H(sales_token), timeout=30)
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith(XLSX_MIME)
    assert r.content[:2] == b"PK"


def test_segment_delete_sales_forbidden(s, sales_token, created_segment_id):
    r = s.delete(f"{API}/segments/{created_segment_id}",
                 headers=H(sales_token), timeout=20)
    assert r.status_code == 403


def test_segment_delete_admin_ok(s, admin_token, created_segment_id):
    r = s.delete(f"{API}/segments/{created_segment_id}",
                 headers=H(admin_token), timeout=20)
    assert r.status_code == 200
    # verify gone
    g = s.get(f"{API}/segments/{created_segment_id}",
              headers=H(admin_token), timeout=20)
    assert g.status_code == 404


# ---------------- Cleanup imported test customers ----------------
def test_cleanup_imported_customers(s, admin_token):
    cs = s.get(f"{API}/customers", headers=H(admin_token), timeout=20).json()
    for c in cs:
        if c.get("mobile") in ("+96577000001", "+96577000002"):
            s.delete(f"{API}/customers/{c['id']}", headers=H(admin_token), timeout=10)
