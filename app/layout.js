export const metadata = { title: 'Character Navigator', description: 'Analyze EPUBs' }
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
