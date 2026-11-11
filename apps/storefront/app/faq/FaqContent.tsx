'use client';

import { useState } from 'react';
import Link from 'next/link';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSection {
  title: string;
  icon: string;
  items: FAQItem[];
}

const FAQ_SECTIONS: FAQSection[] = [
  {
    title: 'Orders',
    icon: '📦',
    items: [
      {
        question: 'How do I place an order?',
        answer: 'Browse our collection, select your size and colour, add items to your cart, and proceed to checkout. You can pay via UPI, cards, net banking, wallets, or Cash on Delivery.',
      },
      {
        question: 'Can I modify or cancel my order after placing it?',
        answer: 'Orders can be cancelled before they move to the "Processing" stage. Once packed or shipped, cancellations are no longer possible. Please contact us as soon as possible if you need to make changes.',
      },
      {
        question: 'How can I track my order?',
        answer: 'Once your order is shipped, you will receive tracking details on your Email. You can also track anytime from the Track Order page using your order number and email, or from "My Orders" in your account.',
      },
      {
        question: 'What does each order status mean?',
        answer: 'Pending: order received, awaiting confirmation. Confirmed: order accepted. Processing: being prepared. Packed: packaged and ready to ship. Shipped: dispatched with a courier. Out for Delivery: arriving today. Delivered: successfully delivered. Cancelled: order was cancelled.',
      },
    ],
  },
  {
    title: 'Payments',
    icon: '💳',
    items: [
      {
        question: 'Is Cash on Delivery (COD) available?',
        answer: 'Yes, Cash on Delivery is available alongside our online payment options.',
      },
      {
        question: 'What payment methods do you accept?',
        answer: 'We accept UPI (GPay, PhonePe, Paytm), Credit/Debit Cards, Net Banking, Wallets (processed securely via Razorpay), and Cash on Delivery. All online payments are 100% secure.',
      },
      {
        question: 'Is my payment information secure?',
        answer: 'Yes. All online payments are processed securely through Razorpay, a PCI-DSS compliant payment gateway. We never store your card details on our servers.',
      },
      {
        question: 'What happens if my payment fails?',
        answer: 'Your order will remain unpaid. No amount is charged for a failed payment. You can retry payment from your order history, or choose Cash on Delivery instead.',
      },
      {
        question: 'Do you charge any extra fees?',
        answer: 'The price shown at checkout is the final amount — there are no hidden fees. Shipping charges (if applicable) are displayed separately before you confirm your order.',
      },
    ],
  },
  {
    title: 'Shipping & Delivery',
    icon: '🚚',
    items: [
      {
        question: 'Do you deliver all over India?',
        answer: 'Yes, we offer Pan-India delivery to all serviceable pin codes.',
      },
      {
        question: 'How long does delivery take?',
        answer: 'Usually 4–7 working days depending on your location. You will get a tracking link once your order is shipped.',
      },
      {
        question: 'What are the shipping charges?',
        answer: 'Shipping charges are calculated at checkout based on your location and order weight.',
      },
      {
        question: 'What if my package is delayed?',
        answer: 'Delays can occasionally happen due to courier issues or holidays. If your order has not arrived within the estimated timeframe, please contact us with your order number.',
      },
    ],
  },
  {
    title: 'Returns & Refunds',
    icon: '↩️',
    items: [
      {
        question: 'What is your return/exchange policy?',
        answer: 'We have an easy exchange policy for size issues within 7 days of delivery. The product must be unused with original tags attached. There is no return on sale items or last-size items.',
      },
      {
        question: 'How do I request a return?',
        answer: 'Log in to your account, go to My Orders, find the relevant order, and submit a return request. Our team will review it and respond within 2 business days.',
      },
      {
        question: 'When will I receive my refund?',
        answer: 'Once a return is approved and the item is received, refunds are processed within 5–7 business days to your original payment method. COD refunds are issued as store credit or via bank transfer.',
      },
      {
        question: 'What items cannot be returned?',
        answer: 'Sale/discounted items, items that have been washed, worn, or damaged, and items returned without original tags or packaging may not be eligible for return.',
      },
    ],
  },
  {
    title: 'Products',
    icon: '👕',
    items: [
      {
        question: 'How do I find the right size?',
        answer: 'Each product page includes a size guide. If you are unsure, we recommend choosing one size up as our fits tend to be true to size.',
      },
      {
        question: 'What type of fabric do you use?',
        answer: 'We offer a premium collection of fabrics including cotton, cotton-blends and mix fabrics. Fabric details are mentioned on each product page.',
      },
      {
        question: 'Is it 100% cotton?',
        answer: 'Not all products are 100% cotton. We have both 100% cotton and premium mix/blended fabrics for better comfort, durability and finish.',
      },
      {
        question: 'How should I care for my PREMAL KAIZEN clothing?',
        answer: 'Machine wash cold on a gentle cycle, inside out. Avoid bleach. Tumble dry low or air dry. Iron on low heat if needed. Full care instructions are on the product tag.',
      },
      {
        question: 'A product I want is out of stock. Will it come back?',
        answer: 'Popular items are restocked when possible. You can check back on the product page or contact us to express interest — we factor customer demand into restock decisions.',
      },
    ],
  },
  {
    title: 'Account & Verification',
    icon: '👤',
    items: [
      {
        question: 'Do I need an account to shop?',
        answer: 'You can browse and add items without an account, but you need to be logged in to place an order.',
      },
      {
        question: 'How do I verify my email address?',
        answer: 'After registration, a 6-digit verification code is sent to your email. Enter it on the verification page. You can also request a new code if it expires.',
      },
      {
        question: 'I did not receive my verification code. What should I do?',
        answer: 'Check your spam/junk folder first. If it is not there, visit the email verification page and click "Resend Code". Codes can be re-sent once every 60 seconds.',
      },
      {
        question: 'How do I reset my password?',
        answer: 'Click "Forgot Password" on the login page. Enter your email address and we will send a password reset link. The link expires after 24 hours.',
      },
    ],
  },
];

