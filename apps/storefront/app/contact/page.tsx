'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { contactService, ContactFormData } from '@/lib/contact-service';
import { getStoreContactInfo } from '@/lib/store-info';

type FormState = 'idle' | 'loading' | 'success' | 'error';

export default function ContactPage() {
  const [formState, setFormState] = useState<FormState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [contactEmail, setContactEmail] = useState('');

  useEffect(() => {
    getStoreContactInfo()
      .then((info) => setContactEmail(info.storeEmail))
      .catch(() => {});
  }, []);

  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    subject: '',
    category: 'general',
    orderNumber: '',
    message: '',
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear errors when user starts typing
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormState('loading');
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await contactService.submitForm(formData);
      setSuccessMessage(response.message);
      setFormState('success');

      // Reset form
      setFormData({
        name: '',
        email: '',
        subject: '',
        category: 'general',
        orderNumber: '',
        message: '',
      });

      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      setFormState('error');
    } finally {
      if (formState !== 'error') {
        setTimeout(() => setFormState('idle'), 3000);
      }
    }
  };

  return (
    <div className="min-h-screen bg-cream pt-20 pb-16">
      {/* Breadcrumb */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 md:px-8 mb-8">
        <div className="flex items-center gap-2 text-sm text-gray-medium">
          <Link href="/" className="hover:text-black transition-colors">Home</Link>
          <span>/</span>
          <span className="text-black">Contact Us</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 md:px-8">
        {/* Page Header */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-black mb-3 tracking-tight">
            Get in Touch
          </h1>
          <p className="text-lg text-gray-dark leading-relaxed">
            Have a question or need help? We're here to help and would love to hear from you.
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Contact Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg border border-gray-light p-8">
              {successMessage && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-6">
                  {successMessage}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Name Field */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-black mb-2">
                    Name *
                  </label>
                  <input
                    id="name"
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    disabled={formState === 'loading'}
                    className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black transition-colors disabled:opacity-50"
                    placeholder="Your name"
                  />
                </div>

                {/* Email Field */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-black mb-2">
                    Email *
                  </label>
                  <input
                    id="email"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    disabled={formState === 'loading'}
                    className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black transition-colors disabled:opacity-50"
                    placeholder="you@example.com"
                  />
                </div>

                {/* Subject Field */}
                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-black mb-2">
                    Subject *
                  </label>
                  <input
                    id="subject"
                    type="text"
                    name="subject"
                    value={formData.subject}
                    onChange={handleInputChange}
                    required
                    disabled={formState === 'loading'}
                    className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black transition-colors disabled:opacity-50"
                    placeholder="What is this about?"
                    maxLength={200}
                  />
                </div>

                {/* Enquiry Type */}
                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-black mb-2">
                    Enquiry Type *
                  </label>
                  <select
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    disabled={formState === 'loading'}
                    className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black transition-colors disabled:opacity-50"
                  >
                    <option value="general">General Enquiry</option>
                    <option value="order-status">Order Status</option>
                    <option value="shipping">Shipping & Delivery</option>
                    <option value="returns">Returns & Exchanges</option>
                    <option value="product-question">Product Question</option>
                    <option value="payment-issue">Payment Issue</option>
                  </select>
                </div>

                {/* Order Number (Optional) */}
                <div>
                  <label htmlFor="orderNumber" className="block text-sm font-medium text-black mb-2">
                    Order Number (if applicable)
                  </label>
                  <input
                    id="orderNumber"
                    type="text"
                    name="orderNumber"
                    value={formData.orderNumber}
                    onChange={handleInputChange}
                    disabled={formState === 'loading'}
                    className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black transition-colors disabled:opacity-50"
                    placeholder="e.g., PK-2024-001"
                  />
                  <p className="text-xs text-gray-medium mt-1">
                    Include if your enquiry relates to a specific order
                  </p>
                </div>

                {/* Message Field */}
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-black mb-2">
                    Message *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    required
                    disabled={formState === 'loading'}
                    rows={6}
                    maxLength={5000}
                    className="w-full px-4 py-2 border border-gray-light rounded focus:outline-none focus:border-black transition-colors disabled:opacity-50 resize-none"
                    placeholder="Tell us more about your enquiry..."
                  />
                  <p className="text-xs text-gray-medium mt-1">
                    {formData.message.length}/5000
                  </p>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                    {error}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={formState === 'loading'}
                  className="w-full px-6 py-3 bg-black text-cream rounded hover:bg-gray-dark transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {formState === 'loading' ? 'Sending...' : 'Send Message'}
                </button>

                <p className="text-xs text-gray-medium text-center">
                  * Required fields
                </p>
              </form>
            </div>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-6">
            {/* Contact Info */}
            <div className="bg-white rounded-lg border border-gray-light p-6">
              <h3 className="font-bold text-black mb-4">Contact Info</h3>
              <div className="space-y-4 text-sm text-gray-dark">
                <div>
                  <p className="text-xs font-medium text-black mb-1">Email</p>
                  <p>{contactEmail || 'Loading...'}</p>
                </div>
              </div>
            </div>

            {/* Help Links */}
            <div className="bg-gray-light rounded-lg p-6">
              <h3 className="font-bold text-black mb-4">Quick Links</h3>
              <div className="space-y-3">
                <Link
                  href="/orders"
                  className="block text-sm text-gray-dark hover:text-black transition-colors underline"
                >
                  Track Your Order →
                </Link>
                <Link
                  href="/shipping"
                  className="block text-sm text-gray-dark hover:text-black transition-colors underline"
                >
                  Shipping Information →
                </Link>
                <Link
                  href="/returns"
                  className="block text-sm text-gray-dark hover:text-black transition-colors underline"
                >
                  Returns & Exchanges →
                </Link>
                <Link
                  href="/account/orders"
                  className="block text-sm text-gray-dark hover:text-black transition-colors underline"
                >
                  My Orders →
                </Link>
              </div>
            </div>

            {/* FAQ */}
            <div className="bg-white rounded-lg border border-gray-light p-6">
              <h3 className="font-bold text-black mb-4">FAQ</h3>
              <p className="text-sm text-gray-dark mb-4">
                Check our shipping and returns pages for answers to common questions.
              </p>
              <Link
                href="/shipping"
                className="inline-block text-sm text-black font-medium underline hover:no-underline"
              >
                View Help →
              </Link>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="bg-gray-light rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-black mb-4">We're Here to Help</h2>
          <p className="text-gray-dark mb-6 leading-relaxed">
            Whether you have a question about our products, need help with an order, or just want to say hello,
            we'd love to hear from you. Fill out the form above and we'll get back to you as soon as possible.
          </p>
          {contactEmail && (
            <p className="text-sm text-gray-medium">
              You can also reach us directly at{' '}
              <a href={`mailto:${contactEmail}`} className="text-black underline hover:no-underline">{contactEmail}</a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
