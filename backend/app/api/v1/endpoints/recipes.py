from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.activity_log import ActivityLog
from app.models.product import Product
from app.models.recipe import ProductRecipe
from app.models.user import User, UserRole
from app.schemas.menu import ProductRecipeUpdate, RecipeItemResponse
from app.services.audit import get_client_ip, record_audit_log

router = APIRouter(prefix="/recipes", tags=["Product Recipes (BOM)"])


@router.get("/{product_id}", response_model=list[RecipeItemResponse])
def get_product_recipe(
    product_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[RecipeItemResponse]:
    product = db.scalar(select(Product.id).where(Product.id == product_id, Product.deleted_at.is_(None)))
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    rows = db.scalars(
        select(ProductRecipe)
        .where(ProductRecipe.product_id == product_id)
        .order_by(ProductRecipe.ingredient_name.asc())
    ).all()
    return [RecipeItemResponse.model_validate(r) for r in rows]


@router.put("/{product_id}", response_model=list[RecipeItemResponse])
def update_product_recipe(
    product_id: UUID,
    payload: ProductRecipeUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.SUPER_ADMIN)),
) -> list[RecipeItemResponse]:
    product = db.scalar(select(Product).where(Product.id == product_id, Product.deleted_at.is_(None)))
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    old_rows = db.scalars(
        select(ProductRecipe).where(ProductRecipe.product_id == product_id)
    ).all()
    old_snapshot = [
        {
            "ingredient_name": r.ingredient_name,
            "quantity_required": str(r.quantity_required),
            "unit": r.unit,
        }
        for r in old_rows
    ]

    # Deduplicate ingredients case-insensitively
    deduped: dict[str, tuple[str, str, str]] = {}
    for item in payload.items:
        key = item.ingredient_name.strip().lower()
        deduped[key] = (item.ingredient_name.strip(), item.quantity_required, item.unit.strip().lower())

    db.execute(delete(ProductRecipe).where(ProductRecipe.product_id == product_id))
    new_rows: list[ProductRecipe] = []
    for ing_name, qty, unit in deduped.values():
        row = ProductRecipe(
            product_id=product_id,
            ingredient_name=ing_name,
            quantity_required=qty,
            unit=unit,
        )
        db.add(row)
        new_rows.append(row)

    db.flush()

    new_snapshot = [
        {
            "ingredient_name": r.ingredient_name,
            "quantity_required": str(r.quantity_required),
            "unit": r.unit,
        }
        for r in new_rows
    ]

    record_audit_log(
        db,
        actor_user_id=current_user.id,
        franchise_id=None,
        action="UPDATE_RECIPE",
        entity_type="product_recipe",
        entity_id=product_id,
        old_values={"items": old_snapshot},
        new_values={"items": new_snapshot},
        ip_address=get_client_ip(request),
    )
    db.add(
        ActivityLog(
            franchise_id=None,
            user_id=current_user.id,
            event_type="RECIPE_UPDATED",
            description=f"Updated BOM recipe for '{product.name}' ({len(new_rows)} ingredients)",
            ip_address=get_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
        )
    )
    db.commit()
    for r in new_rows:
        db.refresh(r)

    return [RecipeItemResponse.model_validate(r) for r in new_rows]
