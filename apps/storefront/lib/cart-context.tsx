'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useAuth } from './auth-context';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  selectedSize?: string;
  selectedColor?: string;
}

interface CartContextType {
  items: CartItem[];
  isHydrated: boolean;
  addItem: (product: Omit<CartItem, 'id' | 'quantity'> & { quantity?: number }) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  getItemCount: () => number;
  getSubtotal: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// Generate stable cart item ID based on product + variant
function generateCartItemId(
  productId: string,
  selectedSize?: string,
  selectedColor?: string
): string {
  return [productId, selectedSize, selectedColor].filter(Boolean).join('_');
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const { sessionToken } = useAuth();
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevSessionTokenRef = useRef<string | null>(null);
  const restoreRequestIdRef = useRef(0);

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('premal-cart');
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
      localStorage.setItem('premal-cart', JSON.stringify(items));
    }
  }, [items, isHydrated]);

  // Background mirror to the backend for logged-in customers (admin cart
  // visibility - Section 3). Purely additive: the storefront's own cart UI
  // keeps reading/writing localStorage exactly as before, completely
  // unaffected if this sync is slow, fails, or the customer is a guest.
  // Debounced so rapid quantity changes don't fire a request per keystroke.
  useEffect(() => {
    if (!isHydrated || !sessionToken) return;

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      fetch(`${API_BASE}/api/customer/cart`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            selectedSize: i.selectedSize,
            selectedColor: i.selectedColor,
          })),
        }),
      }).catch(() => {
        // Best-effort only - admin cart visibility lagging behind is not a
        // customer-facing problem, so failures here are silently ignored.
      });
    }, 800);

    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [items, isHydrated, sessionToken]);

  // Per-account cart lifecycle (Sections 3-5): restore from the backend on
  // login, clear the *current browser view only* on logout - the backend
  // record is never touched here, only by clearCart() (checkout) or an
  // explicit account action. Detected by watching for a sessionToken
  // transition rather than just "is a token present", so this only ever
  // fires once per actual login/logout, not on every render.
  useEffect(() => {
    if (!isHydrated) return;
    const prevToken = prevSessionTokenRef.current;
    prevSessionTokenRef.current = sessionToken;

    if (!prevToken && sessionToken) {
      // Just logged in - fetch this account's saved cart and replace
      // whatever was showing (never merge a guest/previous-account cart into
      // it - strict per-account isolation, Section 5).
      const requestId = ++restoreRequestIdRef.current;
      fetch(`${API_BASE}/api/customer/cart`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data || restoreRequestIdRef.current !== requestId) return; // a newer login/logout superseded this
          setItems(
            data.items.map((i: { productId: string; name: string; image: string | null; price: number; quantity: number; selectedSize: string | null; selectedColor: string | null }) => ({
              id: generateCartItemId(i.productId, i.selectedSize || undefined, i.selectedColor || undefined),
              productId: i.productId,
              name: i.name,
              price: Math.round(i.price / 100), // backend returns paise; the local cart stores rupees (matches addItem's existing convention)
              image: i.image || '',
              quantity: i.quantity,
              selectedSize: i.selectedSize || undefined,
              selectedColor: i.selectedColor || undefined,
            })),
          );
        })
        .catch(() => undefined);
    } else if (prevToken && !sessionToken) {
      // Just logged out - clear this browser session's view only. The
      // account's backend-persisted cart is left completely intact; logging
      // back in (above) restores it.
      restoreRequestIdRef.current++; // invalidate any in-flight restore from the login we're now leaving
      setItems([]);
      try {
        localStorage.removeItem('premal-cart');
      } catch {
        // Ignore localStorage errors
      }
    }
  }, [sessionToken, isHydrated]);

  const addItem = (
    product: Omit<CartItem, 'id' | 'quantity'> & { quantity?: number }
  ) => {
    const itemId = generateCartItemId(product.productId, product.selectedSize, product.selectedColor);
    const quantity = product.quantity || 1;

    setItems((prev) => {
      const existing = prev.find((item) => item.id === itemId);
      if (existing) {
        return prev.map((item) =>
          item.id === itemId ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [...prev, { ...product, id: itemId, quantity }];
    });
  };

  const removeItem = (itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(itemId);
      return;
    }
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
    // Clear localStorage synchronously too, not just React state - the order
    // confirmation page calls clearCart() right after a fresh full-page navigation
    // (window.location.href), which remounts this provider. Its own "restore from
    // localStorage" mount effect can then run AFTER this clear (child effects fire
    // before parent effects on the same commit) and would otherwise read the old
    // saved cart straight back in, undoing the clear. Removing the key directly
    // here means that restore effect finds nothing to restore, regardless of
    // which effect happens to run first.
    try {
      localStorage.removeItem('premal-cart');
    } catch {
      // Ignore localStorage errors
    }

    // Mirror the clear to the backend too (e.g. right after checkout), so the
    // admin cart view doesn't keep showing a cart the customer no longer has.
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    if (sessionToken) {
      fetch(`${API_BASE}/api/customer/cart`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sessionToken}` },
      }).catch(() => undefined);
    }
  };

  const getItemCount = () => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  };

  const getSubtotal = () => {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const value: CartContextType = {
    items,
    isHydrated,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    getItemCount,
    getSubtotal,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}
