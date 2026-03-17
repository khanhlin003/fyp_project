"""
ETF API Routes
Endpoints for ETF discovery, filtering, and details
"""
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select, func, or_
from typing import Optional, List
from app.database import SessionLocal
from app.models import ETF, ETFPrice
from app.schemas import ETFBase, ETFDetail, ETFList
import json

router = APIRouter()


@router.get("", response_model=ETFList)
async def list_etfs(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    category: Optional[str] = Query(None, description="Filter by category"),
    asset_class: Optional[str] = Query(None, description="Filter by asset class"),
    etf_type: Optional[str] = Query(None, description="Filter by ETF type (e.g., ACTIVE, PASSIVE)"),
    region: Optional[str] = Query(None, description="Filter by region"),
    search: Optional[str] = Query(None, description="Search by ticker or name"),
):
    """
    Get paginated list of ETFs with optional filters
    
    - **page**: Page number (default: 1)
    - **page_size**: Number of items per page (default: 20, max: 100)
    - **category**: Filter by category (e.g., "Large Cap Blend")
    - **asset_class**: Filter by asset class (e.g., "Equity")
    - **etf_type**: Filter by ETF type (e.g., "ACTIVE", "PASSIVE")
    - **region**: Filter by region (e.g., "North America")
    - **search**: Search by ticker or ETF name
    """
    session = SessionLocal()
    
    try:
        # Build query with filters
        query = select(ETF)
        
        if category:
            query = query.where(ETF.category == category)
        
        if asset_class:
            query = query.where(ETF.asset_class == asset_class)

        if etf_type:
            query = query.where(func.lower(ETF.asset_class_size) == etf_type.lower())
        
        if region:
            query = query.where(
                or_(
                    ETF.general_region == region,
                    ETF.specific_region == region
                )
            )
        
        if search:
            search_pattern = f"%{search}%"
            query = query.where(
                or_(
                    ETF.ticker.ilike(search_pattern),
                    ETF.etf_name.ilike(search_pattern)
                )
            )
        
        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total = session.execute(count_query).scalar()
        
        # Apply pagination
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)
        
        # Execute query
        result = session.execute(query)
        etfs = result.scalars().all()

        latest_by_ticker = {}
        if etfs:
            tickers = [etf.ticker for etf in etfs]
            latest_price_subquery = (
                select(
                    ETFPrice.ticker.label("ticker"),
                    ETFPrice.close.label("latest_price"),
                    ETFPrice.volume.label("latest_volume"),
                    func.row_number().over(
                        partition_by=ETFPrice.ticker,
                        order_by=ETFPrice.date.desc(),
                    ).label("rn"),
                )
                .where(ETFPrice.ticker.in_(tickers))
                .subquery()
            )

            latest_rows = session.execute(
                select(
                    latest_price_subquery.c.ticker,
                    latest_price_subquery.c.latest_price,
                    latest_price_subquery.c.latest_volume,
                ).where(latest_price_subquery.c.rn == 1)
            ).all()
            latest_by_ticker = {row.ticker: row for row in latest_rows}

        etf_items = []
        for etf in etfs:
            item = ETFBase.model_validate(etf, from_attributes=True)
            latest = latest_by_ticker.get(etf.ticker)
            item.latest_price = float(latest.latest_price) if latest and latest.latest_price is not None else None
            item.latest_volume = int(latest.latest_volume) if latest and latest.latest_volume is not None else None
            etf_items.append(item)
        
        return ETFList(
            total=total,
            page=page,
            page_size=page_size,
            etfs=etf_items
        )
    
    finally:
        session.close()


@router.get("/{ticker}", response_model=ETFDetail)
async def get_etf_detail(ticker: str):
    """
    Get detailed information for a specific ETF
    
    - **ticker**: ETF ticker symbol (e.g., "SPY", "IVV", "G3B.SI")
    
    Returns all 32 fields including performance metrics, risk data, holdings, and sectors
    """
    session = SessionLocal()
    
    try:
        # Query ETF by ticker
        query = select(ETF).where(ETF.ticker == ticker.upper())
        result = session.execute(query)
        etf = result.scalar_one_or_none()
        
        if not etf:
            raise HTTPException(status_code=404, detail=f"ETF with ticker '{ticker}' not found")
        
        return ETFDetail.model_validate(etf, from_attributes=True)
    
    finally:
        session.close()


@router.get("/{ticker}/summary")
async def get_etf_summary(ticker: str):
    """
    Get ETF summary with latest price and key metrics
    
    Returns ETF details plus the most recent closing price
    """
    session = SessionLocal()
    
    try:
        # Get ETF details
        etf_query = select(ETF).where(ETF.ticker == ticker.upper())
        etf_result = session.execute(etf_query)
        etf = etf_result.scalar_one_or_none()
        
        if not etf:
            raise HTTPException(status_code=404, detail=f"ETF with ticker '{ticker}' not found")
        
        # Get latest price
        price_query = (
            select(ETFPrice)
            .where(ETFPrice.ticker == ticker.upper())
            .order_by(ETFPrice.date.desc())
            .limit(1)
        )
        price_result = session.execute(price_query)
        latest_price = price_result.scalar_one_or_none()
        
        # Build response
        etf_dict = {
            "ticker": etf.ticker,
            "etf_name": etf.etf_name,
            "issuer": etf.issuer,
            "category": etf.category,
            "asset_class": etf.asset_class,
            "expense_ratio": etf.expense_ratio,
            "aum": etf.aum,
            "ytd_return": etf.return_ytd,
            "beta": etf.beta,
            "latest_price": latest_price.close if latest_price else None,
            "latest_date": latest_price.date.isoformat() if latest_price else None,
        }
        
        return etf_dict
    
    finally:
        session.close()


@router.get("/filters/options")
async def get_filter_options():
    """
    Get all available filter options for ETF discovery
    
    Returns unique values for categories, asset classes, ETF types, and regions
    """
    session = SessionLocal()
    
    try:
        # Get unique categories
        categories_query = select(ETF.category).distinct().where(ETF.category.isnot(None))
        categories = session.execute(categories_query).scalars().all()
        
        # Get unique asset classes
        asset_classes_query = select(ETF.asset_class).distinct().where(ETF.asset_class.isnot(None))
        asset_classes = session.execute(asset_classes_query).scalars().all()

        # ETF type values are stored in asset_class_size for this dataset
        etf_types_query = (
            select(ETF.asset_class_size)
            .distinct()
            .where(ETF.asset_class_size.isnot(None))
            .where(func.lower(ETF.asset_class_size).in_(["active", "passive"]))
        )
        etf_types = session.execute(etf_types_query).scalars().all()
        
        # Get unique regions
        regions_query = select(ETF.general_region).distinct().where(ETF.general_region.isnot(None))
        regions = session.execute(regions_query).scalars().all()
        
        return {
            "categories": sorted([c for c in categories if c]),
            "asset_classes": sorted([a for a in asset_classes if a]),
            "etf_types": sorted([t.upper() for t in etf_types if t]),
            "regions": sorted([r for r in regions if r])
        }
    
    finally:
        session.close()
