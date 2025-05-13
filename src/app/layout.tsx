import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { CryptoInitializer } from '@/components/CryptoInitializer'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '日志系统',
  description: '安全的日志记录与管理系统',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <CryptoInitializer />
        {children}
      </body>
    </html>
  )
}
