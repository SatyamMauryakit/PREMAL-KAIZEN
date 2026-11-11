'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromQuery = searchParams.get('email') || '';
  const phoneFromQuery = searchParams.get('phone') || '';
  const blockedLogin = searchParams.get('blocked') === '1';

  const [email, setEmail] = useState(emailFromQuery);
  const [otp, setOtp] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !otp.trim()) {
      setMessage('Please enter your email and the verification code.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otp.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Verification failed');
      setStatus('success');
      if (phoneFromQuery) {
        setMessage('Your email has been verified! Now let\'s verify your mobile number…');
        setTimeout(() => router.push(`/auth/verify-mobile?phone=${encodeURIComponent(phoneFromQuery)}`), 2000);
      } else {
        setMessage('Your email has been verified! Redirecting to login…');
        setTimeout(() => router.push('/auth/login'), 2000);
      }
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Verification failed');
    }
  };

  const handleResend = async () => {
    if (!email) { setMessage('Please enter your email address first.'); setStatus('error'); return; }
    if (resendCooldown > 0) return;

    setStatus('loading');
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not send code');
      setStatus('idle');
      setMessage('A new code has been sent to your email.');
      setResendCooldown(60);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Could not resend code');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream to-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-md p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-cream" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-black mb-2">Verify Your Email</h1>
            {blockedLogin && (
              <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm mb-3">
                You'll need to verify your email before you can log in.
              </p>
            )}
            <p className="text-gray-600 text-sm">
              Enter the 6-digit code sent to{' '}
              {emailFromQuery ? <strong>{emailFromQuery}</strong> : 'your email address'}.
            </p>
          </div>

          {/* Status messages */}
          {status === 'error' && message && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">{message}</div>
          )}
          {status === 'success' && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6 text-sm">
              ✅ {message}
            </div>
          )}
          {status === 'idle' && message && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg mb-6 text-sm">{message}</div>
          )}

          <form onSubmit={handleVerify} className="space-y-5">
            {/* Email (editable in case they land here directly) */}
            {!emailFromQuery && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                  required
                />
              </div>
            )}

            {/* OTP input */}
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
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-black text-center text-3xl font-mono tracking-[0.4em] letter-spacing"
                required
                disabled={status === 'loading' || status === 'success'}
              />
              <p className="text-xs text-gray-500 mt-1 text-center">The code expires in 15 minutes.</p>
            </div>

            <button
              type="submit"
              disabled={status === 'loading' || status === 'success' || otp.length < 6}
              className="w-full bg-black text-cream py-3 rounded-lg font-medium hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {status === 'loading' ? 'Verifying…' : 'Verify Email'}
            </button>
          </form>

          {/* Resend */}
          <div className="text-center mt-6">
            <p className="text-sm text-gray-600 mb-2">Didn't receive a code?</p>
            <button
              onClick={handleResend}
              disabled={resendCooldown > 0 || status === 'loading' || status === 'success'}
              className="text-sm font-medium text-black hover:underline disabled:text-gray-400 disabled:no-underline disabled:cursor-not-allowed"
            >
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
            </button>
          </div>

          <div className="border-t border-gray-200 pt-6 mt-6 text-center">
            <Link href="/auth/login" className="text-sm text-gray-600 hover:text-black">
              ← Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-cream flex items-center justify-center"><p className="text-gray-600">Loading…</p></div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
