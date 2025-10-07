"use client";

import React from "react";

export const allRoutes = [
  {
    name: "admin",
    divider: true,
    pages: [
      {
        layout: "dashboard",
        icon: <i className="fa fa-user" />,
        name: "My profile",
        path: "/dashboard/profile/settings",
      },
      // {
      //   layout: "dashboard",
      //   icon: <i className="fa fa-cog" />,
      //   name: "settings",
      //   path: "/pages/account/settings",
      // },
      {
        layout: "auth",
        icon: <i className="fa fa-sign-out" />,
        name: "logout",
        path: "/auth/signin/basic",
      },
    ],
  },
  {
    name: "My Charger",
    icon: <i className="fa fa-bolt" />,
    path: "/dashboard/chargers",
  },
  {
    name: "Device",
    icon: <i className="fa fa-microchip" />,
    path: "/dashboard/device",
  },
  {
    name: "Setting",
    icon: <i className="fa fa-cog" />,
    path: "/dashboard/setting",
  },
  {
    name: "PM report",
    icon: <i className="fa fa-file-alt" />,
    path: "/dashboard/pm-report",
  },
  {
    name: "Test report",
    icon: <i className="fa fa-check-square" />,
    path: "/dashboard/test-report",
  },
  {
    name: "Monitor(CBM)",
    icon: <i className="fa fa-desktop" />,
    path: "#",
  },
  {
    name: "MDB/CCB",
    icon: <i className="fa fa-database" />,
    path: "/dashboard/mdb",
  },
  {
    name: "Ai Module",
    icon: <i className="fa fa-robot" />,
    path: "/dashboard/ai",
  },
  {
    name: "Users",
    icon: <i className="fa fa-users" />,
    path: "/dashboard/users",
  },
  {
    name: "Stations",
    icon: <i className="fa fa-charging-station" />,
    path: "/dashboard/stations",
  },
];

export default allRoutes;
