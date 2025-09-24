/* eslint-disable @next/next/no-img-element */
import React from "react";

// react-router-dom
import Link from "next/link";
import { usePathname } from "next/navigation";

// @material-tailwind/react
import {
  Card,
  Typography,
  List,
  ListItem,
  ListItemPrefix,
  Accordion,
  AccordionHeader,
  AccordionBody,
  IconButton,
} from "@material-tailwind/react";

// routes
import routes from "@/routes";

// @heroicons/react
import { ChevronDownIcon, XMarkIcon } from "@heroicons/react/24/outline";

// @hooks
import { useOnClickOutside } from "usehooks-ts";

import { useMaterialTailwindController, setOpenSidenav } from "@/context";

const COLORS = {
  dark: "tw-bg-gray-900 hover:tw-bg-gray-700 focus:tw-bg-gray-900 active:tw-bg-gray-700 hover:tw-bg-opacity-100 focus:tw-bg-opacity-100 active:tw-bg-opacity-100",
  blue: "tw-bg-blue-500 hover:tw-bg-blue-700 focus:tw-bg-blue-700 active:tw-bg-blue-700 hover:tw-bg-opacity-100 focus:tw-bg-opacity-100 active:tw-bg-opacity-100",
  "blue-gray":
    "tw-bg-blue-gray-900 hover:tw-bg-blue-gray-900 focus:tw-bg-blue-gray-900 active:tw-bg-blue-gray-900 hover:tw-bg-opacity-80 focus:tw-bg-opacity-80 active:tw-bg-opacity-80",
  green:
    "tw-bg-green-500 hover:tw-bg-green-700 focus:tw-bg-green-700 active:tw-bg-green-700 hover:tw-bg-opacity-100 focus:tw-bg-opacity-100 active:tw-bg-opacity-100",
  orange:
    "tw-bg-orange-500 hover:tw-bg-orange-700 focus:tw-bg-orange-700 active:tw-bg-orange-700 hover:tw-bg-opacity-100 focus:tw-bg-opacity-100 active:tw-bg-opacity-100",
  red: "tw-bg-red-500 hover:tw-bg-red-700 focus:tw-bg-red-700 active:tw-bg-red-700 hover:tw-bg-opacity-100 focus:tw-bg-opacity-100 active:tw-bg-opacity-100",
  pink: "tw-bg-pink-500 hover:tw-bg-pink-700 focus:tw-bg-pink-700 active:tw-bg-pink-700 hover:tw-bg-opacity-100 focus:tw-bg-opacity-100 active:tw-bg-opacity-100",
} as any;

type PropTypes = {
  brandImg?: string;
  brandName?: string;
  routes?: {}[];
};

