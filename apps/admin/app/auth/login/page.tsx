'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminAuthService } from '@/lib/auth-service';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // If already signed in as admin, skip straight to the dashboard.
  useEffect(() => {
    adminAuthService.getCurrentAdmin().then((admin) => {
      if (admin) router.replace('/admin');
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await adminAuthService.login(email, password);
      router.push('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-cream flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-beige rounded-lg mb-4">
            <span className="text-black font-bold text-2xl">PK</span>
          </div>
          <h1 className="text-3xl font-bold">PREMAL KAIZEN</h1>
          <p className="text-gray-medium text-sm mt-2">Admin Panel</p>
        </div>

        {/* Form */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-8">
          <h2 className="text-xl font-bold mb-6 text-cream">Admin Login</h2>

          {error && (
            <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-cream mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                autoComplete="username"
                className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 text-cream placeholder-gray-medium rounded focus:outline-none focus:border-beige"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-cream mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 text-cream placeholder-gray-medium rounded focus:outline-none focus:border-beige"
                required
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-4 py-3 bg-beige text-black font-semibold rounded hover:bg-beige-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-6"
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-gray-medium space-y-2">
          <p>
            First time setting up this store?{' '}
            <Link href="/auth/signup" className="text-beige hover:text-beige-light transition-colors">
              Create admin account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
