'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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

  // Restore from localStorage on mount
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
