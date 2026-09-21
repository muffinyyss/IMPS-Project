"use client";

import React from "react";
import ThemeProvider from "@/components/ThemeProvider";
import theme from "@/theme";
import { MaterialTailwindControllerProvider } from "@/context";
import InnerContent from "./content";
import { Kanit } from "next/font/google";
import "@fortawesome/fontawesome-free/css/fontawesome.min.css";
import "@fortawesome/fontawesome-free/css/solid.min.css";
import "@fortawesome/fontawesome-free/css/regular.min.css";
import "@fortawesome/fontawesome-free/css/brands.min.css";
import "react-calendar/dist/Calendar.css";
import "./globals.css";

// ฟอนต์เดียวที่ใช้ทุกหน้า — Jakarta / JetBrains Mono ถูกโหลดเฉพาะหน้า AI
// (ดู src/app/dashboard/ai/layout.tsx) เพื่อไม่ให้หน้าอื่นโหลดไฟล์ฟอนต์ที่ไม่ได้ใช้
const kanit = Kanit({
  subsets: ["thai", "latin"],
  weight: ["400", "600", "700"],
  variable: "--font-kanit",
  display: "swap",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={kanit.variable}>
      <head>
        <link rel="icon" type="image/svg+xml" href="/img/favicon.png" />
        <title>iMPS</title>
      </head>
      <body className={kanit.className}>
        <ThemeProvider value={theme}>
          <MaterialTailwindControllerProvider>
            <InnerContent>{children}</InnerContent>
          </MaterialTailwindControllerProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
