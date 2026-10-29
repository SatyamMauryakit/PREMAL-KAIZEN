'use client';

import { Sidebar } from './Sidebar';
import { ReactNode } from 'react';

interface AdminLayoutProps {
  children: ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-light">
      <Sidebar />
      <main className="pl-64 transition-all duration-300">
        {children}
      </main>
    </div>
  );
};
