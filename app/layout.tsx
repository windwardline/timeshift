import type { ReactNode } from 'react';
import { JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import './globals.css';

// Self-hosted at build time: served from this origin, so the strict CSP
// (style-src/font-src 'self') holds with no Google hosts allowed.
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-space-grotesk',
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-jetbrains-mono',
});

export const metadata = {
  title: 'TimeShift — beat jetlag before you land',
  description:
    'Map your itinerary across time zones, see day and night at your destination, and know exactly when to sleep on the plane.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body>
        <div className="aurora" aria-hidden />
        {children}
      </body>
    </html>
  );
}
