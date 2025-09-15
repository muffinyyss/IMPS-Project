"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type NavItem = { label: string; href: string; requireAuth?: boolean };

type User = { username: string; role?: string; company?: string };

const navItems: NavItem[] = [
  { label: "Home", href: "/pages/mainpages/home", requireAuth: false },
  { label: "About", href: "/pages/mainpages/about", requireAuth: true },
  { label: "Contact", href: "/pages/mainpages/contact", requireAuth: true },
  { label: "Dashboard", href: "/dashboard/chargers", requireAuth: true },
];

export default function SiteNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  // โหลดสถานะจาก localStorage + sync เมื่อมีการเปลี่ยนแปลงจากแท็บอื่น
  useEffect(() => {
    const load = () => {
      try {
        const token = localStorage.getItem("accessToken");
        const rawUser = localStorage.getItem("user");
        setUser(token && rawUser ? JSON.parse(rawUser) : null);
      } catch {
        setUser(null);
      }
    };
    load();
    window.addEventListener("storage", load);
    return () => window.removeEventListener("storage", load);
  }, []);

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === "/pages/mainpages/home") return pathname === "/pages/mainpages/home";
    return pathname.startsWith(href);
  };

  const linkClass = (href: string) =>
    `tw-font-medium hover:tw-text-black ${isActive(href) ? "tw-text-black tw-font-semibold" : "tw-text-gray-700"
    }`;

  const handleLogout = async () => {
    // ถ้ามี endpoint revoke token ค่อยเรียกที่นี่
    // await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/logout`, { method: "POST", credentials: "include" })

    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    setUser(null);
    router.push("/auth/signin/basic");
  };

  return (
    <nav className="tw-sticky tw-top-0 tw-z-40 tw-bg-white">
      <div className="tw-mx-auto tw-max-w-7xl tw-h-20 tw-grid tw-grid-cols-[1fr_auto_1fr] tw-items-center tw-px-4">
        {/* Brand */}
        <Link href="/" className="tw-flex tw-items-center tw-space-x-2" aria-label="IMPS Home">
          <span className="tw-text-4xl tw-font-extrabold">
            <span className="tw-text-yellow-500">i</span>
            <span className="tw-text-gray-900">MPS</span>
          </span>
        </Link>

        {/* Center nav */}
        <ul className="tw-flex tw-items-center tw-space-x-10">
          {/* {navItems.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className={linkClass(item.href)} prefetch={false}>
                {item.label}
              </Link>
            </li>
          ))} */}

          {navItems.map((item) => (
            <li key={item.href}>
              {(!item.requireAuth || user) ? (
                <Link href={item.href} className={linkClass(item.href)} prefetch={false}>
                  {item.label}
                </Link>
              ) : (
                <span
                  role="link"
                  aria-disabled="true"
                  className="tw-text-gray-400 tw-cursor-not-allowed tw-select-none tw-pointer-events-none"
                  title="Please login first"
                >
                  {item.label}
                </span>
              )}
            </li>
          ))}
        </ul>

        {/* Right actions (แสดงปุ่ม Login เฉย ๆ ไม่ผูกกับสถานะผู้ใช้) */}
        {/* <div className="tw-flex tw-justify-end">
          <Link
            href="/auth/signin/basic"
            className="tw-rounded-full tw-bg-white tw-border tw-border-gray-300 tw-px-5 tw-h-10 
                       tw-shadow-sm tw-inline-flex tw-items-center tw-justify-center tw-text-sm
                       hover:tw-bg-black hover:tw-text-white hover:tw-border-black"
          >
            Login
          </Link>
        </div> */}
        <div className="tw-flex tw-justify-end tw-items-center tw-space-x-3">
          {user ? (
            <>
              <span className="tw-text-sm tw-text-gray-700">
                Hi, <span className="tw-font-semibold">{user.username}</span>
              </span>
              <button
                onClick={handleLogout}
                className="tw-rounded-full tw-bg-white tw-border tw-border-gray-300 tw-px-5 tw-h-10 
                           tw-shadow-sm tw-inline-flex tw-items-center tw-justify-center tw-text-sm
                           hover:tw-bg-black hover:tw-text-white hover:tw-border-black"
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              href="/auth/signin/basic"
              className="tw-rounded-full tw-bg-white tw-border tw-border-gray-300 tw-px-5 tw-h-10 
                         tw-shadow-sm tw-inline-flex tw-items-center tw-justify-center tw-text-sm
                         hover:tw-bg-black hover:tw-text-white hover:tw-border-black"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}


















// "use client";

// import Link from "next/link";
// import { usePathname, useRouter } from "next/navigation";
// import React, { useEffect, useRef, useState } from "react";

// type StoredUser = {
//   username?: string;
// };

// const navItems = [
//   { label: "Home", href: "/pages/mainpages/home" },
//   { label: "About", href: "/pages/mainpages/about" },
//   { label: "Contact", href: "/pages/mainpages/contact" },
//   { label: "Dashboard", href: "/dashboard/analytics" },
// ];

// export default function SiteNavbar() {
//   const pathname = usePathname();
//   const router = useRouter();

//   const [user, setUser] = useState<StoredUser | null>(null);
//   const [mounted, setMounted] = useState(false);
//   const [openMenu, setOpenMenu] = useState(false);

//   const menuRef = useRef<HTMLDivElement | null>(null);
//   const btnRef = useRef<HTMLButtonElement | null>(null);

//   useEffect(() => {
//     try {
//       const raw = localStorage.getItem("user");
//       // console.log("DEBUG raw localStorage[user]:", raw);
//       if (raw) setUser(JSON.parse(raw));
//     } catch { }
//     setMounted(true);

//     const onStorage = (e: StorageEvent) => {
//       if (e.key === "user") {
//         try {
//           setUser(e.newValue ? JSON.parse(e.newValue) : null);
//         } catch {
//           setUser(null);
//         }
//       }
//     };
//     window.addEventListener("storage", onStorage);
//     return () => window.removeEventListener("storage", onStorage);
//   }, []);

//   useEffect(() => {
//     const onClickOutside = (e: MouseEvent) => {
//       if (
//         openMenu &&
//         menuRef.current &&
//         !menuRef.current.contains(e.target as Node) &&
//         btnRef.current &&
//         !btnRef.current.contains(e.target as Node)
//       ) {
//         setOpenMenu(false);
//       }
//     };
//     window.addEventListener("mousedown", onClickOutside);
//     return () => window.removeEventListener("mousedown", onClickOutside);
//   }, [openMenu]);

//   const handleLogout = () => {
//     localStorage.removeItem("user");
//     // console.log("After removeItem, localStorage[user]:", localStorage.getItem("user")); // ควรเป็น null
//     setUser(null);
//     setOpenMenu(false);
//     router.push("/auth/signin/basic");
//   };


//   const isActive = (href: string) => {
//     if (!pathname) return false;
//     if (href === "/pages/mainpages/home") return pathname === "/pages/mainpages/home";
//     return pathname.startsWith(href);
//   };

//   const linkClass = (href: string) =>
//     `tw-font-medium hover:tw-text-black ${isActive(href) ? "tw-text-black tw-font-semibold" : "tw-text-gray-700"
//     }`;

//   // จัดการคลิกเมนู Dashboard: ถ้ายังไม่ login ให้ไปหน้า signin
//   const handleNavClick = (
//     e: React.MouseEvent<HTMLAnchorElement, MouseEvent>,
//     label: string
//   ) => {
//     if (label === "Dashboard" && !user?.username) {
//       e.preventDefault();
//       // router.push("/auth/signin/basic");
//       router.push("/dashboard/analytics");

//     }
//   };

//   return (
//     <nav className="tw-sticky tw-top-0 tw-z-40 tw-bg-white">
//       <div className="tw-mx-auto tw-max-w-7xl tw-h-20 tw-grid tw-grid-cols-[1fr_auto_1fr] tw-items-center tw-px-4">
//         {/* Brand */}
//         <Link href="/" className="tw-flex tw-items-center tw-space-x-2" aria-label="IMPS Home">
//           <span className="tw-text-4xl tw-font-extrabold">
//             <span className="tw-text-yellow-500">i</span>
//             <span className="tw-text-gray-900">MPS</span>
//           </span>
//         </Link>

//         {/* Center nav */}
//         <ul className="tw-flex tw-items-center tw-space-x-10">
//           {navItems.map((item) => {
//             // ถ้าเป็น Dashboard ให้กำหนด href ตามสถานะ เพื่อให้ hover/preview ถูกต้องด้วย
//             const targetHref =
//               item.label === "Dashboard" && !user?.username
//                 ? "/auth/signin/basic"
//                 : item.href;

//             return (
//               <li key={item.href}>
//                 <Link
//                   href={targetHref}
//                   className={linkClass(item.href)}
//                   onClick={(e) => handleNavClick(e, item.label)}
//                   prefetch={false}
//                 >
//                   {item.label}
//                 </Link>
//               </li>
//             );
//           })}
//         </ul>

//         {/* Right actions */}
//         <div className="tw-flex tw-justify-end tw-relative">
//           {!mounted ? null : user?.username ? (
//             <>
//               <button
//                 ref={btnRef}
//                 onClick={() => setOpenMenu((v) => !v)}
//                 className="tw-rounded-full tw-px-4 tw-h-10
//                            tw-inline-flex tw-items-center tw-justify-center tw-text-sm tw-text-gray-900
//                            hover:tw-bg-gray-200"
//                 aria-haspopup="menu"
//                 aria-expanded={openMenu}
//               >
//                 <span className="tw-mr-2 tw-line-clamp-1">{user.username}</span>
//                 <svg
//                   xmlns="http://www.w3.org/2000/svg"
//                   className={`tw-h-4 tw-w-4 tw-transition-transform ${openMenu ? "tw-rotate-180" : ""}`}
//                   fill="none"
//                   viewBox="0 0 24 24"
//                   stroke="currentColor"
//                 >
//                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
//                 </svg>
//               </button>

//               {/* Dropdown */}
//               {openMenu && (
//                 <div
//                   ref={menuRef}
//                   role="menu"
//                   className="tw-absolute tw-right-0 tw-top-12 tw-w-56 tw-bg-white tw-border tw-border-gray-200
//                              tw-rounded-lg tw-shadow-lg tw-py-2"
//                 >
//                   <div className="tw-px-4 tw-py-2 tw-text-xs tw-text-gray-500">Signed in as</div>
//                   <div className="tw-px-4 tw-pb-2 tw-text-sm tw-font-medium tw-text-gray-900">
//                     {user.username}
//                   </div>
//                   <hr className="tw-my-2" />
//                   <Link
//                     href="/dashboard/analytics"
//                     className="tw-block tw-w-full tw-text-left tw-px-4 tw-py-2 tw-text-sm hover:tw-bg-gray-100"
//                     role="menuitem"
//                     onClick={() => setOpenMenu(false)}
//                   >
//                     Dashboard
//                   </Link>
//                   <button
//                     onClick={handleLogout}
//                     className="tw-block tw-w-full tw-text-left tw-px-4 tw-py-2 tw-text-sm tw-text-red-600 hover:tw-bg-gray-100"
//                     role="menuitem"
//                   >
//                     Logout
//                   </button>
//                 </div>
//               )}
//             </>
//           ) : (
//             <Link
//               href="/auth/signin/basic"
//               className="tw-rounded-full tw-bg-white tw-border tw-border-gray-300 tw-px-5 tw-h-10
//                          tw-shadow-sm tw-inline-flex tw-items-center tw-justify-center tw-text-sm
//                          hover:tw-bg-black hover:tw-text-white hover:tw-border-black"
//             >
//               Login
//             </Link>
//           )}
//         </div>
//       </div>
//     </nav>
//   );
// }


