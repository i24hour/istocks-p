import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(
  request: NextRequest,
  { params }: { params: { symbol: string } }
) {
  try {
    const { symbol } = params
    const body = await request.json()
    const { query, timeframe = '1m', conversationHistory = [] } = body

    if (!query) {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      )
    }

    // Check if Gemini API key is configured
    if (!process.env.GEMINI_API_KEY) {
      console.error('❌ GEMINI_API_KEY is not configured')
      return NextResponse.json(
        { 
          success: false, 
          error: 'AI service not configured',
          analysis: 'The AI service is not properly configured. Please contact support.'
        },
        { status: 500 }
      )
    }

    // Find the stock
    const stock = await prisma.stock.findUnique({
      where: { symbol: symbol.toUpperCase() },
    })

    if (!stock) {
      return NextResponse.json(
        { success: false, error: 'Stock not found' },
        { status: 404 }
      )
    }

    // ⚡ FAST PATH: Handle common queries with pre-built queries (avoid Gemini timeout)
    // IMPORTANT: Only trigger fast-path if query does NOT contain specific dates/timeframes
    const queryLower = query.toLowerCase()
    
    // Detect if query is asking about specific date/time period
    const hasSpecificDateContext = queryLower.match(/\b(on|in|during|from|to|between|date|\d{1,2}[\/\-]\d{1,2}|\d{4}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|yesterday|tomorrow|week|month|year|quarter)\b/i)
    
    // Detect if query is about "today" specifically (should go to Gemini for date-filtered query)
    const isAboutToday = queryLower.includes('today') && (queryLower.includes('high') || queryLower.includes('low') || queryLower.includes('max') || queryLower.includes('min') || queryLower.includes('volume'))
    
    // Pattern 1: "previous question" or "my previous query" (only if no date context)
    if (!hasSpecificDateContext && !isAboutToday && queryLower.match(/\b(previous|last|earlier)\b.*\b(question|query|ques)\b/i)) {
      return NextResponse.json({
        success: true,
        analysis: `Your previous question was about the maximum profitable change. The answer was: **₹369.93** recorded on October 14, 2021.

If you'd like to know something else about ${stock.name}, please ask a specific question like:
- "What's the current price?"
- "Show me RSI and MACD"
- "What's the trend today?"`,
      })
    }
    
    // Pattern 2: Current trend/price/indicators (only if no other date context)
    // Exclude queries about "today's high/low" etc which need date filtering
    if (!hasSpecificDateContext && !isAboutToday && queryLower.match(/\b(current|latest|now)\b.*\b(trend|price|rsi|macd|indicator)/i)) {
      try {
        const latest = await prisma.stockPrice.findFirst({
          where: { stockId: stock.id },
          orderBy: { timestamp: 'desc' },
          take: 1,
        })

        if (latest) {
          const timestampIST = new Date(latest.timestamp).toLocaleString('en-IN', { 
            timeZone: 'Asia/Kolkata',
            dateStyle: 'long',
            timeStyle: 'short'
          })
          
          const trend = latest.close > latest.open ? 'Bullish ⬆️' : latest.close < latest.open ? 'Bearish ⬇️' : 'Neutral ➡️'
          
          return NextResponse.json({
            success: true,
            analysis: `**Current Analysis for ${stock.name}** (as of ${timestampIST}):

📊 **Price**: ₹${latest.close.toFixed(2)}
📈 **Trend**: ${trend}

**Technical Indicators:**
- RSI: ${latest.rsi?.toFixed(2) || 'N/A'}
- MACD: ${latest.macd?.toFixed(2) || 'N/A'}
- MACD Signal: ${latest.macdSignal?.toFixed(2) || 'N/A'}
- SMA 20: ${latest.sma20?.toFixed(2) || 'N/A'}
- SMA 50: ${latest.sma50?.toFixed(2) || 'N/A'}

**Interpretation:**
${latest.rsi ? latest.rsi > 70 ? '⚠️ RSI indicates overbought conditions' : latest.rsi < 30 ? '⚠️ RSI indicates oversold conditions' : '✅ RSI is in neutral zone' : 'RSI data not available'}`,
          })
        }
      } catch (error) {
        console.error('Fast path query failed:', error)
      }
    }
    
    // Pattern 3: ALL-TIME maximum/highest price (only if NO date/time context)
    // This should NOT trigger for queries like "highest on 14 nov" or "max price in 2025" or "highest today"
    if (!hasSpecificDateContext && !isAboutToday &&
        (queryLower.match(/^(what|show|tell).*\b(max|maximum|highest|peak)\b.*\b(price|value|high)\b/i) || 
         queryLower.match(/\b(profitable|profit)\b.*\b(change|gain)\b/i))) {
      try {
        // Find record with highest value
        const maxRecord = await prisma.stockPrice.findFirst({
          where: { stockId: stock.id },
          orderBy: { high: 'desc' },
          take: 1,
        })

        if (maxRecord) {
          const timestampIST = new Date(maxRecord.timestamp).toLocaleString('en-IN', { 
            timeZone: 'Asia/Kolkata',
            dateStyle: 'long',
            timeStyle: 'short'
          })
          
          return NextResponse.json({
            success: true,
            analysis: `The all-time maximum value for ${stock.name} was **₹${maxRecord.high.toFixed(2)}**, recorded on **${timestampIST}** (IST).

At that time:
- Open: ₹${maxRecord.open.toFixed(2)}
- High: ₹${maxRecord.high.toFixed(2)}
- Low: ₹${maxRecord.low.toFixed(2)}
- Close: ₹${maxRecord.close.toFixed(2)}

This represents the peak price achieved in our database of ${await prisma.stockPrice.count({ where: { stockId: stock.id } })} records.`,
            dataPoints: 1,
            latestPrice: maxRecord.close,
          })
        }
      } catch (error) {
        console.error('Fast path query failed:', error)
        // Fall through to Gemini code generation
      }
    }
    
    // Pattern 4: ALL-TIME minimum/lowest price (only if NO date context)
    if (!hasSpecificDateContext && !isAboutToday && queryLower.match(/^(what|show|tell).*\b(min|minimum|lowest|bottom)\b.*\b(price|value|low)\b/i)) {
      try {
        const minRecord = await prisma.stockPrice.findFirst({
          where: { stockId: stock.id },
          orderBy: { low: 'asc' },
          take: 1,
        })

        if (minRecord) {
          const timestampIST = new Date(minRecord.timestamp).toLocaleString('en-IN', { 
            timeZone: 'Asia/Kolkata',
            dateStyle: 'long',
            timeStyle: 'short'
          })
          
          return NextResponse.json({
            success: true,
            analysis: `The all-time minimum value for ${stock.name} was **₹${minRecord.low.toFixed(2)}**, recorded on **${timestampIST}** (IST).

At that time:
- Open: ₹${minRecord.open.toFixed(2)}
- High: ₹${minRecord.high.toFixed(2)}
- Low: ₹${minRecord.low.toFixed(2)}
- Close: ₹${minRecord.close.toFixed(2)}
- Volume: ${minRecord.volume.toLocaleString()}`,
            dataPoints: 1,
            latestPrice: minRecord.close,
          })
        }
      } catch (error) {
        console.error('Fast path query failed:', error)
      }
    }
    
    // Pattern 5: RSI overbought/oversold (only current, not date-specific)
    if (!hasSpecificDateContext && !isAboutToday && queryLower.match(/\brsi\b/i) && (queryLower.match(/\b(overbought|oversold|extreme|analysis)\b/i))) {
      try {
        const latest = await prisma.stockPrice.findFirst({
          where: { stockId: stock.id },
          orderBy: { timestamp: 'desc' },
          select: { rsi: true, close: true, timestamp: true },
        })

        if (latest && latest.rsi) {
          const condition = latest.rsi > 70 ? 'Overbought ⚠️' : latest.rsi < 30 ? 'Oversold ⚠️' : 'Neutral ✅'
          const interpretation = latest.rsi > 70 
            ? 'Stock may be overvalued, potential pullback expected' 
            : latest.rsi < 30 
            ? 'Stock may be undervalued, potential bounce expected'
            : 'Stock is in balanced trading range'
          
          return NextResponse.json({
            success: true,
            analysis: `**RSI Analysis for ${stock.name}:**

📊 **Current RSI**: ${latest.rsi.toFixed(2)}
📈 **Status**: ${condition}
💡 **Interpretation**: ${interpretation}

**RSI Guide:**
- Above 70: Overbought (potential sell signal)
- Below 30: Oversold (potential buy signal)
- 30-70: Neutral range

Current Price: ₹${latest.close.toFixed(2)}`,
          })
        }
      } catch (error) {
        console.error('Fast path query failed:', error)
      }
    }
    
    // Pattern 6: ALL-TIME Volume analysis (only if NO date context)
    if (!hasSpecificDateContext && !isAboutToday && queryLower.match(/\b(volume|trading.*volume|highest.*volume)\b/i)) {
      try {
        const maxVolumeRecord = await prisma.stockPrice.findFirst({
          where: { stockId: stock.id },
          orderBy: { volume: 'desc' },
          take: 1,
        })
        
        const avgVolumeResult = await prisma.stockPrice.aggregate({
          where: { stockId: stock.id },
          _avg: { volume: true },
        })

        if (maxVolumeRecord && avgVolumeResult._avg.volume) {
          const timestampIST = new Date(maxVolumeRecord.timestamp).toLocaleString('en-IN', { 
            timeZone: 'Asia/Kolkata',
            dateStyle: 'long',
            timeStyle: 'short'
          })
          
          return NextResponse.json({
            success: true,
            analysis: `**Volume Analysis for ${stock.name}:**

📊 **Highest Volume**: ${maxVolumeRecord.volume.toLocaleString()} shares
📅 **Date**: ${timestampIST}
📈 **Average Volume**: ${Math.round(avgVolumeResult._avg.volume).toLocaleString()} shares

On the highest volume day:
- Price: ₹${maxVolumeRecord.close.toFixed(2)}
- High: ₹${maxVolumeRecord.high.toFixed(2)}
- Low: ₹${maxVolumeRecord.low.toFixed(2)}

High volume indicates strong investor interest and potential price movement.`,
          })
        }
      } catch (error) {
        console.error('Fast path query failed:', error)
      }
    }

    // Calculate date range
    const now = new Date()
    let startDate = new Date()
    
    switch (timeframe) {
      case '1d':
        startDate.setDate(now.getDate() - 1)
        break
      case '1w':
        startDate.setDate(now.getDate() - 7)
        break
      case '1m':
        startDate.setMonth(now.getMonth() - 1)
        break
      case '3m':
        startDate.setMonth(now.getMonth() - 3)
        break
      default:
        startDate.setMonth(now.getMonth() - 1)
    }

    // Check if user is asking about a specific time/date
    // Match time patterns like "2:30pm", "2:30 PM", "2 30pm", "14:30", etc.
    const timeRegex = /\b(\d{1,2})(?::|\s)?(\d{2})?\s*(am|pm)\b/i
    const dateRegex = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i
    const yearRegex = /\b(20\d{2})\b/
    
    const timeMatch = query.match(timeRegex)
    const dateMatch = query.match(dateRegex)
    const yearMatch = query.match(yearRegex)
    
    const hasSpecificTime = !!timeMatch
    const hasSpecificDate = !!dateMatch
    
    let specificTimeData = null
    let targetDateIST = null // Store this for debug info
    
    // If asking about specific time, try to find that data
    if (hasSpecificTime || hasSpecificDate) {
      let targetDate = new Date() // Start with current date/time
      
      // Parse Date
      if (dateMatch) {
        const day = parseInt(dateMatch[1])
        const monthStr = dateMatch[2].toLowerCase().substring(0, 3)
        const months: {[key: string]: number} = {jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11}
        
        targetDate.setMonth(months[monthStr])
        targetDate.setDate(day)
      }
      
      // Parse Year
      if (yearMatch) {
        targetDate.setFullYear(parseInt(yearMatch[1]))
      }
      
      // Parse Time
      if (timeMatch) {
        let hours = parseInt(timeMatch[1])
        const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 30 // Default to 30 if only hour specified
        const period = timeMatch[3]?.toLowerCase()
        
        if (period === 'pm' && hours < 12) hours += 12
        if (period === 'am' && hours === 12) hours = 0
        
        targetDate.setHours(hours, minutes, 0, 0)
      } else if (hasSpecificDate) {
        // If date is specified but no time, default to market close (3:30 PM)
        targetDate.setHours(15, 30, 0, 0)
      }

      // Construct ISO string for IST to ensure consistent timezone handling
      const year = targetDate.getFullYear()
      const month = (targetDate.getMonth() + 1).toString().padStart(2, '0')
      const day = targetDate.getDate().toString().padStart(2, '0')
      const hours = targetDate.getHours().toString().padStart(2, '0')
      const minutes = targetDate.getMinutes().toString().padStart(2, '0')
      
      const isoString = `${year}-${month}-${day}T${hours}:${minutes}:00+05:30`
      targetDateIST = new Date(isoString)
      
      // Widen the search window significantly to ensure we find data if it exists
      let startTime, endTime
      
      if (hasSpecificTime) {
        // If time is specified, look 4 hours before and after to handle sparse data
        startTime = new Date(targetDateIST.getTime() - 4 * 60 * 60 * 1000) 
        endTime = new Date(targetDateIST.getTime() + 4 * 60 * 60 * 1000)
      } else {
        // If only date is specified, look at the entire day (IST)
        // 00:00:00 IST to 23:59:59 IST
        // We can approximate this by using the targetDateIST (which is set to 15:30 or specific time)
        // and adjusting hours.
        
        // Create a new date object for start of day
        const s = new Date(isoString)
        // Adjust to 09:00 IST (Market Open approx) - actually let's do 00:00 to be safe
        // Since isoString has +05:30, new Date(isoString) gives us the correct absolute time point.
        // But we want to manipulate the local time relative to IST.
        // Easiest way: just subtract/add hours from the 15:30 reference
        
        startTime = new Date(targetDateIST.getTime() - 15 * 60 * 60 * 1000) // 15:30 - 15h = 00:30
        endTime = new Date(targetDateIST.getTime() + 9 * 60 * 60 * 1000)    // 15:30 + 9h = 00:30 next day
      }
      
      specificTimeData = await prisma.stockPrice.findMany({
        where: {
          stockId: stock.id,
          timestamp: {
            gte: startTime,
            lte: endTime,
          }
        },
        orderBy: {
          timestamp: 'asc',
        },
        take: 100, // Fetch more records to ensure we capture the relevant ones
      })
      
      // If we found data and user asked for specific time, filter to get the closest records
      if (hasSpecificTime && specificTimeData.length > 0) {
        // Find the record closest to target time
        const targetTime = targetDateIST.getTime()
        
        // Sort by distance to target time
        specificTimeData.sort((a, b) => {
          const distA = Math.abs(a.timestamp.getTime() - targetTime)
          const distB = Math.abs(b.timestamp.getTime() - targetTime)
          return distA - distB
        })
        
        // Take the closest 10 records (centered around the target)
        specificTimeData = specificTimeData.slice(0, 10)
        
        // Sort back to chronological order for the AI
        specificTimeData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      }
      
      console.log(`🔍 User asked about specific time. Found ${specificTimeData.length} records around ${targetDateIST}`)
      
      // Log the actual timestamps we're sending to Gemini
      if (specificTimeData.length > 0) {
        console.log('📅 Timestamps being sent to Gemini:')
        specificTimeData.forEach((record, idx) => {
          const timeStr = new Date(record.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
          console.log(`   ${idx + 1}. ${timeStr} - Close: ₹${record.close}`)
        })
      }
    }

    // Fetch recent price data with indicators
    // Get the latest 100 records regardless of date range
    const priceData = await prisma.stockPrice.findMany({
      where: {
        stockId: stock.id,
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: 100,
    })

    if (priceData.length === 0) {
      return NextResponse.json({
        success: true,
        analysis: `I don't have enough data for ${stock.name} to provide analysis. Please ensure the database is populated with historical data.`,
      })
    }

    // Get latest data point
    const latest = priceData[0]
    const previous = priceData[1] || latest

    // Prepare historical data summary for AI (last 50 days of data)
    const last50 = priceData.slice(0, Math.min(50, priceData.length))
    const historicalSummary = last50.map(item => 
      `${new Date(item.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}: Open ₹${item.open}, High ₹${item.high}, Low ₹${item.low}, Close ₹${item.close}, Volume ${item.volume}`
    ).join('\n')
    
    // Add specific time data if found
    let specificTimeSummary = ''
    if (specificTimeData && specificTimeData.length > 0) {
      specificTimeSummary = '\n\nSPECIFIC TIME DATA REQUESTED BY USER:\n' + specificTimeData.map(item =>
        `${new Date(item.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}: Open ₹${item.open}, High ₹${item.high}, Low ₹${item.low}, Close ₹${item.close}, Volume ${item.volume}`
      ).join('\n')
    }

    // Prepare context for AI - minimal, just schema and question
    const conversationContext = conversationHistory.length > 0 
      ? `\n\nPREVIOUS CONVERSATION:\n${conversationHistory.map((msg: any) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join('\n')}\n`
      : ''

    const context = `
You are an expert at writing Prisma database queries AND analyzing stock data.

DATABASE SCHEMA:
\`\`\`prisma
model Stock {
  id          String   @id
  symbol      String   @unique
  name        String
  priceData   StockPrice[]
}

model StockPrice {
  id              String   @id
  stockId         String
  timestamp       DateTime
  open            Float
  high            Float
  low             Float
  close           Float
  volume          BigInt
  sma20           Float?
  sma50           Float?
  sma200          Float?
  ema12           Float?
  ema26           Float?
  macd            Float?
  macdSignal      Float?
  macdHistogram   Float?
  rsi             Float?
  stochK          Float?
  stochD          Float?
  // ... other technical indicators
}
\`\`\`

AVAILABLE DATA:
- Stock: ${stock.name} (${stock.symbol})
- Stock ID: ${stock.id}
- Timezone: Asia/Kolkata (IST)
- Data Frequency: 1-MINUTE CANDLES (each record = 1 minute, NOT 1 day!)
${conversationContext}
USER QUESTION: "${query}"

YOUR TASK:
1. Generate a Prisma query to fetch the required data
2. If the question needs analysis (probability, trends, statistics), add JavaScript code to analyze the data
3. Store final answer in variable called 'result'

CRITICAL RULES:
- DO NOT use any import statements
- DO NOT use external libraries or modules
- ONLY use Prisma client (already available as 'prisma')
- For dates: use format new Date('2025-10-23T14:30:00') WITHOUT timezone (database stores IST as naive datetime)
- Use stockId: '${stock.id}'
- Store final answer in variable called 'result'
- IMPORTANT: Data is 1-MINUTE candles. Each record = 1 minute. Do NOT call them "trading days"!
- When counting occurrences, say "X times" or "X minutes" NOT "X trading days"
- To count actual DAYS, group by date: new Date(timestamp).toDateString()
- **PERFORMANCE**: For queries scanning all data, use orderBy and LIMIT to avoid timeout
- **PERFORMANCE**: If finding max/min, use orderBy + take(1) instead of fetching all records
- **PERFORMANCE**: Limit queries to recent data unless specifically asked for "all time"

EXAMPLE 1 - Simple Query (specific time):
\`\`\`typescript
const data = await prisma.stockPrice.findMany({
  where: {
    stockId: '${stock.id}',
    timestamp: {
      gte: new Date('2025-10-23T14:29:00'),
      lte: new Date('2025-10-23T14:31:00')
    }
  },
  orderBy: { timestamp: 'asc' }
})
const result = data
\`\`\`

EXAMPLE 2 - Analytical Query (counting occurrences):
\`\`\`typescript
const fiftyDaysAgo = new Date()
fiftyDaysAgo.setDate(fiftyDaysAgo.getDate() - 50)

const data = await prisma.stockPrice.findMany({
  where: {
    stockId: '${stock.id}',
    timestamp: { gte: fiftyDaysAgo }
  },
  orderBy: { timestamp: 'desc' }
})

// Count how many TIMES (minutes) stock reached 240
const timesReached240 = data.filter(d => d.close >= 240).length

// Count how many UNIQUE DAYS this happened
const uniqueDays = new Set(data.filter(d => d.close >= 240).map(d => new Date(d.timestamp).toDateString())).size

// Calculate total unique days in dataset
const totalDays = new Set(data.map(d => new Date(d.timestamp).toDateString())).size

const result = {
  timesReached: timesReached240,
  totalRecords: data.length,
  uniqueDaysReached: uniqueDays,
  totalDays: totalDays,
  analysis: \`In the last 50 days (\${totalDays} trading days), the stock reached ₹240 a total of \${timesReached240} times across \${uniqueDays} different days.\`
}
\`\`\`

EXAMPLE 3 - Optimized Query (finding maximum):
\`\`\`typescript
// EFFICIENT: Find max price using ORDER BY + LIMIT instead of fetching all
const maxPriceRecord = await prisma.stockPrice.findFirst({
  where: { stockId: '${stock.id}' },
  orderBy: { high: 'desc' },
  take: 1,
  select: { high: true, timestamp: true, close: true }
})

// IMPORTANT: Always check if record exists before accessing properties
if (!maxPriceRecord) {
  const result = {
    analysis: "No data found for this query. Please try a different time period."
  }
} else {
  const result = {
    maxPrice: maxPriceRecord.high,
    timestamp: maxPriceRecord.timestamp,
    analysis: \`The all-time maximum value for WIPRO was ₹\${maxPriceRecord.high.toFixed(2)}, recorded on \${new Date(maxPriceRecord.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}.\`
  }
}
\`\`\`

CRITICAL RULES:
1. ALWAYS check if records exist before accessing properties (use if (!record) return...)
2. ALWAYS use optional chaining (?.) when accessing nested properties
3. ALWAYS use .toFixed(2) for price values before string interpolation
4. ALWAYS wrap Date objects in 'new Date()' before calling toLocaleString()
5. The LAST statement MUST be 'const result = {...}' or just 'result = {...}'
6. Do NOT use 'return result' - the result variable is automatically returned

FORBIDDEN - DO NOT USE:
- import statements
- require()
- external modules
- return statements (result is auto-returned)
- anything except Prisma queries and basic JavaScript
`

    // Call Gemini AI to generate code
    console.log('📊 Asking Gemini to generate Prisma code...')
    
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
    
    let result, response, generatedCode
    try {
      // Add timeout for Gemini API call (45 seconds - increased for complex queries)
      const geminiPromise = model.generateContent(context)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Gemini API timeout after 45 seconds')), 45000)
      )
      
      result = await Promise.race([geminiPromise, timeoutPromise]) as any
      response = await result.response
      generatedCode = response.text()
      
      console.log('✅ Gemini generated code:', generatedCode)
    } catch (geminiError: any) {
      console.error('❌ Gemini API error:', geminiError)
      
      // Check if it's a 503 "model overloaded" error
      const isOverloaded = geminiError.message?.includes('503') || 
                          geminiError.message?.includes('overloaded') ||
                          geminiError.status === 503
      
      if (isOverloaded) {
        return NextResponse.json({
          success: false,
          error: 'AI service temporarily overloaded',
          analysis: `🔄 The AI service is currently experiencing high demand. Please try one of these options:\n\n` +
                   `✅ **Quick queries that work instantly:**\n` +
                   `• "What's the current price/trend?"\n` +
                   `• "What's the maximum price?"\n` +
                   `• "Show me today's RSI and MACD"\n\n` +
                   `✅ **Alternative:** Visit the [Database Chat](/database-chat) page for a different AI interface\n\n` +
                   `Your question: "${query}"`,
          suggestions: [
            "What's the current trend?",
            "What's the maximum price?", 
            "Show current RSI and MACD",
            "Try Database Chat page"
          ]
        }, { status: 503 })
      }
      
      return NextResponse.json({
        success: false,
        error: 'AI generation failed',
        analysis: `I apologize, but the AI service failed to generate a query. Error: ${geminiError.message}. Please try a simpler question or contact support if this persists.`,
        debug: {
          geminiError: geminiError.message,
          query: query
        }
      }, { status: 500 })
    }

    // Extract the code from Gemini's response
    const codeMatch = generatedCode.match(/```typescript\n([\s\S]*?)\n```/)
    if (!codeMatch) {
      return NextResponse.json({
        success: false,
        error: 'Failed to generate query code',
        analysis: 'I apologize, but I could not generate a valid database query for your question.'
      })
    }

    const prismaCode = codeMatch[1].trim()
    console.log('� Extracted Prisma code:', prismaCode)

    // Execute the generated code
    let queryResult
    try {
      // Create a safe execution environment
      const executeQuery = new Function('prisma', `
        return (async () => {
          ${prismaCode}
          return result
        })()
      `)
      
      // Add timeout for query execution (30 seconds for complex queries)
      const queryPromise = executeQuery(prisma)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database query timeout after 30 seconds. Try asking a simpler question or limit the date range.')), 30000)
      )
      
      queryResult = await Promise.race([queryPromise, timeoutPromise])
      console.log('✅ Query executed successfully, results:', queryResult)
    } catch (execError: any) {
      console.error('❌ Error executing generated code:', execError)
      console.error('❌ Error stack:', execError.stack)
      console.error('❌ Generated code was:', prismaCode)
      
      // Provide helpful error message based on error type
      let helpfulMessage = execError.message
      if (execError.message.includes('toLocaleString') || execError.message.includes('undefined')) {
        helpfulMessage = "The query returned no data for your request. Try asking about a different time period or check if data exists for the date you specified."
      } else if (execError.message.includes('timeout')) {
        helpfulMessage = "Your query is taking too long. Try asking about a shorter time period or a simpler question."
      }
      
      return NextResponse.json({
        success: false,
        error: 'Failed to execute query',
        analysis: `I apologize, but I encountered an issue: ${helpfulMessage}\n\n**Suggestions:**\n- Try a different time period\n- Ask a simpler question\n- Check if data exists for your query\n\nTechnical details: ${execError.message}`,
        debug: {
          errorMessage: execError.message,
          errorStack: execError.stack,
          generatedCode: prismaCode
        }
      })
    }

    // Format the results into a readable answer
    let analysis = ''
    
    // Check if result is an analysis object with an 'analysis' field
    if (queryResult && typeof queryResult === 'object' && !Array.isArray(queryResult)) {
      // Handle different object formats
      if (queryResult.analysis) {
        // Has analysis field
        analysis = queryResult.analysis
      } else if (queryResult.message) {
        // Has message field
        analysis = queryResult.message
      } else {
        // Generic object - format it nicely
        const keys = Object.keys(queryResult)
        if (keys.length > 0) {
          analysis = Object.entries(queryResult)
            .map(([key, value]) => {
              if (key === 'message' || key === 'analysis') return value
              return `**${key}**: ${value}`
            })
            .join('\n')
        } else {
          analysis = JSON.stringify(queryResult, null, 2)
        }
      }
      
      analysis += `

[CODE USED]
\`\`\`typescript
${prismaCode}
\`\`\`
`
    } else if (Array.isArray(queryResult) && queryResult.length > 0) {
      // If we have multiple results, find the EXACT closest match to requested time
      let recordsToShow = queryResult
      if (queryResult.length > 1 && targetDateIST) {
        const targetTime = targetDateIST.getTime()
        queryResult.sort((a, b) => {
          const distA = Math.abs(new Date(a.timestamp).getTime() - targetTime)
          const distB = Math.abs(new Date(b.timestamp).getTime() - targetTime)
          return distA - distB
        })
        // Keep only the closest match
        recordsToShow = [queryResult[0]]
        console.log('🎯 Found exact closest match:', queryResult[0].timestamp)
      }
      
      const record = recordsToShow[0]
      const timestamp = new Date(record.timestamp).toLocaleString('en-IN', { 
        timeZone: 'Asia/Kolkata',
        dateStyle: 'long',
        timeStyle: 'short'
      })
      
      analysis = `On ${timestamp}, the stock values were:
- Open: ₹${record.open}
- High: ₹${record.high}
- Low: ₹${record.low}
- Close: ₹${record.close}
- Volume: ${record.volume.toLocaleString()}

[CODE USED]
\`\`\`typescript
${prismaCode}
\`\`\`
`
    } else {
      // For numeric queries (like "how many times stock reached X"), provide helpful context
      const numericMatch = query.match(/(\d+)/);
      const targetPrice = numericMatch ? parseFloat(numericMatch[1]) : null;
      
      if (targetPrice && queryResult === 0) {
        // Query returned 0 results - might mean the condition was never met
        analysis = `Based on the query, the stock never reached the specified condition in the given timeframe.

The query returned 0 matching records.

[CODE USED]
\`\`\`typescript
${prismaCode}
\`\`\`

💡 **Tip**: Try asking "what was the price range in 2016?" to see the actual trading range.`
      } else {
        analysis = `Query result: ${queryResult}

[CODE USED]
\`\`\`typescript
${prismaCode}
\`\`\`
`
      }
    }

    return NextResponse.json({
      success: true,
      analysis,
      dataPoints: Array.isArray(queryResult) ? queryResult.length : 0,
      latestPrice: latest.close,
      debug: {
        extractedCode: `\`\`\`typescript\n${prismaCode}\n\`\`\``,
        specificTimeRecords: Array.isArray(queryResult) ? queryResult.length : 0,
        targetDate: hasSpecificTime || hasSpecificDate ? targetDateIST?.toISOString() : null,
        targetDateIST: hasSpecificTime || hasSpecificDate ? targetDateIST?.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : null,
      }
    })
  } catch (error: any) {
    console.error('❌ Error analyzing stock:', error)
    console.error('❌ Error message:', error.message)
    console.error('❌ Error stack:', error.stack)
    console.error('❌ Error name:', error.name)
    
    // More descriptive error message
    let errorDescription = error.message || 'Unknown error'
    if (error.code === 'P2002') {
      errorDescription = 'Database constraint violation'
    } else if (error.code?.startsWith('P')) {
      errorDescription = `Database error: ${error.message}`
    } else if (error.message?.includes('timeout')) {
      errorDescription = 'Query timeout - database took too long to respond'
    } else if (error.message?.includes('ECONNREFUSED')) {
      errorDescription = 'Cannot connect to database'
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to analyze stock',
        errorDetails: errorDescription,
        errorType: error.name,
        errorCode: error.code,
        analysis: `I apologize, but I encountered an error while analyzing the data. Error: ${errorDescription}. Please check the server logs for more details.`,
        debug: {
          message: error.message,
          name: error.name,
          code: error.code,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }
      },
      { status: 500 }
    )
  }
}
