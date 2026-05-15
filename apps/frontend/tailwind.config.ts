import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Neutral palette - slate for professional feel
        background: '#fafafa',
        surface: '#ffffff',
        border: '#e2e8f0',
        'border-strong': '#cbd5e1',
        
        // Text hierarchy
        text: {
          primary: '#0f172a',
          secondary: '#475569',
          tertiary: '#94a3b8',
          disabled: '#cbd5e1',
        },
        
        // Brand accent - professional blue
        primary: {
          DEFAULT: '#0369a1',
          hover: '#075985',
          active: '#0c4a6e',
          light: '#e0f2fe',
        },
        
        // Semantic colors
        success: {
          DEFAULT: '#059669',
          light: '#d1fae5',
          text: '#065f46',
        },
        warning: {
          DEFAULT: '#d97706',
          light: '#fef3c7',
          text: '#92400e',
        },
        error: {
          DEFAULT: '#dc2626',
          light: '#fee2e2',
          text: '#991b1b',
        },
        info: {
          DEFAULT: '#0284c7',
          light: '#e0f2fe',
          text: '#075985',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
        mono: [
          '"SF Mono"',
          'Monaco',
          '"Cascadia Code"',
          '"Roboto Mono"',
          'Consolas',
          'monospace',
        ],
      },
      fontSize: {
        xs: ['0.6875rem', { lineHeight: '1rem' }],      // 11px
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],   // 13px
        base: ['0.875rem', { lineHeight: '1.5rem' }],   // 14px - body default
        lg: ['1rem', { lineHeight: '1.5rem' }],         // 16px
        xl: ['1.125rem', { lineHeight: '1.75rem' }],    // 18px
        '2xl': ['1.25rem', { lineHeight: '1.75rem' }],  // 20px
        '3xl': ['1.5rem', { lineHeight: '2rem' }],      // 24px
      },
      spacing: {
        '0.5': '0.125rem',  // 2px
        '1': '0.25rem',     // 4px
        '1.5': '0.375rem',  // 6px
        '2': '0.5rem',      // 8px
        '2.5': '0.625rem',  // 10px
        '3': '0.75rem',     // 12px
        '4': '1rem',        // 16px
        '5': '1.25rem',     // 20px
        '6': '1.5rem',      // 24px
        '8': '2rem',        // 32px
        '10': '2.5rem',     // 40px
        '12': '3rem',       // 48px
        '16': '4rem',       // 64px
      },
      borderRadius: {
        none: '0',
        sm: '0.1875rem',    // 3px
        DEFAULT: '0.25rem', // 4px
        md: '0.375rem',     // 6px
        lg: '0.5rem',       // 8px
        xl: '0.75rem',      // 12px
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
      },
    },
  },
  plugins: [],
} satisfies Config
