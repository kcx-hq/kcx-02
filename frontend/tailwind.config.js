/** @type {import('tailwindcss').Config} */
import tailwindcssAnimate from "tailwindcss-animate"

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        border: "hsl(var(--border))",
        brand: {
          primary: "var(--brand-primary)",
          "primary-hover": "var(--brand-primary-hover)",
          "primary-soft": "var(--brand-primary-soft)",
          secondary: "var(--brand-secondary)",
        },
        bg: {
          main: "var(--bg-main)",
          surface: "var(--bg-surface)",
          soft: "var(--bg-soft)",
          "soft-2": "var(--bg-soft-2)",
          dark: "var(--bg-dark)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
          disabled: "var(--text-disabled)",
          "on-dark": "var(--text-on-dark)",
          "on-dark-muted": "var(--text-on-dark-muted)",
        },
        highlight: {
          green: "var(--highlight-green)",
          blue: "var(--highlight-blue)",
          mint: "var(--highlight-mint)",
          yellow: "var(--highlight-yellow)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "sm-custom": "var(--radius-sm)",
        "md-custom": "var(--radius-md)",
        "lg-custom": "var(--radius-lg)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        heading: ["var(--kcx-font-heading)"],
      },
      boxShadow: {
        "sm-custom": "var(--shadow-sm)",
        "md-custom": "var(--shadow-md)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
}
