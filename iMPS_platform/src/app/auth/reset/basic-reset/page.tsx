"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

// @material-tailwind/react
import { Input, Button, Typography } from "@/components/MaterialTailwind";

export default function BasicResetPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://localhost:8000";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage("");
    setIsError(false);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/forgot-password/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (Array.isArray((data as any)?.detail)) {
          const msgs = (data as any).detail.map((err: any) => `${err.loc?.join(".")}: ${err.msg}`);
          throw new Error(msgs.join(", "));
        }
        throw new Error((data as any)?.detail || "Request failed");
      }

      setSent(true);
      setMessage(data?.message || "If this email is registered, a reset link has been sent.");
    } catch (err: any) {
      console.error(err);
      setIsError(true);
      setMessage(err?.message || "Server error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="tw-grid tw-max-h-screen tw-h-screen tw-place-items-center">
      {/* ปุ่ม Back มุมซ้ายบน */}
      <div className="tw-absolute tw-top-4 tw-left-4">
        <Link href="/auth/signin/basic">
          <Button variant="outlined" size="sm" className="tw-flex tw-items-center tw-gap-2">
            <ArrowLeftIcon className="tw-h-5 tw-w-5" />
          </Button>
        </Link>
      </div>

      <div className="tw-w-full lg:tw-w-3/5 tw-flex tw-flex-col tw-items-center tw-justify-center">
        <div className="tw-text-center">
          <Typography variant="h2" className="!tw-font-bold tw-mb-4">
            Reset Password
          </Typography>
          <Typography className="tw-text-lg !tw-font-normal !tw-text-blue-gray-500">
            Enter your email and we will send you a reset link.
          </Typography>
        </div>
        <form className="tw-mt-8 tw-mx-auto tw-w-80 lg:tw-w-1/2" onSubmit={handleSubmit}>
          <div className="tw-flex tw-flex-col tw-gap-6">
            <Typography
              variant="small"
              color="blue-gray"
              className="-tw-mb-3 !tw-font-medium"
            >
              Your email
            </Typography>
            <Input
              size="lg"
              label="Your email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              crossOrigin={undefined}
              onPointerEnterCapture={undefined}
              onPointerLeaveCapture={undefined}
            />
          </div>

          <Button className="tw-mt-6" fullWidth type="submit" disabled={loading || sent}>
            {loading ? "Sending..." : sent ? "Link sent" : "Send reset link"}
          </Button>

          {!!message && (
            <Typography
              variant="small"
              className={`tw-mt-3 tw-text-center !tw-font-medium ${isError ? "!tw-text-red-500" : "!tw-text-green-600"}`}
            >
              {message}
            </Typography>
          )}

          <div className="tw-mt-6 tw-text-center">
            <Typography variant="small" className="!tw-font-normal !tw-text-blue-gray-500">
              Remember your password?{" "}
              <Link href="/auth/signin/basic" className="tw-font-medium tw-text-blue-gray-900 hover:tw-underline">
                Sign In
              </Link>
            </Typography>
          </div>
        </form>
      </div>
    </section>
  );
}
