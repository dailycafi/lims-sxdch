from typing import List, Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.storage import StorageFreezer, StorageShelf, StorageRack, StorageBox
from app.models.user import User, UserRole
from app.api.v1.endpoints.auth import get_current_user
from pydantic import BaseModel

router = APIRouter()

# --- Pydantic Models ---
class FreezerCreate(BaseModel):
    name: str
    location: Optional[str] = None
    temperature: Optional[float] = None
    description: Optional[str] = None
    total_shelves: int = 0

class FreezerResponse(FreezerCreate):
    id: int
    is_active: bool

class ShelfCreate(BaseModel):
    freezer_id: int
    name: str
    level_order: int

class RackCreate(BaseModel):
    shelf_id: int
    name: str
    row_capacity: Optional[int] = 5
    col_capacity: Optional[int] = 5

class BoxCreate(BaseModel):
    rack_id: int
    name: str
    barcode: str
    box_type: str = "9x9"
    rows: int = 9
    cols: int = 9

# --- Endpoints ---

@router.get("/freezers", response_model=List[FreezerResponse])
async def list_freezers(
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """List all freezers"""
    result = await db.execute(select(StorageFreezer).order_by(StorageFreezer.name))
    return result.scalars().all()

@router.post("/freezers", response_model=FreezerResponse)
async def create_freezer(
    freezer: FreezerCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """Create a new freezer"""
    # Check if name exists
    exists = await db.execute(select(StorageFreezer).where(StorageFreezer.name == freezer.name))
    if exists.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Freezer name already exists")
        
    db_freezer = StorageFreezer(**freezer.model_dump())
    db.add(db_freezer)
    await db.commit()
    await db.refresh(db_freezer)
    
    # Auto-create shelves if specified
    if freezer.total_shelves > 0:
        shelves = []
        for i in range(1, freezer.total_shelves + 1):
            shelf = StorageShelf(
                freezer_id=db_freezer.id,
                name=f"Layer {i}",
                barcode=f"{freezer.name}-L{i}", # Auto-generate barcode
                level_order=i
            )
            shelves.append(shelf)
        db.add_all(shelves)
        await db.commit()
        
    return db_freezer

@router.get("/freezers/{freezer_id}")
async def get_freezer_details(
    freezer_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """Get freezer with hierarchy"""
    result = await db.execute(
        select(StorageFreezer)
        .options(
            selectinload(StorageFreezer.shelves)
            .selectinload(StorageShelf.racks)
        )
        .where(StorageFreezer.id == freezer_id)
    )
    freezer = result.scalar_one_or_none()
    if not freezer:
        raise HTTPException(status_code=404, detail="Freezer not found")
    return freezer

@router.get("/find-by-barcode/{barcode}")
async def find_storage_by_barcode(
    barcode: str,
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """Find storage entity by barcode"""
    # 1. Try Box
    result = await db.execute(select(StorageBox).where(StorageBox.barcode == barcode))
    box = result.scalar_one_or_none()
    if box:
        return {"type": "box", "data": box, "id": box.id}

    # 2. Try Rack
    result = await db.execute(select(StorageRack).where(StorageRack.barcode == barcode))
    rack = result.scalar_one_or_none()
    if rack:
        return {"type": "rack", "data": rack, "id": rack.id}

    # 3. Try Shelf
    result = await db.execute(select(StorageShelf).where(StorageShelf.barcode == barcode))
    shelf = result.scalar_one_or_none()
    if shelf:
        return {"type": "shelf", "data": shelf, "id": shelf.id}

    # 4. Try Freezer
    result = await db.execute(select(StorageFreezer).where(StorageFreezer.barcode == barcode))
    freezer = result.scalar_one_or_none()
    if freezer:
        return {"type": "freezer", "data": freezer, "id": freezer.id}
        
    # 5. Try Freezer Name (fallback)
    result = await db.execute(select(StorageFreezer).where(StorageFreezer.name == barcode))
    freezer = result.scalar_one_or_none()
    if freezer:
        return {"type": "freezer", "data": freezer, "id": freezer.id}

    raise HTTPException(status_code=404, detail="Barcode not found")


@router.post("/shelves")
async def create_shelf(
    shelf: ShelfCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    db_shelf = StorageShelf(**shelf.model_dump())
    db.add(db_shelf)
    await db.commit()
    await db.refresh(db_shelf)
    return db_shelf

@router.post("/racks")
async def create_rack(
    rack: RackCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    db_rack = StorageRack(**rack.model_dump())
    db.add(db_rack)
    await db.commit()
    await db.refresh(db_rack)
    return db_rack

@router.post("/boxes")
async def create_box(
    box: BoxCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    # Check barcode
    exists = await db.execute(select(StorageBox).where(StorageBox.barcode == box.barcode))
    if exists.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Box barcode already exists")
        
    db_box = StorageBox(**box.model_dump())
    db.add(db_box)
    await db.commit()
    await db.refresh(db_box)
    return db_box

@router.post("/boxes/{box_id}/move")
async def move_box(
    box_id: int,
    location_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """Move box to a new rack"""
    rack_id = location_data.get("rack_id")
    if not rack_id:
        raise HTTPException(status_code=400, detail="Target rack_id is required")

    # Find box
    result = await db.execute(select(StorageBox).where(StorageBox.id == box_id))
    box = result.scalar_one_or_none()
    if not box:
        raise HTTPException(status_code=404, detail="Box not found")

    # Find rack
    result = await db.execute(select(StorageRack).where(StorageRack.id == rack_id))
    rack = result.scalar_one_or_none()
    if not rack:
        raise HTTPException(status_code=404, detail="Target rack not found")

    # Update location
    box.rack_id = rack_id
    
    # Also update all samples in this box to reflect the new location
    # Find freezer/shelf info from rack relation
    # Note: This requires complex join or just update sample denormalized fields if we keep them synced
    # For now, let's assume sample location is derived from box relation or we update it here
    
    await db.commit()
    
    return {"message": "Box moved successfully"}
