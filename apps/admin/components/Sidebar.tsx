'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Icons } from './Icons';
import { adminAuthService } from '@/lib/auth-service';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: Icons.Dashboard },
  { label: 'Products', href: '/admin/products', icon: Icons.Products },
  { label: 'Categories', href: '/admin/categories', icon: Icons.Categories },
  { label: 'Inventory', href: '/admin/inventory', icon: Icons.Inventory },
  { label: 'Orders', href: '/admin/orders', icon: Icons.Orders },
  { label: 'Customers', href: '/admin/customers', icon: Icons.Customers },
  { label: 'Analytics', href: '/admin/analytics', icon: Icons.Analytics },
  { label: 'Settings', href: '/admin/settings', icon: Icons.Settings },
];

export const Sidebar: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    if (confirm('Are you sure you want to logout?')) {
      await adminAuthService.logout();
      router.push('/auth/login');
    }
  };

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-white border-r border-gray-light transition-all duration-300 z-40 flex flex-col ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Header / Logo Section */}
      <div className="flex items-center justify-between h-20 px-4 border-b border-gray-light">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {!isCollapsed && (
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 flex-shrink-0 bg-beige rounded-lg flex items-center justify-center text-neutral-900 font-bold text-lg">
                PK
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-sm text-black truncate">PREMAL</span>
                <span className="text-xs text-gray-medium">Admin</span>
              </div>
            </div>
          )}
          {isCollapsed && (
            <div className="w-10 h-10 flex-shrink-0 bg-beige rounded-lg flex items-center justify-center text-neutral-900 font-bold text-lg mx-auto">
              PK
            </div>
          )}
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex-shrink-0 p-2 hover:bg-gray-light rounded-lg transition-colors text-gray-medium hover:text-black ml-2"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={isCollapsed ? 'Expand' : 'Collapse'}
        >
          {isCollapsed ? (
            <Icons.ChevronRight className="w-5 h-5" />
          ) : (
            <Icons.ChevronLeft className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-6 px-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/admin' && pathname.startsWith(item.href));

            const IconComponent = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all group ${
                    isActive
                      ? 'bg-beige text-neutral-900 shadow-sm'
                      : 'text-gray-dark hover:text-black hover:bg-gray-light'
                  }`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <IconComponent
                    className={`w-5 h-5 flex-shrink-0 transition-colors ${
                      isActive ? 'text-neutral-900' : ''
                    }`}
                  />
                  {!isCollapsed && (
                    <span className="flex-1 truncate">{item.label}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-light bg-white px-3 py-4 space-y-2">
        <button
          onClick={() => {
            // Open help in new tab or navigate to help page if it exists
            window.open('mailto:support@premalikaizen.com', '_blank');
          }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-dark hover:text-black hover:bg-gray-light transition-colors group"
          title={isCollapsed ? 'Help & Support' : undefined}
        >
          <Icons.Help className="w-5 h-5 flex-shrink-0" />
          {!isCollapsed && <span className="flex-1 text-left">Help & Support</span>}
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-dark hover:text-black hover:bg-gray-light transition-colors group"
          title={isCollapsed ? 'Logout' : undefined}
        >
          <Icons.Logout className="w-5 h-5 flex-shrink-0" />
          {!isCollapsed && <span className="flex-1 text-left">Logout</span>}
        </button>
      </div>
    </aside>
  );
};
