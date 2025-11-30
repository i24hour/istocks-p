import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// Function to execute database queries safely
async function executeDatabaseQuery(queryType: string, params: any) {
  try {
    switch (queryType) {
      case 'getAllStocks':
        return await prisma.stock.findMany({
          select: {
            id: true,
            symbol: true,
            name: true,
            exchange: true,
          }
        })

      case 'getStockBySymbol':
        return await prisma.stock.findUnique({
          where: { symbol: params.symbol },
          include: {
            priceData: {
              orderBy: { timestamp: 'desc' },
              take: params.limit || 100,
            },
            insights: {
              orderBy: { generatedAt: 'desc' },
              take: 5,
            }
          }
        })

      case 'getLatestPrices':
        const stock = await prisma.stock.findUnique({
          where: { symbol: params.symbol }
        })
        if (!stock) return null

        return await prisma.stockPrice.findMany({
          where: { stockId: stock.id },
          orderBy: { timestamp: 'desc' },
          take: params.limit || 100,
        })

      case 'getPricesByDateRange':
        const stockForRange = await prisma.stock.findUnique({
          where: { symbol: params.symbol }
        })
        if (!stockForRange) return null

        return await prisma.stockPrice.findMany({
          where: {
            stockId: stockForRange.id,
            timestamp: {
              gte: new Date(params.startDate),
              lte: new Date(params.endDate),
            }
          },
          orderBy: { timestamp: 'desc' },
        })

      case 'getStockInsights':
        const stockForInsights = await prisma.stock.findUnique({
          where: { symbol: params.symbol }
        })
        if (!stockForInsights) return null

        return await prisma.stockInsight.findMany({
          where: { stockId: stockForInsights.id },
          orderBy: { generatedAt: 'desc' },
        })

      case 'compareStocks':
        const symbols = params.symbols || []
        const stocks = await prisma.stock.findMany({
          where: {
            symbol: { in: symbols }
          },
          include: {
            priceData: {
              orderBy: { timestamp: 'desc' },
              take: 1,
            }
          }
        })
        return stocks

      case 'getTopMovers':
        // Get all stocks with their latest price
        const allStocks = await prisma.stock.findMany({
          include: {
            priceData: {
              orderBy: { timestamp: 'desc' },
              take: 2, // Latest and previous
            }
          }
        })

        // Calculate percentage change and sort
        const stocksWithChange = allStocks
          .filter(s => s.priceData.length >= 2)
          .map(s => {
            const latest = s.priceData[0]
            const previous = s.priceData[1]
            const change = ((latest.close - previous.close) / previous.close) * 100
            return {
              symbol: s.symbol,
              name: s.name,
              currentPrice: latest.close,
              change,
              volume: latest.volume,
            }
          })
          .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
          .slice(0, params.limit || 10)

        return stocksWithChange

      case 'getVolumeAnalysis':
        const stockForVolume = await prisma.stock.findUnique({
          where: { symbol: params.symbol }
        })
        if (!stockForVolume) return null

        const volumeData = await prisma.stockPrice.findMany({
          where: { stockId: stockForVolume.id },
          orderBy: { timestamp: 'desc' },
          take: params.limit || 50,
          select: {
            timestamp: true,
            volume: true,
            close: true,
          }
        })

        return volumeData

      case 'getTechnicalIndicators':
        const stockForIndicators = await prisma.stock.findUnique({
          where: { symbol: params.symbol }
        })
        if (!stockForIndicators) return null

        return await prisma.stockPrice.findFirst({
          where: { stockId: stockForIndicators.id },
          orderBy: { timestamp: 'desc' },
          select: {
            timestamp: true,
            close: true,
            rsi: true,
            macd: true,
            macdSignal: true,
            macdHistogram: true,
            sma20: true,
            sma50: true,
            sma200: true,
            ema12: true,
            ema26: true,
            bbUpper: true,
            bbMiddle: true,
            bbLower: true,
            atr: true,
            adx: true,
            plusDI: true,
            minusDI: true,
            stochK: true,
            stochD: true,
            cci: true,
            williamsR: true,
            roc: true,
            obv: true,
            vwap: true,
            forceIndex: true,
            adLine: true,
          }
        })

      case 'getPriceAtTime':
        const stockForTime = await prisma.stock.findUnique({
          where: { symbol: params.symbol }
        })
        if (!stockForTime) return { error: 'Stock not found' }

        // Parse the requested time
        let requestedTime: Date
        try {
          requestedTime = new Date(params.timestamp)

          // If date is invalid, return error - DO NOT INFER YEAR
          if (isNaN(requestedTime.getTime())) {
            return { error: `Invalid timestamp format: ${params.timestamp}. Please provide a complete date with year (e.g., 2024-11-21T14:30:00)` }
          }

        } catch (e) {
          return { error: `Invalid timestamp format: ${params.timestamp}` }
        }

        console.log(`🔍 getPriceAtTime: Looking for ${params.symbol} at ${requestedTime.toISOString()}`)

        // Find the closest price record to the requested time (within 5 minutes)
        const priceRecord = await prisma.stockPrice.findFirst({
          where: {
            stockId: stockForTime.id,
            timestamp: {
              gte: new Date(requestedTime.getTime() - 5 * 60 * 1000), // 5 minutes before
              lte: new Date(requestedTime.getTime() + 5 * 60 * 1000), // 5 minutes after
            }
          },
          orderBy: {
            timestamp: 'asc'
          }
        })

        if (!priceRecord) {
          // Get the closest available data before and after
          const closestBefore = await prisma.stockPrice.findFirst({
            where: {
              stockId: stockForTime.id,
              timestamp: { lte: requestedTime }
            },
            orderBy: { timestamp: 'desc' }
          })

          const closestAfter = await prisma.stockPrice.findFirst({
            where: {
              stockId: stockForTime.id,
              timestamp: { gte: requestedTime }
            },
            orderBy: { timestamp: 'asc' }
          })

          // Provide helpful context
          const dateStr = requestedTime.toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })

          if (!closestBefore && !closestAfter) {
            return {
              requestedTime: params.timestamp,
              parsedTime: requestedTime.toISOString(),
              exactMatch: false,
              message: `No data found for ${params.symbol} around ${dateStr}. The database might not have data for this time period.`,
              closestBefore: null,
              closestAfter: null
            }
          }

          return {
            requestedTime: params.timestamp,
            parsedTime: requestedTime.toISOString(),
            exactMatch: false,
            message: `No exact match at ${dateStr}. Showing nearest available data.`,
            closestBefore: closestBefore ? {
              ...closestBefore,
              volume: closestBefore.volume.toString()
            } : null,
            closestAfter: closestAfter ? {
              ...closestAfter,
              volume: closestAfter.volume.toString()
            } : null
          }
        }

        return {
          requestedTime: params.timestamp,
          parsedTime: requestedTime.toISOString(),
          exactMatch: true,
          message: `Found data for ${params.symbol} at ${requestedTime.toLocaleString('en-IN')}`,
          data: {
            ...priceRecord,
            volume: priceRecord.volume.toString()
          }
        }


      default:
        return null
    }
  } catch (error) {
    console.error('Database query error:', error)
    return null
  }
}

