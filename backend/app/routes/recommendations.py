"""
ETF Recommendation Endpoints
Returns personalized ETF recommendations based on risk profile
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func, or_, and_, cast, Float
from typing import List, Optional
from pydantic import BaseModel
from enum import Enum

from app.database import SessionLocal
from app.models import ETF, ETFPrice

router = APIRouter()


# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class RiskProfileEnum(str, Enum):
    conservative = "conservative"
    balanced = "balanced"
    aggressive = "aggressive"


class RecommendedETF(BaseModel):
    ticker: str
    etf_name: str
    category: Optional[str]
    asset_class: Optional[str]
    expense_ratio: Optional[str]
    aum: Optional[str]
    ytd_return: Optional[str]
    beta: Optional[str]
    annual_dividend_yield: Optional[str]
    recommendation_score: float
    recommendation_reason: str
    
    class Config:
        from_attributes = True


class RecommendationResponse(BaseModel):
    risk_profile: str
    profile_description: str
    total_matches: int
    recommendations: List[RecommendedETF]
    filter_criteria: dict


# Risk profile filtering criteria
PROFILE_CRITERIA = {
    "conservative": {
        "description": "Low-risk investor prioritizing capital preservation and stable income",
        "beta_max": 0.8,
        "preferred_categories": [
            "Government Bonds", "Corporate Bonds", "Total Bond Market",
            "Treasury", "Municipal Bonds", "Short-Term Bonds",
            "Dividend", "Utilities", "Consumer Staples", "Real Estate"
        ],
        "preferred_asset_classes": ["Bond", "Fixed Income", "Bonds"],
        "avoid_categories": ["Leveraged", "Inverse", "Crypto", "Volatility"],
        "sort_by": "dividend_yield",  # Prioritize income
    },
    "balanced": {
        "description": "Moderate-risk investor balancing growth with stability",
        "beta_min": 0.7,
        "beta_max": 1.3,
        "preferred_categories": [
            "Large Cap Blend", "Large Cap Value", "Total Stock Market",
            "S&P 500", "Dividend", "Multi-Asset", "Balanced"
        ],
        "preferred_asset_classes": ["Equity", "Mixed Assets", "Alternatives"],
        "avoid_categories": ["Leveraged", "Inverse", "3x", "2x"],
        "sort_by": "balanced",  # Mix of return and stability
    },
    "aggressive": {
        "description": "High-risk investor prioritizing capital growth over stability",
        "beta_min": 1.0,
        "preferred_categories": [
            "Technology", "Growth", "Small Cap", "Mid Cap Growth",
            "Emerging Markets", "Sector", "Thematic", "Innovation"
        ],
        "preferred_asset_classes": ["Equity"],
        "avoid_categories": [],  # Aggressive can handle anything
        "sort_by": "return",  # Prioritize growth
    }
}


def parse_percentage(value: str) -> Optional[float]:
    """Convert percentage string like '12.5%' to float 12.5"""
    if not value or value in ['N/A', 'NA', '-', '']:
        return None
    try:
        return float(value.replace('%', '').replace(',', '').strip())
    except:
        return None


def parse_beta(value: str) -> Optional[float]:
    """Convert beta string to float"""
    if not value or value in ['N/A', 'NA', '-', '']:
        return None
    try:
        return float(value.replace(',', '').strip())
    except:
        return None


def calculate_recommendation_score(etf: ETF, profile: str) -> tuple:
    """
    Calculate a recommendation score and reason for an ETF based on profile.
    Returns (score, reason)
    """
    score = 50  # Base score
    reasons = []
    criteria = PROFILE_CRITERIA[profile]
    
    # Parse values
    beta = parse_beta(etf.beta)
    ytd_return = parse_percentage(etf.return_ytd)
    dividend_yield = parse_percentage(etf.annual_dividend_yield)
    expense_ratio = parse_percentage(etf.expense_ratio)
    
    # Beta scoring
    if beta is not None:
        if profile == "conservative":
            if beta < 0.5:
                score += 20
                reasons.append("Very low volatility")
            elif beta < 0.8:
                score += 15
                reasons.append("Low volatility")
        elif profile == "balanced":
            if 0.9 <= beta <= 1.1:
                score += 15
                reasons.append("Market-aligned volatility")
        elif profile == "aggressive":
            if beta > 1.3:
                score += 20
                reasons.append("High growth potential")
            elif beta > 1.1:
                score += 10
                reasons.append("Above-market volatility")
    
    # Dividend scoring (more important for conservative)
    if dividend_yield is not None:
        if profile == "conservative" and dividend_yield > 3:
            score += 15
            reasons.append(f"Strong dividend yield ({dividend_yield:.1f}%)")
        elif profile == "balanced" and dividend_yield > 2:
            score += 10
            reasons.append(f"Good dividend ({dividend_yield:.1f}%)")
    
    # Return scoring (more important for aggressive)
    if ytd_return is not None:
        if profile == "aggressive" and ytd_return > 20:
            score += 20
            reasons.append(f"Strong YTD return ({ytd_return:.1f}%)")
        elif profile == "balanced" and ytd_return > 10:
            score += 10
            reasons.append(f"Solid returns ({ytd_return:.1f}%)")
        elif profile == "conservative" and ytd_return > 5:
            score += 5
            reasons.append(f"Positive returns ({ytd_return:.1f}%)")
    
    # Low expense ratio bonus
    if expense_ratio is not None and expense_ratio < 0.2:
        score += 10
        reasons.append(f"Low fees ({expense_ratio:.2f}%)")
    
    # Category match bonus
    if etf.category and any(cat.lower() in etf.category.lower() for cat in criteria.get("preferred_categories", [])):
        score += 15
        reasons.append(f"Category match: {etf.category}")
    
    # Asset class match bonus
    if etf.asset_class and any(ac.lower() in etf.asset_class.lower() for ac in criteria.get("preferred_asset_classes", [])):
        score += 10
    
    # Penalty for avoided categories
    if etf.category and any(avoid.lower() in etf.category.lower() for avoid in criteria.get("avoid_categories", [])):
        score -= 30
        reasons.append("Higher risk category")
    
    # Cap score at 100
    score = min(100, max(0, score))
    
    # Generate reason string
    if not reasons:
        reasons = ["Matches profile criteria"]
    reason = "; ".join(reasons[:3])  # Max 3 reasons
    
    return score, reason


@router.get("", response_model=RecommendationResponse)
async def get_recommendations(
    profile: RiskProfileEnum = Query(..., description="Risk profile: conservative, balanced, or aggressive"),
    limit: int = Query(10, ge=1, le=50, description="Number of recommendations to return"),
    category: Optional[str] = Query(None, description="Filter by specific category"),
    region: Optional[str] = Query(None, description="Filter by region (e.g., 'North America', 'Asia-Pacific')"),
    db: Session = Depends(get_db)
):
    """
    Get personalized ETF recommendations based on risk profile.
    
    Risk Profiles:
    - **conservative**: Low-risk ETFs (bonds, dividends, utilities, beta < 0.8)
    - **balanced**: Moderate-risk ETFs (large cap blend, S&P 500, 0.7 < beta < 1.3)
    - **aggressive**: High-risk ETFs (growth, tech, emerging markets, beta > 1.0)
    
    Scoring considers:
    - Beta (volatility relative to market)
    - YTD returns
    - Dividend yield
    - Expense ratio
    - Category alignment
    """
    profile_key = profile.value
    criteria = PROFILE_CRITERIA[profile_key]
    
    # Build base query
    query = select(ETF)
    
    # Apply category filter if specified
    if category:
        query = query.where(ETF.category.ilike(f"%{category}%"))
    
    # Apply region filter if specified
    if region:
        query = query.where(
            or_(
                ETF.general_region.ilike(f"%{region}%"),
                ETF.specific_region.ilike(f"%{region}%")
            )
        )
    
    # Exclude avoided categories
    for avoid in criteria.get("avoid_categories", []):
        query = query.where(
            or_(
                ETF.category == None,
                ~ETF.category.ilike(f"%{avoid}%")
            )
        )
    
    # Execute query
    result = db.execute(query)
    all_etfs = result.scalars().all()
    
    # Score and filter ETFs
    scored_etfs = []
    
    for etf in all_etfs:
        # Parse beta for filtering
        beta = parse_beta(etf.beta)
        
        # Apply beta filters based on profile
        if profile_key == "conservative":
            if beta is not None and beta > criteria.get("beta_max", 999):
                continue  # Skip high-beta ETFs for conservative
        elif profile_key == "aggressive":
            if beta is not None and beta < criteria.get("beta_min", 0):
                continue  # Skip very low-beta for aggressive
        
        # Calculate recommendation score
        score, reason = calculate_recommendation_score(etf, profile_key)
        
        # Only include ETFs with decent scores
        if score >= 40:
            scored_etfs.append((etf, score, reason))
    
    # Sort by score (descending)
    scored_etfs.sort(key=lambda x: x[1], reverse=True)
    
    # Take top N
    top_etfs = scored_etfs[:limit]
    
    # Build response
    recommendations = []
    for etf, score, reason in top_etfs:
        recommendations.append(RecommendedETF(
            ticker=etf.ticker,
            etf_name=etf.etf_name or "Unknown",
            category=etf.category,
            asset_class=etf.asset_class,
            expense_ratio=etf.expense_ratio,
            aum=etf.aum,
            ytd_return=etf.return_ytd,
            beta=etf.beta,
            annual_dividend_yield=etf.annual_dividend_yield,
            recommendation_score=score,
            recommendation_reason=reason
        ))
    
    return RecommendationResponse(
        risk_profile=profile_key,
        profile_description=criteria["description"],
        total_matches=len(scored_etfs),
        recommendations=recommendations,
        filter_criteria={
            "beta_range": f"{criteria.get('beta_min', 0)} - {criteria.get('beta_max', 'any')}",
            "preferred_categories": criteria.get("preferred_categories", [])[:5],
            "avoid_categories": criteria.get("avoid_categories", [])
        }
    )


@router.get("/profiles")
async def get_available_profiles():
    """
    Get information about available risk profiles and their criteria.
    """
    profiles = []
    for profile_key, criteria in PROFILE_CRITERIA.items():
        profiles.append({
            "profile": profile_key,
            "description": criteria["description"],
            "beta_range": {
                "min": criteria.get("beta_min"),
                "max": criteria.get("beta_max")
            },
            "preferred_categories": criteria.get("preferred_categories", [])[:5],
            "avoid_categories": criteria.get("avoid_categories", [])
        })
    
    return {"profiles": profiles}
