'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Activity, BarChart3 } from 'lucide-react'

interface InsightsPanelProps {
  symbol: string
}

export default function InsightsPanel({ symbol }: InsightsPanelProps) {
  const [insights, setInsights] = useState({
    trend: 'Neutral',
    trendStrength: 50,
    momentum: 'Neutral',
    volatility: 'Medium',
    volumeAnalysis: 'Stable',
    supportLevel: 240.50,
    resistanceLevel: 250.20,
    summary: 'Loading insights...',
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchInsights()
  }, [symbol])

  const fetchInsights = async () => {
    try {
      const response = await fetch(`/api/stocks/${symbol}/data?timeframe=1m`)
      const result = await response.json()
      
      if (result.success && result.data.priceData.length > 0) {
        const latest = result.data.priceData[result.data.priceData.length - 1]
        const previous = result.data.priceData[result.data.priceData.length - 2] || latest
        
        // Calculate trend
        const priceChange = ((latest.close - previous.close) / previous.close) * 100
        const trend = priceChange > 0 ? 'Bullish' : priceChange < 0 ? 'Bearish' : 'Neutral'
        const trendStrength = Math.min(Math.abs(priceChange) * 10, 100)
        
        // Determine momentum from RSI
        let momentum = 'Neutral'
        if (latest.rsi) {
          if (latest.rsi > 70) momentum = 'Overbought'
          else if (latest.rsi > 60) momentum = 'Strong Buy'
          else if (latest.rsi > 50) momentum = 'Buy'
          else if (latest.rsi > 40) momentum = 'Sell'
          else momentum = 'Oversold'
        }
        
        // Calculate support and resistance from recent data
        const prices = result.data.priceData.map((d: any) => d.close)
        const supportLevel = Math.min(...prices)
        const resistanceLevel = Math.max(...prices)
        
        setInsights({
          trend,
          trendStrength,
          momentum,
          volatility: latest.atr > 5 ? 'High' : latest.atr > 3 ? 'Medium' : 'Low',
          volumeAnalysis: latest.volume > previous.volume ? 'Increasing' : 'Decreasing',
          supportLevel,
          resistanceLevel,
          summary: `Current RSI: ${latest.rsi?.toFixed(2) || 'N/A'}. MACD: ${latest.macd?.toFixed(2) || 'N/A'}. The stock is showing ${trend.toLowerCase()} momentum with ${momentum.toLowerCase()} signals.`,
        })
      }
    } catch (error) {
      console.error('Error fetching insights:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Insights</h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-danger" />
            <span className="text-sm text-gray-500">Trend</span>
          </div>
          <p className="text-lg font-semibold text-gray-900">{insights.trend}</p>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-danger h-2 rounded-full" 
              style={{ width: `${insights.trendStrength}%` }}
            />
          </div>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-orange-500" />
            <span className="text-sm text-gray-500">Momentum</span>
          </div>
          <p className="text-lg font-semibold text-orange-600">{insights.momentum}</p>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-gray-500">Volatility</span>
          </div>
          <p className="text-lg font-semibold text-gray-900">{insights.volatility}</p>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-purple-500" />
            <span className="text-sm text-gray-500">Volume</span>
          </div>
          <p className="text-lg font-semibold text-gray-900">{insights.volumeAnalysis}</p>
        </div>
      </div>

      <div className="p-4 bg-blue-50 rounded-lg mb-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-2">Support & Resistance</h4>
        <div className="flex justify-between items-center">
          <div>
            <span className="text-xs text-gray-500">Support</span>
            <p className="text-lg font-semibold text-success">₹{insights.supportLevel}</p>
          </div>
          <div className="text-right">
            <span className="text-xs text-gray-500">Resistance</span>
            <p className="text-lg font-semibold text-danger">₹{insights.resistanceLevel}</p>
          </div>
        </div>
      </div>

      <div className="p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-semibold text-gray-900 mb-2">AI Summary</h4>
        <p className="text-sm text-gray-700 leading-relaxed">{insights.summary}</p>
      </div>
    </div>
  )
}
