'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import OtpInput from '@/components/auth/OtpInput';

type Status = 'idle' | 'loading' | 'success' | 'error' | 'expired' | 'locked';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { sendOtp, verifyOtp } = useAuth();
  const emailFromQuery = searchParams.get('email') || '';
  const blockedLogin = searchParams.get('blocked') === '1';

  const [email, setEmail] = useState(emailFromQuery);
  const [otp, setOtp] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [clearSignal, setClearSignal] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || otp.trim().length < 6) {
      setMessage('Please enter your email and the 6-digit verification code.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setMessage('');
    try {
      await verifyOtp(email, otp.trim());
      setStatus('success');
      setMessage('Your email has been verified! Taking you home…');
      setTimeout(() => router.push('/'), 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Verification failed';
      setMessage(msg);
      setOtp('');
      setClearSignal((c) => c + 1);
      if (/expired/i.test(msg)) setStatus('expired');
      else if (/too many/i.test(msg)) setStatus('locked');
      else setStatus('error');
    }
  };

  const handleResend = async () => {
    if (!email) { setMessage('Please enter your email address first.'); setStatus('error'); return; }
    if (resendCooldown > 0) return;

    setStatus('loading');
    setMessage('');
    try {
      await sendOtp(email);
      setStatus('idle');
      setMessage('A new code has been sent to your email.');
      setResendCooldown(60);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'We couldn\'t send your OTP right now. Please try again.');
    }
  };

  const isBusy = status === 'loading' || status === 'success';

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
                You&apos;ll need to verify your email before you can log in.
              </p>
            )}
            <p className="text-gray-600 text-sm">
              Enter the 6-digit code sent to{' '}
              {emailFromQuery ? <strong>{emailFromQuery}</strong> : 'your email address'}.
            </p>
          </div>

          {/* Status messages */}
          {(status === 'error' || status === 'expired' || status === 'locked') && message && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm" role="alert">
              {message}
            </div>
          )}
          {status === 'success' && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6 text-sm" role="status">
              ✅ {message}
            </div>
          )}
          {status === 'idle' && message && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg mb-6 text-sm" role="status">
              {message}
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-5">
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 text-center">Verification Code</label>
              <OtpInput value={otp} onChange={setOtp} disabled={isBusy} clearSignal={clearSignal} autoFocus />
              <p className="text-xs text-gray-500 mt-2 text-center">The code expires in 5 minutes.</p>
            </div>

            <button
              type="submit"
              disabled={isBusy || otp.length < 6}
              className="w-full bg-black text-cream py-3 rounded-lg font-medium hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {status === 'loading' ? 'Verifying…' : 'Verify Email'}
            </button>
          </form>

          {/* Resend */}
          <div className="text-center mt-6">
            <p className="text-sm text-gray-600 mb-2">Didn&apos;t receive a code?</p>
            <button
              onClick={handleResend}
              disabled={resendCooldown > 0 || isBusy}
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
