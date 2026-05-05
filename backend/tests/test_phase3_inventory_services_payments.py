"""
Phase 3 backend tests: Inventory categories, Service categories,
new Inventory fields + filters, Payments report + export.
"""
import io
import os
import pytest
import requests
from datetime import datetime, timezone

_url = os.environ.get("REACT_APP_BACKEND_URL")
if not _url:
    # fallback: read frontend/.env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    _url = line.split("=", 1)[1].strip()
                    break
    except Exception:
        pass
BASE = (_url or "https://vehicle-care-crm.preview.emergentagent.com").rstrip("/") + "/api"


# ---------------- Fixtures ----------------
def _login(email, password):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_tok():
    return _login("admin@autocrm.kw", "admin123")


@pytest.fixture(scope="session")
def sales_tok():
    return _login("sales@autocrm.kw", "sales123")


@pytest.fixture(scope="session")
def tech_tok():
    return _login("tech@autocrm.kw", "tech123")


def h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---------------- Inventory Categories ----------------
class TestInventoryCategories:
    def test_list_all_roles(self, admin_tok, sales_tok, tech_tok):
        for tok in (admin_tok, sales_tok, tech_tok):
            r = requests.get(f"{BASE}/inventory-categories", headers=h(tok))
            assert r.status_code == 200, r.text
            rows = r.json()
            assert isinstance(rows, list)

    def test_default_uncategorized_present_with_migrated_products(self, admin_tok):
        r = requests.get(f"{BASE}/inventory-categories", headers=h(admin_tok))
        rows = r.json()
        default = next((c for c in rows if c.get("is_default") or c.get("name") == "Uncategorized"), None)
        assert default is not None, f"Uncategorized default missing; got={[c['name'] for c in rows]}"
        assert default.get("name") == "Uncategorized"
        assert default.get("product_count", 0) >= 1, "Expected migrated products in default category"

    def test_create_admin(self, admin_tok):
        name = f"TEST_invcat_{datetime.now().timestamp():.0f}"
        r = requests.post(f"{BASE}/inventory-categories", headers=h(admin_tok),
                          json={"name": name, "description": "d", "active": True})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == name
        assert data["active"] is True
        # verify persisted via GET
        rows = requests.get(f"{BASE}/inventory-categories", headers=h(admin_tok)).json()
        assert any(c["id"] == data["id"] for c in rows)
        # cleanup
        requests.delete(f"{BASE}/inventory-categories/{data['id']}", headers=h(admin_tok))

    def test_create_sales(self, sales_tok):
        name = f"TEST_invcat_sales_{datetime.now().timestamp():.0f}"
        r = requests.post(f"{BASE}/inventory-categories", headers=h(sales_tok),
                          json={"name": name, "active": True})
        assert r.status_code == 200, r.text
        cid = r.json()["id"]
        requests.delete(f"{BASE}/inventory-categories/{cid}", headers=h(_login('admin@autocrm.kw', 'admin123'))).json()

    def test_create_tech_403(self, tech_tok):
        r = requests.post(f"{BASE}/inventory-categories", headers=h(tech_tok),
                          json={"name": "TEST_tech_blocked", "active": True})
        assert r.status_code == 403, r.text

    def test_duplicate_name_400(self, admin_tok):
        name = f"TEST_invcat_dup_{datetime.now().timestamp():.0f}"
        r1 = requests.post(f"{BASE}/inventory-categories", headers=h(admin_tok),
                           json={"name": name, "active": True})
        assert r1.status_code == 200
        cid = r1.json()["id"]
        r2 = requests.post(f"{BASE}/inventory-categories", headers=h(admin_tok),
                           json={"name": name, "active": True})
        assert r2.status_code == 400
        requests.delete(f"{BASE}/inventory-categories/{cid}", headers=h(admin_tok))

    def test_patch_updates(self, admin_tok):
        name = f"TEST_invcat_patch_{datetime.now().timestamp():.0f}"
        created = requests.post(f"{BASE}/inventory-categories", headers=h(admin_tok),
                                json={"name": name, "active": True}).json()
        new_name = name + "_upd"
        r = requests.patch(f"{BASE}/inventory-categories/{created['id']}", headers=h(admin_tok),
                           json={"name": new_name, "description": "updated", "active": False})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == new_name
        assert data["active"] is False
        assert data.get("description") == "updated"
        requests.delete(f"{BASE}/inventory-categories/{created['id']}", headers=h(admin_tok))

    def test_delete_default_blocked(self, admin_tok):
        rows = requests.get(f"{BASE}/inventory-categories", headers=h(admin_tok)).json()
        default = next(c for c in rows if c.get("is_default") or c["name"] == "Uncategorized")
        r = requests.delete(f"{BASE}/inventory-categories/{default['id']}", headers=h(admin_tok))
        assert r.status_code == 400, r.text

    def test_delete_with_products_blocked(self, admin_tok):
        # Create a category and a product in it, then try delete
        name = f"TEST_invcat_linked_{datetime.now().timestamp():.0f}"
        cat = requests.post(f"{BASE}/inventory-categories", headers=h(admin_tok),
                            json={"name": name, "active": True}).json()
        prod = requests.post(f"{BASE}/inventory", headers=h(admin_tok), json={
            "sku": f"TEST-SKU-{datetime.now().timestamp():.0f}",
            "name": "TEST_linked_product", "category_id": cat["id"],
            "cost_price": 1, "selling_price": 2, "stock_qty": 5, "reorder_level": 2, "unit": "pcs"
        }).json()
        r = requests.delete(f"{BASE}/inventory-categories/{cat['id']}", headers=h(admin_tok))
        assert r.status_code == 400
        # cleanup
        requests.delete(f"{BASE}/inventory/{prod['id']}", headers=h(admin_tok))
        requests.delete(f"{BASE}/inventory-categories/{cat['id']}", headers=h(admin_tok))

    def test_delete_empty_succeeds(self, admin_tok):
        name = f"TEST_invcat_del_{datetime.now().timestamp():.0f}"
        cat = requests.post(f"{BASE}/inventory-categories", headers=h(admin_tok),
                            json={"name": name, "active": True}).json()
        r = requests.delete(f"{BASE}/inventory-categories/{cat['id']}", headers=h(admin_tok))
        assert r.status_code == 200

    def test_export_xlsx(self, admin_tok):
        r = requests.get(f"{BASE}/export/inventory-categories", headers=h(admin_tok))
        assert r.status_code == 200
        ct = r.headers.get("content-type", "")
        assert "spreadsheet" in ct or "octet-stream" in ct or "xlsx" in ct.lower()
        assert len(r.content) > 100


