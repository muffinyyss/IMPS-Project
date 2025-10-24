"use client";

import React from "react";

export const allRoutes = [
  {
    name: "admin",
    icon: <i className="fa fa-user" />,
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
    name: "Monitor(CBM)",
    icon: <i className="fa fa-desktop" />,
    path: "/dashboard/cbm",
  },
  {
    name: "MDB/CCB",
    icon: <i className="fa fa-database" />,
    path: "/dashboard/mdb",
  },
  {
    name: "PM report",
    icon: <i className="fa fa-file-alt" />,
    path: "/dashboard/pm-report",
  },
  {
    name: "CM report",
    icon: <i className="far fa-file" />,
    path: "/dashboard/cm-report",
  },
  {
    name: "Test report",
    icon: <i className="fa fa-check-square" />,
    path: "/dashboard/test-report",
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
  // {
  //   name: "PM report",
  //   title: "report",
  //   icon: <i className="fa fa-clipboard-list" />,
  //   pages: [
  //     {
  //       // icon: <i className="fa fa-clipboard-check" />,
  //       name: "Charger",
  //       path: "/dashboard/pm-report",
  //     },
  //     {
  //       // icon: <i className="fa fa-server" />,
  //       name: "MDB",
  //       path: "#",
  //     },
  //     {
  //       // icon: <i className="fa fa-network-wired" />,
  //       name: "CCB",
  //       path: "#",
  //     },
  //     {
  //       // icon: <i className="fa fa-box" />,
  //       name: "CB-BOX",
  //       path: "#",
  //     },
  //     {
  //       // icon: <i className="fa fa-map-marker-alt" />,
  //       name: "Station",
  //       path: "#",
  //     },
  //   ],
  // },
  // {
  //   name: "CM report",
  //   icon: <i className="fa fa-clipboard-list" />,
  //   pages: [
  //     {
  //       // icon: <i className="fa fa-clipboard-check" />,
  //       name: "Charger",
  //       path: "/dashboard/cm-report", 
  //     },
  //     {
  //       // icon: <i className="fa fa-server" />,
  //       name: "MDB",
  //       path: "#",
  //     },
  //     {
  //       // icon: <i className="fa fa-network-wired" />,
  //       name: "CCB",
  //       path: "#",
  //     },
  //     {
  //       // icon: <i className="fa fa-box" />,
  //       name: "CB-BOX",
  //       path: "#",
  //     },
  //     {
  //       // icon: <i className="fa fa-map-marker-alt" />,
  //       name: "Station",
  //       path: "#",
  //     },
  //   ],
  // },
  // {
  //   name: "Test report",
  //   icon: <i className="fa fa-clipboard-list" />,
  //   pages: [
  //     {
  //       name: "DC - Test report",
  //       icon: <i className="fa fa-clipboard-check" />,
  //       path: "#",
  //     },
  //     {
  //       name: "AC - Test report",
  //       icon: <i className="fa fa-server" />,
  //       path: "#",
  //     }
  //   ],
  // },

];

export default allRoutes;
