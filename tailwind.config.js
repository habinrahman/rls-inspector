/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Consolas',
          'monospace',
        ],
      },
      // Brand accent uses Tailwind's built-in `emerald` palette directly so
      // JIT class generation is rock-solid (no nested DEFAULT key edge cases).
      fontSize: {
        // Tight, restrained scale
        'display': ['28px', { lineHeight: '34px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'h2': ['18px', { lineHeight: '24px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'h3': ['14px', { lineHeight: '20px', fontWeight: '600' }],
        'body': ['14px', { lineHeight: '20px' }],
        'small': ['13px', { lineHeight: '18px' }],
        'micro': ['11px', { lineHeight: '14px', letterSpacing: '0.06em', fontWeight: '600' }],
      },
    },
  },
  plugins: [],
};
