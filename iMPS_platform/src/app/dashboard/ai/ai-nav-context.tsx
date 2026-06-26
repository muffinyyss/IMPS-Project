"use client";
import { createContext, useContext } from "react";

// ── ให้หน้า (page) สั่งซ่อนแท็บด้านบนได้ เช่นตอนขึ้น No data ──────────────
export type AiNavCtx = { hideNav: boolean; setHideNav: (v: boolean) => void };

export const AiNavContext = createContext<AiNavCtx>({
  hideNav: false,
  setHideNav: () => {},
});

export const useAiNav = () => useContext(AiNavContext);
