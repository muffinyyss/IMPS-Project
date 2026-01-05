"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  Card,
  CardBody,
  CardFooter,
  Button,
  Input,
  Typography,
  CardHeader,
  Dialog,
  DialogHeader,
  DialogBody,
  DialogFooter,
  Spinner,
} from "@/components/MaterialTailwind";

import Profile from "./components/profile";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function Settings() {
  const router = useRouter();

  // ===== State สำหรับ User Info =====
  const [userId, setUserId] = useState<string | null>(null);

  // ===== State สำหรับ Change Password =====
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ===== State สำหรับ Confirm Dialog =====
  const [showConfirm, setShowConfirm] = useState(false);

  // ===== State สำหรับ Redirecting (ล็อกหน้าจอ) =====
  const [redirecting, setRedirecting] = useState(false);

  // ===== ดึง user id จาก /me =====
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    fetch(`${API_BASE}/me`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.id) setUserId(data.id);
      })
      .catch(console.error);
  }, []);

  // ===== Validation =====
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
  const hasMinLength = newPassword.length >= 6;
  const hasNumber = /\d/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0;

  const isFormValid = 
    currentPassword.length > 0 && 
    hasSpecialChar && 
    hasMinLength && 
    hasNumber && 
    passwordsMatch;

  // ===== Handle Submit =====
  const handleChangePassword = async () => {
    if (!isFormValid || !userId) return;
    
    setShowConfirm(false);
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const token = localStorage.getItem("access_token");
      
      const res = await fetch(`${API_BASE}/user_update/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          password: newPassword,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
      }

      // ===== เปิด Overlay ล็อกหน้าจอ =====
      setRedirecting(true);
      
      setTimeout(() => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        router.push("/auth/signin/basic");
      }, 2000);

    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  // ===== Requirement Check Item =====
  const RequirementItem = ({ met, text }: { met: boolean; text: string }) => (
    <div className="tw-flex tw-items-center tw-gap-2">
      <span className={`tw-h-1.5 tw-w-1.5 tw-rounded-full ${met ? "tw-bg-green-500" : "tw-bg-blue-gray-500"}`} />
      <Typography
        className={`!tw-font-normal ${met ? "!tw-text-green-600" : "!tw-text-blue-gray-500"}`}
        variant="small"
      >
        {text} {met && "✓"}
      </Typography>
    </div>
  );

  return (
    <div className="tw-mb-6 !tw-w-full">
      {/* ===== Overlay ล็อกหน้าจอ ===== */}
      {redirecting && (
        <div className="tw-fixed tw-inset-0 tw-z-[9999] tw-bg-black/60 tw-backdrop-blur-sm tw-flex tw-items-center tw-justify-center">
          <div className="tw-bg-white tw-rounded-xl tw-p-8 tw-shadow-2xl tw-flex tw-flex-col tw-items-center tw-gap-4 tw-max-w-sm tw-mx-4">
            <div className="tw-w-16 tw-h-16 tw-rounded-full tw-bg-green-100 tw-flex tw-items-center tw-justify-center">
              <svg className="tw-w-8 tw-h-8 tw-text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <Typography variant="h5" color="blue-gray" className="tw-text-center">
              เปลี่ยนรหัสผ่านสำเร็จ!
            </Typography>
            <Typography className="tw-text-center !tw-text-blue-gray-600">
              กำลังนำคุณไปหน้าเข้าสู่ระบบ...
            </Typography>
            <Spinner className="tw-h-8 tw-w-8" color="blue" />
          </div>
        </div>
      )}

      <div className="!tw-col-span-10">
        <div className="tw-grid tw-grid-cols-1 lg:tw-grid-cols-2 tw-gap-6 tw-mt-8">
          {/* Profile / Basic Info (ซ้าย) */}
          <div className="tw-h-full">
            <Profile />
          </div>

          {/* Change Password (ขวา) */}
          <Card
            className="tw-h-full tw-scroll-mt-4 tw-border tw-border-blue-gray-100 tw-shadow-sm"
            id="Change Password"
          >
            <CardHeader floated={false} shadow={false}>
              <Typography variant="h5" color="blue-gray">
                Change Password
              </Typography>
            </CardHeader>
            <CardBody className="tw-flex tw-flex-col tw-gap-6">
              {/* Error Message */}
              {error && (
                <div className="tw-p-3 tw-bg-red-50 tw-border tw-border-red-200 tw-rounded-lg">
                  <Typography variant="small" className="!tw-text-red-600">
                    {error}
                  </Typography>
                </div>
              )}

              {/* Success Message */}
              {success && (
                <div className="tw-p-3 tw-bg-green-50 tw-border tw-border-green-200 tw-rounded-lg">
                  <Typography variant="small" className="!tw-text-green-600">
                    {success}
                  </Typography>
                </div>
              )}

              <Input 
                label="Current Password" 
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                crossOrigin=""
              />
              <Input 
                label="New Password" 
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                crossOrigin=""
              />
              <Input 
                label="Confirm New Password" 
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={confirmPassword.length > 0 && !passwordsMatch}
                crossOrigin=""
              />
              {confirmPassword.length > 0 && !passwordsMatch && (
                <Typography variant="small" className="!tw-text-red-500 tw--mt-4">
                  รหัสผ่านไม่ตรงกัน
                </Typography>
              )}
            </CardBody>
            <CardFooter>
              <Typography variant="h5" color="blue-gray">
                Password Requirement
              </Typography>
              <Typography className="tw-my-2 !tw-font-normal !tw-text-blue-gray-500">
                Please follow this guide for a strong password
              </Typography>
              <div className="tw-flex tw-flex-col tw-justify-between lg:tw-items-end md:tw-items-end tw-gap-8 md:tw-flex-row">
                <div>
                  <RequirementItem met={hasSpecialChar} text="One special character" />
                  <RequirementItem met={hasMinLength} text="Min 6 characters" />
                  <RequirementItem met={hasNumber} text="One number (2 are recommended)" />
                  <RequirementItem met={passwordsMatch} text="Passwords match" />
                </div>
                <Button
                  variant="gradient"
                  className="tw-py-2 tw-px-4 tw-ml-auto"
                  size="sm"
                  onClick={() => setShowConfirm(true)}
                  disabled={!isFormValid || loading || !userId}
                >
                  {loading ? "Updating..." : "Update Password"}
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* ===== Confirm Dialog ===== */}
      <Dialog open={showConfirm} handler={() => setShowConfirm(false)} size="xs">
        <DialogHeader className="tw-flex tw-flex-col tw-items-start tw-gap-1">
          <Typography variant="h5" color="blue-gray">
            ยืนยันการเปลี่ยนรหัสผ่าน
          </Typography>
        </DialogHeader>
        <DialogBody divider>
          <Typography className="!tw-text-blue-gray-700">
            คุณต้องการเปลี่ยนรหัสผ่านใช่หรือไม่?
          </Typography>
          <Typography variant="small" className="!tw-text-blue-gray-500 tw-mt-2">
            หลังจากเปลี่ยนรหัสผ่านแล้ว ระบบจะนำคุณไปหน้าเข้าสู่ระบบเพื่อ Login ใหม่
          </Typography>
        </DialogBody>
        <DialogFooter className="tw-flex tw-gap-2">
          <Button 
            variant="outlined" 
            color="blue-gray" 
            onClick={() => setShowConfirm(false)}
            disabled={loading}
          >
            ยกเลิก
          </Button>
          <Button 
            variant="gradient" 
            color="green" 
            onClick={handleChangePassword}
            disabled={loading}
          >
            {loading ? "กำลังบันทึก..." : "ยืนยัน"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}