'use client'

import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface StockChartProps {
  symbol: string
}

export default function StockChart({ symbol }: StockChartProps) {
  const [timeframe, setTimeframe] = useState('1m')
  const [chartData, setChartData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchChartData()
  }, [symbol, timeframe])

  const fetchChartData = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/stocks/${symbol}/data?timeframe=${timeframe}`)
      const result = await response.json()
      
      if (result.success && result.data.priceData) {
        // Format data based on timeframe
        const formatted = result.data.priceData.map((item: any) => {
          // Database stores IST time but Prisma returns it with UTC marker (.000Z)
          // We need to parse the timestamp string and treat it as IST, not UTC
          const timestampStr = item.timestamp.replace('Z', '') // Remove UTC marker
          const date = new Date(timestampStr) // Parse without timezone
          
          let timeLabel = ''
          
          // Different formatting based on timeframe
          if (timeframe === '1d') {
            // For 1D: Show time in HH:MM format (e.g., "09:15", "14:30")
            const hours = date.getHours().toString().padStart(2, '0')
            const minutes = date.getMinutes().toString().padStart(2, '0')
            timeLabel = `${hours}:${minutes}`
          } else if (timeframe === '1w') {
            // For 1W: Show day and date (e.g., "Mon 18")
            timeLabel = date.toLocaleDateString('en-IN', { 
              weekday: 'short', 
              day: 'numeric'
            })
          } else if (timeframe === '1m' || timeframe === '3m') {
            // For 1M/3M: Show date (e.g., "18 Nov")
            timeLabel = date.toLocaleDateString('en-IN', { 
              day: 'numeric', 
              month: 'short'
            })
          } else {
            // For 6M/1Y: Show month and year (e.g., "Nov 2025")
            timeLabel = date.toLocaleDateString('en-IN', { 
              month: 'short', 
              year: 'numeric'
            })
          }
          
          return {
            time: timeLabel,
            price: item.close,
            fullDate: date.toLocaleString('en-IN'),
          }
        })
        setChartData(formatted)
      }
    } catch (error) {
      console.error('Error fetching chart data:', error)
    } finally {
      setLoading(false)
    }
  }

  const timeframes = [
    { label: '1D', value: '1d' },
    { label: '1W', value: '1w' },
    { label: '1M', value: '1m' },
    { label: '3M', value: '3m' },
    { label: '6M', value: '6m' },
    { label: '1Y', value: '1y' },
  ]

  return (
    <div>
      {/* Timeframe Selector */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Price Chart</h3>
        <div className="flex gap-2">
          {timeframes.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setTimeframe(tf.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                timeframe === tf.value
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-80">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="time" 
              stroke="#9ca3af"
              style={{ fontSize: '12px' }}
            />
            <YAxis 
              stroke="#9ca3af"
              style={{ fontSize: '12px' }}
              domain={['dataMin - 2', 'dataMax + 2']}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '8px 12px',
              }}
              labelStyle={{ color: '#6b7280', fontSize: '12px' }}
              itemStyle={{ color: '#00d09c', fontSize: '14px', fontWeight: '600' }}
              formatter={(value: any, name: any, props: any) => {
                return [`₹${parseFloat(value).toFixed(2)}`, 'Price']
              }}
              labelFormatter={(label: any, payload: any) => {
                if (payload && payload[0]) {
                  return payload[0].payload.fullDate
                }
                return label
              }}
            />
            <Line 
              type="monotone" 
              dataKey="price" 
              stroke="#00d09c" 
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
