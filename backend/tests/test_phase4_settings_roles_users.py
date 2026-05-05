"""
Phase 4 – Settings: Roles, Users (mobile-login), Vehicle Brand/Model
management, System Settings (toggles + integrations + secret masking).

Run:
  pytest /app/backend/tests/test_phase4_settings_roles_users.py -v
"""
import os
import time
import pytest
import requests

_url = os.environ.get("REACT_APP_BACKEND_URL")
if not _url:
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    _url = line.split("=", 1)[1].strip()
                    break
    except Exception:
        pass
assert _url, "REACT_APP_BACKEND_URL must be set"
BASE_URL = _url.rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@autocrm.kw", "password": "admin123"}
SALES = {"email": "sales@autocrm.kw", "password": "sales123"}


# ---------------- shared fixtures ----------------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=20)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def sales_token():
    r = requests.post(f"{API}/auth/login", json=SALES, timeout=20)
    if r.status_code != 200:
        pytest.skip("sales login unavailable")
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_client(admin_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {admin_token}",
                      "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def sales_client(sales_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {sales_token}",
                      "Content-Type": "application/json"})
    return s


# ---------------- AUTH / PERMISSIONS ----------------
class TestAuth:
    def test_login_admin_email_returns_master_and_permissions(self):
        r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert "token" in body and "user" in body
        u = body["user"]
        assert u.get("is_master") is True, "admin should be is_master=true"
        perms = u.get("permissions") or {}
        # All 14 permission keys present and true for master
        expected = ["dashboard", "customers", "segments", "vehicles", "quotations", "jobs",
                    "inventory_categories", "inventory_products", "services", "reports",
                    "settings_roles", "settings_users", "settings_vehicle_management", "system_settings"]
        for k in expected:
            assert k in perms, f"missing permission key {k}"
            assert perms[k] is True, f"master must have {k}=true"

    def test_auth_me_returns_permissions(self, admin_client):
        r = admin_client.get(f"{API}/auth/me", timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert "permissions" in body
        assert len(body["permissions"]) == 14

    def test_permission_keys_endpoint(self, admin_client):
        r = admin_client.get(f"{API}/permission-keys", timeout=20)
        assert r.status_code == 200
        keys = r.json()
        assert isinstance(keys, list)
        assert len(keys) == 14
        assert "system_settings" in keys
        assert "dashboard" in keys


# ---------------- ROLES ----------------
class TestRoles:
    created_role_ids: list = []

    def test_administrator_role_seeded(self, admin_client):
        r = admin_client.get(f"{API}/roles", timeout=20)
        assert r.status_code == 200
        roles = r.json()
        admin_role = next((x for x in roles if x["name"].lower() == "administrator"), None)
        assert admin_role is not None, "Administrator role must be auto-seeded"
        # All 14 keys true
        for k, v in admin_role["permissions"].items():
            assert v is True, f"Administrator perm {k} should be true"
        assert len(admin_role["permissions"]) == 14
        assert admin_role.get("user_count", 0) >= 1

    def test_create_role_admin_only(self, admin_client):
        name = f"TEST_role_{int(time.time()*1000)}"
        body = {"name": name, "description": "test",
                "permissions": {"customers": True, "jobs": True}}
        r = admin_client.post(f"{API}/roles", json=body, timeout=20)
        assert r.status_code == 200, r.text
        role = r.json()
        assert role["permissions"]["customers"] is True
        assert role["permissions"]["jobs"] is True
        # Other keys should be false (merged with PERMISSION_KEYS defaults)
        assert role["permissions"]["system_settings"] is False
        assert len(role["permissions"]) == 14
        TestRoles.created_role_ids.append(role["id"])

    def test_patch_role_updates_permissions(self, admin_client):
        assert TestRoles.created_role_ids, "depends on test_create_role_admin_only"
        rid = TestRoles.created_role_ids[0]
        upd = {"name": f"TEST_role_renamed_{int(time.time())}",
               "description": "renamed",
               "permissions": {"customers": True, "jobs": True, "reports": True}}
        r = admin_client.patch(f"{API}/roles/{rid}", json=upd, timeout=20)
        assert r.status_code == 200
        role = r.json()
        assert role["permissions"]["reports"] is True

    def test_delete_role_blocked_when_users_assigned(self, admin_client):
        # Find the Administrator role (has users assigned)
        roles = admin_client.get(f"{API}/roles", timeout=20).json()
        admin_role = next(x for x in roles if x["name"].lower() == "administrator")
        r = admin_client.delete(f"{API}/roles/{admin_role['id']}", timeout=20)
        assert r.status_code == 400, f"should block delete; got {r.status_code} {r.text}"

    def test_delete_unused_role_succeeds(self, admin_client):
        # Create a fresh empty role and delete it
        body = {"name": f"TEST_role_del_{int(time.time()*1000)}",
                "permissions": {"dashboard": True}}
        r = admin_client.post(f"{API}/roles", json=body, timeout=20)
        rid = r.json()["id"]
        d = admin_client.delete(f"{API}/roles/{rid}", timeout=20)
        assert d.status_code == 200

    @classmethod
    def teardown_class(cls):
        # Best-effort cleanup
        try:
            tok = requests.post(f"{API}/auth/login", json=ADMIN).json().get("token")
            h = {"Authorization": f"Bearer {tok}"}
            for rid in cls.created_role_ids:
                requests.delete(f"{API}/roles/{rid}", headers=h)
        except Exception:
            pass


# ---------------- USERS (mobile login) ----------------
class TestUsers:
    created_user_ids: list = []
    test_mobile = f"+96588{int(time.time()) % 1000000:06d}"
    test_password = "temp123"

    def test_create_user_with_mobile_and_login(self, admin_client):
        # Get Administrator role id
        roles = admin_client.get(f"{API}/roles").json()
        role_id = next(x for x in roles if x["name"].lower() == "administrator")["id"]

        body = {
            "first_name": "TestPhase4",
            "last_name": "MobileUser",
            "mobile": TestUsers.test_mobile,
            "role_id": role_id,
            "password": TestUsers.test_password,
        }
        r = admin_client.post(f"{API}/users", json=body, timeout=20)
        assert r.status_code == 200, r.text
        u = r.json()
        assert u["mobile"] == TestUsers.test_mobile
        assert u["role_id"] == role_id
        assert "password" not in u
        TestUsers.created_user_ids.append(u["id"])

        # Now login with mobile
        login_resp = requests.post(f"{API}/auth/login",
                                   json={"mobile": TestUsers.test_mobile,
                                         "password": TestUsers.test_password},
                                   timeout=20)
        assert login_resp.status_code == 200, f"mobile login failed: {login_resp.text}"
        body2 = login_resp.json()
        assert body2["user"]["mobile"] == TestUsers.test_mobile

        # Login with mobile in 'email' field also works (per spec)
        alt = requests.post(f"{API}/auth/login",
                            json={"email": TestUsers.test_mobile,
                                  "password": TestUsers.test_password},
                            timeout=20)
        assert alt.status_code == 200, "mobile-in-email-field login should also work"

    def test_non_master_cannot_grant_master(self, admin_client):
        """Verify the 403 logic when non-master tries to grant master.
        We need a non-master admin client. Use the user we just created
        (role=sales/admin legacy) — but wait, our new user is_master=false.
        Login as that user (legacy role='sales' default) and try PATCH.
        Note: PATCH /users requires role='admin' so 'sales' user gets 403
        on the route itself. We instead test via response from admin: admin
        is master, so this call SUCCEEDS. The 403 only triggers when the
        caller lacks is_master. We simulate this with the sales seed user.
        """
        # Sales legacy user has role='sales' and require_roles('admin') will 403.
        # Better: test directly by checking the guard works. Login as a
        # newly created non-master user with role='admin' legacy.
        roles = admin_client.get(f"{API}/roles").json()
        role_id = next(x for x in roles if x["name"].lower() == "administrator")["id"]
        m = f"+96577{int(time.time()*1000) % 10000000:07d}"
        body = {
            "first_name": "TEST_NM", "last_name": "Admin",
            "mobile": m, "role_id": role_id,
            "password": "pw12345", "role": "admin",  # legacy role admin, not master
        }
        r = admin_client.post(f"{API}/users", json=body, timeout=20)
        assert r.status_code == 200
        new_uid = r.json()["id"]
        TestUsers.created_user_ids.append(new_uid)

        # Login as that user
        lr = requests.post(f"{API}/auth/login",
                           json={"mobile": m, "password": "pw12345"}, timeout=20)
        assert lr.status_code == 200
        non_master_token = lr.json()["token"]
        nm_headers = {"Authorization": f"Bearer {non_master_token}",
                      "Content-Type": "application/json"}

        # Try to grant master to themselves
        patch = requests.patch(f"{API}/users/{new_uid}",
                               json={"is_master": True},
                               headers=nm_headers, timeout=20)
        assert patch.status_code == 403, f"non-master should not grant master, got {patch.status_code} {patch.text}"

    def test_delete_last_master_blocked(self, admin_client):
        # Find admin@autocrm.kw user id
        users = admin_client.get(f"{API}/users").json()
        admin_user = next((u for u in users if u.get("email") == "admin@autocrm.kw"), None)
        assert admin_user, "admin user must exist"
        # Count masters first
        masters = [u for u in users if u.get("is_master")]
        if len(masters) > 1:
            pytest.skip("More than one master exists; cannot test last-master block")
        r = admin_client.delete(f"{API}/users/{admin_user['id']}", timeout=20)
        assert r.status_code == 400, f"deleting last master should 400, got {r.status_code}"

    @classmethod
    def teardown_class(cls):
        try:
            tok = requests.post(f"{API}/auth/login", json=ADMIN).json().get("token")
            h = {"Authorization": f"Bearer {tok}"}
            for uid in cls.created_user_ids:
                requests.delete(f"{API}/users/{uid}", headers=h)
        except Exception:
            pass


# ---------------- VEHICLE BRANDS / MODELS ----------------
class TestVehicleBrandsModels:
    created_brand_id = None
    created_model_id = None
    brand_name = f"TEST_Brand_{int(time.time()*1000) % 1000000}"
    model_name = "TEST_Model_X"

    def test_create_brand(self, admin_client):
        r = admin_client.get(f"{API}/vehicle-brands", timeout=20)
        assert r.status_code == 200
        r = admin_client.post(f"{API}/vehicle-brands",
                              json={"name": self.brand_name}, timeout=20)
        assert r.status_code == 200, r.text
        TestVehicleBrandsModels.created_brand_id = r.json()["id"]

    def test_duplicate_brand_400(self, admin_client):
        r = admin_client.post(f"{API}/vehicle-brands",
                              json={"name": self.brand_name}, timeout=20)
        assert r.status_code == 400

    def test_patch_brand(self, admin_client):
        bid = TestVehicleBrandsModels.created_brand_id
        new_name = self.brand_name + "_renamed"
        r = admin_client.patch(f"{API}/vehicle-brands/{bid}",
                               json={"name": new_name, "active": True}, timeout=20)
        assert r.status_code == 200
        assert r.json()["name"] == new_name
        TestVehicleBrandsModels.brand_name = new_name

    def test_create_model(self, admin_client):
        bid = TestVehicleBrandsModels.created_brand_id
        r = admin_client.post(f"{API}/vehicle-models",
                              json={"brand_id": bid, "name": self.model_name,
                                    "vehicle_type": "sedan"}, timeout=20)
        assert r.status_code == 200, r.text
        TestVehicleBrandsModels.created_model_id = r.json()["id"]
        assert r.json()["brand_name"] == TestVehicleBrandsModels.brand_name

    def test_delete_brand_blocked_when_models_exist(self, admin_client):
        bid = TestVehicleBrandsModels.created_brand_id
        r = admin_client.delete(f"{API}/vehicle-brands/{bid}", timeout=20)
        assert r.status_code == 400

    def test_delete_model_blocked_when_vehicle_uses_it(self, admin_client):
        # Create a customer + vehicle that uses make=brand_name, model=model_name
        cust = admin_client.post(f"{API}/customers", json={
            "name": "TEST_phase4_brand_lock", "mobile": f"+96599{int(time.time()) % 1000000:06d}",
            "vehicles": [{
                "vehicle_type": "sedan",
                "make": TestVehicleBrandsModels.brand_name,
                "model": TestVehicleBrandsModels.model_name,
            }]
        }, timeout=20)
        assert cust.status_code == 200, cust.text
        cid = cust.json()["id"]
        try:
            mid = TestVehicleBrandsModels.created_model_id
            r = admin_client.delete(f"{API}/vehicle-models/{mid}", timeout=20)
            assert r.status_code == 400, f"model in use; expected 400, got {r.status_code}"
        finally:
            # Clean up customer (and its vehicles)
            admin_client.delete(f"{API}/customers/{cid}", timeout=20)

    def test_delete_model_then_brand(self, admin_client):
        mid = TestVehicleBrandsModels.created_model_id
        r = admin_client.delete(f"{API}/vehicle-models/{mid}", timeout=20)
        assert r.status_code == 200
        bid = TestVehicleBrandsModels.created_brand_id
        r = admin_client.delete(f"{API}/vehicle-brands/{bid}", timeout=20)
        assert r.status_code == 200


# ---------------- SYSTEM SETTINGS ----------------
class TestSystemSettings:
    def test_get_settings_authed_user_has_toggles(self, sales_client):
        # Sales is authed but not master
        r = sales_client.get(f"{API}/system-settings", timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert "toggles" in body
        assert body.get("is_master") is False

    def test_get_settings_admin_is_master(self, admin_client):
        r = admin_client.get(f"{API}/system-settings", timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert body.get("is_master") is True
        t = body["toggles"]
        # Conservative defaults
        assert t["payment_cash"] is True
        assert t["payment_knet"] is True
        assert t["payment_card"] is True
        assert t["payment_bank_transfer"] is False
        assert t["payment_other"] is False
        assert t["payment_gateway_enabled"] is False
        assert t["whatsapp_enabled"] is False
        assert t["email_smtp_enabled"] is False

    def test_put_toggles_non_master_403(self, sales_client):
        r = sales_client.put(f"{API}/system-settings/toggles", json={
            "payment_cash": True, "payment_knet": True, "payment_card": True,
            "payment_bank_transfer": True, "payment_other": True,
            "payment_gateway_enabled": False, "whatsapp_enabled": False, "email_smtp_enabled": False
        }, timeout=20)
        assert r.status_code == 403

    def test_put_toggles_master_ok_and_persist(self, admin_client):
        payload = {
            "payment_cash": True, "payment_knet": True, "payment_card": True,
            "payment_bank_transfer": False, "payment_other": False,
            "payment_gateway_enabled": False, "whatsapp_enabled": True, "email_smtp_enabled": False
        }
        r = admin_client.put(f"{API}/system-settings/toggles", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        # Re-read
        r2 = admin_client.get(f"{API}/system-settings", timeout=20).json()
        assert r2["toggles"]["whatsapp_enabled"] is True
        # Reset whatsapp to false to keep environment clean for follow-up tests
        admin_client.put(f"{API}/system-settings/toggles",
                         json={**payload, "whatsapp_enabled": False}, timeout=20)

    def test_unknown_integration_400(self, admin_client):
        r = admin_client.put(f"{API}/system-settings/integrations/unknownx",
                             json={"enabled": True, "fields": {}}, timeout=20)
        assert r.status_code == 400

    def test_tap_integration_secret_masking_and_preservation(self, admin_client):
        # 1) Set actual secret
        r = admin_client.put(f"{API}/system-settings/integrations/tap", json={
            "enabled": True,
            "fields": {"api_key": "xyz123abcdef", "secret_key": "sec_999_realvalue"}
        }, timeout=20)
        assert r.status_code == 200, r.text
        masked = r.json()
        # Returned values should be masked
        assert "•" in str(masked["fields"]["api_key"]) or "*" in str(masked["fields"]["api_key"])
        assert "•" in str(masked["fields"]["secret_key"])
        # Real value (full) should not be returned
        assert masked["fields"]["api_key"] != "xyz123abcdef"
        assert masked["fields"]["secret_key"] != "sec_999_realvalue"

        # 2) GET still returns masked
        r2 = admin_client.get(f"{API}/system-settings", timeout=20).json()
        tap = r2["integrations"]["tap"]
        assert "•" in str(tap["fields"]["api_key"])
        assert "•" in str(tap["fields"]["secret_key"])

        # 3) Resending masked value should preserve original (not overwrite)
        masked_api_key = tap["fields"]["api_key"]  # masked
        r3 = admin_client.put(f"{API}/system-settings/integrations/tap", json={
            "enabled": True,
            "fields": {"api_key": masked_api_key, "secret_key": "sec_999_realvalue_NEW"}
        }, timeout=20)
        assert r3.status_code == 200
        # secret_key was sent without •, so it should be replaced. api_key should be preserved.
        # We can verify preservation only indirectly: send a fresh secret then masked again,
        # then check that toggling the integration off/on doesn't lose the original.
        # Direct verification: use a debug-by-roundtrip — set api_key to a known plaintext, mask it,
        # then resend masked alongside changing only enabled. If original preserved, no error
        # and field reads back masked with the same length pattern.
        r4 = admin_client.put(f"{API}/system-settings/integrations/tap", json={
            "enabled": False,
            "fields": {"api_key": masked_api_key}
        }, timeout=20)
        assert r4.status_code == 200
        assert r4.json()["enabled"] is False
        # api_key still masked but length matches a 12-char original "xyz123abcdef" → first2 + 6• + last4
        assert r4.json()["fields"]["api_key"].endswith("cdef"), \
            f"original api_key not preserved; got {r4.json()['fields']['api_key']}"
