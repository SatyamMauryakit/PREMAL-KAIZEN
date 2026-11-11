'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, verifyLoginOtp, resendLoginOtp, isLoading } = useAuth();

  const [step, setStep] = useState<'password' | 'otp'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [otpMessage, setOtpMessage] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const redirectTo = searchParams.get('redirect') || '/account';

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    try {
      const result = await login(email, password);
      if (result.requiresOtp) {
        // Mandatory 2nd factor: a password alone never logs the customer in -
        // the backend hasn't issued a session, only sent a fresh OTP.
        setStep('otp');
        setOtpMessage('We sent a 6-digit verification code to your email.');
        setResendCooldown(60);
        return;
      }
      // Admin accounts only - session is already established.
      router.push(redirectTo);
    } catch (err) {
      const code = (err as { code?: string }).code;
      const unverifiedEmail = (err as { email?: string }).email;
      if (code === 'EMAIL_NOT_VERIFIED') {
        router.push(`/auth/verify-email?email=${encodeURIComponent(unverifiedEmail || email)}&blocked=1`);
        return;
      }
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!otp.trim()) {
      setError('Please enter the verification code');
      return;
    }

    try {
      await verifyLoginOtp(email, otp.trim());
      router.push(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError('');
    try {
      await resendLoginOtp(email);
      setOtpMessage('A new verification code has been sent.');
      setResendCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend code');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream to-white">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-8">
          {step === 'password' ? (
            <>
              <h1 className="text-3xl font-bold text-center text-black mb-2">Login</h1>
              <p className="text-center text-gray-600 mb-8">Welcome back to PREMAL KAIZEN</p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                  {error}
                </div>
              )}

              <form onSubmit={handlePasswordSubmit} className="space-y-6">
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

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-beige focus:border-transparent"
                    placeholder="••••••••"
                    disabled={isLoading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-black text-cream py-3 rounded-lg font-medium hover:bg-gray-800 disabled:bg-gray-400 transition-colors"
                >
                  {isLoading ? 'Logging in...' : 'Login'}
                </button>
              </form>

              <div className="mt-6 space-y-4">
                <div className="text-center">
                  <Link href="/auth/forgot-password" className="text-sm text-black hover:underline">
                    Forgot password?
                  </Link>
                </div>

                <div className="border-t border-gray-200 pt-6">
                  <p className="text-center text-gray-600 text-sm mb-4">
                    Don't have an account?{' '}
                    <Link href="/auth/register" className="text-black font-medium hover:underline">
                      Create one
                    </Link>
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-cream" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-black mb-2">Verify It's You</h1>
                <p className="text-gray-600 text-sm">
                  Enter the 6-digit code sent to <strong>{email}</strong>.
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>
              )}
              {!error && otpMessage && (
                <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg mb-6 text-sm">{otpMessage}</div>
              )}

              <form onSubmit={handleOtpSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Verification Code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="• • • • • •"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-black text-center text-3xl font-mono tracking-[0.4em]"
                    required
                    autoFocus
                    disabled={isLoading}
                  />
                  <p className="text-xs text-gray-500 mt-1 text-center">The code expires in 5 minutes.</p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || otp.length < 6}
                  className="w-full bg-black text-cream py-3 rounded-lg font-medium hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? 'Verifying…' : 'Verify & Login'}
                </button>
              </form>

              <div className="text-center mt-6">
                <p className="text-sm text-gray-600 mb-2">Didn't receive a code?</p>
                <button
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || isLoading}
                  className="text-sm font-medium text-black hover:underline disabled:text-gray-400 disabled:no-underline disabled:cursor-not-allowed"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                </button>
              </div>

              <div className="border-t border-gray-200 pt-6 mt-6 text-center">
                <button
                  onClick={() => { setStep('password'); setOtp(''); setError(''); }}
                  className="text-sm text-gray-600 hover:text-black"
                >
                  ← Use a different account
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-cream to-white flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
