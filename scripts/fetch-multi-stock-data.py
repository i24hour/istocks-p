#!/usr/bin/env python3
"""
Fetch historical stock data for multiple stocks and save to PostgreSQL
Supports 10 years of 1-minute candle data with technical indicators
"""

import requests
import psycopg2
from psycopg2.extras import execute_batch
from SmartApi.smartConnect import SmartConnect
import pyotp
from logzero import logger
from datetime import datetime, timedelta
import time
import os
from dotenv import load_dotenv

# Load environment variables
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_path = os.path.join(project_root, '.env.local')
load_dotenv(env_path)

# Angel One credentials
API_KEY = os.getenv("ANGELONE_API_KEY", "836MHyks")
CLIENT_ID = os.getenv("ANGELONE_CLIENT_ID", "P60613196")
SECRET_KEY = os.getenv("ANGELONE_SECRET_KEY", "1844")
TOTP_TOKEN = os.getenv("ANGELONE_TOTP_TOKEN", "774ISS7A3URGKAG5MN5H2Z4OVE")

# Database connection - use local PostgreSQL
DATABASE_URL = os.getenv("DATABASE_URL")

# Clean up DATABASE_URL if it contains Azure references
if DATABASE_URL and ("istocks.postgres.database.azure.com" in DATABASE_URL or "priyanshu@123" in DATABASE_URL):
    # Use local database instead
    DATABASE_URL = "postgresql://priyanshu@localhost:5432/stock_analysis"
elif not DATABASE_URL:
    DATABASE_URL = "postgresql://priyanshu@localhost:5432/stock_analysis"


# Angel One Scrip Master URL
SCRIP_MASTER_URL = "https://margincalculator.angelone.in/OpenAPI_File/files/OpenAPIScripMaster.json"

# Stock configurations
STOCKS_CONFIG = [
    {
        "symbol": "WIPRO",
        "name": "Wipro Limited",
        "angel_one_name": "WIPRO",
        "exchange": "NSE"
    }
]


def get_symbol_token(name, exchange="NSE"):
    """Fetch token for a stock by name from Angel One scrip master"""
    try:
        response = requests.get(SCRIP_MASTER_URL)
        data = response.json()
        
        for item in data:
            if item["name"].lower() == name.lower() and item["exch_seg"] == exchange:
                return item["token"]
        
        return None
    except Exception as e:
        logger.error(f"Error fetching token: {str(e)}")
        return None


def create_stock_record(symbol, name, exchange):
    """Create a stock record in the database if it doesn't exist"""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        # Generate a unique ID using cuid format (simplified version)
        import hashlib
        stock_id = f"stock_{hashlib.md5(symbol.encode()).hexdigest()[:20]}"
        
        # Insert stock record (ignore if exists)
        insert_query = """
            INSERT INTO "Stock" (id, symbol, name, exchange, "createdAt", "updatedAt")
            VALUES (%s, %s, %s, %s, NOW(), NOW())
            ON CONFLICT (symbol) DO UPDATE
            SET name = EXCLUDED.name,
                exchange = EXCLUDED.exchange,
                "updatedAt" = NOW()
            RETURNING id
        """
        
        cur.execute(insert_query, (stock_id, symbol, name, exchange))
        result = cur.fetchone()
        stock_id = result[0]
        
        conn.commit()
        cur.close()
        conn.close()
        
        logger.info(f"✅ Stock record created/updated: {symbol} (ID: {stock_id})")
        return stock_id
        
    except Exception as e:
        logger.error(f"❌ Error creating stock record: {str(e)}")
        return None


def get_stock_id(symbol):
    """Get stock ID from database by symbol"""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        cur.execute('SELECT id FROM "Stock" WHERE symbol = %s', (symbol,))
        result = cur.fetchone()
        
        cur.close()
        conn.close()
        
        if result:
            return result[0]
        return None
        
    except Exception as e:
        logger.error(f"❌ Error getting stock ID: {str(e)}")
        return None


def fetch_data_in_chunks(smartApi, token, start_date, end_date, interval="ONE_MINUTE"):
    """Fetch historical data in 30-day chunks"""
    all_data = []
    current_start = start_date
    
    while current_start < end_date:
        # Fetch 30 days at a time
        current_end = current_start + timedelta(days=30)
        if current_end > end_date:
            current_end = end_date
        
        from_date_str = current_start.strftime("%Y-%m-%d %H:%M")
        to_date_str = current_end.strftime("%Y-%m-%d %H:%M")
        
        logger.info(f"  Fetching: {from_date_str} to {to_date_str}")
        
        try:
            historicParam = {
                "exchange": "NSE",
                "symboltoken": token,
                "interval": interval,
                "fromdate": from_date_str,
                "todate": to_date_str,
            }
            
            historical_data = smartApi.getCandleData(historicParam)
            
            if "data" in historical_data and historical_data["data"]:
                all_data.extend(historical_data["data"])
                logger.info(f"  ✅ Fetched {len(historical_data['data'])} records")
            else:
                logger.warning(f"  ⚠️  No data for this period")
            
            # Sleep to avoid rate limits
            time.sleep(0.5)
            
        except Exception as e:
            logger.error(f"  ❌ Error: {str(e)}")
        
        current_start = current_end
    
    return all_data


