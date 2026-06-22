import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'TimeShift — beat jetlag before you land',
  description:
    'Map your itinerary across time zones, see day and night at your destination, and know exactly when to sleep on the plane.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="aurora" aria-hidden />
        {children}
      </body>
    </html>
  );
}
