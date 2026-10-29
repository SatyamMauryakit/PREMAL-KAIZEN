'use client';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle }) => {
  return (
    <div className="bg-white border-b border-gray-light">
      <div className="px-6 py-6">
        <h1 className="text-3xl font-bold text-black mb-1">{title}</h1>
        {subtitle && <p className="text-gray-medium text-sm">{subtitle}</p>}
      </div>
    </div>
  );
};