def save_to_database(stock_id, symbol, data):
    """Save fetched data to PostgreSQL database"""
    if not data:
        logger.warning("No data to save")
        return 0
    
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        # Prepare data for insertion
        records = []
        for candle in data:
            # candle format: [timestamp, open, high, low, close, volume]
            timestamp_str = candle[0]
            
            # Parse timestamp (format: "2025-11-14T09:15:00+05:30")
            timestamp = datetime.strptime(timestamp_str, "%Y-%m-%dT%H:%M:%S%z")
            
            # Remove timezone to store as naive datetime (IST)
            timestamp = timestamp.replace(tzinfo=None)
            
            # Generate unique ID
            record_id = f"price_{stock_id}_{timestamp.strftime('%Y%m%d%H%M%S')}"
            
            records.append((
                record_id,
                stock_id,
                timestamp,
                float(candle[1]),  # open
                float(candle[2]),  # high
                float(candle[3]),  # low
                float(candle[4]),  # close
                int(candle[5]),    # volume
            ))
        
        # Insert data (ON CONFLICT DO NOTHING to avoid duplicates)
        insert_query = """
            INSERT INTO "StockPrice" 
            (id, "stockId", timestamp, open, high, low, close, volume, "createdAt")
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (id) DO NOTHING
        """
        
        execute_batch(cur, insert_query, records, page_size=1000)
        conn.commit()
        
        inserted_count = cur.rowcount
        cur.close()
        conn.close()
        
        logger.info(f"✅ Inserted {inserted_count} new records for {symbol}")
        return inserted_count
        
    except Exception as e:
        logger.error(f"❌ Database error: {str(e)}")
        return 0


def fetch_and_save_stock(smartApi, stock_config, years=10):
    """Fetch and save data for a single stock"""
    symbol = stock_config["symbol"]
    name = stock_config["name"]
    angel_one_name = stock_config["angel_one_name"]
    exchange = stock_config["exchange"]
    
    logger.info(f"\n{'='*60}")
    logger.info(f"Processing: {name} ({symbol})")
    logger.info(f"{'='*60}")
    
    # Step 1: Create stock record
    stock_id = create_stock_record(symbol, name, exchange)
    if not stock_id:
        logger.error(f"Failed to create stock record for {symbol}")
        return False
    
    # Step 2: Get Angel One token
    token = get_symbol_token(angel_one_name, exchange)
    if not token:
        logger.error(f"Could not fetch token for {angel_one_name}")
        return False
    
    logger.info(f"✅ Token: {token}")
    
    # Step 3: Calculate date range (10 years)
    end_date = datetime.now()
    start_date = end_date - timedelta(days=365 * years)
    
    logger.info(f"📅 Fetching {years} years of data")
    logger.info(f"   From: {start_date.strftime('%Y-%m-%d')}")
    logger.info(f"   To:   {end_date.strftime('%Y-%m-%d')}")
    
    # Step 4: Fetch historical data
    historical_data = fetch_data_in_chunks(smartApi, token, start_date, end_date)
    
    if not historical_data:
        logger.warning(f"No data fetched for {symbol}")
        return False
    
    logger.info(f"✅ Total records fetched: {len(historical_data)}")
    
    # Step 5: Save to database
    inserted = save_to_database(stock_id, symbol, historical_data)
    logger.info(f"✅ Successfully saved {inserted} records for {symbol}")
    
    return True


def main():
    """Main function to fetch and save data for all stocks"""
    logger.info("🚀 Starting multi-stock data fetch")
    logger.info(f"📊 Stocks to fetch: {', '.join([s['symbol'] for s in STOCKS_CONFIG])}")
    
    # Authenticate with Angel One
    try:
        smartApi = SmartConnect(api_key=API_KEY)
        totp = pyotp.TOTP(TOTP_TOKEN).now()
        
        data = smartApi.generateSession(CLIENT_ID, SECRET_KEY, totp)
        
        if not data.get('status', False):
            logger.error(f"❌ Authentication failed: {data}")
            return
        
        logger.info("✅ Successfully authenticated with Angel One")
        
    except Exception as e:
        logger.error(f"❌ Authentication error: {str(e)}")
        return
    
    # Fetch data for each stock
    start_time = datetime.now()
    success_count = 0
    
    for stock_config in STOCKS_CONFIG:
        if fetch_and_save_stock(smartApi, stock_config, years=10):
            success_count += 1
    
    # Logout
    try:
        smartApi.terminateSession(CLIENT_ID)
        logger.info("✅ Logged out successfully")
    except Exception as e:
        logger.warning(f"⚠️  Logout warning: {str(e)}")
    
    # Summary
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()
    
    logger.info(f"\n{'='*60}")
    logger.info(f"🏁 Fetch Complete!")
    logger.info(f"{'='*60}")
    logger.info(f"✅ Successful: {success_count}/{len(STOCKS_CONFIG)} stocks")
    logger.info(f"⏱️  Duration: {duration:.1f} seconds (~{duration/60:.1f} minutes)")
    logger.info(f"{'='*60}")


if __name__ == "__main__":
    main()
