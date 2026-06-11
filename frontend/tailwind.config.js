/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['attribute', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: 'var(--cyber-bg-color, #07050F)',
          card: 'rgba(15, 12, 30, 0.45)',
          border: 'rgba(255, 255, 255, 0.08)',
          purple: '#8A2BE2',
          cyan: '#00FFFF',
          neonPurple: '#BD00FF',
          neonCyan: '#00F0FF',
          text: 'var(--cyber-text, #F8F7FF)'
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-cyan': '0 0 15px rgba(0, 255, 255, 0.25)',
        'glow-purple': '0 0 15px rgba(138, 43, 226, 0.25)',
        'glow-neon': '0 0 25px rgba(189, 0, 255, 0.35)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'orb-glow': 'orbGlow 4s ease-in-out infinite alternate',
        'float': 'float 6s ease-in-out infinite',
        'float-slow': 'floatSlow 0.4s ease-out both',
        'equalizer': 'equalizer 1.2s ease-in-out infinite',
      },
      keyframes: {
        orbGlow: {
          '0%': { transform: 'scale(1)', filter: 'drop-shadow(0 0 20px rgba(0, 255, 255, 0.2))' },
          '50%': { transform: 'scale(1.05)', filter: 'drop-shadow(0 0 40px rgba(189, 0, 255, 0.4))' },
          '100%': { transform: 'scale(0.98)', filter: 'drop-shadow(0 0 25px rgba(0, 255, 255, 0.25))' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        floatSlow: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        equalizer: {
          '0%, 100%': { height: '10%' },
          '50%': { height: '100%' },
        }
      }
    },
  },
  plugins: [],
}
