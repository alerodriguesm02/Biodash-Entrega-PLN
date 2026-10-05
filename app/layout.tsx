export const metadata = {
  title: "BioDash",
  description: "Gestão inteligente de biodigestores",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}

