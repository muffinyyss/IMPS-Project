"use client";
import React,{useEffect,useState} from "react";
// @material-tailwind/react
import { Avatar, Typography } from "@material-tailwind/react";

// @heroicons/react
import {
  Squares2X2Icon,
  ShoppingBagIcon,
  ClipboardDocumentIcon,
  PhotoIcon,
  ClipboardIcon,
  RectangleGroupIcon,
  CubeTransparentIcon,
} from "@heroicons/react/24/solid";



const icon = {
  className: "tw-w-5 tw-h-5 tw-text-inherit",
};

const text = {
  color: "inherit",
  className: "tw-w-5 tw-grid place-items-center !tw-font-medium",
};



export const routes = [
  {
    // layout: "dashboard",
    name: "John Doe",
    divider: true,
    // icon: (
    //   <Avatar
    //     size="sm"
    //     // src="https://demos.creative-tim.com/nextjs-material-dashboard-pro//_next/static/media/team-3.a3eccb16.jpg"
    //   />
    // ),
    pages: [
      {
        layout: "dashboard",
        icon: <Typography {...text}>M</Typography>,
        name: "My profile",
        path: "/pages/profile/profile-overview",
      },
      {
        layout: "dashboard",
        icon: <Typography {...text}>S</Typography>,
        name: "settings",
        path: "/pages/account/settings",
      },
      {
        layout: "auth",
        icon: <Typography {...text}>L</Typography>,
        name: "logout",
        path: "/auth/signin/basic",
      },
    ],
  },
  {
    name: "Charger",
    icon: <RectangleGroupIcon {...icon} />,
    path: "/dashboard/chargers",
  },
  {
    name: "Device",
    icon: <RectangleGroupIcon {...icon} />,
    path: "#",
  },
  {
    name: "Setting",
    icon: <RectangleGroupIcon {...icon} />,
    path: "/dashboard/setting",
  },
  {
    name: "PM report",
    icon: <RectangleGroupIcon {...icon} />,
    path: "/dashboard/pm-report",
  },
  {
    name: "Test report",
    icon: <RectangleGroupIcon {...icon} />,
    path: "/dashboard/test-report",
  },
  {
    name: "Monitor(CBM)",
    icon: <RectangleGroupIcon {...icon} />,
    path: "#",
  },
  {
    name: "MDB/CCB",
    icon: <RectangleGroupIcon {...icon} />,
    path: "/dashboard/mdb",
  },
  {
    name: "Ai Module",
    icon: <RectangleGroupIcon {...icon} />,
    path: "#",
  },
  {
    name: "Users",
    icon: <RectangleGroupIcon {...icon} />,
    path: "/dashboard/users",
  },
];

export default routes;
