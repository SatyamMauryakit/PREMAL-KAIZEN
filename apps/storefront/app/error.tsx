'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-4 text-center pt-20">
      <p className="text-sm font-bold tracking-widest uppercase text-gray-medium mb-4">Error</p>
      <h1 className="text-4xl md:text-5xl font-bold text-black mb-4">Something Went Wrong</h1>
      <p className="text-gray-dark text-lg mb-8 max-w-md">
        We hit an unexpected error loading this page. Please try again.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={reset}
          className="px-8 py-3 bg-black text-cream font-semibold rounded hover:bg-gray-dark transition-colors"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="px-8 py-3 border-2 border-black text-black font-semibold rounded hover:bg-black hover:text-cream transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
