'use client';

import { ReactNode } from 'react';
import { useAdmin } from '@/lib/admin-context';
import { Permission } from '@/lib/permissions';

/**
 * Client-side route guard: hides a section's content when the signed-in admin's
 * role lacks the given permission. This is a UX convenience only - every
 * underlying API call is independently re-checked server-side by PermissionGuard,
 * so there is no security reliance on this component alone.
 */
export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { hasPermission } = useAdmin();

  if (!hasPermission(permission)) {
    return (
      <div className="min-h-screen bg-gray-light flex items-center justify-center p-6">
        <div className="text-center max-w-md bg-white border border-gray-light rounded-lg p-10">
          <h2 className="text-lg font-semibold text-black mb-2">Access Restricted</h2>
          <p className="text-sm text-gray-medium">
            Your role does not include permission to view this section. Contact a Super Admin if you believe this is a mistake.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
