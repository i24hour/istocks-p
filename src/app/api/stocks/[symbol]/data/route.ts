import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { symbol: string } }
) {
  try {
    const { symbol } = params
    const searchParams = request.nextUrl.searchParams
    const timeframe = searchParams.get('timeframe') || '1m'

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

    // Get the latest timestamp to determine "today"
    const latestRecord = await prisma.stockPrice.findFirst({
      where: { stockId: stock.id },
      orderBy: { timestamp: 'desc' },
    })

    if (!latestRecord) {
      return NextResponse.json(
        { success: false, error: 'No data available for this stock' },
        { status: 404 }
      )
    }

    const latestDate = new Date(latestRecord.timestamp)
    let startDate = new Date(latestDate)
    
    // Calculate date range based on timeframe
    switch (timeframe) {
      case '1d':
        // Show only the latest trading day - get start of day for the latest date
        const latestDay = new Date(latestDate)
        startDate = new Date(latestDay.getFullYear(), latestDay.getMonth(), latestDay.getDate(), 0, 0, 0, 0)
        break
      case '1w':
        // Show last 7 days from latest date
        startDate.setDate(latestDate.getDate() - 7)
        break
      case '1m':
        // Show last 30 days from latest date
        startDate.setDate(latestDate.getDate() - 30)
        break
      case '3m':
        // Show last 90 days from latest date
        startDate.setDate(latestDate.getDate() - 90)
        break
      case '6m':
        // Show last 180 days from latest date
        startDate.setDate(latestDate.getDate() - 180)
        break
      case '1y':
        // Show last 365 days from latest date
        startDate.setDate(latestDate.getDate() - 365)
        break
      default:
        startDate.setDate(latestDate.getDate() - 30)
    }

    // Fetch price data within the date range
    const priceData = await prisma.stockPrice.findMany({
      where: {
        stockId: stock.id,
        timestamp: {
          gte: startDate,
          lte: latestDate,
        },
      },
      orderBy: {
        timestamp: 'asc',
      },
    })

    console.log('API Debug for timeframe:', timeframe)
    console.log('startDate:', startDate.toISOString())
    console.log('latestDate:', latestDate.toISOString())
    console.log('First 3 records:', priceData.slice(0, 3).map(p => ({
      timestamp: p.timestamp,
      iso: new Date(p.timestamp).toISOString()
    })))

    // Get latest day's OHLC data for dashboard
    const latestDayStart = new Date(latestDate)
    latestDayStart.setHours(0, 0, 0, 0)
    
    const latestDayData = await prisma.stockPrice.findMany({
      where: {
        stockId: stock.id,
        timestamp: {
          gte: latestDayStart,
          lte: latestDate,
        },
      },
      orderBy: {
        timestamp: 'asc',
      },
    })

    // Calculate latest day's OHLC
    let latestDayStats = null
    if (latestDayData.length > 0) {
      const open = latestDayData[0].open
      const close = latestDayData[latestDayData.length - 1].close
      const high = Math.max(...latestDayData.map(d => d.high))
      const low = Math.min(...latestDayData.map(d => d.low))
      const volume = latestDayData.reduce((sum, d) => sum + Number(d.volume), 0)

      // Get previous day's close for calculating change
      const previousDayEnd = new Date(latestDayStart)
      previousDayEnd.setMilliseconds(-1)
      const previousDayStart = new Date(previousDayEnd)
      previousDayStart.setHours(0, 0, 0, 0)

      const previousDayData = await prisma.stockPrice.findFirst({
        where: {
          stockId: stock.id,
          timestamp: {
            gte: previousDayStart,
            lte: previousDayEnd,
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
      })

      const prevClose = previousDayData?.close || close
      const change = close - prevClose
      const changePercent = ((change / prevClose) * 100)

      latestDayStats = {
        open,
        high,
        low,
        close,
        prevClose,
        change: parseFloat(change.toFixed(2)),
        changePercent: parseFloat(changePercent.toFixed(2)),
        volume,
        timestamp: latestDate,
      }
    }

    // Convert BigInt to Number for JSON serialization
    const serializedData = priceData.map(item => ({
      ...item,
      volume: Number(item.volume),
      obv: item.obv ? Number(item.obv) : null,
    }))

    return NextResponse.json({
      success: true,
      data: {
        stock,
        priceData: serializedData,
        latestDayStats,
        timeframe,
      },
    })
  } catch (error: any) {
    console.error('Error fetching stock data:', error)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stock data', details: error.message },
      { status: 500 }
    )
  }
}
