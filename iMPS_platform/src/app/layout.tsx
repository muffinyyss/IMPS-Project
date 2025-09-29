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
import "@fortawesome/fontawesome-free/css/all.min.css";
import "react-calendar/dist/Calendar.css";
import "./globals.css";

<link
  rel="stylesheet"
  href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
/>

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
          {/* <MaterialTailwindControllerProvider>
            <div
              className="
              tw-min-h-screen
              tw-transition-[padding] tw-duration-300
              xl:tw-pl-[var(--sidenav-w,18rem)]
            "
            >
              <InnerContent>{children}</InnerContent>
            </div>
          </MaterialTailwindControllerProvider> */}

        </ThemeProvider>
      </body>
    </html>
  );
}


// "use client";

// import React from "react";
// import Script from "next/script";
// import { Roboto, Prompt } from "next/font/google";
// import ThemeProvider from "@/components/ThemeProvider";
// import theme from "@/theme";
// import { MaterialTailwindControllerProvider } from "@/context";
// import InnerContent from "./content";
// import "@fortawesome/fontawesome-free/css/all.min.css";
// import "react-calendar/dist/Calendar.css";
// import "./globals.css";

// const roboto = Roboto({
//   subsets: ["latin"],
//   weight: ["300", "400", "500", "700", "900"],
//   display: "swap",
// });

// const prompt = Prompt({
//   subsets: ["latin", "thai"],
//   weight: ["300", "400", "500", "600", "700"],
//   variable: "--font-prompt",
// });

// export default function RootLayout({ children }: { children: React.ReactNode }) {
//   return (
//     <html lang="th" className={prompt.variable}>
//       <head>
//         <Script
//           defer
//           data-site="YOUR_DOMAIN_HERE"
//           src="https://api.nepcha.com/js/nepcha-analytics.js"
//         />
//         <link rel="icon" type="image/svg+xml" href="/img/favicon.png" />
//         <title>iMPS</title>
//       </head>

//       <body className={roboto.className}>
//         <ThemeProvider value={theme}>
//           <MaterialTailwindControllerProvider>
//             {/* Content wrapper: กินพื้นที่ที่เหลือจาก sidenav แบบ responsive */}
//             <div
//               className="
//                 tw-min-h-screen
//                 tw-transition-[left,width] tw-duration-300 tw-ease-in-out
//                 tw-w-full

//                 xl:tw-relative
//                 xl:tw-left-[var(--sidenav-w,0rem)]
//                 xl:tw-w-[calc(100%_-_var(--sidenav-w,0rem))]
//               "
//             >
//               {/* ถ้าไม่อยากมีรอยห่างระหว่าง sidenav กับเนื้อหา ให้ตั้ง padding เป็น 0 */}
//               <main className="tw-w-full tw-px-0">
//                 <InnerContent>{children}</InnerContent>
//               </main>
//             </div>
//           </MaterialTailwindControllerProvider>
//         </ThemeProvider>


//       </body>
//     </html>
//   );
// }
