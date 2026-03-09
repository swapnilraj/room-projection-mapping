import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Projection Simulator',
  description: 'Simulate projection mapping onto printed surfaces',
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
