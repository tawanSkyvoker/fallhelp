/**
 * StatusBadge.tsx
 *
 * Component สำหรับแสดงป้ายสถานะในหน้า Admin
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - รับ status จากข้อมูล backend หรือค่าที่หน้า Admin สร้างขึ้น
 * - map สีของ badge ตามสถานะอุปกรณ์
 * - แปลสถานะ device เป็นข้อความภาษาไทย
 * - fallback เป็น badge สีเทาสำหรับสถานะทั่วไป
 */

import React from "react";

import type { DeviceStatus } from "../types";

interface StatusBadgeProps {
  status: DeviceStatus | string;
  variant?: "device" | "default";
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, variant = "default" }) => {
  const getStatusColor = (status: string): string => {
    if (variant === "device") {
      switch (status) {
        case "ONLINE":
          return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-700";
        case "WAITING_WIFI":
          return "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-700";
        case "OFFLINE":
          return "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600";
        case "PAIRED":
          return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-700";
        case "UNPAIRED":
          return "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-700";
        default:
          return "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600";
      }
    }

    return "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600";
  };

  const getStatusLabel = (status: string): string => {
    if (variant === "device") {
      switch (status) {
        case "ONLINE":
          return "ออนไลน์";
        case "WAITING_WIFI":
          return "รอเชื่อมต่อ Wi-Fi";
        case "OFFLINE":
          return "ออฟไลน์";
        case "PAIRED":
          return "ผูกแล้ว";
        case "UNPAIRED":
          return "ยังไม่ผูก";
        default:
          return status;
      }
    }

    return status;
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${getStatusColor(status)}`}
    >
      {getStatusLabel(status)}
    </span>
  );
};
