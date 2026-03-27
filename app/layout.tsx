export const metadata = { title: 'Ant Colony 🐜' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, background: '#1a0f00', overflow: 'hidden' }}>
        {children}
      </body>
    </html>
  );
}
