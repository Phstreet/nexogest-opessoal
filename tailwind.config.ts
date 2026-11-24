import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        nexo: {
          background: "var(--nexo-background)",
          sidebar: "var(--nexo-sidebar)",
          surface: "var(--nexo-surface)",
          elevated: "var(--nexo-surface-elevated)",
          border: "var(--nexo-border)",
          text: "var(--nexo-text-primary)",
          muted: "var(--nexo-text-secondary)",
          accent: "var(--nexo-accent-color)",
          success: "var(--nexo-success)",
          warning: "var(--nexo-warning)",
          danger: "var(--nexo-danger)",
        },
      },
      borderRadius: {
        nexo: "var(--nexo-radius)",
        "nexo-card": "var(--nexo-radius-card)",
      },
      boxShadow: {
        nexo: "var(--nexo-shadow-card)",
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
};
export default config;
