import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Disable caching for this route
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const stocks = await prisma.stock.findMany({
      select: {
        id: true,
        symbol: true,
        name: true,
        exchange: true,
      },
      orderBy: {
        symbol: 'asc',
      },
    })

    // For each stock, get the latest price data
    const stocksWithPrices = await Promise.all(
      stocks.map(async (stock) => {
        // Get latest price record
        const latestPrice = await prisma.stockPrice.findFirst({
          where: { stockId: stock.id },
          orderBy: { timestamp: 'desc' },
          take: 1,
        })

        // Get second latest for calculating change
        const previousPrices = await prisma.stockPrice.findMany({
          where: { stockId: stock.id },
          orderBy: { timestamp: 'desc' },
          take: 2,
          skip: 1,
        })

        let change = null
        let changePercent = null

        if (latestPrice && previousPrices.length > 0) {
          const prevClose = previousPrices[0].close
          change = latestPrice.close - prevClose
          changePercent = (change / prevClose) * 100
        }

        return {
          ...stock,
          latestPrice: latestPrice?.close || null,
          change,
          changePercent,
          volume: latestPrice?.volume ? Number(latestPrice.volume) : null,
          lastUpdated: latestPrice?.timestamp || null,
        }
      })
    )

    return NextResponse.json({ success: true, data: stocksWithPrices })
  } catch (error) {
    console.error('Error fetching stocks:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stocks' },
      { status: 500 }
    )
  }
}
