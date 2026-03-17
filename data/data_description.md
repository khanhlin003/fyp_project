=== LOCAL DATA STRUCTURE ===

official/
  sg/
    - etf_metadata.csv (85 Singapore ETFs)
    - price/*.csv (85 CSV files, historical prices)
    - macro/ (empty - using US macro data)
  us/
    - etf_metadata.csv (2,187 US ETFs)
    - price/*.csv (2,187 CSV files, historical prices)
    - macro/*.csv (5 economic indicators)

processed/
  - combined_etf_metadata.csv (2,272 ETFs total, 32 columns, 4.04 MB)
  - combined_etf_prices_15y.csv (5,793,153 rows, 567.82 MB, 2010-2025)
  - combined_macro_indicators.csv (15,585 rows, 0.42 MB, 1947-2025)
  - supabase_upload/*.csv (6 split files for gradual upload)

raw/
  holdings/
  macro/
    singapore/
    us/
      - Federal Funds Rate FEDFUNDS.csv
      - 10-Year Treasury Yield DGS10.csv
      - CPI (Inflation) CPIAUCSL.csv
      - Unemployment Rate 
      - S&P 500 Index
      - VIX (Volatility Index) VIXCLS.csv
      - GDP Growth Rate GDP.csv
  news/
  prices/

user_info/
  - user_info.csv
  - quiz_qus.json (15 questions, scoring 0-1275)
  - quiz_result.csv


=== SUPABASE DATABASE SCHEMA ===

Project: etf-recommender-fyp
Host: aws-1-ap-southeast-1.pooler.supabase.com:6543
Database: postgres

Table 1: etfs
--------------
Total Rows: 2,272 (2,187 US + 85 SG)
Primary Key: ticker (VARCHAR)

Columns (32):
  - ticker: VARCHAR (e.g., "SPY", "IVV", "G3B.SI")
  - etf_name: VARCHAR (e.g., "SPDR S&P 500 ETF Trust")
  - issuer: VARCHAR (e.g., "State Street Global Advisors")
  - brand: VARCHAR (e.g., "SPDR")
  - inception: VARCHAR (inception date)
  - category: VARCHAR (e.g., "Large Cap Blend", "Bond")
  - asset_class: VARCHAR (e.g., "Equity", "Fixed Income")
  - asset_class_size: VARCHAR (e.g., "Large-Cap", "Mid-Cap")
  - asset_class_style: VARCHAR (e.g., "Blend", "Growth", "Value")
  - general_region: VARCHAR (e.g., "North America", "Asia-Pacific")
  - specific_region: VARCHAR (e.g., "U.S.", "Singapore")
  - expense_ratio: VARCHAR (annual fee, e.g., "0.09%")
  - aum: VARCHAR (assets under management, e.g., "$500B")
  - index_tracked: VARCHAR (e.g., "S&P 500")
  - 1_month_return: VARCHAR
  - 3_month_return: VARCHAR
  - ytd_return: VARCHAR
  - 1_year_return: VARCHAR
  - 3_year_return: VARCHAR
  - 5_year_return: VARCHAR
  - 52_week_low: VARCHAR
  - 52_week_high: VARCHAR
  - beta: VARCHAR (market correlation)
  - standard_deviation: VARCHAR (volatility measure)
  - annual_dividend_rate: VARCHAR
  - annual_dividend_yield: VARCHAR
  - dividend: VARCHAR
  - dividend_date: VARCHAR
  - top_holdings: TEXT (JSON string of top 10 holdings)
  - sector_breakdown: TEXT (JSON string of sector allocation)
  - source: VARCHAR (data source: "ETFdb.com" or "yfinance")
  - last_updated: VARCHAR (timestamp)

Data Quality:
  ✅ expense_ratio: 99.4% populated
  ✅ category: 98.4% populated
  ✅ aum: 96.0% populated
  ⚠️ Some performance metrics may be NULL for newly listed ETFs

Table 2: etf_prices
--------------------
Total Rows: 5,793,153
Date Range: 2010-12-27 to 2025-12-05 (15 years)
Tickers: 2,272 distinct
Primary Key: id (BIGINT, auto-increment)
Indexes:
  - idx_etf_prices_ticker (on ticker)
  - idx_etf_prices_date (on date)
  - idx_etf_prices_ticker_date (composite)

Columns (8):
  - id: BIGINT PRIMARY KEY
  - ticker: VARCHAR(20) (foreign key to etfs.ticker)
  - date: DATE (trading date)
  - open: NUMERIC(15,6) (opening price)
  - high: NUMERIC(15,6) (daily high)
  - low: NUMERIC(15,6) (daily low)
  - close: NUMERIC(15,6) (closing price)
  - volume: BIGINT (trading volume)

Average Records per Ticker: ~2,550 rows
Data Quality:
  ✅ No NULL values in close/date columns
  ✅ All tickers match etfs table
  ✅ Continuous daily data (excluding weekends/holidays)

Table 3: macro_indicators
--------------------------
Total Rows: 15,585
Date Range: 1947-01-01 to 2025-10-20
Indicators: 5 distinct
Primary Key: id (INTEGER, auto-increment)
Indexes:
  - idx_macro_indicator_name (on indicator_name)
  - idx_macro_date (on date)

Columns (4):
  - id: INTEGER PRIMARY KEY
  - indicator_name: VARCHAR(50)
  - date: DATE
  - value: NUMERIC(15,6)

Indicators Breakdown:
  1. CPIAUCSL (Consumer Price Index): 944 rows
     - Monthly data
     - Range: 1947-01-01 to 2025-10-01
     - Use: Inflation tracking
  
  2. DGS10 (10-Year Treasury Yield): 6,704 rows
     - Daily data
     - Range: 1962-01-02 to 2025-10-18
     - Use: Risk-free rate benchmark
  
  3. FEDFUNDS (Federal Funds Rate): 855 rows
     - Monthly data
     - Range: 1954-07-01 to 2025-10-01
     - Use: Monetary policy indicator
  
  4. GDP (Gross Domestic Product): 314 rows
     - Quarterly data
     - Range: 1947-01-01 to 2025-07-01
     - Use: Economic growth tracking
  
  5. VIXCLS (VIX Volatility Index): 6,768 rows
     - Daily data
     - Range: 1990-01-02 to 2025-10-18
     - Use: Market fear gauge

Data Quality:
  ✅ All indicators from official FRED database
  ✅ No duplicate date entries per indicator
  ⚠️ Some NULL values in DGS10 (weekends/holidays)


=== DATA UPLOAD SUMMARY ===

Upload Method: PostgreSQL COPY command via psql CLI
Upload Scripts:
  - backend/scripts/upload_prices_to_supabase.sh
  - backend/scripts/upload_macro_to_supabase.sh

Performance:
  - etf_prices: 5,793,153 rows in 304 seconds (~19,056 rows/sec)
  - macro_indicators: 15,585 rows in 2 seconds
  - Total upload time: ~5 minutes

Source Files:
  - data/processed/supabase_upload/etf_prices_part_*_of_6.csv
  - data/processed/combined_macro_indicators.csv


=== TABLES (Created but not populated) ===

Table 4: users (Created but not populated)
------------
Purpose: User authentication and profile storage
Columns:
  - id: INTEGER PRIMARY KEY
  - email: VARCHAR UNIQUE
  - password_hash: VARCHAR
  - risk_profile: VARCHAR (Conservative/Balanced/Aggressive)
  - risk_score: INTEGER (0-1275 from quiz)
  - created_at: TIMESTAMP
  - last_login: TIMESTAMP

Table 5: portfolios (Created but not populated)
-----------------
Purpose: Track user ETF holdings
Columns:
  - id: INTEGER PRIMARY KEY
  - user_id: INTEGER (foreign key to users.id)
  - ticker: VARCHAR (foreign key to etfs.ticker)
  - quantity: NUMERIC(15,6)
  - purchase_date: DATE
  - purchase_price: NUMERIC(15,6)
  - notes: TEXT
  

Table 6: quiz_result (Created but not populated)
-----------------
Purpose: track quiz result 
Columns:
  - id: INTEGER PRIMARY KEY
  - user_id: INTEGER (foreign key to users.id)
  - question_number:INTEGER
  - answer: VARCHAR(5)
  - created_at: TIMESTAMP



Table: news (not created)
-----------------
Purpose: track news ...