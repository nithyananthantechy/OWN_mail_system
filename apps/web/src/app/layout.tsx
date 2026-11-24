import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'NITECHSPARK Mail | Self-Hosted Business Email',
  description: 'Secure self-hosted business email platform by NITECHSPARK. Cybersecurity-oriented enterprise webmail.',
  keywords: 'NITECHSPARK, business email, self-hosted email, webmail, secure email',
  authors: [{ name: 'NITECHSPARK' }],
  viewport: 'width=device-width, initial-scale=1',
  robots: 'noindex, nofollow', // Private enterprise app
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="theme-color" content="#0f172a" />
      </head>
      <body className="bg-surface-950 text-surface-100 font-sans antialiased min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
