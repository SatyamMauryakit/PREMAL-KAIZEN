'use client';

import { createContext, useContext, ReactNode } from 'react';
import { AdminUser } from './auth-service';
import { AdminRole, Permission, roleHasPermission } from './permissions';

interface AdminContextValue {
  admin: AdminUser | null;
  adminRole: AdminRole | null;
  hasPermission: (permission: Permission) => boolean;
}

const AdminContext = createContext<AdminContextValue>({
  admin: null,
  adminRole: null,
  hasPermission: () => false,
});

export function AdminProvider({ admin, children }: { admin: AdminUser; children: ReactNode }) {
  const adminRole = (admin.adminRole as AdminRole | null) ?? null;

  const value: AdminContextValue = {
    admin,
    adminRole,
    // SUPER_ADMIN always passes, mirroring the backend PermissionGuard's shortcut.
    hasPermission: (permission) => adminRole === 'SUPER_ADMIN' || roleHasPermission(adminRole, permission),
  };

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  return useContext(AdminContext);
}
