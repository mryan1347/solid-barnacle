import './globals.css'

export const metadata = {
  title: 'Intel Desk — AI Stock Intelligence',
  description: 'AI-driven stock picks, hidden gems, sleeper plays, options scanners.',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0a0e14',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
