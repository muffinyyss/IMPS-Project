"use client";

import "./globals.css";
import { useRouter } from "next/navigation";

import Login from "./authentication/login"
import MainPage from "./mainPage"

export default function Home() {
  const router = useRouter();

  return (
    <html>
      <body>
        <div>
          <button
            onClick={() => router.push("/authentication/login")}
            className="mt-4 bg-blue-600 text-white px-6 py-3 rounded-md shadow-md hover:bg-blue-700 transition"
          >
            Login
          </button>
        </div>
      </body>
    </html>

  );
}