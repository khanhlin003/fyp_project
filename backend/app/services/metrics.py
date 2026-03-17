"""
ETF Metrics Calculation Service
Calculates performance metrics from historical price data
"""
import numpy as np
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models import ETFPrice, MacroIndicator


def calculate_returns(prices: List[float], periods: Dict[str, int]) -> Dict[str, Optional[float]]:
    """
    Calculate returns for different time periods
    
    Args:
        prices: List of closing prices (oldest to newest)
        periods: Dict mapping period name to number of trading days
    
    Returns:
        Dict with return percentages for each period
    """
    returns = {}
    current_price = prices[-1] if prices else None
    
    if not current_price or len(prices) < 2:
        return {period: None for period in periods}
    
    for period_name, days in periods.items():
        if len(prices) >= days:
            past_price = prices[-days]
            if past_price and past_price > 0:
                returns[period_name] = round(((current_price - past_price) / past_price) * 100, 2)
            else:
                returns[period_name] = None
        else:
            returns[period_name] = None
    
    return returns


def calculate_volatility(prices: List[float], period_days: int = 252) -> Optional[float]:
    """
    Calculate annualized volatility (standard deviation of daily returns)
    
    Args:
        prices: List of closing prices
        period_days: Number of trading days to use (default 252 = 1 year)
    
    Returns:
        Annualized volatility as percentage
    """
    if len(prices) < 20:  # Need at least 20 data points
        return None
    
    # Use the last period_days prices
    recent_prices = prices[-period_days:] if len(prices) > period_days else prices
    
    # Calculate daily returns
    daily_returns = []
    for i in range(1, len(recent_prices)):
        if recent_prices[i-1] > 0:
            daily_return = (recent_prices[i] - recent_prices[i-1]) / recent_prices[i-1]
            daily_returns.append(daily_return)
    
    if len(daily_returns) < 10:
        return None
    
    # Annualized volatility = daily std dev * sqrt(252)
    daily_std = np.std(daily_returns)
    annualized_volatility = daily_std * np.sqrt(252) * 100
    
    return round(annualized_volatility, 2)


def calculate_beta(etf_prices: List[tuple], spy_prices: List[tuple], period_days: int = 252) -> Optional[float]:
    """
    Calculate beta relative to SPY (S&P 500)
    Beta = Cov(ETF, Market) / Var(Market)
    
    Args:
        etf_prices: List of (date, close) tuples for the ETF
        spy_prices: List of (date, close) tuples for SPY
        period_days: Number of trading days to use
    
    Returns:
        Beta coefficient
    """
    if len(etf_prices) < 20 or len(spy_prices) < 20:
        return None
    
    # Create date-aligned price dict
    etf_dict = {date: close for date, close in etf_prices}
    spy_dict = {date: close for date, close in spy_prices}
    
    # Get common dates
    common_dates = sorted(set(etf_dict.keys()) & set(spy_dict.keys()))
    
    if len(common_dates) < 20:
        return None
    
    # Use recent data
    common_dates = common_dates[-period_days:] if len(common_dates) > period_days else common_dates
    
    # Calculate daily returns for both
    etf_returns = []
    spy_returns = []
    
    for i in range(1, len(common_dates)):
        prev_date = common_dates[i-1]
        curr_date = common_dates[i]
        
        etf_prev, etf_curr = etf_dict[prev_date], etf_dict[curr_date]
        spy_prev, spy_curr = spy_dict[prev_date], spy_dict[curr_date]
        
        if etf_prev > 0 and spy_prev > 0:
            etf_returns.append((etf_curr - etf_prev) / etf_prev)
            spy_returns.append((spy_curr - spy_prev) / spy_prev)
    
    if len(etf_returns) < 10:
        return None
    
    # Calculate beta = Cov(ETF, SPY) / Var(SPY)
    covariance = np.cov(etf_returns, spy_returns)[0][1]
    variance = np.var(spy_returns)
    
    if variance == 0:
        return None
    
    beta = covariance / variance
    return round(beta, 2)


def calculate_sharpe_ratio(
    prices: List[float], 
    risk_free_rate: float = 0.05,  # Default 5% annual risk-free rate
    period_days: int = 252
) -> Optional[float]:
    """
    Calculate Sharpe Ratio
    Sharpe = (Annualized Return - Risk Free Rate) / Annualized Volatility
    
    Args:
        prices: List of closing prices
        risk_free_rate: Annual risk-free rate (default 5%)
        period_days: Number of trading days to use
    
    Returns:
        Sharpe ratio
    """
    if len(prices) < 20:
        return None
    
    recent_prices = prices[-period_days:] if len(prices) > period_days else prices
    
    # Calculate annualized return
    if recent_prices[0] <= 0:
        return None
    
    total_return = (recent_prices[-1] - recent_prices[0]) / recent_prices[0]
    trading_days = len(recent_prices)
    annualized_return = ((1 + total_return) ** (252 / trading_days)) - 1
    
    # Calculate annualized volatility
    volatility = calculate_volatility(recent_prices, period_days)
    
    if volatility is None or volatility == 0:
        return None
    
    # Sharpe ratio
    sharpe = (annualized_return - risk_free_rate) / (volatility / 100)
    return round(sharpe, 2)


