/**
 * EmptyState.tsx
 *
 * Component สำหรับแสดงสถานะว่างของข้อมูลในหน้า Admin
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - รับ icon, title และ message จากหน้าที่เรียกใช้
 * - แสดง icon กลางหน้าเพื่อบอกว่าข้อมูลยังไม่มี
 * - ใช้ซ้ำได้กับหลายหน้า เช่น users, elders, devices หรือรายการอื่น
 */

import React from "react";

interface EmptyStateProps {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  title: string;
  message: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, message }) => {
  return (
    <div className="p-12 text-center">
      <div className="flex flex-col items-center">
        {/* icon ถูกส่งมาจากหน้าที่เรียกใช้ เพื่อให้ empty state เข้ากับบริบทของหน้านั้น */}
        <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
          <Icon className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>

        <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{title}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
      </div>
    </div>
  );
};
