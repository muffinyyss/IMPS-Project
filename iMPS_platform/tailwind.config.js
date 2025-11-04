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
        sans: ["var(--font-prompt)", "Prompt", "sans-serif"],
      },
    },
  },
  plugins: [],
  prefix: "tw-",
  theme: { extend: {} },
});
