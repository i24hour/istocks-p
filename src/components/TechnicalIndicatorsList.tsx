'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface TechnicalIndicatorsListProps {
  symbol: string
}

export default function TechnicalIndicatorsList({ symbol }: TechnicalIndicatorsListProps) {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [indicators, setIndicators] = useState({
    trend: [
      { name: 'SMA 20', value: '246.50', signal: 'Bullish' },
      { name: 'SMA 50', value: '243.20', signal: 'Bullish' },
      { name: 'SMA 200', value: '238.90', signal: 'Bullish' },
      { name: 'EMA 12', value: '245.80', signal: 'Neutral' },
      { name: 'EMA 26', value: '244.10', signal: 'Neutral' },
      { name: 'MACD', value: '-1.25', signal: 'Bearish' },
      { name: 'MACD Signal', value: '-0.85', signal: 'Bearish' },
      { name: 'ADX', value: '28.5', signal: 'Neutral' },
    ],
    momentum: [
      { name: 'RSI', value: '42.3', signal: 'Oversold' },
      { name: 'Stochastic K', value: '38.2', signal: 'Oversold' },
      { name: 'Stochastic D', value: '41.5', signal: 'Oversold' },
      { name: 'CCI', value: '-85.3', signal: 'Bearish' },
      { name: 'Williams %R', value: '-68.5', signal: 'Neutral' },
      { name: 'ROC', value: '-2.1%', signal: 'Bearish' },
    ],
    volatility: [
      { name: 'Bollinger Upper', value: '252.30', signal: 'Resistance' },
      { name: 'Bollinger Middle', value: '245.60', signal: 'Neutral' },
      { name: 'Bollinger Lower', value: '238.90', signal: 'Support' },
      { name: 'ATR', value: '5.20', signal: 'Medium' },
    ],
    volume: [
      { name: 'OBV', value: '2.5M', signal: 'Decreasing' },
      { name: 'VWAP', value: '245.80', signal: 'Neutral' },
      { name: 'Force Index', value: '-1250', signal: 'Bearish' },
      { name: 'A/D Line', value: '125K', signal: 'Neutral' },
    ],
  })

  useEffect(() => {
    fetchIndicators()
  }, [symbol])

  const fetchIndicators = async () => {
    try {
      const response = await fetch(`/api/stocks/${symbol}/data?timeframe=1m`)
      const result = await response.json()
      
      if (result.success && result.data.priceData.length > 0) {
        const latest = result.data.priceData[result.data.priceData.length - 1]
        
        const getSignal = (value: number | undefined, type: string) => {
          if (!value) return 'N/A'
          if (type === 'rsi') {
            if (value > 70) return 'Overbought'
            if (value < 30) return 'Oversold'
            return 'Neutral'
          }
          return 'Neutral'
        }
        
        setIndicators({
          trend: [
            { name: 'SMA 20', value: latest.sma20?.toFixed(2) || 'N/A', signal: latest.close > (latest.sma20 || 0) ? 'Bullish' : 'Bearish' },
            { name: 'SMA 50', value: latest.sma50?.toFixed(2) || 'N/A', signal: latest.close > (latest.sma50 || 0) ? 'Bullish' : 'Bearish' },
            { name: 'SMA 200', value: latest.sma200?.toFixed(2) || 'N/A', signal: latest.close > (latest.sma200 || 0) ? 'Bullish' : 'Bearish' },
            { name: 'EMA 12', value: latest.ema12?.toFixed(2) || 'N/A', signal: 'Neutral' },
            { name: 'EMA 26', value: latest.ema26?.toFixed(2) || 'N/A', signal: 'Neutral' },
            { name: 'MACD', value: latest.macd?.toFixed(2) || 'N/A', signal: (latest.macd || 0) > 0 ? 'Bullish' : 'Bearish' },
            { name: 'MACD Signal', value: latest.macdSignal?.toFixed(2) || 'N/A', signal: 'Neutral' },
            { name: 'ADX', value: latest.adx?.toFixed(2) || 'N/A', signal: (latest.adx || 0) > 25 ? 'Strong Trend' : 'Weak Trend' },
          ],
          momentum: [
            { name: 'RSI', value: latest.rsi?.toFixed(2) || 'N/A', signal: getSignal(latest.rsi, 'rsi') },
            { name: 'Stochastic K', value: latest.stochK?.toFixed(2) || 'N/A', signal: (latest.stochK || 0) > 80 ? 'Overbought' : (latest.stochK || 0) < 20 ? 'Oversold' : 'Neutral' },
            { name: 'Stochastic D', value: latest.stochD?.toFixed(2) || 'N/A', signal: 'Neutral' },
            { name: 'CCI', value: latest.cci?.toFixed(2) || 'N/A', signal: (latest.cci || 0) > 100 ? 'Overbought' : (latest.cci || 0) < -100 ? 'Oversold' : 'Neutral' },
            { name: 'Williams %R', value: latest.williamsR?.toFixed(2) || 'N/A', signal: 'Neutral' },
            { name: 'ROC', value: latest.roc ? `${latest.roc.toFixed(2)}%` : 'N/A', signal: (latest.roc || 0) > 0 ? 'Bullish' : 'Bearish' },
          ],
          volatility: [
            { name: 'Bollinger Upper', value: latest.bbUpper?.toFixed(2) || 'N/A', signal: 'Resistance' },
            { name: 'Bollinger Middle', value: latest.bbMiddle?.toFixed(2) || 'N/A', signal: 'Neutral' },
            { name: 'Bollinger Lower', value: latest.bbLower?.toFixed(2) || 'N/A', signal: 'Support' },
            { name: 'ATR', value: latest.atr?.toFixed(2) || 'N/A', signal: (latest.atr || 0) > 5 ? 'High' : 'Medium' },
          ],
          volume: [
            { name: 'OBV', value: latest.obv ? `${(Number(latest.obv) / 1000000).toFixed(2)}M` : 'N/A', signal: 'Neutral' },
            { name: 'VWAP', value: latest.vwap?.toFixed(2) || 'N/A', signal: latest.close > (latest.vwap || 0) ? 'Bullish' : 'Bearish' },
            { name: 'Force Index', value: latest.forceIndex?.toFixed(0) || 'N/A', signal: (latest.forceIndex || 0) > 0 ? 'Bullish' : 'Bearish' },
            { name: 'A/D Line', value: latest.adLine?.toFixed(0) || 'N/A', signal: 'Neutral' },
          ],
        })
      }
    } catch (error) {
      console.error('Error fetching indicators:', error)
    } finally {
      setLoading(false)
    }
  }

  const getSignalColor = (signal: string) => {
    if (signal.includes('Bullish') || signal.includes('Overbought')) return 'text-success'
    if (signal.includes('Bearish') || signal.includes('Oversold')) return 'text-danger'
    return 'text-gray-600'
  }

  const getSignalBg = (signal: string) => {
    if (signal.includes('Bullish') || signal.includes('Overbought')) return 'bg-success/10'
    if (signal.includes('Bearish') || signal.includes('Oversold')) return 'bg-danger/10'
    return 'bg-gray-100'
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Technical Indicators (40+)</h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 font-medium"
        >
          {expanded ? 'Show Less' : 'Show All'}
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      <div className="space-y-6">
        {/* Trend Indicators */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full" />
            Trend Indicators
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {indicators.trend.slice(0, expanded ? undefined : 4).map((indicator, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">{indicator.name}</p>
                  <p className="text-xs text-gray-500">{indicator.value}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded ${getSignalBg(indicator.signal)} ${getSignalColor(indicator.signal)}`}>
                  {indicator.signal}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Momentum Indicators */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <div className="w-2 h-2 bg-orange-500 rounded-full" />
            Momentum Indicators
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {indicators.momentum.slice(0, expanded ? undefined : 4).map((indicator, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">{indicator.name}</p>
                  <p className="text-xs text-gray-500">{indicator.value}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded ${getSignalBg(indicator.signal)} ${getSignalColor(indicator.signal)}`}>
                  {indicator.signal}
                </span>
              </div>
            ))}
          </div>
        </div>

        {expanded && (
          <>
            {/* Volatility Indicators */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full" />
                Volatility Indicators
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {indicators.volatility.map((indicator, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{indicator.name}</p>
                      <p className="text-xs text-gray-500">{indicator.value}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${getSignalBg(indicator.signal)} ${getSignalColor(indicator.signal)}`}>
                      {indicator.signal}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Volume Indicators */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                Volume Indicators
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {indicators.volume.map((indicator, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{indicator.name}</p>
                      <p className="text-xs text-gray-500">{indicator.value}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${getSignalBg(indicator.signal)} ${getSignalColor(indicator.signal)}`}>
                      {indicator.signal}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
