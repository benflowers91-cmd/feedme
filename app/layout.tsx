import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/Providers'
import { BottomNav } from '@/components/BottomNav'
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'FeedMe',
  description: 'Low-FODMAP meal planner',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'FeedMe',
  },
}

export const viewport: Viewport = {
  themeColor: '#16a34a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geist.className}>
      <body className="bg-gray-50 min-h-screen">
        <Providers>
          <ServiceWorkerRegistration />
          <main className="max-w-2xl mx-auto px-4 pt-4 pb-24">{children}</main>
          <BottomNav />
        </Providers>
      </body>
    </html>
  )
}
