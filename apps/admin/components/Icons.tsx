export const Icons = {
  Voucher: ({ className = 'w-5 h-5' }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M20 12c0-1.1.9-2 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-1.99.9-1.99 2v4c1.1 0 1.99.9 1.99 2s-.89 2-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c-1.1 0-2-.9-2-2zm-9 4.5h-2v-2h2v2zm0-4.25h-2v-2h2v2zm0-4.25h-2v-2h2v2z" />
    </svg>
  ),

  Dashboard: ({ className = 'w-5 h-5' }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
    </svg>
  ),

  Products: ({ className = 'w-5 h-5' }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
    </svg>
  ),

  Categories: ({ className = 'w-5 h-5' }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M10 10.5h4v3h-4zM10 3.5h4v3h-4zM16 10.5h4v3h-4zM16 3.5h4v3h-4zM10 17.5h4v3h-4zM4 3.5h4v3H4zM4 10.5h4v3H4zM4 17.5h4v3H4zM16 17.5h4v3h-4z" />
    </svg>
  ),

  Inventory: ({ className = 'w-5 h-5' }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
    </svg>
  ),

  Orders: ({ className = 'w-5 h-5' }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
    </svg>
  ),

  Carts: ({ className = 'w-5 h-5' }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l3.6-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),

  Customers: ({ className = 'w-5 h-5' }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
    </svg>
  ),

  Analytics: ({ className = 'w-5 h-5' }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2V17zm4 0h-2V7h2V17zm4 0h-2v-4h2V17z" />
    </svg>
  ),

  Settings: ({ className = 'w-5 h-5' }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M19.14 12.94c.04-.3.06-.61.06-.94c0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.62l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81c-.04-.25-.25-.43-.5-.43h-3.84c-.25 0-.46.18-.49.43L9.13 5.41C8.54 5.65 8 5.98 7.51 6.37L5.12 5.41c-.22-.08-.47 0-.59.22L2.61 8.95c-.13.21-.08.48.1.62l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.62l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.25.25.43.5.43h3.84c.25 0 .46-.18.49-.43l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.48-.12-.62l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6s3.6 1.62 3.6 3.6s-1.62 3.6-3.6 3.6z" />
    </svg>
  ),

  Messages: ({ className = 'w-5 h-5' }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
    </svg>
  ),

  Reviews: ({ className = 'w-5 h-5' }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  ),

  Help: ({ className = 'w-5 h-5' }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.13-9.4l-.9.92C13.45 11.9 13 12.5 13 14h-2v-.5c0-1.58.45-2.1 1.23-2.98l1.15-1.25c.37-.4.59-.9.59-1.41 0-1.41-1.11-2.52-2.52-2.52S8.09 8.59 8.09 10h-2C6.09 7.35 8.84 5 12 5c3.35 0 6 2.57 6 5.97 0 .98-.29 1.88-.78 2.63z" />
    </svg>
  ),

  Logout: ({ className = 'w-5 h-5' }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
    </svg>
  ),

  ChevronLeft: ({ className = 'w-5 h-5' }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
    </svg>
  ),

  ChevronRight: ({ className = 'w-5 h-5' }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
    </svg>
  ),
};