# ---------------- Inventory (Products) ----------------
class TestInventoryProducts:
    def test_list_has_category_name_and_reorder(self, admin_tok):
        r = requests.get(f"{BASE}/inventory", headers=h(admin_tok))
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        if rows:
            assert "category_name" in rows[0]
            assert "reorder_level" in rows[0]

    def test_filters_q_status_category(self, admin_tok):
        # Ensure a product exists; capture its sku and category
        all_rows = requests.get(f"{BASE}/inventory", headers=h(admin_tok)).json()
        if not all_rows:
            pytest.skip("No inventory rows available")
        sample = all_rows[0]
        # q filter
        q = (sample.get("sku") or sample.get("name") or "")[:3]
        if q:
            r = requests.get(f"{BASE}/inventory", headers=h(admin_tok), params={"q": q})
            assert r.status_code == 200
            assert isinstance(r.json(), list)
        # status filter
        r = requests.get(f"{BASE}/inventory", headers=h(admin_tok), params={"status": "active"})
        assert r.status_code == 200
        for row in r.json():
            assert row.get("active", True) is not False
        # category filter
        if sample.get("category_id"):
            r = requests.get(f"{BASE}/inventory", headers=h(admin_tok),
                             params={"category_id": sample["category_id"]})
            assert r.status_code == 200
            for row in r.json():
                assert row.get("category_id") == sample["category_id"]

    def test_create_auto_default_category(self, admin_tok):
        r = requests.post(f"{BASE}/inventory", headers=h(admin_tok), json={
            "sku": f"TEST-AUTO-{datetime.now().timestamp():.0f}",
            "name": "TEST_auto_default", "cost_price": 1.5, "selling_price": 3,
            "stock_qty": 10, "reorder_level": 2, "unit": "pcs", "active": True
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("category_id"), "Expected auto-assigned category_id"
        # verify it's the default
        cats = requests.get(f"{BASE}/inventory-categories", headers=h(admin_tok)).json()
        default = next(c for c in cats if c.get("is_default") or c["name"] == "Uncategorized")
        assert data["category_id"] == default["id"]
        # reorder_level mirrors low_stock_threshold
        assert data.get("low_stock_threshold") == 2
        requests.delete(f"{BASE}/inventory/{data['id']}", headers=h(admin_tok))

    def test_patch_updates_new_fields(self, admin_tok):
        prod = requests.post(f"{BASE}/inventory", headers=h(admin_tok), json={
            "sku": f"TEST-PATCH-{datetime.now().timestamp():.0f}",
            "name": "TEST_patch", "cost_price": 1, "selling_price": 2,
            "stock_qty": 5, "reorder_level": 3, "unit": "pcs"
        }).json()
        r = requests.patch(f"{BASE}/inventory/{prod['id']}", headers=h(admin_tok), json={
            "sku": prod["sku"], "name": "TEST_patch_upd", "cost_price": 2,
            "selling_price": 5, "stock_qty": 20, "reorder_level": 7, "unit": "box"
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == "TEST_patch_upd"
        assert d["reorder_level"] == 7
        assert d["low_stock_threshold"] == 7
        requests.delete(f"{BASE}/inventory/{prod['id']}", headers=h(admin_tok))

    def test_export_inventory_xlsx(self, admin_tok):
        r = requests.get(f"{BASE}/export/inventory", headers=h(admin_tok))
        assert r.status_code == 200
        assert len(r.content) > 100


# ---------------- Service Categories ----------------
class TestServiceCategories:
    def test_list_auth_required(self):
        r = requests.get(f"{BASE}/service-categories")
        assert r.status_code in (401, 403)

    def test_list_with_counts(self, admin_tok):
        r = requests.get(f"{BASE}/service-categories", headers=h(admin_tok))
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        for row in rows:
            assert "service_count" in row

    def test_create_admin_only(self, admin_tok, sales_tok):
        # sales forbidden
        r_sales = requests.post(f"{BASE}/service-categories", headers=h(sales_tok),
                                json={"name": "TEST_svc_sales", "active": True})
        assert r_sales.status_code == 403
        # admin OK
        name = f"TEST_svccat_{datetime.now().timestamp():.0f}"
        r = requests.post(f"{BASE}/service-categories", headers=h(admin_tok),
                          json={"name": name, "active": True})
        assert r.status_code == 200, r.text
        cid = r.json()["id"]
        # cleanup
        requests.delete(f"{BASE}/service-categories/{cid}", headers=h(admin_tok))

    def test_delete_blocked_with_services(self, admin_tok):
        name = f"TEST_svccat_link_{datetime.now().timestamp():.0f}"
        cat = requests.post(f"{BASE}/service-categories", headers=h(admin_tok),
                            json={"name": name, "active": True}).json()
        svc = requests.post(f"{BASE}/services", headers=h(admin_tok), json={
            "category_id": cat["id"], "category": "misc", "pricing_mode": "fixed",
            "name": "TEST_linked_svc", "price": 10, "duration_min": 30
        })
        assert svc.status_code == 200, svc.text
        svc_id = svc.json()["id"]
        r = requests.delete(f"{BASE}/service-categories/{cat['id']}", headers=h(admin_tok))
        assert r.status_code == 400
        requests.delete(f"{BASE}/services/{svc_id}", headers=h(admin_tok))
        requests.delete(f"{BASE}/service-categories/{cat['id']}", headers=h(admin_tok))

    def test_service_accepts_category_id_and_legacy_category(self, admin_tok):
        cat = requests.post(f"{BASE}/service-categories", headers=h(admin_tok),
                            json={"name": f"TEST_svc_legacy_{datetime.now().timestamp():.0f}", "active": True}).json()
        # with category_id
        s1 = requests.post(f"{BASE}/services", headers=h(admin_tok), json={
            "category_id": cat["id"], "category": "misc", "pricing_mode": "fixed",
            "name": "TEST_with_catid", "price": 5, "duration_min": 20
        })
        assert s1.status_code == 200, s1.text
        assert s1.json().get("category_id") == cat["id"]
        # legacy free-form category string (no category_id)
        s2 = requests.post(f"{BASE}/services", headers=h(admin_tok), json={
            "category": "legacy_paint", "pricing_mode": "fixed",
            "name": "TEST_legacy_cat", "price": 5, "duration_min": 20
        })
        assert s2.status_code == 200, s2.text
        # cleanup
        requests.delete(f"{BASE}/services/{s1.json()['id']}", headers=h(admin_tok))
        requests.delete(f"{BASE}/services/{s2.json()['id']}", headers=h(admin_tok))
        requests.delete(f"{BASE}/service-categories/{cat['id']}", headers=h(admin_tok))


# ---------------- Payments Report ----------------
class TestPaymentsReport:
    def test_default_today(self, admin_tok):
        r = requests.get(f"{BASE}/reports/payments", headers=h(admin_tok))
        assert r.status_code == 200, r.text
        data = r.json()
        today = datetime.now(timezone.utc).date().isoformat()
        assert data["filters"]["start"] == today
        assert data["filters"]["end"] == today
        assert "payments" in data and isinstance(data["payments"], list)
        assert "total_amount" in data
        assert "by_method" in data

    def test_filters_date_range(self, admin_tok):
        r = requests.get(f"{BASE}/reports/payments", headers=h(admin_tok),
                         params={"start": "2020-01-01", "end": "2099-12-31"})
        assert r.status_code == 200
        data = r.json()
        # row shape validation
        if data["payments"]:
            row = data["payments"][0]
            for key in ("payment_date", "job_number", "invoice_number", "customer_name",
                        "customer_mobile", "vehicle_plate", "method", "amount",
                        "balance_due", "received_by"):
                assert key in row, f"Missing {key} in payment row"

    def test_method_filter(self, admin_tok):
        r = requests.get(f"{BASE}/reports/payments", headers=h(admin_tok),
                         params={"start": "2020-01-01", "end": "2099-12-31", "method": "cash"})
        assert r.status_code == 200
        for row in r.json()["payments"]:
            assert row["method"] == "cash"

    def test_received_by_filter(self, admin_tok):
        # Get a received_by id from any payment
        all_r = requests.get(f"{BASE}/reports/payments", headers=h(admin_tok),
                             params={"start": "2020-01-01", "end": "2099-12-31"}).json()
        if not all_r["payments"]:
            pytest.skip("No payments to filter by received_by")
        rb = next((p["received_by_id"] for p in all_r["payments"] if p.get("received_by_id")), None)
        if not rb:
            pytest.skip("No recorded_by on any payment")
        r = requests.get(f"{BASE}/reports/payments", headers=h(admin_tok),
                         params={"start": "2020-01-01", "end": "2099-12-31", "received_by": rb})
        assert r.status_code == 200
        for row in r.json()["payments"]:
            assert row["received_by_id"] == rb

    def test_export_xlsx(self, admin_tok):
        r = requests.get(f"{BASE}/reports/payments/export", headers=h(admin_tok),
                         params={"start": "2020-01-01", "end": "2099-12-31"})
        assert r.status_code == 200
        assert len(r.content) > 100