// Define available database functions for Gemini
const databaseFunctions = [
  {
    name: 'getAllStocks',
    description: 'Get list of all available stocks in the database',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: 'getStockBySymbol',
    description: 'Get detailed information about a specific stock including recent price data and insights',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        symbol: { type: SchemaType.STRING, description: 'Stock symbol (e.g., WIPRO, RELIANCE)' },
        limit: { type: SchemaType.NUMBER, description: 'Number of price records to fetch (default: 100)' },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'getLatestPrices',
    description: 'Get latest price data for a stock',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        symbol: { type: SchemaType.STRING, description: 'Stock symbol' },
        limit: { type: SchemaType.NUMBER, description: 'Number of records (default: 100)' },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'getPricesByDateRange',
    description: 'Get price data for a specific date range',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        symbol: { type: SchemaType.STRING, description: 'Stock symbol' },
        startDate: { type: SchemaType.STRING, description: 'Start date (ISO format)' },
        endDate: { type: SchemaType.STRING, description: 'End date (ISO format)' },
      },
      required: ['symbol', 'startDate', 'endDate'],
    },
  },
  {
    name: 'getStockInsights',
    description: 'Get AI-generated insights for a stock',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        symbol: { type: SchemaType.STRING, description: 'Stock symbol' },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'compareStocks',
    description: 'Compare multiple stocks',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        symbols: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: 'Array of stock symbols' },
      },
      required: ['symbols'],
    },
  },
  {
    name: 'getTopMovers',
    description: 'Get stocks with highest price changes',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        limit: { type: SchemaType.NUMBER, description: 'Number of stocks to return (default: 10)' },
      },
    },
  },
  {
    name: 'getVolumeAnalysis',
    description: 'Get volume analysis for a stock',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        symbol: { type: SchemaType.STRING, description: 'Stock symbol' },
        limit: { type: SchemaType.NUMBER, description: 'Number of records (default: 50)' },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'getTechnicalIndicators',
    description: 'Get all technical indicators for a stock',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        symbol: { type: SchemaType.STRING, description: 'Stock symbol' },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'getPriceAtTime',
    description: 'Get stock price at a specific date and time. Use this ONLY when you have the COMPLETE date including year. Database has data from Oct 2016 to Nov 2025. If user gives incomplete date (e.g. "14 Nov"), ask which year before calling this function.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        symbol: { type: SchemaType.STRING, description: 'Stock symbol' },
        timestamp: { type: SchemaType.STRING, description: 'Complete timestamp in ISO format. Examples: "2024-11-14T13:50:00" for 14 Nov 2024 1:50 PM, "2025-11-14T13:50:00" for 14 Nov 2025 1:50 PM.' },
      },
      required: ['symbol', 'timestamp'],
    },
  },
]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, conversationHistory = [] } = body

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      )
    }

    // Initialize Gemini with function calling
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      tools: [{
        functionDeclarations: databaseFunctions as any,
      }],
    })

    // Build conversation history
    const history = conversationHistory.map((msg: any) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }))

    const chat = model.startChat({
      history,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
    })

    // System context
    const systemContext = `You are a friendly and helpful AI stock market analyst for iStocks. You have access to a comprehensive stock database with data from 2016 to 2025.

PERSONALITY & TONE:
- Be conversational, friendly, and engaging ("thoda conversational hona chahiye")
- Avoid blunt "No" or "I don't know" answers. Instead, explain *why* or ask for clarification.
- If data is missing, say something like "I checked the records, but I couldn't find data for that specific time. Could you double-check the date?"
- Use emojis occasionally to keep it light 📈
- Speak naturally, like a helpful financial assistant.

MEMORY & CONTEXT:
- You have access to our previous conversation above
- Remember what the user has asked about before
- If they refer to "it", "that stock", "the previous one", use context to understand what they mean

CRITICAL RULES - YOU MUST FOLLOW THESE:
1. NEVER make up or hallucinate data.
2. ALWAYS use database functions to get actual data.
3. ONLY provide information that comes from database query results.
4. **AMBIGUOUS DATES**: If the user mentions a date without a year (e.g., "21 Nov", "last Monday"), you MUST ASK "Which year are you referring to?" before calling any function.
   - The database has data for multiple years (2016-2025).
   - Do NOT assume the current year.
   - Do NOT guess.
   - Just ask nicely: "I can help with that! Since I have data for multiple years, could you tell me which year you're interested in?"
5. **DAILY DATA**: If the user asks for "highest price", "lowest price", or "close" for a specific *day* (not a specific time), use 'getPricesByDateRange' for that entire day (09:15 to 15:30).
6. **SPECIFIC TIME**: Use 'getPriceAtTime' ONLY when the user gives a specific time (e.g., "2:30 PM").

DATABASE SCHEMA:
- Stock: Contains stock information (id, symbol, name, exchange)
- StockPrice: Contains OHLCV data and 40+ technical indicators
- StockInsight: Contains AI-generated insights

AVAILABLE FUNCTIONS:
${databaseFunctions.map(f => `- ${f.name}: ${f.description}`).join('\n')}

WORKFLOW:
1. Read the user's question.
2. **CHECK FOR YEAR**: Does the date have a year? If no -> ASK USER.
3. Identify the right function.
4. Call the function.
5. Answer in a friendly, conversational way based *only* on the data.

EXAMPLES:

User: "What was the highest price of VEDL on 21 Nov?"
You: "I'd love to check that for you! 🧐 Since I have data from 2016 to 2025, could you please specify which year you're asking about?"
(DO NOT call any function yet)

User: "2024"
You: (Call getPricesByDateRange for 2024-11-21) "On November 21, 2024, VEDL reached a high of..."

User: "Price of WIPRO now"
You: (Call getLatestPrices) "Currently, Wipro is trading at..."

User's question: ${message}`

    // Send message and get response
    let result = await chat.sendMessage(systemContext)
    let response = result.response

    // Handle function calls
    const functionCalls: any[] = []
    let finalText = ''

    const calls = response.functionCalls?.() || []
    while (calls && calls.length > 0) {
      const functionCall = calls[0]
      const functionName = functionCall.name
      const functionArgs = functionCall.args

      console.log('🔍 Function call:', functionName, functionArgs)

      // Execute the database query
      const queryResult = await executeDatabaseQuery(functionName, functionArgs)

      console.log('📊 Query result:', JSON.stringify(queryResult, null, 2))

      functionCalls.push({
        name: functionName,
        args: functionArgs,
        result: queryResult,
      })

      // Send function response back to Gemini
      result = await chat.sendMessage([{
        functionResponse: {
          name: functionName,
          response: {
            content: queryResult,
          },
        },
      }])

      response = result.response
    }

    // Get final text response
    finalText = response.text()

    return NextResponse.json({
      success: true,
      message: finalText,
      functionCalls,
      model: 'gemini-2.0-flash',
    })

  } catch (error: any) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process chat message',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
