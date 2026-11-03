import Link from 'next/link';

export const HeroSection: React.FC = () => {
  return (
    <section className="relative w-full bg-black text-cream overflow-hidden" style={{ marginTop: '4rem' }}>
      {/* Grid layout: text on left, image on right */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 items-stretch min-h-[600px] md:min-h-[500px]">
        {/* Left side: Text content on dark background */}
        <div className="relative z-20 bg-neutral-950 flex flex-col justify-center px-8 sm:px-12 md:px-16 py-12 md:py-0">
          {/* Brand label - cream box */}
          <div className="mb-8 inline-block relative z-30">
            <span className="bg-cream text-black px-4 py-2 text-xs font-bold tracking-widest rounded-md inline-block" style={{ backgroundColor: '#F5F1ED', color: '#000000' }}>
              PREMAL KAIZEN
            </span>
          </div>

          {/* Main heading - Large serif style */}
          <h1 className="text-5xl sm:text-6xl md:text-6xl font-display font-bold mb-6 leading-tight text-cream" style={{ color: '#F5F1ED' }}>
            Wear Your Vibe
            <br />
            Own Your Story
          </h1>

          {/* Description */}
          <p className="text-base md:text-lg text-gray-300 mb-8 max-w-lg leading-relaxed font-light">
            Elevated streetwear crafted for the modern explorer. Built for comfort. Designed for confidence.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 mb-12 relative z-30">
            <Link
              href="/shop"
              className="px-8 py-3 bg-cream text-black font-semibold hover:bg-opacity-90 active:bg-opacity-75 transition-all rounded-md text-center inline-block"
              style={{ backgroundColor: '#F5F1ED', color: '#000000' }}
            >
              Shop Now
            </Link>
            <Link
              href="/shop?filter=new"
              className="px-8 py-3 border-2 border-cream text-cream font-semibold hover:bg-cream hover:text-black transition-all rounded-md text-center inline-block"
              style={{ borderColor: '#F5F1ED', color: '#F5F1ED' }}
            >
              New Collection
            </Link>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 text-xs sm:text-sm text-gray-300">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>100% Cotton</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m0 10v10l8 4m0-10l8-4" />
              </svg>
              <span>Pan-India Delivery</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m7.5-4.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Cash on Delivery Available</span>
            </div>
          </div>
        </div>

        {/* Right side: Hero image - Fashion photography */}
        <div className="hidden md:flex items-center justify-center relative bg-gradient-to-br from-gray-700 via-gray-800 to-gray-950 overflow-hidden">
          {/* Model image with overlay gradient */}
          <img
            src="/hero-model.png"
            alt="PREMAL KAIZEN - Hooded model in premium streetwear with misty mountains"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: 'center 20%' }}
          />
          {/* Overlay gradient for depth and text contrast */}
          <div className="absolute inset-0 bg-gradient-to-l from-black/0 via-black/10 to-black/30 z-10" />
        </div>
      </div>
    </section>
  );
};
