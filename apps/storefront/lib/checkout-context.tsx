'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface ShippingAddress {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  street1: string;
  street2?: string;
  landmark?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface CheckoutStep {
  step: 'cart' | 'information' | 'shipping' | 'payment' | 'review';
  isCompleted: boolean;
}

export interface AppliedCoupon {
  code: string;
  discountAmount: number;
}

interface CheckoutContextType {
  currentStep: 'cart' | 'information' | 'shipping' | 'payment' | 'review';
  shippingAddress: ShippingAddress | null;
  billingAddress: ShippingAddress | null;
  sameAsBilling: boolean;
  shippingMethod: string | null;
  paymentMethod: 'card' | 'upi' | 'netbanking' | 'cod' | null;
  orderNotes: string;
  isLoading: boolean;
  error: string | null;
  appliedCoupon: AppliedCoupon | null;
  couponError: string | null;
  isApplyingCoupon: boolean;

  // Actions
  goToStep: (step: 'cart' | 'information' | 'shipping' | 'payment' | 'review') => void;
  applyCoupon: (code: string, userId: string, cartItems: Array<{ productId: string; quantity: number; price: number }>, subtotal: number) => Promise<void>;
  removeCoupon: () => void;
  updateShippingAddress: (address: ShippingAddress) => void;
  updateBillingAddress: (address: ShippingAddress) => void;
  setSameAsBilling: (same: boolean) => void;
  setShippingMethod: (method: string) => void;
  setPaymentMethod: (method: 'card' | 'upi' | 'netbanking' | 'cod') => void;
  setOrderNotes: (notes: string) => void;
  setError: (error: string | null) => void;
  resetCheckout: () => void;
}

const CheckoutContext = createContext<CheckoutContextType | undefined>(undefined);

export function CheckoutProvider({ children }: { children: ReactNode }) {
  const [currentStep, setCurrentStep] = useState<'cart' | 'information' | 'shipping' | 'payment' | 'review'>('cart');
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress | null>(null);
  const [billingAddress, setBillingAddress] = useState<ShippingAddress | null>(null);
  const [sameAsBilling, setSameAsShippingBilling] = useState(true);
  const [shippingMethod, setShippingMethodState] = useState<string | null>('standard');
  const [paymentMethod, setPaymentMethodState] = useState<'card' | 'upi' | 'netbanking' | 'cod' | null>(null);
  const [orderNotes, setOrderNotesState] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);

  const goToStep = (step: 'cart' | 'information' | 'shipping' | 'payment' | 'review') => {
    setCurrentStep(step);
    setErrorState(null);
  };

  const updateShippingAddress = (address: ShippingAddress) => {
    setShippingAddress(address);
  };

  const updateBillingAddress = (address: ShippingAddress) => {
    setBillingAddress(address);
  };

  const setSameAsBilling = (same: boolean) => {
    setSameAsShippingBilling(same);
    if (same && shippingAddress) {
      setBillingAddress(shippingAddress);
    }
  };

  const setShippingMethod = (method: string) => {
    setShippingMethodState(method);
  };

  const setPaymentMethod = (method: 'card' | 'upi' | 'netbanking' | 'cod') => {
    setPaymentMethodState(method);
  };

  const setOrderNotes = (notes: string) => {
    setOrderNotesState(notes);
  };

  const setError = (err: string | null) => {
    setErrorState(err);
  };

  const resetCheckout = () => {
    setCurrentStep('cart');
    setShippingAddress(null);
    setBillingAddress(null);
    setSameAsShippingBilling(true);
    setShippingMethodState('standard');
    setPaymentMethodState(null);
    setOrderNotesState('');
    setErrorState(null);
    setAppliedCoupon(null);
    setCouponError(null);
  };

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

  const applyCoupon = async (
    code: string,
    userId: string,
    cartItems: Array<{ productId: string; quantity: number; price: number }>,
    subtotal: number  // in RUPEES (cart state unit)
  ) => {
    setIsApplyingCoupon(true);
    setCouponError(null);
    try {
      // The promotions API works in PAISE (matches the backend's stored prices).
      // Convert both the cart item prices and subtotal from rupees → paise.
      const cartItemsPaise = cartItems.map((i) => ({ ...i, price: i.price * 100 }));
      const subtotalPaise = subtotal * 100;
      const response = await fetch(`${API_BASE}/api/promotions/validate-coupon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ couponCode: code, userId, cartItems: cartItemsPaise, subtotal: subtotalPaise }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Invalid coupon code');
      // discountAmount returned is in paise — store as-is so OrderReview can use it
      // with calculateTax/calculateShipping (both paise-based).
      setAppliedCoupon({ code: data.couponCode, discountAmount: data.discountAmount });
    } catch (err) {
      setCouponError(err instanceof Error ? err.message : 'Failed to apply coupon');
      setAppliedCoupon(null);
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponError(null);
  };

  const value: CheckoutContextType = {
    currentStep,
    shippingAddress,
    billingAddress,
    sameAsBilling,
    shippingMethod,
    paymentMethod,
    orderNotes,
    isLoading,
    error,
    appliedCoupon,
    couponError,
    isApplyingCoupon,
    goToStep,
    updateShippingAddress,
    updateBillingAddress,
    setSameAsBilling,
    setShippingMethod,
    setPaymentMethod,
    setOrderNotes,
    setError,
    applyCoupon,
    removeCoupon,
    resetCheckout,
  };

  return (
    <CheckoutContext.Provider value={value}>
      {children}
    </CheckoutContext.Provider>
  );
}

export function useCheckout() {
  const context = useContext(CheckoutContext);
  if (context === undefined) {
    throw new Error('useCheckout must be used within CheckoutProvider');
  }
  return context;
}
