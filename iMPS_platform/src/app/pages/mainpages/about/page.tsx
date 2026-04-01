"use client";

import React, { useState, useEffect } from "react";
import { apiFetch, getAccessToken } from "@/utils/api";

type AboutContent = {
  title: string;
  description: string;
};

export default function About() {
  const [content, setContent] = useState<AboutContent | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!getAccessToken());
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;

    (async () => {
      try {
        const res = await apiFetch("/about");  // ← เปลี่ยน endpoint ให้ตรง API จริง
        const data = await res.json();
        setContent(data);
      } catch {
        // ถ้า 401 → apiFetch เด้ง login ให้แล้ว
        // ถ้า network error → apiFetch แสดง toast ให้แล้ว
      }
    })();
  }, [isLoggedIn]);

  // fallback ถ้ายังไม่ได้ login หรือ fetch ยังไม่เสร็จ
  const title = content?.title ?? "Lorem Ipsum";
  const description =
    content?.description ??
    `Lorem Ipsum is simply dummy text of the printing and typesetting industry.
     Lorem Ipsum has been the industry's standard dummy text ever since the 1500s,
     when an unknown printer took a galley of type and scrambled it to make a type specimen book.
     It has survived not only five centuries, but also the leap into electronic typesetting,
     remaining essentially unchanged. It was popularised in the 1960s with the release of
     Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing
     software like Aldus PageMaker including versions of Lorem Ipsum.`;

  return (
    <div className="tw-min-h-screen tw-bg-white">
      <section className="tw-text-center tw-px-4 tw-pt-16 tw-pb-24">
        <h1 className="tw-text-5xl tw-font-extrabold tw-mb-5">{title}</h1>
        <p className="tw-max-w-[720px] tw-mx-auto tw-text-gray-700 tw-leading-7">
          {description}
        </p>
      </section>
    </div>
  );
}