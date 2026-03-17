"""
Scenario Analysis Service
Performs historical stress testing and portfolio impact analysis
"""
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
import logging
import math

logger = logging.getLogger(__name__)

# COVID-19 Market Crash Period
COVID_START = "2020-02-19"  # Market peak before crash
COVID_END = "2020-03-23"    # Market bottom


def get_price_change_during_period(
    db: Session,
    ticker: str,
    start_date: str,
    end_date: str
) -> Dict[str, Any]:
    """
    Calculate price change and statistics for a ticker during a specific period.
    
    Args:
        db: Database session
        ticker: ETF ticker symbol
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)
    
    Returns:
        Dict with price_change_percent, start_price, end_price, max_drawdown
    """
    query = text("""
        WITH period_prices AS (
            SELECT 
                date,
                close,
                FIRST_VALUE(close) OVER (ORDER BY date) as start_price,
                LAST_VALUE(close) OVER (ORDER BY date ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) as end_price,
                MAX(close) OVER (ORDER BY date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as running_max
            FROM etf_prices
            WHERE ticker = :ticker
            AND date >= :start_date
            AND date <= :end_date
            ORDER BY date
        )
        SELECT 
            start_price,
            end_price,
            ((end_price - start_price) / start_price * 100) as price_change_percent,
            MIN(((close - running_max) / running_max * 100)) as max_drawdown
        FROM period_prices
        GROUP BY start_price, end_price
        LIMIT 1
    """)
    
    result = db.execute(
        query,
        {"ticker": ticker, "start_date": start_date, "end_date": end_date}
    ).fetchone()
    
    if not result:
        return {
            "ticker": ticker,
            "start_price": None,
            "end_price": None,
            "price_change_percent": 0.0,
            "max_drawdown": 0.0,
            "error": "No price data available for this period"
        }
    
    return {
        "ticker": ticker,
        "start_price": float(result[0]) if result[0] else None,
        "end_price": float(result[1]) if result[1] else None,
        "price_change_percent": float(result[2]) if result[2] else 0.0,
        "max_drawdown": float(result[3]) if result[3] else 0.0
    }


def get_latest_price(db: Session, ticker: str) -> Optional[float]:
    """Get latest available close price for a ticker."""
    query = text("""
        SELECT close
        FROM etf_prices
        WHERE ticker = :ticker
        ORDER BY date DESC
        LIMIT 1
    """)

    row = db.execute(query, {"ticker": ticker}).fetchone()
    if not row or row[0] is None:
        return None
    return float(row[0])


