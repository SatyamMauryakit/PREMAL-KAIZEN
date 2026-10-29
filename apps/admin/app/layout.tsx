import type { Metadata } from 'next';
import { AdminLayout } from '@/components/AdminLayout';
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
      <body>
        <AdminLayout>{children}</AdminLayout>
      </body>
    </html>
  );
}
