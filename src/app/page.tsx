'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface StockData {
  symbol: string
  name: string
  exchange: string
  latestPrice: number | null
  change: number | null
  changePercent: number | null
  volume: number | null
}

export default function HomePage() {
  const router = useRouter()
  const [stocks, setStocks] = useState<StockData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStocks()
  }, [])

  const fetchStocks = async () => {
    try {
      const response = await fetch('/api/stocks')
      const result = await response.json()

      if (result.success && result.data) {
        setStocks(result.data)
      }
    } catch (error) {
      console.error('Error fetching stocks:', error)
    } finally {
      setLoading(false)
    }
  }

  // Get first letter of stock name for icon
  const getStockInitial = (name: string) => {
    return name.charAt(0).toUpperCase()
  }

  // Generate gradient colors based on stock symbol
  const getGradientColors = (symbol: string) => {
    const gradients = {
      'WIPRO': 'from-blue-500 to-purple-600',
      'VEDL': 'from-orange-500 to-red-600',
      'ADANIPOWER': 'from-green-500 to-teal-600',
    }
    return gradients[symbol as keyof typeof gradients] || 'from-blue-500 to-purple-600'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-teal-500 rounded-full flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-800">iStocks</span>
          </div>
          <nav className="flex gap-6">
            <button className="text-gray-700 hover:text-gray-900 font-medium">Stocks</button>
            <button
              onClick={() => router.push('/database-chat')}
              className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <span>AI Database</span>
              <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded">NEW</span>
            </button>
            <button className="text-gray-500 hover:text-gray-700">Explore</button>
            <button className="text-gray-500 hover:text-gray-700">Holdings</button>
            <button className="text-gray-500 hover:text-gray-700">Positions</button>
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
      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            AI-Powered Stock Analysis Platform
          </h1>
          <p className="text-xl text-gray-600">
            Get intelligent insights with our AI chatbot
          </p>
        </div>

        {/* Stock Cards */}
        <div className="max-w-4xl mx-auto mb-16">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {stocks.map((stock) => (
                <div
                  key={stock.symbol}
                  onClick={() => router.push(`/stock/${stock.symbol}`)}
                  className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer p-6 border border-gray-200"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 bg-gradient-to-br ${getGradientColors(stock.symbol)} rounded-lg flex items-center justify-center`}>
                        <span className="text-white font-bold text-lg">{getStockInitial(stock.name)}</span>
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-gray-900">{stock.name}</h2>
                        <p className="text-sm text-gray-500">{stock.exchange}: {stock.symbol}</p>
                      </div>
                    </div>
                  </div>

                  {stock.latestPrice !== null ? (
                    <>
                      <div className="mb-3">
                        <div className="text-2xl font-bold text-gray-900">₹{stock.latestPrice.toFixed(2)}</div>
                        {stock.change !== null && stock.changePercent !== null && (
                          <div className={`flex items-center gap-1 text-sm ${stock.change < 0 ? 'text-danger' : 'text-success'}`}>
                            {stock.change < 0 ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                            <span className="font-semibold">
                              {stock.change > 0 ? '+' : ''}{stock.change.toFixed(2)} ({stock.changePercent.toFixed(2)}%)
                            </span>
                          </div>
                        )}
                      </div>

                      {stock.volume && (
                        <div className="text-xs text-gray-500">
                          Vol: {(stock.volume / 1000000).toFixed(2)}M
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-sm text-gray-500">Loading price data...</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Features */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Real-time Analysis</h3>
            <p className="text-gray-600">Get live technical indicators and market insights</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">AI Chatbot</h3>
            <p className="text-gray-600">Ask questions and get intelligent stock analysis</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">40+ Indicators</h3>
            <p className="text-gray-600">Comprehensive technical analysis with multiple indicators</p>
          </div>
        </div>
      </main>
    </div>
  )
}
