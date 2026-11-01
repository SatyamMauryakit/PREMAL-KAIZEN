import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PREMAL KAIZEN Admin',
  description: 'Admin dashboard for PREMAL KAIZEN store management.',
  robots: 'noindex, nofollow',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
