"""
Wallet Routes - Goal-based investment wallets per user.
Phase 1: wallet CRUD and wallet profile management.
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import User, Wallet, WalletHolding, WalletProfile, ETFPrice

router = APIRouter()


class WalletProfileResponse(BaseModel):
    risk_profile: str
    horizon_months: Optional[int] = None
    objective: str
    target_return_min: Optional[float] = None
    target_return_max: Optional[float] = None
    max_drawdown_pct: Optional[float] = None
    liquidity_need: str
    experience_level: str
    source: str

    class Config:
        from_attributes = True


class WalletResponse(BaseModel):
    id: int
    name: str
    purpose: str
    base_currency: str
    is_active: bool
    holdings_count: int = 0
    created_at: datetime
    updated_at: datetime
    profile: Optional[WalletProfileResponse] = None


class CreateWalletRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    purpose: str = Field(default="custom", max_length=64)
    base_currency: str = Field(default="USD", min_length=3, max_length=3)


class UpdateWalletRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=80)
    purpose: Optional[str] = Field(default=None, max_length=64)
    base_currency: Optional[str] = Field(default=None, min_length=3, max_length=3)
    is_active: Optional[bool] = None


class UpsertWalletProfileRequest(BaseModel):
    risk_profile: str = Field(default="balanced", max_length=32)
    horizon_months: Optional[int] = Field(default=None, ge=1, le=600)
    objective: str = Field(default="balanced_growth", max_length=64)
    target_return_min: Optional[float] = Field(default=None, ge=0)
    target_return_max: Optional[float] = Field(default=None, ge=0)
    max_drawdown_pct: Optional[float] = Field(default=None, ge=0, le=100)
    liquidity_need: str = Field(default="medium", max_length=32)
    experience_level: str = Field(default="beginner", max_length=32)
    source: str = Field(default="manual", max_length=32)


class WalletHoldingResponse(BaseModel):
    id: int
    wallet_id: int
    ticker: str
    quantity: float
    avg_cost: Optional[float] = None
    latest_price: Optional[float] = None
    current_value: Optional[float] = None
    added_at: datetime
    updated_at: datetime


def _to_wallet_response(db: Session, wallet: Wallet, include_profile: bool) -> WalletResponse:
    holdings_count = db.query(WalletHolding).filter(WalletHolding.wallet_id == wallet.id).count()
    profile = None

    if include_profile:
        wallet_profile = db.query(WalletProfile).filter(WalletProfile.wallet_id == wallet.id).first()
        if wallet_profile:
            profile = WalletProfileResponse(
                risk_profile=wallet_profile.risk_profile,
                horizon_months=wallet_profile.horizon_months,
                objective=wallet_profile.objective,
                target_return_min=wallet_profile.target_return_min,
                target_return_max=wallet_profile.target_return_max,
                max_drawdown_pct=wallet_profile.max_drawdown_pct,
                liquidity_need=wallet_profile.liquidity_need,
                experience_level=wallet_profile.experience_level,
                source=wallet_profile.source,
            )

    return WalletResponse(
        id=wallet.id,
        name=wallet.name,
        purpose=wallet.purpose,
        base_currency=wallet.base_currency,
        is_active=bool(wallet.is_active),
        holdings_count=holdings_count,
        created_at=wallet.created_at,
        updated_at=wallet.updated_at,
        profile=profile,
    )


@router.post("", response_model=WalletResponse, status_code=status.HTTP_201_CREATED)
async def create_wallet(
    payload: CreateWalletRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    wallet = Wallet(
        user_id=current_user.id,
        name=payload.name.strip(),
        purpose=payload.purpose.strip().lower(),
        base_currency=payload.base_currency.strip().upper(),
        is_active=1,
    )
    db.add(wallet)
    db.flush()

    default_profile = WalletProfile(wallet_id=wallet.id)
    db.add(default_profile)
    db.commit()
    db.refresh(wallet)

    return _to_wallet_response(db, wallet, include_profile=True)


@router.get("", response_model=List[WalletResponse])
async def list_wallets(
    include_inactive: bool = Query(False, description="Include inactive wallets"),
    include_profile: bool = Query(True, description="Include wallet profile"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Wallet).filter(Wallet.user_id == current_user.id)
    if not include_inactive:
        query = query.filter(Wallet.is_active == 1)

    wallets = query.order_by(Wallet.created_at.asc()).all()
    return [_to_wallet_response(db, wallet, include_profile=include_profile) for wallet in wallets]


@router.get("/{wallet_id}", response_model=WalletResponse)
async def get_wallet(
    wallet_id: int,
    include_profile: bool = Query(True, description="Include wallet profile"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    wallet = db.query(Wallet).filter(Wallet.id == wallet_id, Wallet.user_id == current_user.id).first()
    if not wallet:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wallet not found")

    return _to_wallet_response(db, wallet, include_profile=include_profile)


@router.get("/{wallet_id}/holdings", response_model=List[WalletHoldingResponse])
async def get_wallet_holdings(
    wallet_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    wallet = db.query(Wallet).filter(Wallet.id == wallet_id, Wallet.user_id == current_user.id).first()
    if not wallet:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wallet not found")

    holdings = db.query(WalletHolding).filter(WalletHolding.wallet_id == wallet_id).order_by(WalletHolding.added_at.desc()).all()
    response: List[WalletHoldingResponse] = []

    for holding in holdings:
        latest_price_row = db.query(ETFPrice).filter(
            ETFPrice.ticker == holding.ticker
        ).order_by(ETFPrice.date.desc()).first()
        latest_price = latest_price_row.close if latest_price_row else None
        current_value = (latest_price * holding.quantity) if latest_price is not None else None

        response.append(
            WalletHoldingResponse(
                id=holding.id,
                wallet_id=holding.wallet_id,
                ticker=holding.ticker,
                quantity=holding.quantity,
                avg_cost=holding.avg_cost,
                latest_price=latest_price,
                current_value=current_value,
                added_at=holding.added_at,
                updated_at=holding.updated_at,
            )
        )

    return response


@router.patch("/{wallet_id}", response_model=WalletResponse)
async def update_wallet(
    wallet_id: int,
    payload: UpdateWalletRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    wallet = db.query(Wallet).filter(Wallet.id == wallet_id, Wallet.user_id == current_user.id).first()
    if not wallet:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wallet not found")

    if payload.name is not None:
        wallet.name = payload.name.strip()
    if payload.purpose is not None:
        wallet.purpose = payload.purpose.strip().lower()
    if payload.base_currency is not None:
        wallet.base_currency = payload.base_currency.strip().upper()
    if payload.is_active is not None:
        wallet.is_active = 1 if payload.is_active else 0

    db.commit()
    db.refresh(wallet)
    return _to_wallet_response(db, wallet, include_profile=True)


@router.delete("/{wallet_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_wallet(
    wallet_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    wallet = db.query(Wallet).filter(Wallet.id == wallet_id, Wallet.user_id == current_user.id).first()
    if not wallet:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wallet not found")

    wallet.is_active = 0
    db.commit()
    return None


@router.get("/{wallet_id}/profile", response_model=WalletProfileResponse)
async def get_wallet_profile(
    wallet_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    wallet = db.query(Wallet).filter(Wallet.id == wallet_id, Wallet.user_id == current_user.id).first()
    if not wallet:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wallet not found")

    profile = db.query(WalletProfile).filter(WalletProfile.wallet_id == wallet_id).first()
    if not profile:
        profile = WalletProfile(wallet_id=wallet_id)
        db.add(profile)
        db.commit()
        db.refresh(profile)

    return WalletProfileResponse(
        risk_profile=profile.risk_profile,
        horizon_months=profile.horizon_months,
        objective=profile.objective,
        target_return_min=profile.target_return_min,
        target_return_max=profile.target_return_max,
        max_drawdown_pct=profile.max_drawdown_pct,
        liquidity_need=profile.liquidity_need,
        experience_level=profile.experience_level,
        source=profile.source,
    )


@router.put("/{wallet_id}/profile", response_model=WalletProfileResponse)
async def upsert_wallet_profile(
    wallet_id: int,
    payload: UpsertWalletProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    wallet = db.query(Wallet).filter(Wallet.id == wallet_id, Wallet.user_id == current_user.id).first()
    if not wallet:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wallet not found")

    if payload.target_return_min is not None and payload.target_return_max is not None:
        if payload.target_return_min > payload.target_return_max:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="target_return_min cannot be greater than target_return_max",
            )

    profile = db.query(WalletProfile).filter(WalletProfile.wallet_id == wallet_id).first()
    if not profile:
        profile = WalletProfile(wallet_id=wallet_id)
        db.add(profile)

    profile.risk_profile = payload.risk_profile.strip().lower()
    profile.horizon_months = payload.horizon_months
    profile.objective = payload.objective.strip().lower()
    profile.target_return_min = payload.target_return_min
    profile.target_return_max = payload.target_return_max
    profile.max_drawdown_pct = payload.max_drawdown_pct
    profile.liquidity_need = payload.liquidity_need.strip().lower()
    profile.experience_level = payload.experience_level.strip().lower()
    profile.source = payload.source.strip().lower()

    db.commit()
    db.refresh(profile)
    return WalletProfileResponse(
        risk_profile=profile.risk_profile,
        horizon_months=profile.horizon_months,
        objective=profile.objective,
        target_return_min=profile.target_return_min,
        target_return_max=profile.target_return_max,
        max_drawdown_pct=profile.max_drawdown_pct,
        liquidity_need=profile.liquidity_need,
        experience_level=profile.experience_level,
        source=profile.source,
    )
