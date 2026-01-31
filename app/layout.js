export const metadata = {
  title: 'Hello World',
  description: 'A simple Hello World app',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
