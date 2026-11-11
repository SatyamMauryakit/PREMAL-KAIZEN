'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/AdminLayout';
import { adminAuthService, AdminUser } from '@/lib/auth-service';
import { AdminProvider } from '@/lib/admin-context';

/**
 * Protects every /admin/* route: redirects to /auth/login when there is no
 * valid admin session, and only renders the dashboard chrome once verified.
 * Also makes the signed-in admin's granular role available app-wide via
 * AdminProvider, so the sidebar and individual pages can filter by permission.
 */
export default function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [status, setStatus] = useState<'checking' | 'authorized'>('checking');

  useEffect(() => {
    let cancelled = false;

    adminAuthService.getCurrentAdmin().then((admin) => {
      if (cancelled) return;
      if (!admin) {
        router.replace('/auth/login');
        return;
      }
      setAdmin(admin);
      setStatus('authorized');
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (status === 'checking' || !admin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <p className="text-gray-medium text-sm">Checking admin session...</p>
      </div>
    );
  }

  return (
    <AdminProvider admin={admin}>
      <AdminLayout>{children}</AdminLayout>
    </AdminProvider>
  );
}
