import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      colors: {
        fleet: {
          ink: '#161816',
          panel: '#ffffff',
          line: '#dfe4e8',
          green: '#0f8f63',
          cyan: '#027f9f',
          amber: '#b7791f',
          red: '#c2413b'
        }
      },
      boxShadow: {
        soft: '0 18px 45px rgba(21, 24, 22, 0.10)'
      }
    }
  },
  plugins: []
} satisfies Config;
