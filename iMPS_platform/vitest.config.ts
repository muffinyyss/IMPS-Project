import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  // tsconfig ของ Next ตั้ง jsx: "preserve" (ให้ Next แปลงเอง) — vitest ต้องแปลง JSX เอง
  // ไม่งั้นเทสต์ที่ import คอมโพเนนต์ .tsx จะ parse ไม่ผ่านและทั้งชุดขึ้นแดงตลอด
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
