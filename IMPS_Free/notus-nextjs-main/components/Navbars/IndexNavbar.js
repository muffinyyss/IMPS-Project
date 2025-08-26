import React from "react";
import Link from "next/link";
// components

import IndexDropdown from "components/Dropdowns/IndexDropdown.js";

export default function Navbar(props) {
  const [navbarOpen, setNavbarOpen] = React.useState(false);
  const navItems = [
    { href: "/", label: "Home" },
    { href: "/about", label: "About" },
    { href: "/contract", label: "Contract" },
    { href: "/dashboard", label: "Dashboard" },
  ];

  return (
    <>
      <nav className="top-0 fixed z-50 w-full flex flex-wrap items-center justify-between px-2 py-3 navbar-expand-lg bg-white shadow">
        <div className="container px-4 mx-auto flex flex-wrap items-center justify-between">

          <div className="relative w-14 flex-none justify-between lg:w-auto lg:static lg:block lg:justify-start">
            <Link
              href="/"
              className="text-blueGray-700 text-sm font-bold leading-relaxed inline-block mr-4 py-2 whitespace-nowrap uppercase"
            >
              iMPS
            </Link>
            <button
              className="cursor-pointer text-xl leading-none px-3 py-1 border border-solid border-transparent rounded bg-transparent block lg:hidden outline-none focus:outline-none"
              type="button"
              onClick={() => setNavbarOpen(!navbarOpen)}
            >
              <i className="fas fa-bars"></i>
            </button>
          </div>

          <div className="flex flex-1 justify-center">
            <ul className="hidden lg:flex items-center justify-evenly flex-1">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm font-medium text-neutral-700 hover:text-black relative after:absolute after:-bottom-2 after:left-0 after:h-[2px] after:w-0 after:bg-black hover:after:w-full after:transition-all"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div
            className={
              "lg:flex items-center bg-white lg:bg-opacity-0 lg:shadow-none justify-end" +
              (navbarOpen ? " block" : " hidden")
            }
            id="example-navbar-warning"
          >
            <ul className="flex flex-col lg:flex-row list-none">
              <li className="flex items-center">
                <button
                  className="bg-blueGray-700 text-white active:bg-blueGray-600 text-xs font-bold uppercase px-4 py-2 rounded shadow hover:shadow-lg outline-none focus:outline-none lg:mr-1 lg:mb-0 ml-3 mb-3 ease-linear transition-all duration-150"
                  type="button"
                >
                  Login
                </button>
              </li>
            </ul>
          </div>

        </div>
      </nav>
    </>
  );
}

/////////////////////////////////////////////////

// import React from "react";
// import Link from "next/link";

// export default function Navbar() {
//   const [navbarOpen, setNavbarOpen] = React.useState(false);
//   const [profileOpen, setProfileOpen] = React.useState(false);
//   const profileRef = React.useRef(null);

//   // ปิดดรอปดาวน์โปรไฟล์เมื่อคลิกนอก
//   React.useEffect(() => {
//     function onClickOutside(e) {
//       if (profileRef.current && !profileRef.current.contains(e.target)) {
//         setProfileOpen(false);
//       }
//     }
//     document.addEventListener("click", onClickOutside);
//     return () => document.removeEventListener("click", onClickOutside);
//   }, []);

//   const navItems = [
//     { href: "/", label: "Home" },
//     { href: "/about", label: "About" },
//     { href: "/contract", label: "Contract" },
//     { href: "/dashboard", label: "Dashboard" },
//   ];

//   return (
//     <>
//       <nav className="fixed top-0 z-50 w-full bg-white/90 backdrop-blur border-b border-neutral-200">
//         <div className="container mx-auto flex items-center justify-between px-4 py-3">
//           {/* Left: Logo */}
//           <div className="flex items-center">
//             <Link
//               href="/"
//               className="text-neutral-900 font-black tracking-tight text-2xl"
//             >
//               iMPS
//             </Link>
//           </div>

