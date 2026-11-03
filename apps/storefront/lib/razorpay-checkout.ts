// Loads Razorpay's official Checkout.js script on demand and opens the payment
// modal. Per Razorpay's integration docs, this script must be loaded from their
// CDN directly (not bundled) - https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/build-integration/

declare global {
  interface Window {
    Razorpay: any;
  }
}

const SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';
let scriptLoadPromise: Promise<void> | null = null;

function loadRazorpayScript(): Promise<void> {
  if (typeof window !== 'undefined' && window.Razorpay) {
    return Promise.resolve();
  }
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay Checkout. Please check your connection and try again.'));
    document.body.appendChild(script);
  });
  return scriptLoadPromise;
}

export interface RazorpayCheckoutOptions {
  keyId: string;
  razorpayOrderId: string;
  amount: number; // paise
  currency: string;
  orderNumber: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
}

export interface RazorpayPaymentResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

/**
 * Opens Razorpay Checkout and resolves with the payment result on success.
 * Rejects if the user cancels/closes the modal or a payment failure event fires -
 * the caller must never treat this promise resolving as proof of payment on its
 * own; the result must still be sent to the server for signature verification.
 */
export function openRazorpayCheckout(options: RazorpayCheckoutOptions): Promise<RazorpayPaymentResult> {
  return loadRazorpayScript().then(
    () =>
      new Promise<RazorpayPaymentResult>((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: options.keyId,
          amount: options.amount,
          currency: options.currency,
          name: 'PREMAL KAIZEN',
          description: `Order ${options.orderNumber}`,
          order_id: options.razorpayOrderId,
          prefill: {
            name: options.customerName,
            email: options.customerEmail,
            contact: options.customerPhone,
          },
          theme: { color: '#000000' },
          handler: (response: RazorpayPaymentResult) => resolve(response),
          modal: {
            ondismiss: () => reject(new Error('Payment was cancelled.')),
          },
        });
        rzp.on('payment.failed', (response: any) => {
          reject(new Error(response?.error?.description || 'Payment failed. Please try again.'));
        });
        rzp.open();
      }),
  );
}
