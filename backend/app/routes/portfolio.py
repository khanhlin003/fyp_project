"""
Portfolio Routes - User's ETF holdings
"""
from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import List, Optional
from datetime import date, datetime

from app.database import SessionLocal
from app.models import User, Portfolio, ETF, ETFPrice, Wallet, WalletHolding
from app.auth import get_current_user

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Request/Response Models
class AddPortfolioItem(BaseModel):
    ticker: str
    quantity: float
    purchase_price: Optional[float] = None
    purchase_date: Optional[date] = None
    wallet_id: Optional[int] = None


class UpdatePortfolioItem(BaseModel):
    quantity: Optional[float] = None
    purchase_price: Optional[float] = None
    purchase_date: Optional[date] = None
    wallet_id: Optional[int] = None


class PortfolioItemResponse(BaseModel):
    id: int
    ticker: str
    wallet_id: Optional[int] = None
    wallet_name: Optional[str] = None
    quantity: float
    purchase_price: Optional[float]
    purchase_date: Optional[date]
    etf_name: Optional[str]
    category: Optional[str]
    current_price: Optional[float]
    current_value: Optional[float]
    gain_loss: Optional[float]
    gain_loss_percent: Optional[float]


class PortfolioSummary(BaseModel):
    total_value: float
    total_cost: float
    total_gain_loss: float
    total_gain_loss_percent: float
    holdings_count: int
    holdings: List[PortfolioItemResponse]


class PortfolioTimeseriesPoint(BaseModel):
    date: date
    invested_capital: float
    market_value: float
    unrealized_pl: float
    unrealized_return_percent: float


def _get_wallet_map_by_ticker(db: Session, user_id: int) -> dict[str, dict[str, Optional[str]]]:
    """Return latest wallet assignment by ticker for a user."""
    rows = db.query(WalletHolding, Wallet).join(
        Wallet, Wallet.id == WalletHolding.wallet_id
    ).filter(
        Wallet.user_id == user_id
    ).all()

    assignments: dict[str, dict[str, Optional[str]]] = {}
    for holding, wallet in rows:
        current = assignments.get(holding.ticker)
        if current is None or (holding.updated_at and current.get("updated_at") and holding.updated_at > current["updated_at"]) or current is None:
            assignments[holding.ticker] = {
                "wallet_id": wallet.id,
                "wallet_name": wallet.name,
                "updated_at": holding.updated_at,
            }

    return assignments


def _validate_user_wallet(db: Session, user_id: int, wallet_id: int) -> Wallet:
    wallet = db.query(Wallet).filter(
        Wallet.id == wallet_id,
        Wallet.user_id == user_id,
        Wallet.is_active == 1,
    ).first()
    if not wallet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wallet not found",
        )
    return wallet


def _sync_wallet_assignment(
    db: Session,
    user_id: int,
    ticker: str,
    quantity: float,
    avg_cost: Optional[float],
    wallet_id: Optional[int],
) -> None:
    user_wallet_ids = [w.id for w in db.query(Wallet).filter(Wallet.user_id == user_id).all()]
    if not user_wallet_ids:
        return

    existing_rows = db.query(WalletHolding).filter(
        WalletHolding.wallet_id.in_(user_wallet_ids),
        WalletHolding.ticker == ticker,
    ).all()
    for row in existing_rows:
        db.delete(row)

    if wallet_id is not None:
        db.add(WalletHolding(
            wallet_id=wallet_id,
            ticker=ticker,
            quantity=quantity,
            avg_cost=avg_cost,
        ))