function FAQAccordion({ item }: { item: FAQItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-200 last:border-b-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex justify-between items-start py-5 text-left group"
        aria-expanded={open}
      >
        <span className="font-medium text-black group-hover:text-gray-700 pr-8 leading-snug">
          {item.question}
        </span>
        <span className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full border border-gray-300 transition-transform ${open ? 'rotate-180 bg-black border-black' : ''}`}>
          <svg className={`w-3 h-3 transition-colors ${open ? 'text-white' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="pb-5 pr-8">
          <p className="text-gray-600 leading-relaxed">{item.answer}</p>
        </div>
      )}
    </div>
  );
}

export default function FaqContent() {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-cream pt-20 pb-20">
      {/* Hero */}
      <div className="bg-black text-cream py-16 px-4 sm:px-6 md:px-8 mb-16">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Frequently Asked Questions</h1>
          <p className="text-gray-300 text-lg">
            Find quick answers to the most common questions about orders, payments, shipping, and more.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 md:px-8">
        {/* Section navigation pills */}
        <div className="flex flex-wrap gap-2 mb-12 justify-center">
          {FAQ_SECTIONS.map((s) => (
            <button
              key={s.title}
              onClick={() => {
                setActiveSection(activeSection === s.title ? null : s.title);
                document.getElementById(`faq-${s.title}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                activeSection === s.title
                  ? 'bg-black text-cream border-black'
                  : 'bg-white text-black border-gray-300 hover:border-black'
              }`}
            >
              {s.icon} {s.title}
            </button>
          ))}
        </div>

        {/* FAQ sections */}
        <div className="space-y-12">
          {FAQ_SECTIONS.map((section) => (
            <div key={section.title} id={`faq-${section.title}`} className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-2xl">{section.icon}</span>
                <h2 className="text-2xl font-bold text-black">{section.title}</h2>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 px-6">
                {section.items.map((item) => (
                  <FAQAccordion key={item.question} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Still need help */}
        <div className="mt-16 bg-black text-cream rounded-lg p-10 text-center">
          <h3 className="text-2xl font-bold mb-3">Still have questions?</h3>
          <p className="text-gray-300 mb-6">
            Our support team is here to help. Reach out and we'll get back to you as quickly as possible.
          </p>
          <Link
            href="/contact"
            className="inline-block px-8 py-3 bg-cream text-black font-semibold rounded hover:bg-gray-100 transition-colors"
          >
            Contact Us
          </Link>
        </div>
      </div>
    </div>
  );
}
