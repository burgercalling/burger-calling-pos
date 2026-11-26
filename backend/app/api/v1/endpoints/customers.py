from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.customer import Customer
from app.models.order import Order
from app.models.user import User, UserRole
from app.schemas.pos import CustomerResponse, OrderResponse

router = APIRouter(prefix="/customers", tags=["Customers"])


@router.get("", response_model=list[CustomerResponse])
def search_customers(
    search: str | None = Query(default=None, max_length=100),
    franchise_id: UUID | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[CustomerResponse]:
    filters = []
    if current_user.role == UserRole.SUPER_ADMIN:
        if franchise_id is not None:
            filters.append(Customer.franchise_id == franchise_id)
    else:
        filters.append(Customer.franchise_id == current_user.franchise_id)

    if search and search.strip():
        term = f"%{search.strip()}%"
        filters.append(or_(Customer.phone.ilike(term), Customer.name.ilike(term)))

    customers = db.scalars(
        select(Customer).where(*filters).order_by(Customer.updated_at.desc()).limit(limit)
    ).all()
    return [CustomerResponse.model_validate(c) for c in customers]


@router.get("/{customer_id}/orders", response_model=list[OrderResponse])
def get_customer_orders(
    customer_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[OrderResponse]:
    customer = db.scalar(select(Customer).where(Customer.id == customer_id))
    if customer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    if current_user.role != UserRole.SUPER_ADMIN and customer.franchise_id != current_user.franchise_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    orders = (
        db.scalars(
            select(Order).options(joinedload(Order.items), joinedload(Order.customer))
            .where(Order.customer_id == customer_id).order_by(Order.created_at.desc()).limit(50)
        ).unique().all()
    )
    return [OrderResponse.model_validate(o) for o in orders]
