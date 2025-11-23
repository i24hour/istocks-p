import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const stocks = await prisma.stock.findMany({
      select: {
        id: true,
        symbol: true,
        name: true,
        exchange: true,
      },
    })

    return NextResponse.json({ success: true, data: stocks })
  } catch (error) {
    console.error('Error fetching stocks:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stocks' },
      { status: 500 }
    )
  }
}