export default function Sidenav({
  // brandImg = "/img/logo-ct.png",
  // brandName = "iMPS",
}: PropTypes) {
  const pathname = usePathname();
  const [controller, dispatch] = useMaterialTailwindController();

  const { sidenavType, sidenavColor, openSidenav }: any = controller;

  const [openCollapse, setOpenCollapse] = React.useState(null);
  const [openSubCollapse, setOpenSubCollapse] = React.useState(null);

  const handleOpenCollapse = (value: any) => {
    setOpenCollapse((cur) => (cur === value ? null : value));
  };

  const handleOpenSubCollapse = (value: any) => {
    setOpenSubCollapse((cur) => (cur === value ? null : value));
  };

  const sidenavRef = React.useRef(null);

  const handleClickOutside = () => {
    setOpenSidenav(dispatch, false);
  };

  useOnClickOutside(sidenavRef, handleClickOutside);

  const collapseItemClasses =
    sidenavType === "dark"
      ? "tw-text-white hover:tw-bg-opacity-25 focus:tw-bg-opacity-100 active:tw-bg-opacity-10 hover:tw-text-white focus:tw-text-white active:tw-text-white"
      : "";
  const collapseHeaderClasses =
    "tw-border-b-0 !tw-p-3 tw-text-inherit hover:tw-text-inherit focus:tw-text-inherit active:tw-text-inherit";
  const activeRouteClasses = `${collapseItemClasses} ${COLORS[sidenavColor]} tw-text-white active:tw-text-white hover:tw-text-white focus:tw-text-white`;

  return (
    <Card
      ref={sidenavRef}
      color={
        sidenavType === "dark"
          ? "gray"
          : sidenavType === "transparent"
            ? "transparent"
            : "white"
      }
      shadow={sidenavType !== "transparent"}
      variant="gradient"
      className={`!tw-fixed tw-top-4 !tw-z-50 tw-h-[calc(100vh-2rem)] tw-w-full tw-max-w-[18rem] tw-p-4 tw-shadow-blue-gray-900/5 ${openSidenav ? "tw-left-4" : "-tw-left-72"
        } ${sidenavType === "transparent" ? "shadow-none" : "shadow-xl"} ${sidenavType === "dark" ? "!tw-text-white" : "tw-text-gray-900"
        }} tw-transition-all tw-duration-300 tw-ease-in-out xl:tw-left-4 tw-overflow-y-scroll`}
    >
      <Link
        href="/"
        className="tw-mb-2 tw-flex tw-items-center tw-gap-1 !tw-p-4"
      >
        {/* <img src={brandImg} className="tw-h-7 tw-w-7" alt="logo" /> */}
        {/* <Typography variant="h2" color="blue-gray" className="tw-w-full tw-text-center">
          {brandName}
        </Typography> */}
        <Typography variant="h2" className="tw-w-full tw-text-center tw-font-bold">
          <span className="tw-text-yellow-500">i</span>
          <span className="tw-text-black">MPS</span>
        </Typography>

      </Link>
      <IconButton
        ripple={false}
        size="sm"
        variant="text"
        className="!tw-absolute tw-top-1 tw-right-1 tw-block xl:tw-hidden"
        onClick={() => setOpenSidenav(dispatch, false)}
      >
        <XMarkIcon className="tw-w-5 tw-h-5" />
      </IconButton>
      <List className="tw-text-inherit">
        {routes.map(
          ({ name, icon, pages, title, divider, external, path }, key) =>
            pages ? (
              <React.Fragment key={key}>
                {title && (
                  <Typography
                    variant="small"
                    color="inherit"
                    className="tw-ml-2 tw-mt-4 tw-mb-1 tw-text-xs tw-font-bold tw-uppercase"
                  >
                    {title}
                  </Typography>
                )}
                <Accordion
                  open={openCollapse === name}
                  icon={
                    <ChevronDownIcon
                      strokeWidth={2.5}
                      className={`tw-mx-auto tw-h-3 tw-w-3 tw-text-inherit tw-transition-transform ${openCollapse === name ? "tw-rotate-180" : ""
                        }`}
                    />
                  }
                >
                  <ListItem
                    className={`!tw-overflow-hidden !tw-p-0 ${openCollapse === name
                        ? sidenavType === "dark"
                          ? "tw-bg-white/10"
                          : "tw-bg-gray-200"
                        : ""
                      } ${collapseItemClasses}`}
                    selected={openCollapse === name}
                  >
                    <AccordionHeader
                      onClick={() => handleOpenCollapse(name)}
                      className={collapseHeaderClasses}
                    >
                      <ListItemPrefix>{icon}</ListItemPrefix>
                      <Typography
                        color="inherit"
                        className="tw-mr-auto tw-font-normal tw-capitalize"
                      >
                        {name}
                      </Typography>
                    </AccordionHeader>
                  </ListItem>
                  <AccordionBody className="!tw-py-1 tw-text-inherit">
                    <List className="!tw-p-0 tw-text-inherit">
                      {pages.map((page: any, key) =>
                        page.pages ? (
                          <Accordion
                            key={key}
                            open={openSubCollapse === page.name}
                            icon={
                              <ChevronDownIcon
                                strokeWidth={2.5}
                                className={`tw-mx-auto tw-h-3 tw-w-3 tw-text-inherit tw-transition-transform ${openSubCollapse === page.name
                                    ? "tw-rotate-180"
                                    : ""
                                  }`}
                              />
                            }
                          >
                            <ListItem
                              className={`!tw-p-0 ${openSubCollapse === page.name
                                  ? sidenavType === "dark"
                                    ? "tw-bg-white/10"
                                    : "tw-bg-gray-200"
                                  : ""
                                } ${collapseItemClasses}`}
                              selected={openSubCollapse === page.name}
                            >
                              <AccordionHeader
                                onClick={() => handleOpenSubCollapse(page.name)}
                                className={collapseHeaderClasses}
                              >
                                <ListItemPrefix>{page.icon}</ListItemPrefix>
                                <Typography
                                  color="inherit"
                                  className="tw-mr-auto tw-font-normal tw-capitalize"
                                >
                                  {page.name}
                                </Typography>
                              </AccordionHeader>
                            </ListItem>
                            <AccordionBody className="!tw-py-1 tw-text-inherit">
                              <List className="!tw-p-0 tw-ext-inherit">
                                {page.pages.map((subPage: any, key: number) =>
                                  subPage.external ? (
                                    <a
                                      href={subPage.path}
                                      target="_blank"
                                      key={key}
                                    >
                                      <ListItem
                                        key={key}
                                        className="tw-capitalize"
                                      >
                                        <ListItemPrefix>
                                          {subPage.icon}
                                        </ListItemPrefix>
                                        {subPage.name}
                                      </ListItem>
                                    </a>
                                  ) : (
                                    <Link href={`${subPage.path}`} key={key}>
                                      <ListItem
                                        className={`tw-capitalize ${pathname === `${subPage.path}`
                                            ? activeRouteClasses
                                            : collapseItemClasses
                                          }`}
                                      >
                                        <ListItemPrefix>
                                          {subPage.icon}
                                        </ListItemPrefix>
                                        {subPage.name}
                                      </ListItem>
                                    </Link>
                                  )
                                )}
                              </List>
                            </AccordionBody>
                          </Accordion>
                        ) : page.external ? (
                          <a key={key} href={page.path} target="_blank">
                            <ListItem className="tw-capitalize">
                              <ListItemPrefix>{page.icon}</ListItemPrefix>
                              {page.name}
                            </ListItem>
                          </a>
                        ) : (
                          <Link href={page.path} key={key}>
                            <ListItem
                              className={`tw-capitalize ${pathname === `${page.path}`
                                  ? activeRouteClasses
                                  : collapseItemClasses
                                }`}
                            >
                              <ListItemPrefix>{page.icon}</ListItemPrefix>
                              {page.name}
                            </ListItem>
                          </Link>
                        )
                      )}
                    </List>
                  </AccordionBody>
                </Accordion>
                {divider && <hr className="tw-my-2 tw-border-blue-gray-50" />}
              </React.Fragment>
            ) : (
              <List className="!tw-p-0 tw-text-inherit" key={key}>
                {external ? (
                  <a key={key} href={path} target="_blank">
                    <ListItem className="tw-capitalize">
                      <ListItemPrefix>{icon}</ListItemPrefix>
                      {name}
                    </ListItem>
                  </a>
                ) : (
                  <Link href={`${path}`} key={key}>
                    <ListItem
                      className={`tw-capitalize ${pathname === `${path}`
                          ? activeRouteClasses
                          : collapseItemClasses
                        }`}
                    >
                      <ListItemPrefix>{icon}</ListItemPrefix>
                      {name}
                    </ListItem>
                  </Link>
                )}
              </List>
            )
        )}
      </List>
    </Card>
  );
}




