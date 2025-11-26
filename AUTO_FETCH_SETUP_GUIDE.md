# Auto-Fetch Stock Data Setup

Automatically fetch and update stock data in your database during market hours.

## 🚀 Quick Setup (3 Steps)

### Step 1: Install Python Dependencies
```bash
chmod +x scripts/install-dependencies.sh
./scripts/install-dependencies.sh
```

### Step 2: Setup Automatic Fetching
```bash
chmod +x scripts/setup-cron-autofetch.sh
./scripts/setup-cron-autofetch.sh
```

### Step 3: Test It Works
```bash
chmod +x scripts/manual-fetch.sh
./scripts/manual-fetch.sh
```

## 📊 How It Works

- **Runs automatically** during market hours (9:15 AM - 3:30 PM IST)
- **Fetches every 15 minutes** on weekdays (Mon-Fri)
- **Final fetch at 3:35 PM** after market closes
- **Skips weekends** automatically
- **Saves to Azure PostgreSQL** database

## 🔧 Management Commands

### View Logs
```bash
# Live log monitoring
tail -f logs/auto-fetch/output.log

# Error logs
tail -f logs/auto-fetch/error.log

# Last 50 lines
tail -50 logs/auto-fetch/output.log
```

### Manual Run
```bash
# Run fetch manually anytime
./scripts/manual-fetch.sh

# Or directly
python3 scripts/auto-fetch-stock-data.py
```

### Check Cron Status
```bash
# View all scheduled jobs
crontab -l

# Check if auto-fetch is running
crontab -l | grep iStocks
```

### Stop Auto-Fetch
```bash
# Edit crontab
crontab -e

# Delete lines containing "iStocks Auto-Fetch"
# Save and exit
```

### Restart Auto-Fetch
```bash
# Re-run setup script
./scripts/setup-cron-autofetch.sh
```

## 📅 Schedule Details

| Time | Frequency | Purpose |
|------|-----------|---------|
| 9:00 AM - 3:30 PM | Every 15 min | Live market data |
| 3:35 PM | Once | Final EOD data |
| Days | Mon-Fri | Trading days only |

## 🐛 Troubleshooting

### Check if script is running
```bash
ps aux | grep auto-fetch-stock-data
```

### Test database connection
```bash
python3 -c "
import os
from dotenv import load_dotenv
load_dotenv('.env.local')
print('DATABASE_URL:', os.getenv('DATABASE_URL')[:50] + '...')
"
```

### Check Python packages
```bash
pip3 list | grep -E 'requests|psycopg2|smartapi|pyotp|logzero|dotenv'
```

### View last fetch time
```bash
# Check latest record in database
psql "$DATABASE_URL" -c "SELECT MAX(timestamp) FROM \"StockPrice\";"
```

## 📝 What Gets Fetched

- **Stock**: WIPRO (NSE)
- **Interval**: 1-minute candles
- **Data**: Open, High, Low, Close, Volume
- **Auto-dedup**: Skips duplicate records
- **Incremental**: Only fetches new data since last run

## 🔐 Environment Variables

Make sure `.env.local` has:
```bash
DATABASE_URL="postgresql://istocks:priyanshu@123@istocks.postgres.database.azure.com:5432/stock_analysis?sslmode=require&connect_timeout=10"
ANGELONE_API_KEY="836MHyks"
ANGELONE_CLIENT_ID="P60613196"
ANGELONE_SECRET_KEY="1844"
ANGELONE_TOTP_TOKEN="774ISS7A3URGKAG5MN5H2Z4OVE"
```

## ✅ Verification

After setup, verify it's working:

1. **Check crontab**: `crontab -l`
2. **Manual test**: `./scripts/manual-fetch.sh`
3. **View logs**: `tail logs/auto-fetch/output.log`
4. **Check database**: Visit your app and see latest data

## 🎯 Expected Behavior

- First run: Fetches all missing data since last record
- Subsequent runs: Only new data (very fast)
- Logs show: "✅ Inserted X new records"
- If no new data: "⚠️ No new data fetched" (normal during non-market hours)

## 📞 Support

If issues persist:
1. Check logs: `tail -100 logs/auto-fetch/error.log`
2. Test manually: `./scripts/manual-fetch.sh`
3. Verify credentials in `.env.local`
4. Check database connectivity
