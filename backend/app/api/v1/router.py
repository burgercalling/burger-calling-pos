from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    categories,
    customers,
    dashboard,
    franchises,
    inventory,
    logs,
    media,
    pos,
    products,
    reports,
    settings,
    stock_requests,
    system,
    users,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(franchises.router)
api_router.include_router(users.router)
api_router.include_router(categories.router)
api_router.include_router(products.router)
api_router.include_router(media.router)
api_router.include_router(inventory.router)
api_router.include_router(stock_requests.router)
api_router.include_router(pos.router)
api_router.include_router(customers.router)
api_router.include_router(dashboard.router)
api_router.include_router(reports.router)
api_router.include_router(settings.router)
api_router.include_router(logs.router)
api_router.include_router(system.router)
