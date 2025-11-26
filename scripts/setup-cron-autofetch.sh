#!/bin/bash
# Simple cron-based auto-fetch setup
# Adds entries to crontab for automatic data fetching during market hours

PROJECT_DIR="/Users/priyanshu/Desktop/Desktop/Github/istocks-p"
SCRIPT_PATH="$PROJECT_DIR/scripts/auto-fetch-stock-data.py"
LOG_DIR="$PROJECT_DIR/logs/auto-fetch"

echo "🚀 Setting up cron-based auto-fetch..."
echo ""

# Create log directory
mkdir -p "$LOG_DIR"
echo "✅ Created log directory: $LOG_DIR"

# Make script executable
chmod +x "$SCRIPT_PATH"
echo "✅ Made script executable"

# Create cron entries
CRON_ENTRIES="
# iStocks Auto-Fetch: Fetch stock data during market hours (Mon-Fri)
# Market hours: 9:15 AM - 3:30 PM IST

# Every 15 minutes during market hours (9:15 AM - 3:30 PM, Mon-Fri)
*/15 9-15 * * 1-5 /usr/bin/python3 $SCRIPT_PATH >> $LOG_DIR/output.log 2>> $LOG_DIR/error.log

# After market close (3:35 PM, Mon-Fri) - Final fetch
35 15 * * 1-5 /usr/bin/python3 $SCRIPT_PATH >> $LOG_DIR/output.log 2>> $LOG_DIR/error.log
"

# Backup current crontab
crontab -l > /tmp/crontab_backup_$(date +%Y%m%d_%H%M%S).txt 2>/dev/null
echo "✅ Backed up current crontab"

# Remove old iStocks entries if they exist
(crontab -l 2>/dev/null | grep -v "iStocks Auto-Fetch" | grep -v "$SCRIPT_PATH") | crontab -

# Add new entries
(crontab -l 2>/dev/null; echo "$CRON_ENTRIES") | crontab -

if [ $? -eq 0 ]; then
    echo "✅ Successfully added cron jobs!"
    echo ""
    echo "📊 Auto-fetch schedule:"
    echo "   • Every 15 minutes: 9:00 AM - 3:30 PM (Mon-Fri)"
    echo "   • Final fetch: 3:35 PM (after market close)"
    echo "   • Logs: $LOG_DIR"
    echo ""
    echo "🔧 Management:"
    echo "   View crontab:   crontab -l"
    echo "   Edit crontab:   crontab -e"
    echo "   Remove jobs:    crontab -e (then delete iStocks lines)"
    echo "   Test script:    python3 $SCRIPT_PATH"
    echo "   View logs:      tail -f $LOG_DIR/output.log"
    echo ""
    echo "Current crontab:"
    crontab -l | grep -A2 "iStocks"
else
    echo "❌ Failed to setup cron jobs"
    exit 1
fi
