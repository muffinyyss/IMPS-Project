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
  // เดิมมี key "theme" ซ้ำสองอัน อันล่าง ({ extend: {} }) ทับอันบนทิ้ง
  // ทำให้ build จาก repo ได้ฟอนต์ default ของ Material Tailwind (Roboto)
  // ไม่ตรงกับเว็บจริงที่ใช้ Kanit — รวมเป็นอันเดียวและชี้ไป --font-kanit
  // (ประกาศไว้ที่ src/app/layout.tsx) ตัว Prompt ถูกถอดออกแล้ว: ไม่เคยถูกใช้จริง
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-kanit)", "Kanit", "sans-serif"],
      },
    },
  },
  plugins: [],
  prefix: "tw-",
});
