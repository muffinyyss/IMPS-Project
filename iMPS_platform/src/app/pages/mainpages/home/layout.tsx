// import React from "react";
// import "@/app/globals.css";
// import { ThemeProvider } from "@material-tailwind/react";
// import { MaterialTailwindControllerProvider } from "@/context";
// import Script from "next/script";
// import { Roboto } from "next/font/google";
// import theme from "@/theme";
// import "react-calendar/dist/Calendar.css";

// const roboto = Roboto({
//   subsets: ["latin"],
//   weight: ["300", "400", "500", "700", "900"],
//   display: "swap",
// });

// export const metadata = {
//   title: "Home",
// };

// export default function RootLayout({
//   children,
// }: {
//   children: React.ReactNode;
// }) {
//   return (
//     <html lang="en">
//       <head>
//         <Script
//           defer
//           data-site="YOUR_DOMAIN_HERE"
//           src="https://api.nepcha.com/js/nepcha-analytics.js"
//         />
//         <link rel="icon" type="image/svg+xml" href="/img/favicon.png" />
//         <title>
//           iMPS
//         </title>
//       </head>
//       <body className={roboto.className}>
//         <ThemeProvider value={theme}>
//           <MaterialTailwindControllerProvider>
//             {/* <InnerContent>{children}</InnerContent> */}
//             {children}
//           </MaterialTailwindControllerProvider>
//         </ThemeProvider>
//       </body>
//     </html>
//   );
// }
// src/app/pages/mainpages/home/layout.tsx
"use client";

import React from "react";
// ❌ หลีกเลี่ยงการ import เยอะจาก @material-tailwind/react ใน layout ถ้าไม่จำเป็น
// ใช้เฉพาะ provider หรือ wrapper ที่ต้องใช้จริง ๆ

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
