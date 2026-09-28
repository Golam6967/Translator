/** @type {import('tailwindcss').Config} */

// Reads the "R G B" triplet custom properties in globals.css so that
// Tailwind's color-opacity modifiers (bg-primary/10, border-accent/20, ...)
// resolve to a real rgba() instead of silently being dropped.
function withOpacity(rgbVar) {
  return ({ opacityValue }) =>
    opacityValue === undefined
      ? `rgb(var(${rgbVar}))`
      : `rgb(var(${rgbVar}) / ${opacityValue})`;
}

export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: withOpacity("--primary-rgb"),
        accent: withOpacity("--accent-rgb"),
        background: withOpacity("--background-rgb"),
        surface: withOpacity("--surface-rgb"),
        text: withOpacity("--text-rgb"),
      },
      fontFamily: {
        sans: "var(--font-sans)",
        mono: "var(--font-mono)",
      },
      borderRadius: {
        sm: "calc(var(--radius) - 0.375rem)",
        DEFAULT: "var(--radius)",
        lg: "var(--radius)",
        xl: "calc(var(--radius) + 0.5rem)",
        "2xl": "calc(var(--radius) + 1rem)",
      },
      boxShadow: {
        soft: "0 2px 8px -2px rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.06)",
        card: "0 4px 20px -4px rgb(0 0 0 / 0.10), 0 2px 6px -2px rgb(0 0 0 / 0.06)",
        lift: "0 12px 32px -8px rgb(0 0 0 / 0.18), 0 4px 12px -4px rgb(0 0 0 / 0.10)",
        glow: "0 0 0 1px color-mix(in srgb, var(--accent) 40%, transparent), 0 8px 24px -6px color-mix(in srgb, var(--accent) 35%, transparent)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 },
        },
        "fade-in-up": {
          "0%": { opacity: 0, transform: "translateY(8px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: 0, transform: "scale(0.96)" },
          "100%": { opacity: 1, transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 color-mix(in srgb, var(--accent) 45%, transparent)" },
          "100%": { boxShadow: "0 0 0 10px color-mix(in srgb, var(--accent) 0%, transparent)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out both",
        "fade-in-up": "fade-in-up 0.35s cubic-bezier(0.16,1,0.3,1) both",
        "scale-in": "scale-in 0.2s cubic-bezier(0.16,1,0.3,1) both",
        shimmer: "shimmer 1.8s ease-in-out infinite",
        "pulse-ring": "pulse-ring 1.4s cubic-bezier(0.4,0,0.6,1) infinite",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
  ],
};
