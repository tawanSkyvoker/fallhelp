/**
 * App.tsx
 *
 * จุดเริ่มต้นของ Admin Dashboard
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - สร้าง React Query client สำหรับ cache ข้อมูลฝั่ง Admin
 * - ครอบแอปด้วย ThemeProvider, QueryClientProvider และ AuthProvider
 * - กำหนด route หลักของหน้า Login, Dashboard และ Devices
 * - ป้องกัน route ภายในด้วย ProtectedRoute
 * - แสดง Toaster กลางสำหรับแจ้งผลสำเร็จหรือข้อผิดพลาด
 */

import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { LoadingSkeleton } from "./components/LoadingSkeleton";
import AdminLayout from "./layouts/AdminLayout";

import Login from "./pages/Login";
import Devices from "./pages/Devices";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";

// Query client ของ Admin ใช้ staleTime สั้น เพื่อให้ข้อมูล dashboard สดพอโดยไม่ refetch ถี่เกินไป
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  // ระหว่างกู้ session จาก token เดิม ให้แสดง loading ก่อนตัดสินใจ redirect
  if (isLoading && !isAuthenticated) {
    return <LoadingSkeleton message="กำลังโหลดข้อมูล..." />;
  }

  // ถ้าไม่มี session ให้กลับไปหน้า login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Devices />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>

      {/* Toaster กลางของ Admin ใช้กับ toast จากหน้า Devices และ flow อื่น ๆ */}
      <Toaster position="top-right" richColors style={{ fontFamily: '"Kanit", sans-serif' }} />
    </ThemeProvider>
  );
}
