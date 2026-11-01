'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export default function AdminSignupPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [adminExists, setAdminExists] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/auth/admin/exists`)
      .then((r) => r.json())
      .then((data) => setAdminExists(data.exists))
      .catch(() => setAdminExists(true))
      .finally(() => setChecking(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/auth/admin/bootstrap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, firstName, lastName }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Signup failed');

      localStorage.setItem('adminSessionToken', data.sessionToken);
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
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-beige rounded-lg mb-4">
            <span className="text-black font-bold text-2xl">PK</span>
          </div>
          <h1 className="text-3xl font-bold">PREMAL KAIZEN</h1>
          <p className="text-gray-medium text-sm mt-2">Admin Setup</p>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-8">
          {checking ? (
            <p className="text-sm text-gray-medium text-center">Checking setup status...</p>
          ) : adminExists ? (
            <>
              <h2 className="text-xl font-bold mb-4 text-cream">Administrator Already Exists</h2>
              <p className="text-sm text-gray-medium mb-6">
                This store already has an administrator account. New admin accounts can only be
                created by an existing administrator from Settings.
              </p>
              <Link
                href="/auth/login"
                className="block w-full text-center px-4 py-3 bg-beige text-black font-semibold rounded hover:bg-beige-light transition-colors"
              >
                Go to Login
              </Link>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold mb-2 text-cream">Create the First Administrator</h2>
              <p className="text-sm text-gray-medium mb-6">
                No administrator exists yet. Set one up now - this form disables itself permanently
                once an admin account is created.
              </p>

              {error && (
                <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-6 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-cream mb-2">First Name</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 text-cream rounded focus:outline-none focus:border-beige"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-cream mb-2">Last Name</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 text-cream rounded focus:outline-none focus:border-beige"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-cream mb-2">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                    className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 text-cream rounded focus:outline-none focus:border-beige"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-cream mb-2">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 text-cream rounded focus:outline-none focus:border-beige"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-cream mb-2">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 text-cream rounded focus:outline-none focus:border-beige"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full px-4 py-3 bg-beige text-black font-semibold rounded hover:bg-beige-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-6"
                >
                  {isLoading ? 'Creating account...' : 'Create Administrator Account'}
                </button>
              </form>
            </>
          )}
        </div>

        <div className="text-center mt-6 text-sm text-gray-medium">
          <p>
            Already have an account?{' '}
            <Link href="/auth/login" className="text-beige hover:text-beige-light transition-colors">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
