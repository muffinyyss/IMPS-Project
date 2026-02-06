"use client";

import React, { useState, useEffect } from "react";

// @material-tailwind/react
import { Typography } from "@material-tailwind/react";
import { apiFetch, getAccessToken } from "@/utils/api";

export default function Landing() {
  const [users, setUsers] = useState<string[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

  // เช็คสถานะล็อกอินจาก localStorage
  useEffect(() => {
    setIsLoggedIn(!!getAccessToken());
  }, []);

  // ถ้าล็อกอินแล้ว ค่อย fetch รายชื่อผู้ใช้
  useEffect(() => {
    if (!isLoggedIn) {
      setUsers([]);
      return;
    }

    (async () => {
      try {
        // apiFetch จัดการให้หมด:
        // ✅ ใส่ Authorization header
        // ✅ ใส่ base URL
        // ✅ refresh token อัตโนมัติ
        // ✅ เด้ง login ถ้า session หมด
        const res = await apiFetch("/");
        const data = await res.json();

        const names = Array.isArray(data)
          ? data.map((u: any) => u.username ?? String(u))
          : [];

        setUsers(names);
      } catch {
        // ถ้า UNAUTHENTICATED → apiFetch เด้ง login ให้แล้ว
        // ถ้า network error → apiFetch แสดง toast ให้แล้ว
        setUsers([]);
      }
    })();
  }, [isLoggedIn]);

  return (
    <div className="tw-min-h-screen tw-bg-white">
      {/* HERO */}
      <section className="tw-mx-auto tw-max-w-7xl tw-grid tw-grid-cols-1 md:tw-grid-cols-2 tw-gap-10 tw-items-center tw-px-4 tw-pt-20 md:tw-pt-28 tw-mt-32 md:tw-mt-5">
        {/* Left text */}
        <div className="tw-order-2 md:tw-order-1">
          <Typography
            variant="h1"
            className="tw-font-extrabold tw-tracking-tight tw-text-4xl sm:tw-text-5xl lg:tw-text-6xl"
          >
            Ai Maintenance
            <br />
            as a service Platform
          </Typography>

          <Typography className="tw-mt-6 tw-max-w-xl tw-text-gray-600 tw-text-base sm:tw-text-lg">
            Journey to the edge of wonder and witness the Aurora Borealis,
            where nature&apos;s most dazzling light show awaits to captivate
            your senses and ignite&nbsp;your imagination.
          </Typography>
        </div>

        {/* Right image */}
        <div className="tw-order-1 md:tw-order-2 tw-flex tw-justify-center">
          <img
            src="/img/charger.jpg"
            alt="Charger"
            className="tw-w-auto tw-max-h-[560px] tw-object-contain"
          />
        </div>
      </section>

      {/* Users list (ถ้าล็อกอินแล้ว) */}
      {isLoggedIn && users.length > 0 && (
        <section className="tw-mx-auto tw-max-w-7xl tw-px-4 tw-mt-20">
          <Typography variant="h4" className="tw-mb-4">
            Users
          </Typography>
          <ul className="tw-list-disc tw-pl-6 tw-text-gray-700">
            {users.map((name, i) => (
              <li key={i}>{name}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="tw-mt-20" />
    </div>
  );
}