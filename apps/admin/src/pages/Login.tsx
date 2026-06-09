/**
 * Login.tsx
 *
 * หน้าล็อกอินสำหรับ Admin Panel
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - รับอีเมลและรหัสผ่านของผู้ดูแลระบบ
 * - เรียก API login แล้วตรวจ role ว่าเป็น ADMIN
 * - บันทึก session ผ่าน AuthContext
 * - แสดง loading/error state และ toggle การมองเห็นรหัสผ่าน
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ExclamationCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline";

import { loginAdmin } from "../services/adminAuthService";
import Logger from "../utils/logger";

import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Admin login ใช้ endpoint แยกที่ backend ตรวจ role ADMIN ก่อนคืน token
      // ไฟล์ถัดไป: services/adminAuthService.ts
      const { token, user } = await loginAdmin(email, password);

      // บันทึก token/user ลง AuthContext แล้วพาเข้า Dashboard
      // ไฟล์ถัดไป: context/AuthContext.tsx
      login(token, user);
      navigate("/");
    } catch (err) {
      Logger.error("[Login] Login failed", err);
      setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-xl border border-gray-200 dark:border-gray-700 shadow-none w-full max-w-md">
        <div className="text-center mb-8">
          <div className="h-14 w-52 mx-auto overflow-hidden relative flex items-center justify-center mb-1">
            <img
              src="/logoicon.png"
              alt="FallHelp Logo"
              className="h-36 w-auto object-contain absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 font-kanit tracking-wide mt-3">
            แผงควบคุมผู้ดูแลระบบ
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            เข้าสู่ระบบเพื่อเข้าใช้งานแผงควบคุมผู้ดูแลระบบ
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
              <ExclamationCircleIcon className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              อีเมล
            </label>
            <div className="relative">
              <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-4 focus:ring-green-500/10 focus:border-green-500 outline-none transition-all duration-150 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              รหัสผ่าน
            </label>
            <div className="relative">
              <LockClosedIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-4 focus:ring-green-500/10 focus:border-green-500 outline-none transition-all duration-150 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none cursor-pointer"
              >
                {showPassword ? (
                  <EyeSlashIcon className="w-5 h-5" />
                ) : (
                  <EyeIcon className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-all shadow-none active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
          >
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>
      </div>
    </div>
  );
}
