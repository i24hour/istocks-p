#!/usr/bin/env python3
"""
Auto-fetch stock data from Angel One and save to PostgreSQL
Runs daily after market close to fetch latest data
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
load_dotenv()

# Angel One credentials
API_KEY = "836MHyks"
CLIENT_ID = "P60613196"
SECRET_KEY = "1844"
TOTP_TOKEN = "774ISS7A3URGKAG5MN5H2Z4OVE"

# Database connection
DATABASE_URL = "postgresql://priyanshu@localhost:5432/stock_analysis"

# Stock configuration
STOCK_NAME = "WIPRO"
STOCK_SYMBOL = "WIPRO"
STOCK_ID = "cmi2cmbzn0000ne9p2v0g98ry"  # Your existing stock ID

# Angel One Scrip Master URL
SCRIP_MASTER_URL = "https://margincalculator.angelone.in/OpenAPI_File/files/OpenAPIScripMaster.json"

def get_symbol_token(name, exchange="NSE"):
    """Fetch token for a stock by name"""
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

def get_last_fetched_date():
    """Get the last date we have data for in the database"""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        cur.execute("""
            SELECT MAX(timestamp) 
            FROM "StockPrice" 
            WHERE "stockId" = %s
        """, (STOCK_ID,))
        
        result = cur.fetchone()
        cur.close()
        conn.close()
        
        if result and result[0]:
            # Return date in IST
            return result[0]
        else:
            # If no data, start from 30 days ago
            return datetime.now() - timedelta(days=30)
            
    except Exception as e:
        logger.error(f"Error getting last date: {str(e)}")
        return datetime.now() - timedelta(days=30)

def fetch_data_in_chunks(smartApi, token, start_date, end_date, interval="ONE_MINUTE"):
    """Fetch historical data in chunks to avoid API limits"""
    all_data = []
    current_start = start_date
    
    while current_start < end_date:
        # Fetch 1 day at a time to avoid API limits
        current_end = current_start + timedelta(days=1)
        if current_end > end_date:
            current_end = end_date
        
        from_date_str = current_start.strftime("%Y-%m-%d %H:%M")
        to_date_str = current_end.strftime("%Y-%m-%d %H:%M")
        
        logger.info(f"Fetching data from {from_date_str} to {to_date_str}")
        
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
                logger.info(f"✅ Fetched {len(historical_data['data'])} records")
            else:
                logger.warning(f"⚠️  No data for {from_date_str} to {to_date_str}")
            
            # Sleep to avoid rate limits (500ms between requests)
            time.sleep(0.5)
            
        except Exception as e:
            logger.error(f"❌ Error fetching data: {str(e)}")
        
        current_start = current_end
    
    return all_data

def save_to_database(data):
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
            timestamp = datetime.strptime(candle[0], "%Y-%m-%dT%H:%M:%S%z")
            
            # Generate unique ID
            record_id = f"price_{STOCK_ID}_{timestamp.strftime('%Y%m%d%H%M%S')}"
            
            records.append((
                record_id,
                STOCK_ID,
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
            (id, "stockId", timestamp, open, high, low, close, volume)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING
        """
        
        execute_batch(cur, insert_query, records, page_size=100)
        conn.commit()
        
        inserted_count = cur.rowcount
        cur.close()
        conn.close()
        
        logger.info(f"✅ Inserted {inserted_count} new records into database")
        return inserted_count
        
    except Exception as e:
        logger.error(f"❌ Database error: {str(e)}")
        return 0

def main():
    """Main function to fetch and save data"""
    logger.info("🚀 Starting auto-fetch stock data script")
    
    # Get token
    token = get_symbol_token(STOCK_NAME)
    if not token:
        logger.error(f"❌ Could not fetch token for {STOCK_NAME}")
        return
    
    logger.info(f"✅ Token for {STOCK_NAME}: {token}")
    
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
    
    # Get last fetched date
    last_date = get_last_fetched_date()
    logger.info(f"📅 Last data in database: {last_date}")
    
    # Calculate fetch range
    start_date = last_date + timedelta(minutes=1)  # Start from next minute
    end_date = datetime.now()
    
    # If today is a trading day and market hasn't closed, set end to 3:30 PM today
    today = datetime.now()
    if today.weekday() < 5:  # Monday to Friday
        market_close = today.replace(hour=15, minute=30, second=0, microsecond=0)
        if today < market_close:
            end_date = market_close
    
    logger.info(f"📊 Fetching data from {start_date} to {end_date}")
    
    # Fetch data
    try:
        historical_data = fetch_data_in_chunks(smartApi, token, start_date, end_date)
        
        if historical_data:
            logger.info(f"✅ Fetched {len(historical_data)} total records")
            
            # Save to database
            inserted = save_to_database(historical_data)
            logger.info(f"✅ Successfully saved {inserted} new records")
        else:
            logger.warning("⚠️  No new data fetched")
        
    except Exception as e:
        logger.error(f"❌ Error in main process: {str(e)}")
    
    # Logout
    try:
        smartApi.terminateSession(CLIENT_ID)
        logger.info("✅ Logged out successfully")
    except Exception as e:
        logger.warning(f"⚠️  Logout warning: {str(e)}")
    
    logger.info("🏁 Script completed")

if __name__ == "__main__":
    main()