// /* eslint-disable @next/next/no-img-element */
// "use client";

// import React from "react";
// import Link from "next/link";
// import { usePathname } from "next/navigation";
// import {
//   Card,
//   Typography,
//   List,
//   ListItem,
//   ListItemPrefix,
//   Accordion,
//   AccordionHeader,
//   AccordionBody,
//   IconButton,
// } from "@material-tailwind/react";

// import routes from "@/routes";
// import { ChevronDownIcon, XMarkIcon } from "@heroicons/react/24/outline";
// import { useOnClickOutside } from "usehooks-ts";
// import { useMaterialTailwindController, setOpenSidenav } from "@/context";

// /* ความสูง/ระยะห่างของรายการแต่ละแถว */
// const ITEM_EXPANDED = "tw-h-11 tw-px-3";                       // ตอนขยาย
// const ITEM_COLLAPSED = "tw-h-11 xl:!tw-px-0 tw-justify-center"; // ตอนพับ

// const COLORS: any = {
//   dark: "tw-bg-gray-900 hover:tw-bg-gray-700 focus:tw-bg-gray-900 active:tw-bg-gray-700 hover:tw-bg-opacity-100 focus:tw-bg-opacity-100 active:tw-bg-opacity-100",
//   blue: "tw-bg-blue-500 hover:tw-bg-blue-700 focus:tw-bg-blue-700 active:tw-bg-blue-700 hover:tw-bg-opacity-100 focus:tw-bg-opacity-100 active:tw-bg-opacity-100",
//   "blue-gray":
//     "tw-bg-blue-gray-900 hover:tw-bg-blue-gray-900 focus:tw-bg-blue-gray-900 active:tw-bg-blue-gray-900 hover:tw-bg-opacity-80 focus:tw-bg-opacity-80 active:tw-bg-opacity-80",
//   green:
//     "tw-bg-green-500 hover:tw-bg-green-700 focus:tw-bg-green-700 active:tw-bg-green-700 hover:tw-bg-opacity-100 focus:tw-bg-opacity-100 active:tw-bg-opacity-100",
//   orange:
//     "tw-bg-orange-500 hover:tw-bg-orange-700 focus:tw-bg-orange-700 active:tw-bg-orange-700 hover:tw-bg-opacity-100 focus:tw-bg-opacity-100 active:tw-bg-opacity-100",
//   red: "tw-bg-red-500 hover:tw-bg-red-700 focus:tw-bg-red-700 active:tw-bg-red-700 hover:tw-bg-opacity-100 focus:tw-bg-opacity-100 active:tw-bg-opacity-100",
//   pink: "tw-bg-pink-500 hover:tw-bg-pink-700 focus:tw-bg-pink-700 active:tw-bg-pink-700 hover:tw-bg-opacity-100 focus:tw-bg-opacity-100 active:tw-bg-opacity-100",
// };

