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
        const requestedTime = new Date(params.timestamp)
        
        // Find the closest price record to the requested time
        const priceRecord = await prisma.stockPrice.findFirst({
          where: {
            stockId: stockForTime.id,
            timestamp: {
              gte: new Date(requestedTime.getTime() - 5 * 60 * 1000), // 5 minutes before
              lte: new Date(requestedTime.getTime() + 5 * 60 * 1000), // 5 minutes after
            }
          },
          orderBy: {
            timestamp: 'desc'
          }
        })
        
        if (!priceRecord) {
          // Get the closest available data
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
          
          return {
            requestedTime: params.timestamp,
            exactMatch: false,
            message: 'No exact match found. Showing closest available data.',
            closestBefore,
            closestAfter
          }
        }
        
        return {
          requestedTime: params.timestamp,
          exactMatch: true,
          data: priceRecord
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
    description: 'Get stock price at a specific date and time. Use this when user asks about price at a specific time.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        symbol: { type: SchemaType.STRING, description: 'Stock symbol' },
        timestamp: { type: SchemaType.STRING, description: 'Timestamp in ISO format (e.g., 2025-11-14T14:30:00)' },
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
      model: 'gemini-3-pro',
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
    const systemContext = `You are an expert stock market analyst with full access to a comprehensive stock database. 

MEMORY & CONTEXT:
- You have access to our previous conversation above
- Remember what the user has asked about before
- If they refer to "it", "that stock", "the previous one", use context to understand what they mean
- If they ask follow-up questions, refer back to previous answers

CRITICAL RULES - YOU MUST FOLLOW THESE:
1. NEVER make up or hallucinate data
2. ALWAYS use database functions to get actual data
3. ONLY provide information that comes from database query results
4. If you don't have data, say "I don't have data for that" - DO NOT make assumptions
5. When user asks about specific times/dates, use getPriceAtTime function
6. ALWAYS call the appropriate database function before answering
7. Base your entire response ONLY on the data returned from database functions
8. Use conversation context to understand follow-up questions

DATABASE SCHEMA:
- Stock: Contains stock information (id, symbol, name, exchange)
- StockPrice: Contains OHLCV data and 40+ technical indicators including:
  * Trend: SMA (20,50,200), EMA (12,26), MACD, ADX, DI+, DI-
  * Momentum: RSI, Stochastic (K,D), CCI, Williams %R, ROC
  * Volatility: Bollinger Bands, ATR
  * Volume: OBV, VWAP, Force Index, A/D Line
- StockInsight: Contains AI-generated insights and analysis

AVAILABLE FUNCTIONS:
You have access to these database functions:
${databaseFunctions.map(f => `- ${f.name}: ${f.description}`).join('\n')}

WORKFLOW:
1. Read the user's question carefully
2. Identify which database function(s) to call
3. Call the function(s) to get actual data
4. Wait for the database results
5. ONLY use the returned data in your response
6. If data is missing, clearly state that

EXAMPLE:
User: "What was WIPRO's price at 2:30 PM on November 14th?"
You MUST: Call getPriceAtTime with symbol="WIPRO" and timestamp="2025-11-14T14:30:00"
Then: Use ONLY the returned data in your response
DO NOT: Make up prices or say "data not available" without calling the function first

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
