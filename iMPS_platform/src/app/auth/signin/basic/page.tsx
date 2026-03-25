"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
// @material-tailwind/react
import {
  Input,
  Checkbox,
  Button,
  Typography,
} from "@/components/MaterialTailwind";
// import { headers } from "next/headers";

export default function BasicPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const router = useRouter();
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://localhost:8000";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const formData = new URLSearchParams();
      formData.append("username", email);
      formData.append("password", password);

      // const res = await fetch("http://localhost:8000/login/", {
      //   method: "POST",
      //   // headers: {"Content-Type": "application/json"},
      //   // body: JSON.stringify({username,password}),
      //   headers: { "Content-Type": "application/x-www-form-urlencoded" },
      //   body: formData.toString(),
      // });

      const res = await fetch(`${API_BASE}/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",                // ★ ให ้cookie ที่ backend set กลับมาเก็บใน browser
        body: JSON.stringify({ email, password }) // ★ ตรงกับ LoginRequest(email,password)
      });

      const data = await res.json();

      if (!res.ok) {
        // รองรับ both cases: detail เป็น string หรือเป็น list of errors
        if (Array.isArray((data as any)?.detail)) {
          const msgs = (data as any).detail.map((err: any) => `${err.loc?.join(".")}: ${err.msg}`);
          throw new Error(msgs.join(", "));
        }
        throw new Error((data as any)?.detail || "Login failed ❌");
      }

      // ✅ เก็บคีย์ให้ “ตรงกับ Navbar”
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("userRole", data.user?.role ?? "");

      // ✅ แจ้ง Navbar ให้รีโหลดสถานะทันที (แท็บเดียวกัน storage ไม่ยิง)
      window.dispatchEvent(new Event("auth"));

      setMessage(data?.message || "Login success ✅");
      router.push("/pages/mainpages/home");
    } catch (err: any) {
      console.error(err);
      setMessage(err?.message || "Server error");
    } finally {
      setLoading(false);
    }
  };


  return (
    <section className="tw-grid tw-grid-cols-1 xl:tw-grid-cols-2 tw-items-center tw-h-full">

      {/* ปุ่ม Back มุมซ้ายบน */}
      <div className="tw-absolute tw-top-4 tw-left-4">
        <Link href="/">
          <Button
            variant="outlined"
            size="sm"
            className="tw-flex tw-items-center tw-gap-2"
          >
            <ArrowLeftIcon className="tw-h-5 tw-w-5" />
          </Button>
        </Link>
      </div>

      <div className="tw-w-full tw-min-h-screen tw-grid tw-place-items-center">
        <div className="tw-w-full">
          <div className="tw-text-center">
            <Typography variant="h2" className="!tw-font-bold tw-mb-4">
              Sign In
            </Typography>
            <Typography className="tw-text-lg !tw-font-normal !tw-text-blue-gray-500">
              Enter your email and password to Sign In.
            </Typography>
          </div>
          <form className="tw-mt-8 tw-mb-2 tw-mx-auto tw-w-80 tw-max-w-screen-lg lg:tw-w-1/2" onSubmit={handleSubmit}>
            <div className="tw-mb-1 tw-flex tw-flex-col tw-gap-6">
              <Typography
                variant="small"
                color="blue-gray"
                className="-tw-mb-3 !tw-font-medium"
              >
                Your email
              </Typography>
              <Input size="lg" label="Your email"
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Typography
                variant="small"
                color="blue-gray"
                className="-tw-mb-3 !tw-font-medium"
              >
                Password
              </Typography>
              {/* <Input type="password" size="lg" label="Password"
                value={password}
                onChange={(e) => setPassword((e.target.value))} /> */}
              <Input 
                type={showPassword ? "text" : "password"} 
                size="lg" 
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)} 
                icon={
                  <div onClick={() => setShowPassword(!showPassword)} className="tw-cursor-pointer">
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="tw-w-5 tw-h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="tw-w-5 tw-h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </div>
                }
              />
            </div>

            {/* <Button className="tw-mt-6" fullWidth type="submit">
              Sign In
            </Button>
            {message && <p>{message}</p>} */}

            <Button className="tw-mt-6" fullWidth type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>

            {!!message && <p className="tw-mt-3">{message}</p>}

            {/* <div className="tw-flex tw-items-center tw-justify-between tw-gap-2 tw-mt-6">
              <Checkbox
                label={
                  <Typography
                    variant="small"
                    color="gray"
                    className="tw-flex tw-items-center tw-justify-start !tw-font-medium"
                  >
                    Subscribe me to newsletter
                  </Typography>
                }
                containerProps={{ className: "-tw-ml-2.5" }}
              />
            </div> */}

            <Typography className="tw-text-center !tw-text-blue-gray-500 !tw-font-medium tw-mt-4">
              Not registered?
              <Link
                href="/auth/signup/basic-signup"
                className="tw-text-gray-900 tw-ml-1"
              >
                Create account
              </Link>
            </Typography>
          </form>
        </div>
      </div>
      <div className="tw-p-8 tw-hidden xl:tw-block">
        <img
          src="/img/pattern.png"
          alt="image"
          className="tw-object-cover tw-object-center tw-max-h-[calc(100vh-4rem)] tw-w-full tw-rounded-2xl"
        />
      </div>
    </section>
  );
}
