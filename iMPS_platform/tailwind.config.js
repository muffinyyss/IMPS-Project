/** @type {import('tailwindcss').Config} */

const withMT = require("@material-tailwind/react/utils/withMT");

module.exports = withMT({
  content: [
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/data/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/theme/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/widgets/**/*.{js,ts,jsx,tsx,mdx}",
    "./backend/pdf/templates/**/*.html", // ให้ Tailwind scan เทมเพลตที่ใช้จริง
    "./src/**/*.{ts,tsx}",   
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "var(--font-kanit)",
          "Kanit",
          "var(--font-jakarta)",
          "Plus Jakarta Sans",
          "sans-serif",
        ],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
  prefix: "tw-",
});
