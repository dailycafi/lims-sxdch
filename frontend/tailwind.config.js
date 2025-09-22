/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93bbfd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
      },
      spacing: {
        '1.5': '0.375rem',
        '2.5': '0.625rem',
        '3.5': '0.875rem',
      },
      borderRadius: {
        'lg': '0.5rem',
      },
      // 漂浮和科技感动画
      animation: {
        'float-slow': 'float-slow 6s ease-in-out infinite',
        'metallic-shine': 'metallic-shine 4s ease-in-out infinite',
        'tech-scan': 'tech-scan 2s ease-in-out infinite',
      },
      keyframes: {
        'float-slow': {
          '0%, 100%': { 
            transform: 'translateY(0px) rotate(12deg)',
          },
          '50%': { 
            transform: 'translateY(-20px) rotate(15deg)',
          },
        },
        'metallic-shine': {
          '0%': { 
            transform: 'translateX(-100%) skewX(-6deg)',
            opacity: '0',
          },
          '20%': {
            opacity: '0.8',
          },
          '80%': {
            opacity: '0.8',
          },
          '100%': { 
            transform: 'translateX(200%) skewX(-6deg)',
            opacity: '0',
          },
        },
        'tech-scan': {
          '0%': { 
            transform: 'translateX(-120%) skewX(-12deg)',
            opacity: '0',
          },
          '10%': {
            opacity: '1',
          },
          '90%': {
            opacity: '1',
          },
          '100%': { 
            transform: 'translateX(220%) skewX(-12deg)',
            opacity: '0',
          },
        },
      },
    },
  },
  plugins: [],
  // 添加对特殊类名的支持
  safelist: [
    {
      pattern: /^(bg|text|border)-(zinc|blue|white)-(50|100|200|300|400|500|600|700|800|900|950)$/,
    },
    'animate-float-slow',
    'animate-metallic-shine',
    'animate-tech-scan',
  ],
}
