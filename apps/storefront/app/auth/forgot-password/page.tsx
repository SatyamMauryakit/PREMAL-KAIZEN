'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

export default function ForgotPasswordPage() {
  const { requestPasswordReset, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email) {
      setError('Please enter your email address');
      return;
    }

    try {
      await requestPasswordReset(email);
      setSuccess('Password reset link has been sent to your email. Please check your inbox.');
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream to-white">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold text-center text-black mb-2">Reset Password</h1>
          <p className="text-center text-gray-600 mb-8">Enter your email address and we'll send you a reset link</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-beige focus:border-transparent"
                placeholder="you@example.com"
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-black text-cream py-3 rounded-lg font-medium hover:bg-gray-800 disabled:bg-gray-400 transition-colors"
            >
              {isLoading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          <div className="border-t border-gray-200 pt-6 mt-6">
            <p className="text-center text-gray-600 text-sm">
              Remember your password?{' '}
              <Link href="/auth/login" className="text-black font-medium hover:underline">
                Login here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
