import DatabaseChat from '@/components/DatabaseChat'

export default function DatabaseChatPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            AI Database Analyst
          </h1>
          <p className="text-gray-600">
            Chat with AI that has full access to your stock database
          </p>
        </div>
        
        <DatabaseChat />
      </div>
    </div>
  )
}
