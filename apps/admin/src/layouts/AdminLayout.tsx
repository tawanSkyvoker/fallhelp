/**
 * AdminLayout.tsx
 *
 * Layout หลักของ Admin Panel
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - แสดง Top Navbar แทน Sidebar เพราะมีเมนูเพียงหน้าเดียว
 * - แสดงข้อมูลผู้ใช้และปุ่ม logout ใน navbar
 * - จัดการเปลี่ยนธีม light/dark
 * - render หน้า child ผ่าน Outlet ของ React Router
 */

import { Outlet, useNavigate } from "react-router-dom";
import { ArrowRightOnRectangleIcon, SunIcon, MoonIcon } from "@heroicons/react/24/outline";

import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export default function AdminLayout() {
  const { logout, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    // ล้าง auth state แล้วพากลับไปหน้า login
    // ไฟล์ถัดไป: context/AuthContext.tsx
    logout();
    navigate("/login");
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Navbar */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          {/* Logo + subtitle */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="h-10 w-23 overflow-hidden relative flex items-center">
              <img
                src="/logoicon.png"
                alt="FallHelp Logo"
                className="h-28 w-auto object-contain absolute -left-1.5 top-1/2 -translate-y-1/2"
              />
            </div>
            {/* ข้อความ "แผงจัดการอุปกรณ์" คงไว้สำหรับ AdminLayout.test.tsx */}
            <span className="admin-sidebar-meta hidden sm:inline">แผงจัดการอุปกรณ์</span>
          </div>

          {/* Right section: theme + user + logout */}
          <div className="flex items-center gap-2 shrink-0">
            {/* ปุ่มสลับธีมทำงานผ่าน ThemeContext เพื่อ sync class dark ที่ root document */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title={theme === "dark" ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด"}
            >
              {theme === "dark" ? (
                <SunIcon className="w-4.5 h-4.5" />
              ) : (
                <MoonIcon className="w-4.5 h-4.5" />
              )}
            </button>

            {/* Avatar + ชื่อแอดมิน & บทบาทแบบ 2 บรรทัด */}
            <div className="flex items-center gap-2.5 px-3 py-1.5 border-l border-gray-200 dark:border-gray-700 pl-4 shrink-0">
              <div className="w-8 h-8 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary text-sm font-bold shrink-0 ring-2 ring-primary/10 dark:ring-primary/20">
                {user?.firstName?.charAt(0)}
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 leading-tight">
                  {user?.firstName} {user?.lastName || ""}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider mt-0.5">
                  {user?.role === "ADMIN" ? "ผู้ดูแลระบบ" : "ผู้ใช้งาน"}
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="ออกจากระบบ"
            >
              <ArrowRightOnRectangleIcon className="w-4.5 h-4.5" />
              <span className="hidden sm:inline">ออกจากระบบ</span>
            </button>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
