'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { TrendingUp, TrendingDown, Bell, Bookmark, ArrowLeft } from 'lucide-react'
import StockChart from '@/components/StockChart'
import AIChat from '@/components/AIChat'
import InsightsPanel from '@/components/InsightsPanel'
import TechnicalIndicatorsList from '@/components/TechnicalIndicatorsList'

export default function StockDetailPage() {
  const params = useParams()
  const router = useRouter()
  const symbol = params.symbol as string

  const [stockData, setStockData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStockData()
  }, [symbol])

  const fetchStockData = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/stocks/${symbol}/data?timeframe=1d`)
      const result = await response.json()
      
      if (result.success && result.data && result.data.latestDayStats && result.data.stock) {
        const stats = result.data.latestDayStats
        const stockInfo = result.data.stock
        
        setStockData({
          symbol: stockInfo.symbol,
          name: stockInfo.name,
          price: stats.close.toFixed(2),
          change: stats.change,
          changePercent: stats.changePercent,
          high: stats.high.toFixed(2),
          low: stats.low.toFixed(2),
          open: stats.open.toFixed(2),
          prevClose: stats.prevClose.toFixed(2),
          volume: (stats.volume / 1000000).toFixed(1) + 'M',
        })
      } else {
        // Set default data if API fails
        setStockData({
          symbol: symbol,
          name: symbol,
          price: '0.00',
          change: 0,
          changePercent: 0,
          high: '0.00',
          low: '0.00',
          open: '0.00',
          prevClose: '0.00',
          volume: '0M',
        })
      }
    } catch (error) {
      console.error('Error fetching stock data:', error)
      // Set default data on error
      setStockData({
        symbol: symbol,
        name: symbol,
        price: '0.00',
        change: 0,
        changePercent: 0,
        high: '0.00',
        low: '0.00',
        open: '0.00',
        prevClose: '0.00',
        volume: '0M',
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading || !stockData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/')} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-teal-500 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-800">iStocks</span>
            </div>
          </div>
          <nav className="flex gap-6">
            <button className="text-gray-700 hover:text-gray-900 font-medium">Stocks</button>
            <button className="text-gray-500 hover:text-gray-700">Explore</button>
            <button className="text-gray-500 hover:text-gray-700">Holdings</button>
            <button className="text-gray-500 hover:text-gray-700">Positions</button>
            <button className="text-gray-500 hover:text-gray-700">Orders</button>
            <button className="text-gray-500 hover:text-gray-700">Watchlist</button>
          </nav>
          <div className="flex items-center gap-4">
            <input
              type="text"
              placeholder="Search stocks..."
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
              P
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Chart and Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stock Header */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-2xl">W</span>
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">{stockData.name}</h1>
                    <p className="text-gray-500">NSE: {stockData.symbol}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="p-2 hover:bg-gray-100 rounded-lg border border-gray-300">
                    <Bell className="w-5 h-5 text-gray-600" />
                  </button>
                  <button className="p-2 hover:bg-gray-100 rounded-lg border border-gray-300">
                    <Bookmark className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
              </div>

              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold text-gray-900">₹{stockData.price}</span>
                <div className={`flex items-center gap-1 ${stockData.change < 0 ? 'text-danger' : 'text-success'}`}>
                  {stockData.change < 0 ? <TrendingDown className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
                  <span className="text-lg font-semibold">
                    {stockData.change} ({stockData.changePercent}%)
                  </span>
                  <span className="text-sm text-gray-500 ml-2">1D</span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-4 gap-4 pt-4 border-t border-gray-100">
                <div>
                  <p className="text-sm text-gray-500">Open</p>
                  <p className="text-lg font-semibold text-gray-900">₹{stockData.open}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">High</p>
                  <p className="text-lg font-semibold text-gray-900">₹{stockData.high}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Low</p>
                  <p className="text-lg font-semibold text-gray-900">₹{stockData.low}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Prev. Close</p>
                  <p className="text-lg font-semibold text-gray-900">₹{stockData.prevClose}</p>
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <StockChart symbol={symbol} />
            </div>

            {/* Insights Panel */}
            <InsightsPanel symbol={symbol} />

            {/* Technical Indicators */}
            <TechnicalIndicatorsList symbol={symbol} />
          </div>

          {/* Right Column - AI Chatbot */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <AIChat symbol={symbol} />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
