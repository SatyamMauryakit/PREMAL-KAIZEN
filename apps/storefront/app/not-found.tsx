import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-4 text-center pt-20">
      <p className="text-sm font-bold tracking-widest uppercase text-gray-medium mb-4">404</p>
      <h1 className="text-4xl md:text-5xl font-bold text-black mb-4">Page Not Found</h1>
      <p className="text-gray-dark text-lg mb-8 max-w-md">
        The page you're looking for doesn't exist or may have moved.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          href="/"
          className="px-8 py-3 bg-black text-cream font-semibold rounded hover:bg-gray-dark transition-colors"
        >
          Back to Home
        </Link>
        <Link
          href="/shop"
          className="px-8 py-3 border-2 border-black text-black font-semibold rounded hover:bg-black hover:text-cream transition-colors"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
