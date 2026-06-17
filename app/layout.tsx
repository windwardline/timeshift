import type { ReactNode } from 'react';

export const metadata = {
  title: 'TimeShift',
  description: 'Jetlag and layover visualizer',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
