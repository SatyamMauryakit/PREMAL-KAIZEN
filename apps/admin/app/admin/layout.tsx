'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/AdminLayout';
import { adminAuthService } from '@/lib/auth-service';

/**
 * Protects every /admin/* route: redirects to /auth/login when there is no
 * valid admin session, and only renders the dashboard chrome once verified.
 */
export default function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<'checking' | 'authorized'>('checking');

  useEffect(() => {
    let cancelled = false;

    adminAuthService.getCurrentAdmin().then((admin) => {
      if (cancelled) return;
      if (!admin) {
        router.replace('/auth/login');
        return;
      }
      setStatus('authorized');
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <p className="text-gray-medium text-sm">Checking admin session...</p>
      </div>
    );
  }

  return <AdminLayout>{children}</AdminLayout>;
}