# Routes
@router.get("", response_model=PortfolioSummary)
async def get_portfolio(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's complete portfolio with current values"""
    
    # Get all portfolio items for user
    portfolio_items = db.query(Portfolio).filter(Portfolio.user_id == current_user.id).all()
    
    holdings = []
    wallet_map = _get_wallet_map_by_ticker(db, current_user.id)
    total_value = 0
    total_cost = 0
    
    for item in portfolio_items:
        # Get ETF details
        etf = db.query(ETF).filter(ETF.ticker == item.ticker).first()
        
        # Get latest price
        latest_price = db.query(ETFPrice).filter(
            ETFPrice.ticker == item.ticker
        ).order_by(ETFPrice.date.desc()).first()
        
        current_price = latest_price.close if latest_price else None
        current_value = (current_price * item.quantity) if current_price else None
        cost_basis = (item.purchase_price * item.quantity) if item.purchase_price else 0
        
        gain_loss = (current_value - cost_basis) if (current_value is not None and cost_basis > 0) else None
        gain_loss_percent = (gain_loss / cost_basis * 100) if (gain_loss is not None and cost_basis > 0) else None
        
        if current_value is not None:
            total_value += current_value
        if cost_basis > 0:
            total_cost += cost_basis
        
        wallet_info = wallet_map.get(item.ticker, {})

        holdings.append(PortfolioItemResponse(
            id=item.id,
            ticker=item.ticker,
            wallet_id=wallet_info.get("wallet_id"),
            wallet_name=wallet_info.get("wallet_name"),
            quantity=item.quantity,
            purchase_price=item.purchase_price,
            purchase_date=item.purchase_date,
            etf_name=etf.etf_name if etf else None,
            category=etf.category if etf else None,
            current_price=current_price,
            current_value=current_value,
            gain_loss=gain_loss,
            gain_loss_percent=gain_loss_percent
        ))
    
    total_gain_loss = total_value - total_cost
    total_gain_loss_percent = (total_gain_loss / total_cost * 100) if total_cost > 0 else 0
    
    return PortfolioSummary(
        total_value=total_value,
        total_cost=total_cost,
        total_gain_loss=total_gain_loss,
        total_gain_loss_percent=total_gain_loss_percent,
        holdings_count=len(holdings),
        holdings=holdings
    )


@router.get("/timeseries", response_model=List[PortfolioTimeseriesPoint])
async def get_portfolio_timeseries(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get daily portfolio market value and invested capital since first purchase date."""

    portfolio_items = db.query(Portfolio).filter(Portfolio.user_id == current_user.id).all()
    if not portfolio_items:
        return []

    tickers = sorted({item.ticker for item in portfolio_items})
    purchase_dates = [item.purchase_date for item in portfolio_items if item.purchase_date]
    if not purchase_dates:
        return []

    min_date = min(purchase_dates)

    price_rows = db.query(ETFPrice.ticker, ETFPrice.date, ETFPrice.close).filter(
        ETFPrice.ticker.in_(tickers),
        ETFPrice.date >= min_date
    ).order_by(ETFPrice.date.asc(), ETFPrice.ticker.asc()).all()

    if not price_rows:
        return []

    updates_by_date = {}
    all_dates = []
    for ticker, px_date, close in price_rows:
        if px_date not in updates_by_date:
            updates_by_date[px_date] = {}
            all_dates.append(px_date)
        updates_by_date[px_date][ticker] = close

    all_dates.sort()

    last_prices = {}
    series: List[PortfolioTimeseriesPoint] = []

    for d in all_dates:
        for ticker, close in updates_by_date[d].items():
            last_prices[ticker] = close

        invested_capital = 0.0
        market_value = 0.0

        for item in portfolio_items:
            buy_date = item.purchase_date or d
            if d < buy_date:
                continue

            cost_price = item.purchase_price or 0.0
            invested_capital += item.quantity * cost_price

            mark_price = last_prices.get(item.ticker)
            if mark_price is None:
                mark_price = cost_price
            market_value += item.quantity * float(mark_price)

        unrealized_pl = market_value - invested_capital
        unrealized_return_percent = (unrealized_pl / invested_capital * 100) if invested_capital > 0 else 0.0

        series.append(
            PortfolioTimeseriesPoint(
                date=d,
                invested_capital=round(invested_capital, 2),
                market_value=round(market_value, 2),
                unrealized_pl=round(unrealized_pl, 2),
                unrealized_return_percent=round(unrealized_return_percent, 4),
            )
        )

    return series


@router.post("", response_model=PortfolioItemResponse, status_code=status.HTTP_201_CREATED)
async def add_to_portfolio(
    item: AddPortfolioItem,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add an ETF to user's portfolio"""
    
    # Validate ticker exists
    etf = db.query(ETF).filter(ETF.ticker == item.ticker.upper()).first()
    if not etf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ETF with ticker '{item.ticker}' not found"
        )
    
    # Check if already in portfolio
    existing = db.query(Portfolio).filter(
        Portfolio.user_id == current_user.id,
        Portfolio.ticker == item.ticker.upper()
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ETF already in portfolio. Use PUT to update."
        )
    
    # Validate quantity
    if item.quantity <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quantity must be greater than 0"
        )

    selected_wallet = None
    if item.wallet_id is not None:
        selected_wallet = _validate_user_wallet(db, current_user.id, item.wallet_id)
    
    # Get current price if purchase_price not provided
    purchase_price = item.purchase_price
    if not purchase_price:
        latest_price = db.query(ETFPrice).filter(
            ETFPrice.ticker == item.ticker.upper()
        ).order_by(ETFPrice.date.desc()).first()
        purchase_price = latest_price.close if latest_price else None
    
    # Create portfolio item
    portfolio_item = Portfolio(
        user_id=current_user.id,
        ticker=item.ticker.upper(),
        quantity=item.quantity,
        purchase_price=purchase_price,
        purchase_date=item.purchase_date or date.today()
    )
    
    db.add(portfolio_item)
    if selected_wallet is not None:
        _sync_wallet_assignment(
            db=db,
            user_id=current_user.id,
            ticker=item.ticker.upper(),
            quantity=item.quantity,
            avg_cost=purchase_price,
            wallet_id=selected_wallet.id,
        )
    db.commit()
    db.refresh(portfolio_item)
    
    # Get latest price for response
    latest_price = db.query(ETFPrice).filter(
        ETFPrice.ticker == portfolio_item.ticker
    ).order_by(ETFPrice.date.desc()).first()
    
    current_price = latest_price.close if latest_price else None
    current_value = (current_price * portfolio_item.quantity) if current_price else None
    cost_basis = (portfolio_item.purchase_price * portfolio_item.quantity) if portfolio_item.purchase_price else 0
    gain_loss = (current_value - cost_basis) if (current_value is not None and cost_basis > 0) else None
    gain_loss_percent = (gain_loss / cost_basis * 100) if (gain_loss is not None and cost_basis > 0) else None
    wallet_info = _get_wallet_map_by_ticker(db, current_user.id).get(portfolio_item.ticker, {})

    wallet_info = _get_wallet_map_by_ticker(db, current_user.id).get(portfolio_item.ticker, {})
    
    return PortfolioItemResponse(
        id=portfolio_item.id,
        ticker=portfolio_item.ticker,
        wallet_id=wallet_info.get("wallet_id"),
        wallet_name=wallet_info.get("wallet_name"),
        quantity=portfolio_item.quantity,
        purchase_price=portfolio_item.purchase_price,
        purchase_date=portfolio_item.purchase_date,
        etf_name=etf.etf_name,
        category=etf.category,
        current_price=current_price,
        current_value=current_value,
        gain_loss=gain_loss,
        gain_loss_percent=gain_loss_percent
    )