def calculate_max_drawdown(prices: List[float]) -> Optional[float]:
    """
    Calculate Maximum Drawdown
    The largest peak-to-trough decline in the price series
    
    Args:
        prices: List of closing prices
    
    Returns:
        Maximum drawdown as a negative percentage
    """
    if len(prices) < 2:
        return None
    
    peak = prices[0]
    max_drawdown = 0
    
    for price in prices:
        if price > peak:
            peak = price
        
        if peak > 0:
            drawdown = (price - peak) / peak
            if drawdown < max_drawdown:
                max_drawdown = drawdown
    
    return round(max_drawdown * 100, 2)


def calculate_52_week_high_low(prices: List[tuple]) -> Dict[str, Optional[float]]:
    """
    Calculate 52-week high and low from price data
    
    Args:
        prices: List of (date, high, low, close) tuples
    
    Returns:
        Dict with 52_week_high and 52_week_low
    """
    if not prices:
        return {"week_52_high": None, "week_52_low": None}
    
    # Get last 252 trading days
    recent = prices[-252:] if len(prices) > 252 else prices
    
    highs = [p[1] for p in recent if p[1] is not None]
    lows = [p[2] for p in recent if p[2] is not None]
    
    return {
        "week_52_high": round(max(highs), 2) if highs else None,
        "week_52_low": round(min(lows), 2) if lows else None
    }


def get_etf_metrics(session: Session, ticker: str) -> Dict[str, Any]:
    """
    Calculate all metrics for an ETF
    
    Args:
        session: Database session
        ticker: ETF ticker symbol
    
    Returns:
        Dict with all calculated metrics
    """
    # Get price data for the ETF (last 5 years for comprehensive metrics)
    query = (
        select(ETFPrice.date, ETFPrice.open, ETFPrice.high, ETFPrice.low, ETFPrice.close)
        .where(ETFPrice.ticker == ticker.upper())
        .order_by(ETFPrice.date.asc())
    )
    result = session.execute(query)
    price_data = result.fetchall()
    
    if not price_data:
        return {"error": f"No price data found for {ticker}"}
    
    # Extract price lists
    dates = [row[0] for row in price_data]
    closes = [row[4] for row in price_data]
    highs_lows = [(row[0], row[2], row[3], row[4]) for row in price_data]  # date, high, low, close
    
    # Get current price info
    latest_price = closes[-1] if closes else None
    latest_date = dates[-1] if dates else None
    
    # Calculate returns for different periods
    # Trading days approximations: 1M=21, 3M=63, 6M=126, YTD=varies, 1Y=252, 3Y=756, 5Y=1260
    today = datetime.now().date()
    year_start = datetime(today.year, 1, 1).date()
    
    # Find YTD start index
    ytd_days = None
    for i, d in enumerate(dates):
        if d >= year_start:
            ytd_days = len(dates) - i
            break
    
    period_mapping = {
        "return_1m": 21,
        "return_3m": 63,
        "return_6m": 126,
        "return_1y": 252,
        "return_3y": 756,
        "return_5y": 1260,
    }
    
    returns = calculate_returns(closes, period_mapping)
    
    # Calculate YTD separately
    ytd_return = None
    if ytd_days and ytd_days > 0 and len(closes) >= ytd_days:
        ytd_start_price = closes[-ytd_days]
        if ytd_start_price and ytd_start_price > 0:
            ytd_return = round(((latest_price - ytd_start_price) / ytd_start_price) * 100, 2)
    
    # Calculate volatility
    volatility = calculate_volatility(closes, 252)
    
    # Calculate Sharpe ratio
    # Get current risk-free rate from macro indicators
    risk_free_rate = 0.05  # Default
    try:
        rf_query = (
            select(MacroIndicator.value)
            .where(MacroIndicator.indicator_name == "FEDFUNDS")
            .order_by(MacroIndicator.date.desc())
            .limit(1)
        )
        rf_result = session.execute(rf_query).scalar_one_or_none()
        if rf_result:
            risk_free_rate = rf_result / 100  # Convert percentage to decimal
    except:
        pass
    
    sharpe = calculate_sharpe_ratio(closes, risk_free_rate, 252)
    
    # Calculate max drawdown (last 1 year)
    max_dd = calculate_max_drawdown(closes[-252:] if len(closes) > 252 else closes)
    
    # Calculate 52-week high/low
    week_52 = calculate_52_week_high_low(highs_lows)
    
    # Get SPY data for beta calculation
    spy_query = (
        select(ETFPrice.date, ETFPrice.close)
        .where(ETFPrice.ticker == "SPY")
        .order_by(ETFPrice.date.asc())
    )
    spy_result = session.execute(spy_query)
    spy_data = spy_result.fetchall()
    
    # Calculate beta
    etf_date_prices = [(row[0], row[4]) for row in price_data]  # date, close
    spy_date_prices = [(row[0], row[1]) for row in spy_data]
    beta = calculate_beta(etf_date_prices, spy_date_prices, 252)
    
    return {
        "ticker": ticker.upper(),
        "latest_price": round(latest_price, 2) if latest_price else None,
        "latest_date": latest_date.isoformat() if latest_date else None,
        "data_points": len(closes),
        "metrics": {
            "return_1m": returns.get("return_1m"),
            "return_3m": returns.get("return_3m"),
            "return_6m": returns.get("return_6m"),
            "return_ytd": ytd_return,
            "return_1y": returns.get("return_1y"),
            "return_3y": returns.get("return_3y"),
            "return_5y": returns.get("return_5y"),
            "volatility": volatility,
            "beta": beta,
            "sharpe_ratio": sharpe,
            "max_drawdown": max_dd,
            "week_52_high": week_52["week_52_high"],
            "week_52_low": week_52["week_52_low"],
            "risk_free_rate_used": round(risk_free_rate * 100, 2),
        }
    }
