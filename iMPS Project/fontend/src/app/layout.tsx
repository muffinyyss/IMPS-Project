"use client";
import "./globals.css";

import { usePathname } from "next/navigation";
import { Geist, Geist_Mono } from "next/font/google";
import Login from "@/app/authentication/login";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDashboard = pathname.startsWith("/dashboard"); // ตรวจสอบว่าอยู่ใน dashboard หรือไม่

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* <div className="min-h-screen flex flex-col"> */}
          {/* แสดง Sidebar ถ้าเป็นหน้า Dashboard, หรือแสดง Navbar ถ้าไม่ใช่ */}
          {/* {isDashboard ? <Sidebar /> : <Navbar />} */}

          {/* <main className={`relative flex-1 ${isDashboard ? "ml-64 p-4" : ""}`}>
            {children}
          </main> */}

          {/* <Footer /> */}
        {/* </div> */}
            <Login/>
        
      </body>
    </html>
  );
}
