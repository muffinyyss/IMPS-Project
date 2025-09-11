"use client";

/* eslint-disable @next/next/next-script-for-ga */
import React from "react";
import Script from "next/script";
import { Roboto } from "next/font/google";
import ThemeProvider from "@/components/ThemeProvider";
import theme from "@/theme";
import { MaterialTailwindControllerProvider } from "@/context";
import InnerContent from "./content";
import { Prompt } from "next/font/google";

import "react-calendar/dist/Calendar.css";
import "./globals.css";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700", "900"],
  display: "swap",
});

// โหลดฟอนต์ Prompt
const prompt = Prompt({
  subsets: ["latin", "thai"], // เลือก subset ภาษาไทยด้วย
  weight: ["300", "400", "500", "600", "700"], // เลือกน้ำหนักตามต้องการ
  variable: "--font-prompt", // ตั้งชื่อเป็นตัวแปร CSS
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={`${prompt.variable}`}>
      <head>
        <Script
          defer
          data-site="YOUR_DOMAIN_HERE"
          src="https://api.nepcha.com/js/nepcha-analytics.js"
        />
        <link rel="icon" type="image/svg+xml" href="/img/favicon.png" />
        <title>
          iMPS
        </title>
      </head>
      <body className={roboto.className}>
        <ThemeProvider value={theme}>
          <MaterialTailwindControllerProvider>
            <InnerContent>{children}</InnerContent>
          </MaterialTailwindControllerProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