def analyze_covid_scenario(
    db: Session,
    holdings: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Analyze portfolio impact during COVID-19 market crash (Feb-Mar 2020).
    
    Args:
        db: Database session
        holdings: List of portfolio holdings with ticker, quantity, purchase_price
        
    Returns:
        Scenario analysis results with portfolio impact
    """
    if not holdings:
        return {
            "scenario_name": "COVID-19 Market Crash",
            "period": f"{COVID_START} to {COVID_END}",
            "error": "No holdings provided"
        }
    
    # Analyze each holding
    holding_impacts = []
    initial_value = 0.0
    total_scenario_value = 0.0
    
    for holding in holdings:
        ticker = holding["ticker"]
        quantity = holding["quantity"]
        purchase_price = holding["purchase_price"]
        latest_price = get_latest_price(db, ticker)
        base_price = latest_price if latest_price is not None else purchase_price
        initial_holding_value = quantity * base_price
        initial_value += initial_holding_value
        
        # Get price impact during COVID crash
        impact = get_price_change_during_period(
            db, ticker, COVID_START, COVID_END
        )
        
        if impact.get("error"):
            # If no data, assume 0% change
            scenario_value = initial_holding_value
            holding_impacts.append({
                "ticker": ticker,
                "quantity": quantity,
                "initial_value": round(initial_holding_value, 2),
                "scenario_value": round(scenario_value, 2),
                "change_percent": 0.0,
                "change_amount": 0.0,
                "max_drawdown": 0.0,
                "base_price": round(base_price, 4),
                "note": "No price data available for COVID period"
            })
        else:
            # Calculate scenario value based on historical price change
            price_change_ratio = impact["price_change_percent"] / 100
            scenario_value = initial_holding_value * (1 + price_change_ratio)
            change_amount = scenario_value - initial_holding_value
            
            holding_impacts.append({
                "ticker": ticker,
                "quantity": quantity,
                "initial_value": round(initial_holding_value, 2),
                "scenario_value": round(scenario_value, 2),
                "change_percent": round(impact["price_change_percent"], 2),
                "change_amount": round(change_amount, 2),
                "max_drawdown": round(impact["max_drawdown"], 2),
                "base_price": round(base_price, 4),
                "historical_prices": {
                    "start": impact["start_price"],
                    "end": impact["end_price"]
                }
            })
        
        total_scenario_value += scenario_value
    
    # Portfolio-level metrics
    portfolio_change = total_scenario_value - initial_value
    portfolio_change_percent = (portfolio_change / initial_value * 100) if initial_value > 0 else 0
    
    # Sort holdings by impact (worst to best)
    holding_impacts.sort(key=lambda x: x["change_percent"])
    
    return {
        "scenario_name": "COVID-19 Market Crash",
        "description": "Historical replay of February-March 2020 market crash",
        "period": {
            "start": COVID_START,
            "end": COVID_END,
            "duration_days": 33
        },
        "portfolio_summary": {
            "initial_value": round(initial_value, 2),
            "scenario_value": round(total_scenario_value, 2),
            "change_amount": round(portfolio_change, 2),
            "change_percent": round(portfolio_change_percent, 2),
            "holdings_count": len(holdings)
        },
        "holdings": holding_impacts,
        "insights": {
            "worst_performer": holding_impacts[0]["ticker"] if holding_impacts else None,
            "worst_decline": holding_impacts[0]["change_percent"] if holding_impacts else None,
            "best_performer": holding_impacts[-1]["ticker"] if holding_impacts else None,
            "best_performance": holding_impacts[-1]["change_percent"] if holding_impacts else None,
        }
    }


def analyze_simple_stress_test(
    db: Session,
    holdings: List[Dict[str, Any]],
    shock_percent: float
) -> Dict[str, Any]:
    """
    Apply a simple uniform shock to all holdings.
    
    Args:
        holdings: List of portfolio holdings
        shock_percent: Percentage change to apply (e.g., -20 for 20% decline)
        
    Returns:
        Stress test results
    """
    if not holdings:
        return {
            "scenario_name": f"Stress Test ({shock_percent:+.0f}%)",
            "error": "No holdings provided"
        }
    
    shock_ratio = shock_percent / 100
    initial_value = 0.0
    
    holding_impacts = []
    for holding in holdings:
        ticker = holding["ticker"]
        latest_price = get_latest_price(db, ticker)
        base_price = latest_price if latest_price is not None else holding["purchase_price"]
        initial_holding_value = holding["quantity"] * base_price
        initial_value += initial_holding_value
        scenario_value = initial_holding_value * (1 + shock_ratio)
        change_amount = scenario_value - initial_holding_value
        
        holding_impacts.append({
            "ticker": holding["ticker"],
            "quantity": holding["quantity"],
            "initial_value": round(initial_holding_value, 2),
            "scenario_value": round(scenario_value, 2),
            "change_percent": shock_percent,
            "change_amount": round(change_amount, 2),
            "base_price": round(base_price, 4)
        })
    
    total_scenario_value = initial_value * (1 + shock_ratio)
    portfolio_change = total_scenario_value - initial_value
    
    return {
        "scenario_name": f"Stress Test ({shock_percent:+.0f}%)",
        "description": f"Hypothetical {abs(shock_percent)}% {'decline' if shock_percent < 0 else 'gain'} across all holdings",
        "shock_applied": shock_percent,
        "portfolio_summary": {
            "initial_value": round(initial_value, 2),
            "scenario_value": round(total_scenario_value, 2),
            "change_amount": round(portfolio_change, 2),
            "change_percent": round(shock_percent, 2),
            "holdings_count": len(holdings)
        },
        "holdings": holding_impacts
    }


def get_available_scenarios() -> List[Dict[str, Any]]:
    """
    Return list of available scenario analysis options.
    """
    return [
        {
            "id": "covid-crash",
            "name": "COVID-19 Market Crash",
            "description": "Historical replay of Feb-Mar 2020 crash (-34% S&P 500)",
            "period": f"{COVID_START} to {COVID_END}",
            "type": "historical",
            "requires_data": True
        },
        {
            "id": "stress-10",
            "name": "Mild Correction (-10%)",
            "description": "Hypothetical 10% market decline",
            "type": "stress_test",
            "shock_percent": -10
        },
        {
            "id": "stress-20",
            "name": "Moderate Correction (-20%)",
            "description": "Hypothetical 20% market decline",
            "type": "stress_test",
            "shock_percent": -20
        },
        {
            "id": "stress-30",
            "name": "Severe Crash (-30%)",
            "description": "Hypothetical 30% market decline",
            "type": "stress_test",
            "shock_percent": -30
        }
    ]


def calculate_var(
    db: Session,
    holdings: List[Dict[str, Any]],
    confidence_level: float = 0.95,
    time_horizon_days: int = 252
) -> Dict[str, Any]:
    """
    Calculate Value at Risk (VaR) for a portfolio using two methods:
    1. Historical VaR - Based on actual historical return distribution
    2. Parametric VaR - Assumes normal distribution of returns
    
    Args:
        db: Database session
        holdings: List of portfolio holdings with ticker, quantity, purchase_price
        confidence_level: Confidence level (default 0.95 for 95% VaR)
        time_horizon_days: Number of days of historical data to use (default 252 = 1 year)
        
    Returns:
        Dict with VaR calculations and portfolio statistics
    """
    if not holdings:
        return {
            "error": "No holdings provided",
            "confidence_level": confidence_level
        }
    
    # Calculate current portfolio value from latest prices (fallback: purchase_price)
    holding_values: Dict[str, float] = {}
    for holding in holdings:
        ticker = holding["ticker"]
        latest_price = get_latest_price(db, ticker)
        base_price = latest_price if latest_price is not None else holding["purchase_price"]
        holding_values[ticker] = holding["quantity"] * base_price

    portfolio_value = sum(holding_values.values())
    if portfolio_value <= 0:
        return {
            "error": "Portfolio value is zero; unable to calculate VaR",
            "confidence_level": confidence_level
        }
    
    # Fetch historical returns for each holding
    holding_returns = []
    
    for holding in holdings:
        ticker = holding["ticker"]
        weight = holding_values.get(ticker, 0.0) / portfolio_value
        
        # Get daily returns for the past time_horizon_days
        query = text("""
            SELECT 
                date,
                close,
                LAG(close) OVER (ORDER BY date) as prev_close
            FROM etf_prices
            WHERE ticker = :ticker
            AND date >= CURRENT_DATE - :days * INTERVAL '1 day'
            ORDER BY date DESC
            LIMIT :limit
        """)
        
        result = db.execute(
            query,
            {"ticker": ticker, "days": time_horizon_days, "limit": time_horizon_days}
        ).fetchall()
        
        if not result or len(result) < 2:
            logger.warning(f"Insufficient data for {ticker}, skipping")
            continue
        
        # Calculate daily returns
        daily_returns = []
        for row in result:
            if row[2] is not None and row[2] > 0:  # prev_close exists and is positive
                daily_return = (row[1] - row[2]) / row[2]
                daily_returns.append(daily_return * weight)  # Weight by portfolio allocation
        
        if daily_returns:
            holding_returns.append({
                "ticker": ticker,
                "weight": weight,
                "returns": daily_returns,
                "count": len(daily_returns)
            })
    
    if not holding_returns:
        return {
            "error": "Insufficient historical data for VaR calculation",
            "confidence_level": confidence_level
        }
    
    # Aggregate portfolio returns (sum of weighted returns)
    max_length = max(h["count"] for h in holding_returns)
    portfolio_returns = []
    
    for i in range(max_length):
        daily_portfolio_return = sum(
            h["returns"][i] if i < len(h["returns"]) else 0
            for h in holding_returns
        )
        portfolio_returns.append(daily_portfolio_return)
    
    # Sort returns for percentile calculation
    sorted_returns = sorted(portfolio_returns)
    
    # Method 1: Historical VaR (percentile method)
    percentile_index = int((1 - confidence_level) * len(sorted_returns))
    historical_var_return = sorted_returns[percentile_index]
    historical_var_amount = portfolio_value * abs(historical_var_return)

    # Historical CVaR / Expected Shortfall: average of worst-tail returns
    historical_tail_returns = [r for r in sorted_returns if r <= historical_var_return]
    historical_cvar_return = (
        sum(historical_tail_returns) / len(historical_tail_returns)
        if historical_tail_returns
        else historical_var_return
    )
    historical_cvar_amount = portfolio_value * abs(historical_cvar_return)
    
    # Method 2: Parametric VaR (assumes normal distribution)
    mean_return = sum(portfolio_returns) / len(portfolio_returns)
    variance = sum((r - mean_return) ** 2 for r in portfolio_returns) / len(portfolio_returns)
    std_dev = math.sqrt(variance)
    
    # Z-score for confidence levels: 90%=1.28, 95%=1.65, 99%=2.33
    z_scores = {0.90: 1.28, 0.95: 1.65, 0.99: 2.33}
    z_score = z_scores.get(confidence_level, 1.65)
    
    parametric_var_return = mean_return - (z_score * std_dev)
    parametric_var_amount = portfolio_value * abs(parametric_var_return)

    # Parametric CVaR / Expected Shortfall under normality assumption
    # ES_alpha = mu - sigma * phi(z) / alpha, where alpha = (1 - confidence)
    tail_alpha = 1 - confidence_level
    std_normal_pdf = (1 / math.sqrt(2 * math.pi)) * math.exp(-0.5 * (z_score ** 2))
    parametric_cvar_return = mean_return - (std_dev * (std_normal_pdf / tail_alpha))
    parametric_cvar_amount = portfolio_value * abs(parametric_cvar_return)
    
    # Calculate portfolio statistics
    worst_day_return = sorted_returns[0]
    best_day_return = sorted_returns[-1]
    
    return {
        "portfolio_value": round(portfolio_value, 2),
        "confidence_level": confidence_level,
        "time_horizon_days": time_horizon_days,
        "data_points": len(portfolio_returns),
        "var_methods": {
            "historical": {
                "var_amount": round(historical_var_amount, 2),
                "var_percent": round(historical_var_return * 100, 2),
                "description": f"Historical VaR: With {int(confidence_level*100)}% confidence, portfolio will not lose more than ${historical_var_amount:,.2f} in a day"
            },
            "parametric": {
                "var_amount": round(parametric_var_amount, 2),
                "var_percent": round(parametric_var_return * 100, 2),
                "description": f"Parametric VaR: Assuming normal distribution, with {int(confidence_level*100)}% confidence, portfolio will not lose more than ${parametric_var_amount:,.2f} in a day"
            }
        },
        "cvar_methods": {
            "historical": {
                "var_amount": round(historical_cvar_amount, 2),
                "var_percent": round(historical_cvar_return * 100, 2),
                "description": f"Historical CVaR: Average loss on the worst {int((1-confidence_level)*100)}% of days is about ${historical_cvar_amount:,.2f}"
            },
            "parametric": {
                "var_amount": round(parametric_cvar_amount, 2),
                "var_percent": round(parametric_cvar_return * 100, 2),
                "description": f"Parametric CVaR: Normal-model expected shortfall beyond VaR is about ${parametric_cvar_amount:,.2f}"
            }
        },
        "portfolio_statistics": {
            "mean_daily_return": round(mean_return * 100, 4),
            "daily_volatility": round(std_dev * 100, 4),
            "annualized_volatility": round(std_dev * math.sqrt(252) * 100, 2),
            "worst_day_return": round(worst_day_return * 100, 2),
            "best_day_return": round(best_day_return * 100, 2)
        },
        "holdings_analyzed": [
            {
                "ticker": h["ticker"],
                "weight": round(h["weight"] * 100, 2),
                "data_points": h["count"]
            }
            for h in holding_returns
        ]
    }
