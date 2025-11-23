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

EXAMPLE 2 - Analytical Query (probability):
\`\`\`typescript
const thirtyDaysAgo = new Date()
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

const data = await prisma.stockPrice.findMany({
  where: {
    stockId: '${stock.id}',
    timestamp: { gte: thirtyDaysAgo }
  },
  orderBy: { timestamp: 'desc' }
})

// Analyze: how many times did it cross 240?
const crossedCount = data.filter(d => d.high > 240 || d.close > 240).length
const probability = data.length > 0 ? (crossedCount / data.length * 100).toFixed(2) : 0

const result = {
  totalDays: data.length,
  daysCrossed240: crossedCount,
  probability: probability + '%',
  analysis: \`In the last 30 days, the stock crossed ₹240 on \${crossedCount} out of \${data.length} trading days, giving a probability of \${probability}%.\`
}
\`\`\`

FORBIDDEN - DO NOT USE:
- import statements
- require()
- external modules
- anything except Prisma queries and basic JavaScript
`

    // Call Gemini AI to generate code
    console.log('📊 Asking Gemini to generate Prisma code...')
    
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
    const result = await model.generateContent(context)
    const response = await result.response
    const generatedCode = response.text()
    
    console.log('✅ Gemini generated code:', generatedCode)

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
      
      queryResult = await executeQuery(prisma)
      console.log('✅ Query executed successfully, results:', queryResult)
    } catch (execError: any) {
      console.error('❌ Error executing generated code:', execError)
      return NextResponse.json({
        success: false,
        error: 'Failed to execute query',
        analysis: `I apologize, but the generated query failed to execute: ${execError.message}`
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
    console.error('Error analyzing stock:', error)
    console.error('Error details:', error.message, error.stack)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to analyze stock',
        errorDetails: error.message || 'Unknown error',
        analysis: 'I apologize, but I encountered an error while analyzing the data. Please try again.'
      },
      { status: 500 }
    )
  }
}
