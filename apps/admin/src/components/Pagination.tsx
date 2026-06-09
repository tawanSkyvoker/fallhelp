/**
 * Pagination.tsx
 *
 * Component สำหรับควบคุมการแบ่งหน้าข้อมูลในหน้า Admin
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - แสดงปุ่มก่อนหน้าและถัดไป
 * - แสดงหมายเลขหน้าตามจำนวนสูงสุดที่ config กำหนด
 * - ส่ง page ที่เลือกกลับไปให้ parent โหลดข้อมูลหน้าใหม่
 */

import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { PAGINATION_MAX_VISIBLE } from "../constants/config";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const getPageNumbers = (): number[] => {
    // พยายามให้หน้าปัจจุบันอยู่ใกล้กลางช่วงที่แสดง
    let start = Math.max(1, currentPage - Math.floor(PAGINATION_MAX_VISIBLE / 2));
    const end = Math.min(totalPages, start + PAGINATION_MAX_VISIBLE - 1);

    // ถ้า end ชนหน้าสุดท้าย ให้ขยับ start กลับเพื่อให้ยังแสดงจำนวนหน้าได้เต็มช่วง
    start = Math.max(1, end - PAGINATION_MAX_VISIBLE + 1);

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  const pages = getPageNumbers();

  return (
    <div className="flex items-center justify-center gap-1 py-3">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="p-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
        title="ก่อนหน้า"
      >
        <ChevronLeftIcon className="w-4 h-4" />
      </button>

      {pages.map((page) => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          className={`min-w-8 h-8 px-2 rounded-full text-xs font-medium transition-colors ${
            page === currentPage
              ? "bg-primary text-white"
              : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          }`}
        >
          {page}
        </button>
      ))}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="p-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
        title="ถัดไป"
      >
        <ChevronRightIcon className="w-4 h-4" />
      </button>
    </div>
  );
}
