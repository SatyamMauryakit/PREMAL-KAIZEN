'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { reviewsService, Review, RatingSummary, ReviewEligibility } from '@/lib/reviews-service';

interface ProductReviewsProps {
  productId: string;
}

type SortOption = 'newest' | 'highest' | 'lowest';

const PAGE_SIZE = 5;

function Stars({ value, size = 'text-lg' }: { value: number; size?: string }) {
  const rounded = Math.round(value);
  return (
    <span className={`${size} text-beige leading-none`} aria-label={`${value} out of 5 stars`}>
      {'★'.repeat(rounded)}
      <span className="text-gray-300">{'★'.repeat(5 - rounded)}</span>
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ProductReviews({ productId }: ProductReviewsProps) {
  const { sessionToken, isAuthenticated } = useAuth();

  const [summary, setSummary] = useState<RatingSummary | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortOption>('newest');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [eligibility, setEligibility] = useState<ReviewEligibility | null>(null);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formRating, setFormRating] = useState(5);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());

  // Initial load + whenever sort changes (resets to page 1).
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    Promise.all([
      reviewsService.getRatingSummary(productId),
      reviewsService.getProductReviews(productId, { page: 1, limit: PAGE_SIZE, sort }),
    ])
      .then(([summaryRes, reviewsRes]) => {
        if (cancelled) return;
        setSummary(summaryRes);
        setReviews(reviewsRes.data);
        setTotal(reviewsRes.total);
        setPage(1);
      })
      .catch(() => {
        if (!cancelled) {
          setSummary(null);
          setReviews([]);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId, sort]);

  // Eligibility only matters for a signed-in customer.
  useEffect(() => {
    if (!isAuthenticated || !sessionToken) {
      setEligibility(null);
      return;
    }
    setIsCheckingEligibility(true);
    reviewsService
      .getEligibility(productId, sessionToken)
      .then(setEligibility)
      .catch(() => setEligibility(null))
      .finally(() => setIsCheckingEligibility(false));
  }, [productId, isAuthenticated, sessionToken]);

  const handleLoadMore = useCallback(() => {
    const nextPage = page + 1;
    setIsLoadingMore(true);
    reviewsService
      .getProductReviews(productId, { page: nextPage, limit: PAGE_SIZE, sort })
      .then((result) => {
        setReviews((prev) => [...prev, ...result.data]);
        setTotal(result.total);
        setPage(nextPage);
      })
      .finally(() => setIsLoadingMore(false));
  }, [productId, page, sort]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionToken || !eligibility?.eligibleOrderItems.length) return;

    setSubmitState('loading');
    setSubmitError(null);
    try {
      await reviewsService.submitReview(sessionToken, {
        productId,
        orderItemId: eligibility.eligibleOrderItems[0].orderItemId,
        rating: formRating,
        title: formTitle.trim(),
        description: formDescription.trim(),
      });
      setSubmitState('success');
      setShowForm(false);
      setFormTitle('');
      setFormDescription('');
      setFormRating(5);
      // Re-check eligibility (this purchase is now reviewed) - the new review is
      // 'pending', so it will not appear in the public list until an admin
      // approves it, which is correct, not a bug.
      reviewsService.getEligibility(productId, sessionToken).then(setEligibility).catch(() => {});
    } catch (err) {
      setSubmitState('error');
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit review');
    }
  };

  const handleReport = async (reviewId: string) => {
    if (!sessionToken || reportedIds.has(reviewId)) return;
    try {
      await reviewsService.reportReview(sessionToken, reviewId);
      setReportedIds((prev) => new Set(prev).add(reviewId));
    } catch {
      // Reporting is a courtesy action, not critical - fail silently rather than alarm the user.
    }
  };

  const hasMore = reviews.length < total;

  return (
    <section className="py-12 border-t border-gray-light" aria-label="Product reviews">
      <h2 className="text-2xl md:text-3xl font-display font-bold text-black mb-6">Reviews</h2>

      {/* Summary + distribution */}
      {summary && summary.total > 0 && (
        <div className="flex flex-col sm:flex-row gap-8 mb-8">
          <div className="flex flex-col items-center sm:items-start">
            <p className="text-5xl font-bold text-black">{summary.average}</p>
            <Stars value={summary.average} size="text-xl" />
            <p className="text-sm text-gray-medium mt-1">{summary.total} review{summary.total === 1 ? '' : 's'}</p>
          </div>
          <div className="flex-1 max-w-sm space-y-1">
            {([5, 4, 3, 2, 1] as const).map((star) => {
              const count = summary.distribution[star];
              const pct = summary.total > 0 ? Math.round((count / summary.total) * 100) : 0;
              return (
                <div key={star} className="flex items-center gap-2 text-xs text-gray-dark">
                  <span className="w-8">{star}★</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded overflow-hidden">
                    <div className="h-full bg-beige" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {summary && summary.total === 0 && !isLoading && (
        <p className="text-gray-medium mb-8">No reviews yet - be the first to share your experience.</p>
      )}

      {/* Write a review */}
      <div className="mb-8 bg-cream border border-gray-light rounded-lg p-6">
        {!isAuthenticated ? (
          <p className="text-sm text-gray-dark">
            <Link href={`/auth/login?redirect=/products/${productId}`} className="text-black font-semibold underline hover:no-underline">
              Log in
            </Link>{' '}
            to write a review - only customers who have purchased and received this product can review it.
          </p>
        ) : isCheckingEligibility ? (
          <p className="text-sm text-gray-medium">Checking review eligibility...</p>
        ) : !eligibility?.canReview ? (
          <p className="text-sm text-gray-dark">
            {eligibility?.alreadyReviewed
              ? "You've already reviewed your purchase of this product."
              : eligibility?.hasPurchased
                ? 'Your order for this product is not yet delivered - you can review it once it arrives.'
                : 'Purchase and receive this product to write a review.'}
          </p>
        ) : showForm ? (
          <form onSubmit={handleSubmitReview} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-black mb-2">Your Rating</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFormRating(star)}
                    aria-label={`Rate ${star} out of 5`}
                    className={`text-3xl leading-none ${star <= formRating ? 'text-beige' : 'text-gray-300'}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="review-title" className="block text-sm font-semibold text-black mb-2">Title</label>
              <input
                id="review-title"
                type="text"
                required
                minLength={3}
                maxLength={150}
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-light rounded focus:outline-none focus:border-black"
                placeholder="Sum up your experience"
              />
            </div>
            <div>
              <label htmlFor="review-description" className="block text-sm font-semibold text-black mb-2">Review</label>
              <textarea
                id="review-description"
                required
                minLength={10}
                maxLength={2000}
                rows={4}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-light rounded focus:outline-none focus:border-black resize-none"
                placeholder="What did you like or dislike? How does it fit?"
              />
            </div>
            {submitError && <p className="text-sm text-red-600">{submitError}</p>}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitState === 'loading'}
                className="px-6 py-2 bg-black text-cream font-semibold rounded hover:bg-gray-dark transition-colors disabled:opacity-50"
              >
                {submitState === 'loading' ? 'Submitting...' : 'Submit Review'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-2 border border-gray-light text-black rounded hover:border-black transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : submitState === 'success' ? (
          <p className="text-sm text-green-700">
            Thanks for your review! It&apos;s been submitted and will appear once our team approves it.
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="px-6 py-2 bg-black text-cream font-semibold rounded hover:bg-gray-dark transition-colors"
          >
            Write a Review
          </button>
        )}
      </div>

      {/* Sort */}
      {reviews.length > 0 && (
        <div className="flex justify-end mb-4">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="px-3 py-1.5 border border-gray-light rounded text-sm focus:outline-none focus:border-black"
            aria-label="Sort reviews"
          >
            <option value="newest">Newest</option>
            <option value="highest">Highest Rated</option>
            <option value="lowest">Lowest Rated</option>
          </select>
        </div>
      )}

      {/* Review list */}
      {isLoading ? (
        <p className="text-gray-medium">Loading reviews...</p>
      ) : (
        <div className="space-y-6">
          {reviews.map((review) => (
            <div key={review.id} className="border-b border-gray-light pb-6 last:border-0">
              <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Stars value={review.rating} size="text-sm" />
                  {review.verifiedPurchase && (
                    <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded">
                      Verified Purchase
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-medium">{formatDate(review.createdAt)}</span>
              </div>
              <p className="font-semibold text-black mb-1">{review.title}</p>
              <p className="text-sm text-gray-dark leading-relaxed mb-2">{review.description}</p>
              <p className="text-xs text-gray-medium flex items-center gap-3">
                <span>{review.reviewerName}</span>
                {isAuthenticated && (
                  <button
                    type="button"
                    onClick={() => handleReport(review.id)}
                    disabled={reportedIds.has(review.id)}
                    className="underline hover:no-underline disabled:no-underline disabled:cursor-default"
                  >
                    {reportedIds.has(review.id) ? 'Reported' : 'Report'}
                  </button>
                )}
              </p>
            </div>
          ))}
        </div>
      )}

      {!isLoading && hasMore && (
        <div className="flex justify-center mt-6">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="px-6 py-2 border border-black text-black text-sm font-medium hover:bg-black hover:text-cream transition-colors rounded disabled:opacity-50"
          >
            {isLoadingMore ? 'Loading...' : 'Load More Reviews'}
          </button>
        </div>
      )}
    </section>
  );
}
