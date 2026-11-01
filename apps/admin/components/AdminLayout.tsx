'use client';

import { Sidebar } from './Sidebar';
import { ReactNode } from 'react';

interface AdminLayoutProps {
  children: ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-neutral-50">
      <Sidebar />
      <main className="ml-64 transition-all duration-300 min-h-screen">
        {children}
      </main>
    </div>
  );
};