@router.put("/{ticker}", response_model=PortfolioItemResponse)
async def update_portfolio_item(
    ticker: str,
    item: UpdatePortfolioItem,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an ETF in user's portfolio"""
    
    portfolio_item = db.query(Portfolio).filter(
        Portfolio.user_id == current_user.id,
        Portfolio.ticker == ticker.upper()
    ).first()
    
    if not portfolio_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ETF '{ticker}' not in portfolio"
        )
    
    if item.quantity is not None:
        if item.quantity <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Quantity must be greater than 0"
            )
        portfolio_item.quantity = item.quantity
    
    if item.purchase_price is not None:
        portfolio_item.purchase_price = item.purchase_price
    
    if item.purchase_date is not None:
        portfolio_item.purchase_date = item.purchase_date

    selected_wallet = None
    if item.wallet_id is not None:
        selected_wallet = _validate_user_wallet(db, current_user.id, item.wallet_id)

    final_quantity = portfolio_item.quantity
    final_avg_cost = portfolio_item.purchase_price

    if selected_wallet is not None:
        _sync_wallet_assignment(
            db=db,
            user_id=current_user.id,
            ticker=portfolio_item.ticker,
            quantity=final_quantity,
            avg_cost=final_avg_cost,
            wallet_id=selected_wallet.id,
        )
    else:
        wallet_map = _get_wallet_map_by_ticker(db, current_user.id)
        existing_wallet_id = wallet_map.get(portfolio_item.ticker, {}).get("wallet_id")
        if existing_wallet_id is not None:
            _sync_wallet_assignment(
                db=db,
                user_id=current_user.id,
                ticker=portfolio_item.ticker,
                quantity=final_quantity,
                avg_cost=final_avg_cost,
                wallet_id=int(existing_wallet_id),
            )
    
    db.commit()
    db.refresh(portfolio_item)
    
    # Get ETF and price for response
    etf = db.query(ETF).filter(ETF.ticker == portfolio_item.ticker).first()
    latest_price = db.query(ETFPrice).filter(
        ETFPrice.ticker == portfolio_item.ticker
    ).order_by(ETFPrice.date.desc()).first()
    
    current_price = latest_price.close if latest_price else None
    current_value = (current_price * portfolio_item.quantity) if current_price else None
    cost_basis = (portfolio_item.purchase_price * portfolio_item.quantity) if portfolio_item.purchase_price else 0
    gain_loss = (current_value - cost_basis) if (current_value is not None and cost_basis > 0) else None
    gain_loss_percent = (gain_loss / cost_basis * 100) if (gain_loss is not None and cost_basis > 0) else None
    
    return PortfolioItemResponse(
        id=portfolio_item.id,
        ticker=portfolio_item.ticker,
        wallet_id=wallet_info.get("wallet_id"),
        wallet_name=wallet_info.get("wallet_name"),
        quantity=portfolio_item.quantity,
        purchase_price=portfolio_item.purchase_price,
        purchase_date=portfolio_item.purchase_date,
        etf_name=etf.etf_name if etf else None,
        category=etf.category if etf else None,
        current_price=current_price,
        current_value=current_value,
        gain_loss=gain_loss,
        gain_loss_percent=gain_loss_percent
    )


@router.delete("/{ticker}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_portfolio(
    ticker: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove an ETF from user's portfolio"""
    
    portfolio_item = db.query(Portfolio).filter(
        Portfolio.user_id == current_user.id,
        Portfolio.ticker == ticker.upper()
    ).first()
    
    if not portfolio_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ETF '{ticker}' not in portfolio"
        )
    
    db.delete(portfolio_item)

    user_wallet_ids = [w.id for w in db.query(Wallet).filter(Wallet.user_id == current_user.id).all()]
    if user_wallet_ids:
        db.query(WalletHolding).filter(
            WalletHolding.wallet_id.in_(user_wallet_ids),
            WalletHolding.ticker == ticker.upper(),
        ).delete(synchronize_session=False)

    db.commit()
    
    return None