// type PropTypes = {
//   brandImg?: string;
//   brandName?: string;
//   routes?: {}[];
// };

// export default function Sidenav({ }: PropTypes) {
//   const pathname = usePathname();
//   const [controller, dispatch] = useMaterialTailwindController();
//   const { sidenavType, sidenavColor, openSidenav }: any = controller;

//   const [openCollapse, setOpenCollapse] = React.useState<string | null>(null);
//   const [openSubCollapse, setOpenSubCollapse] = React.useState<string | null>(null);

//   const sidenavRef = React.useRef<HTMLDivElement | null>(null);
//   useOnClickOutside(sidenavRef, () => setOpenSidenav(dispatch, false));

//   const handleOpenCollapse = (value: any) =>
//     setOpenCollapse((cur) => (cur === value ? null : value));
//   const handleOpenSubCollapse = (value: any) =>
//     setOpenSubCollapse((cur) => (cur === value ? null : value));

//   const collapseItemClasses =
//     sidenavType === "dark"
//       ? "tw-text-white hover:tw-bg-opacity-25 focus:tw-bg-opacity-100 active:tw-bg-opacity-10 hover:tw-text-white focus:tw-text-white active:tw-text-white"
//       : "";
//   const collapseHeaderClasses =
//     "tw-border-b-0 !tw-p-3 tw-text-inherit hover:tw-text-inherit focus:tw-text-inherit active:tw-text-inherit";
//   const activeRouteClasses = `${collapseItemClasses} ${COLORS[sidenavColor]} tw-text-white active:tw-text-white hover:tw-text-white focus:tw-text-white`;

