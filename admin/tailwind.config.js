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
        text: {
          "on-dark": "var(--text-on-dark)",
          "on-dark-muted": "var(--text-on-dark-muted)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "sm-custom": "var(--radius-sm)",
        "md-custom": "var(--radius-md)",
        "lg-custom": "var(--radius-lg)",
        "xl-custom": "var(--radius-xl)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        heading: ["var(--kcx-font-heading)"],
      },
      boxShadow: {
        "sm-custom": "var(--shadow-sm)",
        "md-custom": "var(--shadow-md)",
        "lg-custom": "var(--shadow-lg)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
}

