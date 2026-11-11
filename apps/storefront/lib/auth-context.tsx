'use client';

import React, { createContext, useState, useEffect, ReactNode } from 'react';

export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string | null;
  emailVerified: string | null;
}

export interface AuthContextType {
  user: User | null;
  sessionToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /**
   * Step 1 of the mandatory two-step login flow: validates credentials only.
   * Returns `{ requiresOtp: true }` for every customer account (a fresh login
   * OTP has been emailed; no session is created yet - call verifyLoginOtp to
   * finish logging in) or `{ requiresOtp: false }` for an admin account
   * (session is already established, exactly like the old single-step login).
   */
  login: (email: string, password: string) => Promise<{ requiresOtp: boolean }>;
  /** Step 2: the only call that can turn a pending customer login into a real session. */
  verifyLoginOtp: (email: string, otp: string) => Promise<void>;
  resendLoginOtp: (email: string) => Promise<void>;
  register: (email: string, password: string, firstName?: string, lastName?: string, phoneNumber?: string) => Promise<void>;
  logout: () => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  updateProfile: (data: { firstName?: string; lastName?: string; phoneNumber?: string }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  sendOtp: (email: string) => Promise<void>;
  verifyOtp: (email: string, otp: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

  // Hydrate auth state from localStorage on mount
  useEffect(() => {
    const hydrateAuth = async () => {
      try {
        const storedToken = localStorage.getItem('sessionToken');
        if (storedToken) {
          setSessionToken(storedToken);

          // Verify session is still valid
          const response = await fetch(`${API_BASE}/api/auth/me`, {
            headers: {
              Authorization: `Bearer ${storedToken}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            setUser(data.user);
          } else {
            // Token expired, clear it
            localStorage.removeItem('sessionToken');
            setSessionToken(null);
          }
        }
      } catch (error) {
        console.error('Auth hydration error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    hydrateAuth();
  }, [API_BASE]);

  const login = async (email: string, password: string): Promise<{ requiresOtp: boolean }> => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        const err = new Error(data.message || 'Login failed') as Error & { code?: string; email?: string };
        err.code = data.code;
        err.email = data.email;
        throw err;
      }

      if (data.requiresOtp) {
        // A fresh login OTP has been emailed - no session exists yet. Never
        // set `user`/`sessionToken` here; the backend has not issued one, and
        // the old bug this flow replaces was exactly this: treating a
        // correct password as "logged in" before any OTP was ever verified.
        return { requiresOtp: true };
      }

      // Admin accounts only (see IdentityService.login) - a real session was
      // already issued directly, no OTP step required.
      setUser(data.user);
      setSessionToken(data.sessionToken);
      localStorage.setItem('sessionToken', data.sessionToken);
      return { requiresOtp: false };
    } finally {
      setIsLoading(false);
    }
  };

  const verifyLoginOtp = async (email: string, otp: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/auth/login/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Verification failed');
      }

      // This is the only place a customer session is ever created, mirroring
      // the backend: a correct password alone (login() above) never sets
      // `user`/`sessionToken` for a customer - only a verified OTP does.
      setUser(data.user);
      setSessionToken(data.sessionToken);
      localStorage.setItem('sessionToken', data.sessionToken);
    } finally {
      setIsLoading(false);
    }
  };

  const resendLoginOtp = async (email: string) => {
    const response = await fetch(`${API_BASE}/api/auth/login/resend-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Could not resend verification code');
    }
  };

  const register = async (email: string, password: string, firstName?: string, lastName?: string, phoneNumber?: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, firstName, lastName, phoneNumber }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Registration failed');
      }

      // Registration never returns a session token - the account still needs
      // email OTP verification before it can log in (the backend now enforces
      // this). Setting `user` here used to make the UI look logged in with no
      // real session at all (every authenticated API call would 401 against
      // a null token) and with no verification ever having happened. Leave
      // auth state untouched; the register page itself routes to the
      // verify-email step, and the customer logs in for real afterward.
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });
    } finally {
      setUser(null);
      setSessionToken(null);
      localStorage.removeItem('sessionToken');
      setIsLoading(false);
    }
  };

  const verifyEmail = async (token: string) => {
    const response = await fetch(`${API_BASE}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Email verification failed');
    }
  };

  const requestPasswordReset = async (email: string) => {
    const response = await fetch(`${API_BASE}/api/auth/request-password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Password reset request failed');
    }
  };

  const sendOtp = async (email: string) => {
    const response = await fetch(`${API_BASE}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Could not send verification code');
    }
  };

  const verifyOtp = async (email: string, otp: string) => {
    const response = await fetch(`${API_BASE}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Verification failed');
    }
    // Refresh user state to pick up the new emailVerified timestamp
    const me = await fetch(`${API_BASE}/api/auth/me`, {
      headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {},
    });
    if (me.ok) {
      const data = await me.json();
      setUser(data.user);
    }
  };

  const resetPassword = async (token: string, newPassword: string) => {
    const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Password reset failed');
    }
  };

  const updateProfile = async (data: { firstName?: string; lastName?: string; phoneNumber?: string }) => {
    const response = await fetch(`${API_BASE}/api/customer/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update profile');
    }

    const updated = await response.json();
    setUser((prev) => (prev ? { ...prev, ...updated } : prev));
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    const response = await fetch(`${API_BASE}/api/customer/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to change password');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        sessionToken,
        isLoading,
        isAuthenticated: !!user,
        login,
        verifyLoginOtp,
        resendLoginOtp,
        register,
        logout,
        verifyEmail,
        requestPasswordReset,
        resetPassword,
        updateProfile,
        changePassword,
        sendOtp,
        verifyOtp,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