//   return (
//     <Card
//       ref={sidenavRef}
//       color={
//         sidenavType === "dark"
//           ? "gray"
//           : sidenavType === "transparent"
//             ? "transparent"
//             : "white"
//       }
//       shadow={sidenavType !== "transparent"}
//       variant="gradient"
//       className={`
//     !tw-fixed tw-top-4 !tw-z-50 tw-h-[calc(100vh-2rem)]
//     tw-w-[18rem]                         /* ⬅️ มือถือให้กว้าง 18rem ตายตัว */
//     tw-px-2 tw-pt-2 tw-pb-3 tw-shadow-blue-gray-900/5
//     ${openSidenav ? "tw-left-4" : "-tw-left-72"}   /* 📱 slide in/out */
//     ${sidenavType === "transparent" ? "shadow-none" : "shadow-xl"}
//     ${sidenavType === "dark" ? "!tw-text-white" : "tw-text-gray-900"}
//     tw-transition-all tw-duration-300 tw-ease-in-out
//     xl:tw-left-4
//     ${openSidenav ? "xl:tw-w-64" : "xl:tw-w-14"}   /* ⬅️ เดสก์ท็อป: 256px / 56px */
//     tw-overflow-y-auto
//   `}
//     >
//       {/* --------- Header: โลโก้ + ปุ่มพับ/ขยาย --------- */}
//       <div className="tw-flex tw-items-center tw-gap-2 tw-px-2 tw-pt-2 tw-pb-4">
//         <Link href="/" className="tw-flex tw-items-center tw-gap-2">
//           {/* ชื่อ iMPS (ซ่อนเมื่อพับ) */}
//           <Typography
//             variant="h2"
//             className={`tw-font-bold tw-leading-none ${openSidenav ? "tw-block" : "tw-hidden xl:tw-hidden"
//               }`}
//           >
//             <span className="tw-text-yellow-500">i</span>
//             <span className="tw-text-black">MPS</span>
//           </Typography>

//           {/* โลโก้ตัว i เล็ก (โชว์เมื่อพับ) */}
//           <Typography
//             variant="h4"
//             className={`${openSidenav ? "tw-hidden" : "tw-block"} tw-leading-none`}
//             aria-hidden={openSidenav}
//           >
//             <span className="tw-text-yellow-500">i</span>
//           </Typography>
//         </Link>

//         {/* ปุ่มพับ/ขยาย เฉพาะจอใหญ่ */}
//         <IconButton
//           ripple={false}
//           variant="text"
//           className="tw-ml-auto tw-hidden xl:tw-grid tw-h-9 tw-w-9 tw-rounded-lg tw-place-items-center"
//           onClick={() => setOpenSidenav(dispatch, !openSidenav)}
//           title={openSidenav ? "ย่อเมนู" : "ขยายเมนู"}
//           aria-label={openSidenav ? "Collapse menu" : "Expand menu"}
//         >
//           {openSidenav ? (
//             <i className="fa fa-angles-left tw-text-base" />
//           ) : (
//             <i className="fa fa-angles-right tw-text-base" />
//           )}
//         </IconButton>
//       </div>

//       {/* ปุ่ม X ปิดบนมือถือ */}
//       <IconButton
//         ripple={false}
//         size="sm"
//         variant="text"
//         className="!tw-absolute tw-top-1 tw-right-1 tw-block xl:tw-hidden"
//         onClick={() => setOpenSidenav(dispatch, false)}
//       >
//         <XMarkIcon className="tw-w-5 tw-h-5" />
//       </IconButton>

