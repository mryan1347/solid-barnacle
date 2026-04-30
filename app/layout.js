import './globals.css'

export const metadata = {
  title: 'Intel Desk — AI Stock Intelligence',
  description: 'Drop intelligence. Get stock picks, hidden gems, and options ideas.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
