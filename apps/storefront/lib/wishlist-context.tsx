'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useAuth } from './auth-context';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

interface WishlistItem {
  productId: string;
  name: string;
  price: number;
  image: string;
  category: string;
  addedAt: number;
}

interface WishlistContextType {
  items: WishlistItem[];
  addItem: (product: Omit<WishlistItem, 'addedAt'>) => void;
  removeItem: (productId: string) => void;
  toggleItem: (product: Omit<WishlistItem, 'addedAt'>) => void;
  isInWishlist: (productId: string) => boolean;
  getItemCount: () => number;
  clearWishlist: () => void;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const { sessionToken } = useAuth();
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevSessionTokenRef = useRef<string | null>(null);
  const restoreRequestIdRef = useRef(0);

  // Restore from localStorage on mount (guest/offline-first view).
  useEffect(() => {
    try {
      const saved = localStorage.getItem('premal-wishlist');
      if (saved) {
        const parsed = JSON.parse(saved);
        setItems(Array.isArray(parsed) ? parsed : []);
      }
    } catch {
      // Ignore localStorage errors
    }
    setIsHydrated(true);
  }, []);

  // Save to localStorage whenever items change
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem('premal-wishlist', JSON.stringify(items));
    }
  }, [items, isHydrated]);

  // Background mirror to the backend for logged-in customers, same debounced
  // pattern as cart-context's sync - this is what makes the wishlist actually
  // belong to the account rather than just whatever's in this browser.
  useEffect(() => {
    if (!isHydrated || !sessionToken) return;

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      fetch(`${API_BASE}/api/customer/wishlist`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ productIds: items.map((i) => i.productId) }),
      }).catch(() => undefined);
    }, 800);

    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [items, isHydrated, sessionToken]);

  // Per-account wishlist lifecycle, identical in spirit to cart-context:
  // restore from the backend on login (replacing, never merging, the local
  // view - strict per-account isolation), clear the current browser view
  // only on logout (the backend record is untouched).
  useEffect(() => {
    if (!isHydrated) return;
    const prevToken = prevSessionTokenRef.current;
    prevSessionTokenRef.current = sessionToken;

    if (!prevToken && sessionToken) {
      const requestId = ++restoreRequestIdRef.current;
      fetch(`${API_BASE}/api/customer/wishlist`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data || restoreRequestIdRef.current !== requestId) return;
          setItems(
            data.items.map((i: { productId: string; name: string; image: string | null; price: number; category: string | null; addedAt: string }) => ({
              productId: i.productId,
              name: i.name,
              price: Math.round(i.price / 100), // backend returns paise; the local wishlist stores rupees, matching cart's convention
              image: i.image || '',
              category: i.category || '',
              addedAt: new Date(i.addedAt).getTime(),
            })),
          );
        })
        .catch(() => undefined);
    } else if (prevToken && !sessionToken) {
      restoreRequestIdRef.current++;
      setItems([]);
      try {
        localStorage.removeItem('premal-wishlist');
      } catch {
        // Ignore localStorage errors
      }
    }
  }, [sessionToken, isHydrated]);

  const addItem = (product: Omit<WishlistItem, 'addedAt'>) => {
    setItems((prev) => {
      const exists = prev.some((item) => item.productId === product.productId);
      if (exists) return prev;
      return [...prev, { ...product, addedAt: Date.now() }];
    });
  };

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((item) => item.productId !== productId));
  };

  const toggleItem = (product: Omit<WishlistItem, 'addedAt'>) => {
    const exists = items.some((item) => item.productId === product.productId);
    if (exists) {
      removeItem(product.productId);
    } else {
      addItem(product);
    }
  };

  const isInWishlist = (productId: string) => {
    return items.some((item) => item.productId === productId);
  };

  const getItemCount = () => items.length;

  const clearWishlist = () => {
    setItems([]);
    try {
      localStorage.removeItem('premal-wishlist');
    } catch {
      // Ignore localStorage errors
    }
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    if (sessionToken) {
      fetch(`${API_BASE}/api/customer/wishlist`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sessionToken}` },
      }).catch(() => undefined);
    }
  };

  const value: WishlistContextType = {
    items,
    addItem,
    removeItem,
    toggleItem,
    isInWishlist,
    getItemCount,
    clearWishlist,
  };

  return (
    <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (context === undefined) {
    throw new Error('useWishlist must be used within WishlistProvider');
  }
  return context;
}
