from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.main import app
from app.models.inventory import InventoryChangeType, InventoryItem, InventoryTransaction
from app.models.setting import Setting


def _login_superadmin(client: TestClient) -> None:
    res = client.post(
        "/api/v1/auth/superadmin/login",
        json={"username": settings.INITIAL_SUPERADMIN_USERNAME, "password": settings.INITIAL_SUPERADMIN_PASSWORD},
    )
    assert res.status_code == 200, res.text


def test_auth_portal_isolation(client: TestClient) -> None:
    res = client.post(
        "/api/v1/auth/login",
        json={"username": settings.INITIAL_SUPERADMIN_USERNAME, "password": settings.INITIAL_SUPERADMIN_PASSWORD},
    )
    assert res.status_code == 403

    _login_superadmin(client)
    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["role"] == "super_admin"


def test_multi_tenant_isolation_and_stock_and_billing(client: TestClient, db_session: Session) -> None:
    _login_superadmin(client)

    fa = client.post(
        "/api/v1/franchises",
        json={
            "outlet_code": "A", "name": "Burger Calling Alpha",
            "model_type": "Signature Restaurant", "city": "Jabalpur",
            "address": "Civil Lines", "phone": "9876543210",
        },
    ).json()
    fb = client.post(
        "/api/v1/franchises",
        json={
            "outlet_code": "B", "name": "Burger Calling Beta",
            "model_type": "Express Kiosk", "city": "Bhopal",
            "address": "MP Nagar", "phone": "9876543211",
        },
    ).json()

    client.post("/api/v1/users", json={"franchise_id": fa["id"], "full_name": "Owner A", "username": "owner_a", "password": "Password123!", "role": "franchise_owner"})
    client.post("/api/v1/users", json={"franchise_id": fb["id"], "full_name": "Owner B", "username": "owner_b", "password": "Password123!", "role": "franchise_owner"})
    client.post("/api/v1/users", json={"franchise_id": fa["id"], "full_name": "Cashier A", "username": "cashier_a", "password": "Password123!", "role": "cashier"})

    cat = client.post("/api/v1/categories", json={"name": "Burgers", "display_order": 1}).json()
    prod = client.post("/api/v1/products", json={"category_id": cat["id"], "name": "Classic Veg Burger", "price": 100.00, "item_type": "regular", "is_available": True}).json()

    inv_a = client.post("/api/v1/inventory/items", json={"franchise_id": fa["id"], "broadcast_all_active": False, "item_name": "Veg Patties", "unit": "pcs", "opening_stock": 50, "reorder_level": 10}).json()["items"][0]
    inv_b = client.post("/api/v1/inventory/items", json={"franchise_id": fb["id"], "broadcast_all_active": False, "item_name": "Veg Patties", "unit": "pcs", "opening_stock": 40, "reorder_level": 10}).json()["items"][0]

    client.post("/api/v1/auth/login", json={"username": "owner_a", "password": "Password123!"})
    forbidden_adj = client.post(f"/api/v1/inventory/items/{inv_b['id']}/adjust", json={"change_type": "manual_adjust", "quantity_delta": 5, "remarks": "Cross tenant"})
    assert forbidden_adj.status_code == 403

    sr = client.post("/api/v1/stock-requests", json={"items": [{"inventory_item_id": inv_a["id"], "requested_qty": 25}], "remarks": "Need patties"})
    assert sr.status_code == 201
    sr_id = sr.json()["id"]

    _login_superadmin(client)
    assert client.patch(f"/api/v1/stock-requests/{sr_id}/review", json={"decision": "approved"}).status_code == 200
    assert client.patch(f"/api/v1/stock-requests/{sr_id}/status", json={"next_status": "packed"}).status_code == 200
    assert client.patch(f"/api/v1/stock-requests/{sr_id}/status", json={"next_status": "dispatched"}).status_code == 200
    assert client.patch(f"/api/v1/stock-requests/{sr_id}/status", json={"next_status": "delivered"}).status_code == 200

    db_session.expire_all()
    refreshed_inv_a = db_session.scalar(select(InventoryItem).where(InventoryItem.id == inv_a["id"]))
    assert refreshed_inv_a is not None and refreshed_inv_a.current_stock == Decimal("75.00")

    tx = db_session.scalar(select(InventoryTransaction).where(InventoryTransaction.inventory_item_id == inv_a["id"], InventoryTransaction.change_type == InventoryChangeType.REQUEST_DELIVERED))
    assert tx is not None and tx.quantity_delta == Decimal("25.00")

    def place_order_worker() -> str:
        with TestClient(app) as c:
            c.post("/api/v1/auth/login", json={"username": "cashier_a", "password": "Password123!"})
            r = c.post("/api/v1/pos/orders", json={"order_type": "dine_in", "payment_mode": "upi", "items": [{"product_id": prod["id"], "quantity": 1}], "discount_type": "none", "discount_value": 0, "print_kot": True})
            assert r.status_code == 201, r.text
            body = r.json()
            assert Decimal(body["order"]["tax_amount"]) == Decimal("0.00")
            return body["order"]["bill_number"]

    with ThreadPoolExecutor(max_workers=5) as pool:
        bill_numbers = list(pool.map(lambda _: place_order_worker(), range(5)))

    assert len(set(bill_numbers)) == 5
    assert sorted(int(bn.split("-")[-1]) for bn in bill_numbers) == [1, 2, 3, 4, 5]

    outlet_a_setting = db_session.scalar(select(Setting).where(Setting.franchise_id == fa["id"]))
    assert outlet_a_setting is not None
    outlet_a_setting.tax_enabled = True
    outlet_a_setting.tax_rate = Decimal("5.00")
    db_session.commit()

    client.post("/api/v1/auth/login", json={"username": "cashier_a", "password": "Password123!"})
    gst_order = client.post("/api/v1/pos/orders", json={"order_type": "takeaway", "payment_mode": "cash", "items": [{"product_id": prod["id"], "quantity": 2}], "discount_type": "none", "discount_value": 0, "print_kot": False})
    assert gst_order.status_code == 201
    order_data = gst_order.json()["order"]
    assert Decimal(order_data["subtotal"]) == Decimal("200.00")
    assert Decimal(order_data["tax_amount"]) == Decimal("10.00")
    assert Decimal(order_data["grand_total"]) == Decimal("210.00")
