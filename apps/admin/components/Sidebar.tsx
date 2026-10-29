'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';

interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: string;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: '📊' },
  { label: 'Products', href: '/admin/products', icon: '📦' },
  { label: 'Categories', href: '/admin/categories', icon: '🏷️' },
  { label: 'Inventory', href: '/admin/inventory', icon: '📈' },
  { label: 'Orders', href: '/admin/orders', icon: '🛒', badge: 'Soon' },
  { label: 'Customers', href: '/admin/customers', icon: '👥' },
  { label: 'Analytics', href: '/admin/analytics', icon: '📉' },
  { label: 'Settings', href: '/admin/settings', icon: '⚙️' },
];

export const Sidebar: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-neutral-900 text-cream border-r border-gray-medium transition-all duration-300 z-40 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Logo Section */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-medium">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-beige rounded flex items-center justify-center text-neutral-900 font-bold text-sm">
              PK
            </div>
            <span className="font-bold text-sm whitespace-nowrap">PREMAL</span>
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 hover:bg-neutral-800 rounded transition-colors"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? '→' : '←'}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-2 px-2">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/admin' && pathname.startsWith(item.href));

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-beige text-neutral-900'
                      : 'text-cream hover:bg-neutral-800'
                  }`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <span className="text-lg flex-shrink-0">{item.icon}</span>
                  {!isCollapsed && (
                    <>
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span className="text-xs bg-neutral-700 px-2 py-1 rounded">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-medium p-4 space-y-2">
        <button className="w-full text-left text-xs text-cream hover:text-beige px-3 py-2 rounded hover:bg-neutral-800 transition-colors">
          {!isCollapsed ? 'Help & Support' : '?'}
        </button>
        <button className="w-full text-left text-xs text-cream hover:text-beige px-3 py-2 rounded hover:bg-neutral-800 transition-colors">
          {!isCollapsed ? 'Logout' : '↪'}
        </button>
      </div>
    </aside>
  );
};
