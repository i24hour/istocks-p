import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'iStocks - AI-Powered Stock Analysis',
  description: 'Intelligent stock analysis platform with AI chatbot',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
