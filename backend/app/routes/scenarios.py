"""
Scenario Analysis API Routes
Endpoints for portfolio stress testing and historical scenario analysis
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, Field

from ..database import get_db
from ..auth import get_current_user
from ..models import User, Portfolio
from ..services.scenario_service import (
    analyze_covid_scenario,
    analyze_simple_stress_test,
    get_available_scenarios,
    calculate_var
)

router = APIRouter(prefix="/scenarios", tags=["Scenario Analysis"])


# Pydantic Models
class HoldingInput(BaseModel):
    ticker: str = Field(..., description="ETF ticker symbol")
    quantity: float = Field(..., gt=0, description="Number of shares")
    purchase_price: float = Field(..., gt=0, description="Purchase price per share")


class ScenarioRequest(BaseModel):
    scenario_id: str = Field(..., description="Scenario ID (covid-crash, stress-10, etc.)")
    holdings: Optional[List[HoldingInput]] = Field(None, description="Custom holdings (optional, uses portfolio if not provided)")


class ScenarioResponse(BaseModel):
    scenario_name: str
    description: Optional[str] = None
    period: Optional[dict] = None
    portfolio_summary: dict
    holdings: List[dict]
    insights: Optional[dict] = None


@router.get("/available")
def list_available_scenarios():
    """
    Get list of all available scenario analysis options.
    
    Returns:
        List of scenario definitions with descriptions
    """
    return {
        "scenarios": get_available_scenarios(),
        "total": len(get_available_scenarios())
    }


@router.post("/analyze", response_model=ScenarioResponse)
def analyze_scenario(
    request: ScenarioRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Run scenario analysis on portfolio or custom holdings.
    
    **Scenarios:**
    - `covid-crash`: Historical COVID-19 crash (Feb-Mar 2020)
    - `stress-10`: Hypothetical -10% decline
    - `stress-20`: Hypothetical -20% decline  
    - `stress-30`: Hypothetical -30% decline
    
    **Request Body:**
    ```json
    {
        "scenario_id": "covid-crash",
        "holdings": [  // Optional - uses portfolio if not provided
            {"ticker": "SPY", "quantity": 10, "purchase_price": 450.0},
            {"ticker": "QQQ", "quantity": 5, "purchase_price": 380.0}
        ]
    }
    ```
    """
    # Get holdings from request or user portfolio
    if request.holdings:
        holdings = [h.dict() for h in request.holdings]
    else:
        # Fetch user's portfolio from database
        portfolio_items = db.query(Portfolio).filter(
            Portfolio.user_id == current_user.id
        ).all()
        
        if not portfolio_items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No holdings provided and portfolio is empty"
            )
        
        holdings = [
            {
                "ticker": item.ticker,
                "quantity": item.quantity,
                "purchase_price": item.purchase_price
            }
            for item in portfolio_items
        ]
    
    # Route to appropriate scenario handler
    scenario_id = request.scenario_id.lower()
    
    if scenario_id == "covid-crash":
        result = analyze_covid_scenario(db, holdings)
    elif scenario_id.startswith("stress-"):
        try:
            shock = int(scenario_id.split("-")[1])
            result = analyze_simple_stress_test(db, holdings, -shock)
        except (IndexError, ValueError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid stress test ID format. Use: stress-10, stress-20, stress-30"
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown scenario_id: {scenario_id}. Use /scenarios/available to see options."
        )
    
    # Check if scenario returned error
    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["error"]
        )
    
    return result


@router.get("/portfolio/covid")
def analyze_portfolio_covid(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Quick endpoint to analyze user's portfolio against COVID-19 crash.
    
    Shortcut for: POST /scenarios/analyze with scenario_id="covid-crash"
    """
    portfolio_items = db.query(Portfolio).filter(
        Portfolio.user_id == current_user.id
    ).all()
    
    if not portfolio_items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Portfolio is empty. Add holdings first."
        )
    
    holdings = [
        {
            "ticker": item.ticker,
            "quantity": item.quantity,
            "purchase_price": item.purchase_price
        }
        for item in portfolio_items
    ]
    
    result = analyze_covid_scenario(db, holdings)
    
    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["error"]
        )
    
    return result


@router.get("/var")
def calculate_portfolio_var(
    confidence_level: float = 0.95,
    time_horizon_days: int = 252,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Calculate Value at Risk (VaR) for user's portfolio.
    
    **Methods:**
    - Historical VaR: Based on actual return distribution (95th percentile)
    - Parametric VaR: Assumes normal distribution of returns
    
    **Query Parameters:**
    - `confidence_level`: Confidence level (0.90, 0.95, or 0.99). Default: 0.95
    - `time_horizon_days`: Historical data period in days. Default: 252 (1 year)
    
    **Example:**
    ```
    GET /scenarios/var?confidence_level=0.95&time_horizon_days=252
    ```
    
    **Response:**
    ```json
    {
        "portfolio_value": 10000.00,
        "confidence_level": 0.95,
        "var_methods": {
            "historical": {
                "var_amount": 250.00,
                "var_percent": -2.50,
                "description": "With 95% confidence, portfolio will not lose more than $250 in a day"
            },
            "parametric": {
                "var_amount": 280.00,
                "var_percent": -2.80,
                "description": "Assuming normal distribution, with 95% confidence..."
            }
        },
        "portfolio_statistics": {
            "mean_daily_return": 0.05,
            "daily_volatility": 1.20,
            "annualized_volatility": 19.05
        }
    }
    ```
    """
    # Validate confidence level
    if confidence_level not in [0.90, 0.95, 0.99]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="confidence_level must be 0.90, 0.95, or 0.99"
        )
    
    # Validate time horizon
    if time_horizon_days < 30 or time_horizon_days > 1000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="time_horizon_days must be between 30 and 1000"
        )
    
    # Fetch user's portfolio
    portfolio_items = db.query(Portfolio).filter(
        Portfolio.user_id == current_user.id
    ).all()
    
    if not portfolio_items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Portfolio is empty. Add holdings first."
        )
    
    holdings = [
        {
            "ticker": item.ticker,
            "quantity": item.quantity,
            "purchase_price": item.purchase_price
        }
        for item in portfolio_items
    ]
    
    result = calculate_var(
        db, 
        holdings, 
        confidence_level=confidence_level,
        time_horizon_days=time_horizon_days
    )
    
    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["error"]
        )
    
    return result
