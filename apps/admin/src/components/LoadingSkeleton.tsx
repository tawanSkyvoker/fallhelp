/**
 * LoadingSkeleton.tsx
 *
 * Component สำหรับแสดงสถานะโหลดของหน้า Admin
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - แสดง spinner และข้อความระหว่างโหลดข้อมูล
 * - รองรับทั้งโหมดเต็มหน้าและโหมดฝังใน section
 * - เปลี่ยนสี spinner ได้จาก prop color
 */

import React from "react";

interface LoadingSkeletonProps {
  message?: string;
  color?: string;
  fullScreen?: boolean;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  message = "Loading...",
  color = "blue",
  fullScreen = true,
}) => {
  // map สีที่อนุญาตให้ใช้กับ spinner ถ้าส่งสีที่ไม่รู้จักจะ fallback เป็น blue
  const colorClasses = {
    blue: "border-blue-600",
    green: "border-green-600",
    purple: "border-purple-600",
  };

  // fullScreen ใช้กับการโหลดทั้งหน้า ส่วน false ใช้กับ section ภายในหน้า
  const containerClass = fullScreen
    ? "flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900"
    : "flex items-center justify-center min-h-[60vh] w-full";

  return (
    <div className={containerClass}>
      <div className="text-center">
        <div
          className={`animate-spin rounded-full h-12 w-12 border-b-2 ${
            colorClasses[color as keyof typeof colorClasses] || colorClasses.blue
          } mx-auto mb-4`}
        ></div>
        <p className="text-gray-500 dark:text-gray-400">{message}</p>
      </div>
    </div>
  );
};
