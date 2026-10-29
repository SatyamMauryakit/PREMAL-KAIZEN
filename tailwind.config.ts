import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './apps/storefront/app/**/*.{js,ts,jsx,tsx}',
    './apps/storefront/components/**/*.{js,ts,jsx,tsx}',
    './apps/admin/app/**/*.{js,ts,jsx,tsx}',
    './apps/admin/components/**/*.{js,ts,jsx,tsx}',
    './packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // PREMAL KAIZEN Color Palette
        // Primary: Black (depth, premium feel)
        black: '#000000',
        'neutral-950': '#0A0A0A',
        'neutral-900': '#1A1A1A',
        'neutral-800': '#2D2D2D',

        // Secondary: Cream/Off-white (background, cards)
        cream: '#F5F1ED',
        'cream-light': '#FAFAF7',

        // Accent: Beige/Tan (prices, labels, secondary elements)
        beige: '#D4C5B9',
        'beige-light': '#E8DDD4',

        // Neutral grays
        'gray-dark': '#333333',
        'gray-medium': '#666666',
        'gray-light': '#999999',

        // Status colors (minimal, must maintain contrast)
        success: '#2D5016',
        error: '#8B0000',
        warning: '#7C4D00',
        info: '#003366',
      },
      typography: {
        DEFAULT: {
          css: {
            color: '#000000',
            a: {
              color: '#000000',
              textDecoration: 'underline',
            },
          },
        },
      },
      fontFamily: {
        // Headlines: Modern sans-serif (e.g., Inter, DM Sans)
        display: ['system-ui', '-apple-system', 'sans-serif'],
        // Body: Clean sans-serif for readability
        body: ['system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        // Typography scale for PREMAL KAIZEN
        xs: '12px',
        sm: '14px',
        base: '16px',
        lg: '18px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '32px',
        '4xl': '40px',
        '5xl': '48px',
      },
      lineHeight: {
        tight: '1.2',
        snug: '1.4',
        normal: '1.6',
        relaxed: '1.8',
      },
      spacing: {
        // Spacing scale: 4px base unit
        0: '0',
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        5: '20px',
        6: '24px',
        8: '32px',
        10: '40px',
        12: '48px',
        16: '64px',
        20: '80px',
        24: '96px',
      },
      borderRadius: {
        none: '0',
        sm: '2px',
        base: '4px',
        md: '6px',
        lg: '8px',
        xl: '12px',
        full: '9999px',
      },
      borderWidth: {
        DEFAULT: '1px',
        0: '0',
        1: '1px',
        2: '2px',
        3: '3px',
      },
      boxShadow: {
        none: 'none',
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        base: '0 2px 4px 0 rgba(0, 0, 0, 0.1)',
        md: '0 4px 8px 0 rgba(0, 0, 0, 0.12)',
        lg: '0 8px 16px 0 rgba(0, 0, 0, 0.15)',
        xl: '0 12px 24px 0 rgba(0, 0, 0, 0.18)',
      },
      transitionDuration: {
        fast: '150ms',
        base: '200ms',
        slow: '300ms',
      },
      screens: {
        xs: '320px',
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px',
      },
    },
  },
  plugins: [],
};

export default config;