//       {/* --------- รายการเมนู --------- */}
//       <List className="tw-text-inherit">
//         {routes.map(({ name, icon, pages, title, divider, external, path }, key) =>
//           pages ? (
//             <React.Fragment key={key}>
//               {title && openSidenav && (
//                 <Typography
//                   variant="small"
//                   color="inherit"
//                   className="tw-ml-2 tw-mt-4 tw-mb-1 tw-text-xs tw-font-bold tw-uppercase"
//                 >
//                   {title}
//                 </Typography>
//               )}

//               {/* ✅ เมนูระดับแรก (มีลูก) */}
//               <Accordion
//                 open={openSidenav && openCollapse === name}
//                 icon={
//                   openSidenav ? (
//                     <ChevronDownIcon
//                       strokeWidth={2.5}
//                       className={`tw-mx-auto tw-h-3 tw-w-3 tw-text-inherit tw-transition-transform ${openCollapse === name ? "tw-rotate-180" : ""
//                         }`}
//                     />
//                   ) : null
//                 }
//               >
//                 <ListItem
//                   className={`!tw-overflow-hidden ${openCollapse === name
//                     ? sidenavType === "dark"
//                       ? "tw-bg-white/10"
//                       : "tw-bg-gray-200"
//                     : ""
//                     } ${collapseItemClasses} ${openSidenav ? ITEM_EXPANDED : ITEM_COLLAPSED
//                     }`}
//                   selected={openSidenav && openCollapse === name}
//                 >
//                   <AccordionHeader
//                     onClick={() => openSidenav && handleOpenCollapse(name)}
//                     className={`${collapseHeaderClasses} ${openSidenav ? "" : "tw-justify-center"
//                       }`}
//                   >
//                     <ListItemPrefix>{icon}</ListItemPrefix>
//                     <Typography
//                       color="inherit"
//                       className={`tw-mr-auto tw-font-normal tw-capitalize ${openSidenav ? "tw-inline" : "xl:tw-hidden"
//                         }`}
//                     >
//                       {name}
//                     </Typography>
//                   </AccordionHeader>
//                 </ListItem>

//                 <AccordionBody className="!tw-py-1 tw-text-inherit">
//                   <List className="!tw-p-0 tw-text-inherit">
//                     {pages.map((page: any, key: number) =>
//                       page.pages ? (
//                         /* ✅ เมนูชั้นสอง (ยังมีลูก) */
//                         <Accordion
//                           key={key}
//                           open={openSidenav && openSubCollapse === page.name}
//                           icon={
//                             openSidenav ? (
//                               <ChevronDownIcon
//                                 strokeWidth={2.5}
//                                 className={`tw-mx-auto tw-h-3 tw-w-3 tw-text-inherit tw-transition-transform ${openSubCollapse === page.name
//                                   ? "tw-rotate-180"
//                                   : ""
//                                   }`}
//                               />
//                             ) : null
//                           }
//                         >
//                           <ListItem
//                             className={`${openSubCollapse === page.name
//                               ? sidenavType === "dark"
//                                 ? "tw-bg-white/10"
//                                 : "tw-bg-gray-200"
//                               : ""
//                               } ${collapseItemClasses} ${openSidenav ? ITEM_EXPANDED : ITEM_COLLAPSED
//                               }`}
//                             selected={openSidenav && openSubCollapse === page.name}
//                           >
//                             <AccordionHeader
//                               onClick={() =>
//                                 openSidenav && handleOpenSubCollapse(page.name)
//                               }
//                               className={`${collapseHeaderClasses} ${openSidenav ? "" : "tw-justify-center"
//                                 }`}
//                             >
//                               <ListItemPrefix>{page.icon}</ListItemPrefix>
//                               <Typography
//                                 color="inherit"
//                                 className={`tw-mr-auto tw-font-normal tw-capitalize ${openSidenav ? "tw-inline" : "xl:tw-hidden"
//                                   }`}
//                               >
//                                 {page.name}
//                               </Typography>
//                             </AccordionHeader>
//                           </ListItem>

