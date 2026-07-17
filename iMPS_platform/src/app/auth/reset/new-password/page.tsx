"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

// @material-tailwind/react
import { Input, Button, Typography } from "@/components/MaterialTailwind";

function EyeIcon({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <div onClick={onToggle} className="tw-cursor-pointer">
      {show ? (
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
  );
}

function NewPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";
  const emailFromUrl = searchParams.get("email") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://localhost:8000";
  const linkInvalid = !token || !emailFromUrl;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage("");
    setIsError(false);

    if (password.length < 8) {
      setIsError(true);
      setMessage("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setIsError(true);
      setMessage("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/reset-password/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailFromUrl, token, new_password: password }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (Array.isArray((data as any)?.detail)) {
          const msgs = (data as any).detail.map((err: any) => `${err.loc?.join(".")}: ${err.msg}`);
          throw new Error(msgs.join(", "));
        }
        throw new Error((data as any)?.detail || "Request failed");
      }

      setDone(true);
      setMessage(data?.message || "Password reset successful");
      setTimeout(() => router.push("/auth/signin/basic"), 2500);
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
      <div className="tw-w-full lg:tw-w-3/5 tw-flex tw-flex-col tw-items-center tw-justify-center">
        <div className="tw-text-center">
          <Typography variant="h2" className="!tw-font-bold tw-mb-4">
            New Password
          </Typography>
          <Typography className="tw-text-lg !tw-font-normal !tw-text-blue-gray-500">
            {linkInvalid
              ? "This reset link is invalid."
              : `Choose a new password for ${emailFromUrl}.`}
          </Typography>
        </div>

        {linkInvalid ? (
          <div className="tw-mt-8 tw-text-center">
            <Link href="/auth/reset/basic-reset">
              <Button>Request a new link</Button>
            </Link>
          </div>
        ) : (
          <form className="tw-mt-8 tw-mx-auto tw-w-80 lg:tw-w-1/2" onSubmit={handleSubmit}>
            <div className="tw-flex tw-flex-col tw-gap-6">
              <Typography
                variant="small"
                color="blue-gray"
                className="-tw-mb-3 !tw-font-medium"
              >
                New password
              </Typography>
              <Input
                type={showPassword ? "text" : "password"}
                size="lg"
                label="New password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                crossOrigin={undefined}
                onPointerEnterCapture={undefined}
                onPointerLeaveCapture={undefined}
                icon={<EyeIcon show={showPassword} onToggle={() => setShowPassword(!showPassword)} />}
              />
              <Typography
                variant="small"
                color="blue-gray"
                className="-tw-mb-3 !tw-font-medium"
              >
                Confirm password
              </Typography>
              <Input
                type={showPassword ? "text" : "password"}
                size="lg"
                label="Confirm password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                crossOrigin={undefined}
                onPointerEnterCapture={undefined}
                onPointerLeaveCapture={undefined}
              />
            </div>

            <Button className="tw-mt-6" fullWidth type="submit" disabled={loading || done}>
              {loading ? "Saving..." : done ? "Password updated" : "Reset password"}
            </Button>

            {!!message && (
              <Typography
                variant="small"
                className={`tw-mt-3 tw-text-center !tw-font-medium ${isError ? "!tw-text-red-500" : "!tw-text-green-600"}`}
              >
                {message}
                {done && " — redirecting to sign in..."}
              </Typography>
            )}

            <div className="tw-mt-6 tw-text-center">
              <Typography variant="small" className="!tw-font-normal !tw-text-blue-gray-500">
                Back to{" "}
                <Link href="/auth/signin/basic" className="tw-font-medium tw-text-blue-gray-900 hover:tw-underline">
                  Sign In
                </Link>
              </Typography>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

export default function NewPasswordPage() {
  return (
    <Suspense fallback={null}>
      <NewPasswordForm />
    </Suspense>
  );
}
