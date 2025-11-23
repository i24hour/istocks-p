'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader2 } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  debug?: {
    context: string
    specificTimeRecords: number
    targetDate: string | null
    targetDateIST?: string
    extractedCode?: string
  }
}

interface AIChatProps {
  symbol: string
}

export default function AIChat({ symbol }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Hello! I'm your AI stock analyst. I can help you analyze ${symbol} using 40+ technical indicators. Ask me about trends, patterns, momentum, or any specific indicators!`,
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [expandedDebug, setExpandedDebug] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    const userInput = input.toLowerCase().trim()
    setInput('')
    setIsLoading(true)

    try {
      // Handle casual greetings without calling API
      const greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'namaste']
      const thanks = ['thanks', 'thank you', 'thx', 'ty']
      
      if (greetings.includes(userInput)) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `Hello! 👋 How can I help you analyze ${symbol} today? You can ask me about trends, technical indicators, or trading signals!`,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, assistantMessage])
        setIsLoading(false)
        return
      }
      
      if (thanks.includes(userInput)) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `You're welcome! Feel free to ask me anything else about ${symbol}! 😊`,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, assistantMessage])
        setIsLoading(false)
        return
      }

      // Build conversation history (last 10 messages for context)
      const conversationHistory = messages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content,
      }))

      // Call AI analysis API for actual questions
      const response = await fetch(`/api/stocks/${symbol}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: input, 
          timeframe: '1d',
          conversationHistory, // Include chat history
        }),
      })

      const data = await response.json()

      // Extract code from response if it contains [CODE USED] section
      let mainContent = data.analysis || 'I apologize, but I encountered an error analyzing the data. Please try again.'
      let extractedCode = null
      
      // First try to get code from debug (backend extracted)
      if (data.debug?.extractedCode) {
        extractedCode = data.debug.extractedCode
      } else {
        // Fallback: try to extract from response text
        const codeMatch = mainContent.match(/\[CODE USED\]\s*```[\s\S]*?```/i)
        if (codeMatch) {
          extractedCode = codeMatch[0].replace(/\[CODE USED\]\s*/i, '')
        }
      }
      
      // Remove code section from main content for cleaner display
      mainContent = mainContent.replace(/\[CODE USED\]\s*```[\s\S]*?```/i, '').trim()

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: mainContent,
        timestamp: new Date(),
        debug: extractedCode || data.debug ? {
          context: '',
          specificTimeRecords: data.debug?.specificTimeRecords || 0,
          targetDate: data.debug?.targetDate || null,
          targetDateIST: data.debug?.targetDateIST || null,
          extractedCode: extractedCode || 'No code generated'
        } : undefined
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error: any) {
      console.error('Chat error:', error)
      let errorContent = 'I apologize, but I encountered an error. Please try again later.'
      
      // Try to extract more detailed error message
      if (error.message) {
        errorContent += `\n\nError: ${error.message}`
      }
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorContent,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const suggestedQuestions = [
    "What's the current trend?",
    "Analyze RSI and MACD",
    "Find support and resistance levels",
    "Check volume patterns",
  ]

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-primary/10 to-teal-500/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-teal-500 rounded-full flex items-center justify-center">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">AI Stock Analyst</h3>
            <p className="text-xs text-gray-500">Powered by Gemini AI</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'assistant' && (
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-teal-500 rounded-full flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5 text-white" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              <span className="text-xs opacity-70 mt-1 block">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              
              {/* Debug Info Button - Only for assistant messages with debug data */}
              {message.role === 'assistant' && message.debug && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <button
                    onClick={() => setExpandedDebug(expandedDebug === message.id ? null : message.id)}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                  >
                    <span>{expandedDebug === message.id ? '🔽' : '▶️'}</span>
                    {expandedDebug === message.id ? 'Hide' : 'Show'} Code
                  </button>
                  
                  {expandedDebug === message.id && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg text-xs font-mono overflow-x-auto max-h-96 overflow-y-auto">
                      {message.debug.targetDateIST && (
                        <div className="mb-2 text-gray-700">
                          <strong className="text-blue-600">🎯 Target Date (IST):</strong> {message.debug.targetDateIST}
                        </div>
                      )}
                      {message.debug.specificTimeRecords > 0 && (
                        <div className="mb-2 text-gray-700">
                          <strong className="text-blue-600">📊 Records Found:</strong> {message.debug.specificTimeRecords}
                        </div>
                      )}
                      <div className="mb-1">
                        <strong className="text-blue-600">💻 Code Used:</strong>
                      </div>
                      <pre className="whitespace-pre-wrap text-[11px] bg-gray-900 text-green-400 p-3 rounded border border-gray-300 font-mono">
                        {message.debug.extractedCode || 'No code was generated for this query.'}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
            {message.role === 'user' && (
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-white" />
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-teal-500 rounded-full flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="bg-gray-100 rounded-2xl px-4 py-3">
              <Loader2 className="w-5 h-5 animate-spin text-gray-600" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions */}
      {messages.length === 1 && (
        <div className="px-4 pb-3">
          <p className="text-xs text-gray-500 mb-2">Suggested questions:</p>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.map((question, idx) => (
              <button
                key={idx}
                onClick={() => setInput(question)}
                className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 transition-colors"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about technical indicators..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="px-4 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">
          AI can make mistakes. Verify important information.
        </p>
      </div>
    </div>
  )
}