//                           <AccordionBody className="!tw-py-1 tw-text-inherit">
//                             <List className="!tw-p-0 tw-ext-inherit">
//                               {page.pages.map((subPage: any, subKey: number) =>
//                                 subPage.external ? (
//                                   <a href={subPage.path} target="_blank" key={subKey}>
//                                     <ListItem
//                                       className={`tw-capitalize ${openSidenav ? ITEM_EXPANDED : ITEM_COLLAPSED
//                                         }`}
//                                     >
//                                       <ListItemPrefix>{subPage.icon}</ListItemPrefix>
//                                       <span className={openSidenav ? "" : "xl:tw-hidden"}>
//                                         {subPage.name}
//                                       </span>
//                                     </ListItem>
//                                   </a>
//                                 ) : (
//                                   <Link href={`${subPage.path}`} key={subKey}>
//                                     <ListItem
//                                       className={`tw-capitalize ${pathname === `${subPage.path}`
//                                         ? activeRouteClasses
//                                         : collapseItemClasses
//                                         } ${openSidenav ? ITEM_EXPANDED : ITEM_COLLAPSED}`}
//                                     >
//                                       <ListItemPrefix>{subPage.icon}</ListItemPrefix>
//                                       <span className={openSidenav ? "" : "xl:tw-hidden"}>
//                                         {subPage.name}
//                                       </span>
//                                     </ListItem>
//                                   </Link>
//                                 )
//                               )}
//                             </List>
//                           </AccordionBody>
//                         </Accordion>
//                       ) : page.external ? (
//                         <a key={key} href={page.path} target="_blank">
//                           <ListItem
//                             className={`tw-capitalize ${openSidenav ? ITEM_EXPANDED : ITEM_COLLAPSED
//                               }`}
//                           >
//                             <ListItemPrefix>{page.icon}</ListItemPrefix>
//                             <span className={openSidenav ? "" : "xl:tw-hidden"}>
//                               {page.name}
//                             </span>
//                           </ListItem>
//                         </a>
//                       ) : (
//                         <Link href={page.path} key={key}>
//                           <ListItem
//                             className={`tw-capitalize ${pathname === `${page.path}`
//                               ? activeRouteClasses
//                               : collapseItemClasses
//                               } ${openSidenav ? ITEM_EXPANDED : ITEM_COLLAPSED}`}
//                           >
//                             <ListItemPrefix>{page.icon}</ListItemPrefix>
//                             <span className={openSidenav ? "" : "xl:tw-hidden"}>
//                               {page.name}
//                             </span>
//                           </ListItem>
//                         </Link>
//                       )
//                     )}
//                   </List>
//                 </AccordionBody>
//               </Accordion>

//               {divider && <hr className="tw-my-2 tw-border-blue-gray-50" />}
//             </React.Fragment>
//           ) : (
//             /* ✅ เมนูเดี่ยว (ไม่มีลูก) */
//             <List className="!tw-p-0 tw-text-inherit" key={key}>
//               {external ? (
//                 <a key={key} href={path} target="_blank">
//                   <ListItem
//                     className={`tw-capitalize ${openSidenav ? ITEM_EXPANDED : ITEM_COLLAPSED
//                       }`}
//                   >
//                     <ListItemPrefix>{icon}</ListItemPrefix>
//                     <span className={openSidenav ? "" : "xl:tw-hidden"}>{name}</span>
//                   </ListItem>
//                 </a>
//               ) : (
//                 <Link href={`${path}`} key={key}>
//                   <ListItem
//                     className={`tw-capitalize ${pathname === `${path}` ? activeRouteClasses : collapseItemClasses
//                       } ${openSidenav ? ITEM_EXPANDED : ITEM_COLLAPSED}`}
//                   >
//                     <ListItemPrefix>{icon}</ListItemPrefix>
//                     <span className={openSidenav ? "" : "xl:tw-hidden"}>{name}</span>
//                   </ListItem>
//                 </Link>
//               )}
//             </List>
//           )
//         )}
//       </List>
//     </Card>
//   );
// }
