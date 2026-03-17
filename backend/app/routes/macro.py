"""
Macro Economic Indicators API Routes
Endpoints for economic indicators (CPI, GDP, Fed Funds Rate, etc.)
"""
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select, func
from datetime import datetime, timedelta
from typing import Optional
from app.database import SessionLocal
from app.models import MacroIndicator
from app.schemas import MacroIndicator as MacroIndicatorSchema, MacroData

router = APIRouter()


AVAILABLE_INDICATORS = {
    "CPIAUCSL": "Consumer Price Index (Inflation)",
    "DGS10": "10-Year Treasury Yield",
    "FEDFUNDS": "Federal Funds Rate",
    "GDP": "Gross Domestic Product",
    "VIXCLS": "VIX Volatility Index"
}


@router.get("/indicators")
async def list_indicators():
    """
    Get list of all available macro economic indicators
    
    Returns indicator names with descriptions and record counts
    """
    session = SessionLocal()
    
    try:
        indicators_info = []
        
        for indicator_name, description in AVAILABLE_INDICATORS.items():
            # Get count and date range for each indicator
            query = select(MacroIndicator).where(
                MacroIndicator.indicator_name == indicator_name
            )
            result = session.execute(query)
            records = result.scalars().all()
            
            if records:
                dates = [r.date for r in records]
                indicators_info.append({
                    "name": indicator_name,
                    "description": description,
                    "total_records": len(records),
                    "date_range": {
                        "start": min(dates).isoformat(),
                        "end": max(dates).isoformat()
                    }
                })
        
        return {
            "total_indicators": len(indicators_info),
            "indicators": indicators_info
        }
    
    finally:
        session.close()


@router.get("/{indicator_name}", response_model=MacroIndicatorSchema)
async def get_indicator_data(
    indicator_name: str,
    days: Optional[int] = Query(365, description="Number of days of historical data"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)")
):
    """
    Get historical data for a specific macro indicator
    
    - **indicator_name**: One of CPIAUCSL, DGS10, FEDFUNDS, GDP, VIXCLS
    - **days**: Number of days to retrieve (default: 365)
    - **start_date**: Optional start date in YYYY-MM-DD format
    - **end_date**: Optional end date in YYYY-MM-DD format
    """
    session = SessionLocal()
    
    try:
        # Validate indicator name
        if indicator_name.upper() not in AVAILABLE_INDICATORS:
            raise HTTPException(
                status_code=404, 
                detail=f"Indicator '{indicator_name}' not found. Available: {', '.join(AVAILABLE_INDICATORS.keys())}"
            )
        
        # Build query
        query = select(MacroIndicator).where(
            MacroIndicator.indicator_name == indicator_name.upper()
        )
        
        # Apply date filters
        if start_date and end_date:
            try:
                start = datetime.strptime(start_date, "%Y-%m-%d").date()
                end = datetime.strptime(end_date, "%Y-%m-%d").date()
                query = query.where(MacroIndicator.date >= start, MacroIndicator.date <= end)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        else:
            # Use days parameter
            end_date_obj = datetime.now().date()
            start_date_obj = end_date_obj - timedelta(days=days)
            query = query.where(MacroIndicator.date >= start_date_obj)
        
        # Order by date ascending
        query = query.order_by(MacroIndicator.date.asc())
        
        # Execute query
        result = session.execute(query)
        data = result.scalars().all()
        
        if not data:
            raise HTTPException(
                status_code=404, 
                detail=f"No data found for indicator '{indicator_name}' in the specified date range"
            )
        
        # Get date range
        date_range = {
            "start": data[0].date.isoformat(),
            "end": data[-1].date.isoformat()
        }
        
        return MacroIndicatorSchema(
            indicator_name=indicator_name.upper(),
            total_records=len(data),
            date_range=date_range,
            data=[MacroData.model_validate(d) for d in data]
        )
    
    finally:
        session.close()


@router.get("/{indicator_name}/latest")
async def get_latest_indicator(indicator_name: str):
    """
    Get the most recent value for a macro indicator
    
    - **indicator_name**: One of CPIAUCSL, DGS10, FEDFUNDS, GDP, VIXCLS
    """
    session = SessionLocal()
    
    try:
        # Validate indicator name
        if indicator_name.upper() not in AVAILABLE_INDICATORS:
            raise HTTPException(
                status_code=404, 
                detail=f"Indicator '{indicator_name}' not found. Available: {', '.join(AVAILABLE_INDICATORS.keys())}"
            )
        
        # Get latest value
        query = (
            select(MacroIndicator)
            .where(MacroIndicator.indicator_name == indicator_name.upper())
            .order_by(MacroIndicator.date.desc())
            .limit(1)
        )
        
        result = session.execute(query)
        indicator = result.scalar_one_or_none()
        
        if not indicator:
            raise HTTPException(
                status_code=404, 
                detail=f"No data found for indicator '{indicator_name}'"
            )
        
        return {
            "indicator_name": indicator_name.upper(),
            "description": AVAILABLE_INDICATORS[indicator_name.upper()],
            "date": indicator.date.isoformat(),
            "value": float(indicator.value)
        }
    
    finally:
        session.close()


@router.get("/dashboard/summary")
async def get_macro_dashboard():
    """
    Get latest values for all macro indicators (dashboard view)
    
    Returns the most recent value for each indicator
    """
    session = SessionLocal()
    
    try:
        dashboard_data = []
        
        for indicator_name, description in AVAILABLE_INDICATORS.items():
            # Get latest value
            query = (
                select(MacroIndicator)
                .where(MacroIndicator.indicator_name == indicator_name)
                .order_by(MacroIndicator.date.desc())
                .limit(1)
            )
            
            result = session.execute(query)
            latest = result.scalar_one_or_none()
            
            if latest:
                dashboard_data.append({
                    "name": indicator_name,
                    "description": description,
                    "date": latest.date.isoformat(),
                    "value": float(latest.value)
                })
        
        return {
            "indicators": dashboard_data,
            "last_updated": max(d["date"] for d in dashboard_data) if dashboard_data else None
        }
    
    finally:
        session.close()
