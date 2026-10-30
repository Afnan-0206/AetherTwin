import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0a0c10",
        foreground: "#f3f4f6",
        graphite: {
          950: "#0b0d13",
          900: "#11141d",
          850: "#161a24",
          800: "#1e2230",
          750: "#252b3c",
          700: "#323a4e",
          600: "#4b556b",
          500: "#64748b",
          400: "#94a3b8",
          300: "#cbd5e1",
          200: "#e2e8f0",
          100: "#f1f5f9"
        },
        panel: {
          bg: "#0d0f16",
          surface: "#121520",
          card: "#171b28",
          border: "#1f2434",
          borderSubtle: "#171b26",
          divider: "#1f2434",
          hover: "#1e2333"
        },
        status: {
          observed: "#3b82f6",     // Precision Blue
          observedBg: "#0f172a",
          calculated: "#10b981",   // Scientific Emerald
          calculatedBg: "#06281e",
          model: "#f59e0b",        // Theoretical Ochre
          modelBg: "#291b05",
          deviation: "#f43f5e",    // Residual Rose
          deviationBg: "#2b0a13"
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '0.875rem' }],
      }
    },
  },
  plugins: [],
};
export default config;
