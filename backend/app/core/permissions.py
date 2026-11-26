from typing import TypedDict

from app.models.user import UserRole


class PermissionDefinition(TypedDict):
    key: str
    label: str
    description: str
    cashier_toggleable: bool


PERMISSION_CATALOG: list[PermissionDefinition] = [
    {
        "key": "pos:create_order",
        "label": "Create POS Orders",
        "description": "Ring up items and complete customer bills",
        "cashier_toggleable": True,
    },
    {
        "key": "pos:print_kot",
        "label": "Enable KOT Printing",
        "description": "Allow printing Kitchen Order Tickets alongside receipts",
        "cashier_toggleable": True,
    },
    {
        "key": "pos:reprint_receipt",
        "label": "Allow Receipt Reprint",
        "description": "Reprint previously settled thermal bills",
        "cashier_toggleable": True,
    },
    {
        "key": "reports:today_sales",
        "label": "View Today's Sales",
        "description": "View current shift and today's outlet revenue summary",
        "cashier_toggleable": True,
    },
    {
        "key": "reports:outlet_analytics",
        "label": "Outlet Analytics & Reports",
        "description": "Access historical sales, item mix, and tax reports",
        "cashier_toggleable": False,
    },
    {
        "key": "inventory:manage",
        "label": "Manage Outlet Inventory",
        "description": "Adjust unit stock levels and submit replenishment requests",
        "cashier_toggleable": False,
    },
    {
        "key": "stock_requests:create",
        "label": "Create Stock Requests",
        "description": "Submit supply replenishment requests to central admin",
        "cashier_toggleable": False,
    },
    {
        "key": "users:manage_cashiers",
        "label": "Manage Outlet Cashiers",
        "description": "Create, disable, and configure cashier permissions",
        "cashier_toggleable": False,
    },
    {
        "key": "settings:manage_outlet",
        "label": "Manage Outlet Settings",
        "description": "Configure thermal printer width, KOT defaults, and footer",
        "cashier_toggleable": False,
    },
]

VALID_PERMISSION_KEYS: set[str] = {item["key"] for item in PERMISSION_CATALOG}
CASHIER_ALLOWED_PERMISSIONS: set[str] = {
    item["key"] for item in PERMISSION_CATALOG if item["cashier_toggleable"]
}

DEFAULT_ROLE_PERMISSIONS: dict[UserRole, list[str]] = {
    UserRole.SUPER_ADMIN: ["*"],
    UserRole.FRANCHISE_OWNER: [
        "pos:create_order",
        "pos:print_kot",
        "pos:reprint_receipt",
        "reports:today_sales",
        "reports:outlet_analytics",
        "inventory:manage",
        "stock_requests:create",
        "users:manage_cashiers",
        "settings:manage_outlet",
    ],
    UserRole.CASHIER: [
        "pos:create_order",
        "pos:print_kot",
    ],
}