//           {/* Center: desktop menu */}
//           {/* <ul className="hidden lg:flex items-center space-x-12">
//             {navItems.map((item) => (
//               <li key={item.href}>
//                 <Link
//                   href={item.href}
//                   className="text-sm font-medium text-neutral-700 hover:text-black relative after:absolute after:-bottom-2 after:left-0 after:h-[2px] after:w-0 after:bg-black hover:after:w-full after:transition-all"
//                 >
//                   {item.label}
//                 </Link>
//               </li>
//             ))}
//           </ul> */}

//           {/* Center: desktop menu */}
//           <ul className="hidden lg:flex items-center space-x-12">
//             {navItems.map((item) => (
//               <li key={item.href}>
//                 <Link
//                   href={item.href}
//                   className="text-sm font-medium text-neutral-700 hover:text-black relative after:absolute after:-bottom-2 after:left-0 after:h-[2px] after:w-0 after:bg-black hover:after:w-full after:transition-all"
//                 >
//                   {item.label}
//                 </Link>
//               </li>
//             ))}
//           </ul>



//           {/* Right: Profile (desktop) */}
//           {/* <div className="hidden lg:block relative" ref={profileRef}>
//             <button
//               onClick={() => setProfileOpen((v) => !v)}
//               className="flex items-center gap-2 rounded-full px-3 py-1.5 hover:bg-neutral-100 transition"
//             >
//               <span className="text-sm font-medium text-neutral-800">
//                 John Doe
//               </span>
//               <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" className="opacity-70">
//                 <path d="M5.25 7.5l4.5 4.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
//               </svg>
//             </button>

//             {profileOpen && (
//               <div className="absolute right-0 mt-2 w-44 rounded-xl border border-neutral-200 bg-white shadow-lg p-1">
//                 <Link href="/profile" className="block rounded-lg px-3 py-2 text-sm hover:bg-neutral-100">
//                   Profile
//                 </Link>
//                 <Link href="/settings" className="block rounded-lg px-3 py-2 text-sm hover:bg-neutral-100">
//                   Settings
//                 </Link>
//                 <button className="w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-neutral-100">
//                   Sign out
//                 </button>
//               </div>
//             )}
//           </div> */}

//           {/* Right: Login button (desktop) */}
//           <div className="hidden lg:block">
//             <Link
//               href="/login"
//               className="px-5 py-1.5 border border-neutral-400 rounded-full text-sm font-medium text-neutral-800
//                hover:bg-neutral-100 transition"
//             >
//               Login
//             </Link>
//           </div>


//           {/* Hamburger (mobile) */}
//           <button
//             className="lg:hidden inline-flex items-center justify-center rounded-md p-2 hover:bg-neutral-100"
//             onClick={() => setNavbarOpen((v) => !v)}
//             aria-label="Toggle menu"
//           >
//             <svg viewBox="0 0 24 24" className="h-6 w-6">
//               {navbarOpen ? (
//                 <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
//               ) : (
//                 <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
//               )}
//             </svg>
//           </button>
//         </div>

//         {/* Mobile panel */}
//         {navbarOpen && (
//           <div className="lg:hidden border-t border-neutral-200">
//             <ul className="flex flex-col gap-1 px-4 py-3">
//               {navItems.map((item) => (
//                 <li key={item.href}>
//                   <Link
//                     href={item.href}
//                     className="block rounded-lg px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-100"
//                     onClick={() => setNavbarOpen(false)}
//                   >
//                     {item.label}
//                   </Link>
//                 </li>
//               ))}
//               <li className="mt-2 border-t border-neutral-200 pt-2">
//                 <span className="block px-3 py-2 text-sm font-medium text-neutral-800">
//                   John Doe
//                 </span>
//                 <div className="flex flex-col">
//                   <Link href="/profile" className="rounded-lg px-3 py-2 text-sm hover:bg-neutral-100" onClick={() => setNavbarOpen(false)}>
//                     Profile
//                   </Link>
//                   <Link href="/settings" className="rounded-lg px-3 py-2 text-sm hover:bg-neutral-100" onClick={() => setNavbarOpen(false)}>
//                     Settings
//                   </Link>
//                   <button className="text-left rounded-lg px-3 py-2 text-sm hover:bg-neutral-100">
//                     Sign out
//                   </button>
//                 </div>
//               </li>
//             </ul>
//           </div>
//         )}
//       </nav>
//     </>
//   );
// }

