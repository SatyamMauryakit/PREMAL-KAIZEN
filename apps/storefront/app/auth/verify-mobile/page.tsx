'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

function VerifyMobileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phoneFromQuery = searchParams.get('phone') || '';

  const [phoneNumber, setPhoneNumber] = useState(phoneFromQuery);
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
    if (!phoneNumber || !otp.trim()) {
      setMessage('Please enter your mobile number and the verification code.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-mobile-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, otp: otp.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Verification failed');
      setStatus('success');
      setMessage('Your mobile number has been verified! Redirecting to login…');
      setTimeout(() => router.push('/auth/login'), 2000);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Verification failed');
    }
  };

  const handleResend = async () => {
    if (!phoneNumber) { setMessage('Please enter your mobile number first.'); setStatus('error'); return; }
    if (resendCooldown > 0) return;

    setStatus('loading');
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/send-mobile-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not send code');
      setStatus('idle');
      setMessage('A new code has been sent via SMS.');
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-black mb-2">Verify Your Mobile</h1>
            <p className="text-gray-600 text-sm">
              Enter the 6-digit code sent via SMS to{' '}
              {phoneFromQuery ? <strong>{phoneFromQuery}</strong> : 'your mobile number'}.
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
            {/* Phone (editable in case they land here directly) */}
            {!phoneFromQuery && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mobile Number</label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="9876543210"
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
              <p className="text-xs text-gray-500 mt-1 text-center">The code expires in 5 minutes.</p>
            </div>

            <button
              type="submit"
              disabled={status === 'loading' || status === 'success' || otp.length < 6}
              className="w-full bg-black text-cream py-3 rounded-lg font-medium hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {status === 'loading' ? 'Verifying…' : 'Verify Mobile'}
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
              Skip for now → Log in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyMobilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-cream flex items-center justify-center"><p className="text-gray-600">Loading…</p></div>}>
      <VerifyMobileContent />
    </Suspense>
  );
}
