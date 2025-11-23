'use client'

import { useRouter } from 'next/navigation'
import { TrendingUp } from 'lucide-react'

export default function HomePage() {
  const router = useRouter()

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

        {/* Stock Card */}
        <div className="max-w-2xl mx-auto">
          <div
            onClick={() => router.push('/stock/WIPRO')}
            className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer p-6 border border-gray-200"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xl">W</span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Wipro</h2>
                  <p className="text-gray-500">NSE: WIPRO</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-gray-900">₹244.37</div>
                <div className="text-danger flex items-center justify-end gap-1">
                  <span>-0.98 (-0.39%)</span>
                  <span className="text-xs">1D</span>
                </div>
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-gray-100">
              <div className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-gray-500">Market Cap</span>
                  <div className="font-semibold text-gray-900">₹1.32T</div>
                </div>
                <div>
                  <span className="text-gray-500">Volume</span>
                  <div className="font-semibold text-gray-900">45.2M</div>
                </div>
                <div>
                  <span className="text-gray-500">P/E Ratio</span>
                  <div className="font-semibold text-gray-900">24.5</div>
                </div>
              </div>
            </div>
          </div>
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
