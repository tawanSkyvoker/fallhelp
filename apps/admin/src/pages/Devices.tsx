/**
 * Devices.tsx
 *
 * หน้าจัดการอุปกรณ์ของ Admin
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - แสดงรายการอุปกรณ์ทั้งหมดและสถานะ online/offline
 * - ลงทะเบียนอุปกรณ์ใหม่จาก serial number
 * - แสดง QR Code สำหรับให้ mobile สแกนเพื่อจับคู่
 * - ลบอุปกรณ์หรือยกเลิกการผูกกับผู้สูงอายุ
 * - คำนวณสถานะออนไลน์แบบ local fallback ระหว่างรอ refetch
 */

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import {
  PlusIcon,
  TrashIcon,
  QrCodeIcon,
  LinkIcon,
  SignalIcon,
  LinkSlashIcon,
  CpuChipIcon,
  PrinterIcon,
} from "@heroicons/react/24/outline";

import { LoadingSkeleton } from "../components/LoadingSkeleton";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";
import { Pagination } from "../components/Pagination";

import {
  useAdminDevices,
  useCreateDevice,
  useDeleteDevice,
  useUnpairDevice,
} from "../hooks/useAdminDevices";

import type { Device, CreateDevicePayload } from "../types";
import type { DeviceOnlineStatus } from "../types";
import {
  PAGE_SIZE,
  DEVICE_ONLINE_THRESHOLD_MS,
  DEVICE_CLOCK_TICK_MS,
  ERROR_CODES,
} from "../constants/config";
import {
  DEVICE_SERIAL_PATTERN,
  DEVICE_SERIAL_TOTAL_LENGTH,
  isValidDeviceSerial,
  normalizeDeviceSerial,
  normalizeDeviceSerialInput,
} from "../utils/deviceSerial";

type AdminApiErrorPayload = {
  response?: {
    data?: {
      error?: { code?: string; message?: string };
      message?: string;
    };
  };
};

const getErrorCode = (error: unknown): string | undefined => {
  return (error as AdminApiErrorPayload).response?.data?.error?.code;
};

const getErrorMessage = (error: unknown): string | undefined => {
  const apiError = (error as AdminApiErrorPayload).response?.data;
  return apiError?.error?.message ?? apiError?.message;
};

/** ป้าย QR 6 ดวง (3×2) สำหรับพิมพ์ลงกระดาษ A4 — ซ่อนบนหน้าจอ แสดงเฉพาะตอน print */
function DeviceLabelSheet({ device }: { device: Device }): React.ReactElement {
  return (
    <div className="device-label-sheet">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="device-label">
          <p className="device-label__name">QR CODE</p>
          <div className="device-label__qr" data-testid="qr-svg-container">
            <QRCodeSVG value={device.deviceCode} size={64} level="H" />
          </div>
          <p className="device-label__code">CODE {device.deviceCode}</p>
          <p className="device-label__serial">SN {device.serialNumber}</p>
        </div>
      ))}
    </div>
  );
}

// ไอคอนรูปเซนเซอร์กล่องตรวจจับการล้มแบบคล้องคอ (ไม่ใช่โทรศัพท์)
function DevicePendantIcon({ className = "w-5 h-5", ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
      {...props}
    >
      {/* สายคล้องคอ (Neck strap / Lanyard) */}
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 2c0 3.5 3.5 5.5 6 5.5s6-2 6-5.5" />
      {/* ห่วงยึดสาย */}
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5v1.5" />
      {/* ตัวเครื่องส่งสัญญาณตรวจจับการล้ม (Pendant casing) */}
      <rect
        x="8.5"
        y="9"
        width="7"
        height="11.5"
        rx="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* ปุ่มกดยกเลิกการแจ้งเหตุฉุกเฉิน (GPIO27 Cancel Button) */}
      <circle cx="12" cy="15" r="1.5" fill="currentColor" />
    </svg>
  );
}

export default function Devices() {
  const [devicesPage, setDevicesPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [newDevice, setNewDevice] = useState<CreateDevicePayload>({
    serialNumber: "",
  });
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [unpairId, setUnpairId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // tick เวลาเพื่อให้สถานะ online/offline fallback เปลี่ยนได้ แม้ข้อมูลจาก backend ยังไม่ refetch
    const timer = setInterval(() => setNow(Date.now()), DEVICE_CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  // โหลดรายการอุปกรณ์และเตรียม mutation สำหรับ action ของ admin
  // ไฟล์ถัดไป: hooks/useAdminDevices.ts
  const { data: devices, isLoading } = useAdminDevices();
  const createMutation = useCreateDevice();
  const deleteMutation = useDeleteDevice();
  const unpairMutation = useUnpairDevice();

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();

    const normalizedSerialNumber = normalizeDeviceSerial(newDevice.serialNumber);

    if (!isValidDeviceSerial(normalizedSerialNumber)) {
      toast.error("หมายเลขอุปกรณ์ต้องอยู่ในรูปแบบ ESP32-XXXXXXXXXXXX ให้ครบ 12 ตัวท้าย");
      return;
    }

    createMutation.mutate(
      { serialNumber: normalizedSerialNumber },
      {
        onSuccess: () => {
          setShowModal(false);
          setNewDevice({ serialNumber: "" });
          toast.success("ลงทะเบียนอุปกรณ์สำเร็จ");
        },
        onError: (error: unknown) => {
          const code = getErrorCode(error);
          const message = getErrorMessage(error);

          if (code === ERROR_CODES.SERIAL_NUMBER_EXISTS) {
            toast.error("หมายเลขอุปกรณ์นี้มีอยู่ในระบบแล้ว กรุณาตรวจสอบหมายเลข Serial อีกครั้ง");
          } else {
            toast.error(message || "ลงทะเบียนอุปกรณ์ไม่สำเร็จ");
          }
        },
      }
    );
  };

  const handleDelete = (): void => {
    if (deleteId) {
      deleteMutation.mutate(deleteId, {
        onSuccess: () => {
          setDeleteId(null);
          toast.success("ลบอุปกรณ์สำเร็จ");
        },
        onError: (error: unknown) => {
          toast.error(getErrorMessage(error) || "ลบอุปกรณ์ไม่สำเร็จ");
        },
      });
    }
  };

  const handleUnpair = (): void => {
    if (unpairId) {
      unpairMutation.mutate(unpairId, {
        onSuccess: () => {
          setUnpairId(null);
          toast.success("ยกเลิกการผูกอุปกรณ์สำเร็จ");
        },
        onError: (error: unknown) => {
          toast.error(getErrorMessage(error) || "ยกเลิกการผูกอุปกรณ์ไม่สำเร็จ");
        },
      });
    }
  };

  const isPaired = (device: Device) => Boolean(device.elderId);

  const isDeviceOnlineLocal = (lastOnline: Date | null | undefined): boolean => {
    if (!lastOnline) return false;

    const time = lastOnline instanceof Date ? lastOnline.getTime() : new Date(lastOnline).getTime();

    if (isNaN(time)) return false;

    // ใช้ threshold เดียวกับ backend เพื่อไม่ให้ badge แสดง online/offline เพี้ยนกันมาก
    return now - time < DEVICE_ONLINE_THRESHOLD_MS;
  };

  const isOnline = (device: Device): boolean =>
    device.isOnline === true ||
    device.onlineStatus === "ONLINE" ||
    isDeviceOnlineLocal(device.lastOnline);

  const getDisplayStatus = (device: Device): DeviceOnlineStatus | "UNPAIRED" => {
    if (!isPaired(device)) return "UNPAIRED";
    if (device.status === "PAIRED" && !device.lastOnline) return "WAITING_WIFI";

    return isOnline(device) ? "ONLINE" : "OFFLINE";
  };

  if (isLoading) {
    return <LoadingSkeleton message="กำลังโหลดอุปกรณ์..." color="green" fullScreen={false} />;
  }

  const pairedCount = devices?.filter((d) => isPaired(d)).length || 0;
  const activeCount = devices?.filter((d) => isPaired(d) && isOnline(d)).length || 0;
  const unpairedCount = devices?.filter((d) => !isPaired(d)).length || 0;

  const allDevices = devices ?? [];
  const devicesTotalPages = Math.ceil(allDevices.length / PAGE_SIZE);
  const pagedDevices = allDevices.slice((devicesPage - 1) * PAGE_SIZE, devicesPage * PAGE_SIZE);
  const normalizedSerialNumber = normalizeDeviceSerial(newDevice.serialNumber);
  const isSerialNumberValid = isValidDeviceSerial(normalizedSerialNumber);

  return (
    <>
      <div className="admin-page-shell">
        <div className="admin-page-container">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="admin-page-title">จัดการอุปกรณ์ (Devices)</h1>
              <p className="admin-page-subtitle">
                ลงทะเบียน ตรวจสอบสถานะ และจัดการอุปกรณ์ทั้งหมดในระบบ
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="bg-green-600 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm font-semibold hover:bg-green-700 transition-all"
            >
              <PlusIcon className="w-4.5 h-4.5" />
              <span>ลงทะเบียนอุปกรณ์</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* อุปกรณ์ทั้งหมด */}
            <div className="admin-kpi-card flex items-center justify-between p-5">
              <div className="flex flex-col">
                <p className="admin-kpi-label">อุปกรณ์ทั้งหมด</p>
                <p className="admin-kpi-value text-slate-800 dark:text-slate-100 mt-1">
                  {devices?.length || 0}
                </p>
              </div>
              <div className="w-11 h-11 bg-slate-50 text-slate-500 border border-slate-200/80 dark:bg-slate-700/30 dark:text-slate-400 dark:border-slate-700/50 rounded-xl flex items-center justify-center shrink-0">
                <DevicePendantIcon className="w-5.5 h-5.5" />
              </div>
            </div>

            {/* ผูกแล้ว */}
            <div className="admin-kpi-card flex items-center justify-between p-5">
              <div className="flex flex-col">
                <p className="admin-kpi-label">ผูกแล้ว</p>
                <p className="admin-kpi-value text-slate-800 dark:text-slate-100 mt-1">
                  {pairedCount}
                </p>
              </div>
              <div className="w-11 h-11 bg-blue-50 text-blue-600 border border-blue-100/60 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30 rounded-xl flex items-center justify-center shrink-0">
                <LinkIcon className="w-5.5 h-5.5" />
              </div>
            </div>

            {/* ใช้งานอยู่ */}
            <div className="admin-kpi-card flex items-center justify-between p-5">
              <div className="flex flex-col">
                <p className="admin-kpi-label">ใช้งานอยู่</p>
                <p className="admin-kpi-value text-slate-800 dark:text-slate-100 mt-1">
                  {activeCount}
                </p>
              </div>
              <div className="w-11 h-11 bg-green-50 text-green-600 border border-green-100/60 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/30 rounded-xl flex items-center justify-center shrink-0">
                <SignalIcon className="w-5.5 h-5.5" />
              </div>
            </div>

            {/* ยังไม่ผูก */}
            <div className="admin-kpi-card flex items-center justify-between p-5">
              <div className="flex flex-col">
                <p className="admin-kpi-label">ยังไม่ผูก</p>
                <p className="admin-kpi-value text-slate-800 dark:text-slate-100 mt-1">
                  {unpairedCount}
                </p>
              </div>
              <div className="w-11 h-11 bg-orange-50 text-orange-600 border border-orange-100/60 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/30 rounded-xl flex items-center justify-center shrink-0">
                <LinkSlashIcon className="w-5.5 h-5.5" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-none">
            <div className="overflow-x-auto">
              <div className="min-w-200 md:min-w-full">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
                      <th className="admin-table-head w-2/5">หมายเลขอุปกรณ์</th>
                      <th className="admin-table-head w-1/5">รหัสอุปกรณ์</th>
                      <th className="admin-table-head w-1/5">สถานะ</th>
                      <th className="admin-table-head w-1/5 text-right pr-8">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {pagedDevices.map((device) => {
                      return (
                        <tr key={device.id}>
                          <td className="px-6 py-3.5 w-2/5">
                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {device.serialNumber}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 w-1/5">
                            <code className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm font-mono text-gray-700 dark:text-gray-300">
                              {device.deviceCode}
                            </code>
                          </td>
                          <td className="px-6 py-3.5 w-1/5">
                            <StatusBadge status={getDisplayStatus(device)} variant="device" />
                          </td>
                          <td className="px-6 py-3.5 w-1/5 text-right pr-8">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setSelectedDevice(device)}
                                className="p-2 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                                title="ดู QR Code"
                              >
                                <QrCodeIcon className="w-4 h-4" />
                              </button>
                              {isPaired(device) && (
                                <button
                                  onClick={() => setUnpairId(device.id)}
                                  className="p-2 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40 rounded-lg transition-colors"
                                  title="ยกเลิกการผูก"
                                >
                                  <LinkSlashIcon className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => setDeleteId(device.id)}
                                className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                                title="ลบอุปกรณ์"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {allDevices.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12">
                          <EmptyState
                            icon={DevicePendantIcon}
                            title="ยังไม่มีอุปกรณ์ในระบบ"
                            message="ลงทะเบียนอุปกรณ์เครื่องแรกเพื่อเริ่มต้นใช้งาน"
                          />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <Pagination
              currentPage={devicesPage}
              totalPages={devicesTotalPages}
              onPageChange={(p) => setDevicesPage(p)}
            />
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 transition-all duration-300">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-sm shadow-lg border border-gray-200 dark:border-gray-700 relative overflow-hidden transition-all duration-200">
            <div className="flex items-center gap-2 mb-6 mt-1">
              <PlusIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                ลงทะเบียนอุปกรณ์ใหม่
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="device-serial-number"
                  className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
                >
                  หมายเลขอุปกรณ์
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 dark:text-gray-500">
                    <CpuChipIcon className="w-5 h-5" />
                  </div>
                  <input
                    id="device-serial-number"
                    type="text"
                    required
                    value={newDevice.serialNumber}
                    onChange={(e) =>
                      setNewDevice({
                        ...newDevice,
                        serialNumber: normalizeDeviceSerialInput(e.target.value),
                      })
                    }
                    minLength={DEVICE_SERIAL_TOTAL_LENGTH}
                    maxLength={DEVICE_SERIAL_TOTAL_LENGTH}
                    pattern={DEVICE_SERIAL_PATTERN.source}
                    title="กรอกหมายเลขอุปกรณ์จากฮาร์ดแวร์ให้ครบถ้วน"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-4 focus:ring-green-500/10 focus:border-green-500 outline-none transition-all duration-150 font-mono tracking-wider text-sm"
                    placeholder="ESP32-XXXXXXXXXXXX"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg font-medium transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || !isSerialNumberValid}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-all shadow-none active:scale-[0.98] cursor-pointer"
                >
                  {createMutation.isPending ? "กำลังลงทะเบียน..." : "ลงทะเบียนอุปกรณ์"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedDevice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 print:p-0 print:bg-white print:static print:block transition-all duration-300">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-sm text-center shadow-lg border border-gray-200 dark:border-gray-700 relative overflow-hidden print:shadow-none print:w-full print:max-w-none print:p-0">
            <div className="print-content">
              <div className="flex items-center justify-center gap-2 mb-3 mt-1 print:mb-6">
                <QrCodeIcon className="w-6 h-6 text-green-600 dark:text-green-400 print:hidden" />
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 print:text-2xl">
                  ตัวอย่างป้าย QR Code
                </h2>
              </div>
              <p className="text-gray-500 dark:text-gray-400 mb-5 text-xs print:hidden">
                สแกนรหัสนี้ด้วยมือถือเพื่อผูกอุปกรณ์ หรือสั่งพิมพ์ป้ายคู่กับตัวเครื่อง
              </p>

              <div className="flex justify-center mb-5 p-4 bg-white rounded-lg border border-gray-200/80 shadow-none print:border-gray-300 print:bg-white">
                <QRCodeSVG value={selectedDevice.deviceCode} size={180} level="H" />
              </div>

              {/* ข้อมูลการลงทะเบียนอุปกรณ์แบบย่อ (Device Registration Details) */}
              <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-lg mb-5 border border-gray-200/80 dark:border-gray-700 text-center print:bg-transparent print:border-2 print:border-gray-300">
                <div className="mb-2.5">
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest font-semibold">
                    รหัสสำหรับจับคู่ (Device Code)
                  </p>
                  <p className="font-mono text-xl font-extrabold text-gray-900 dark:text-gray-100 tracking-wider mt-0.5">
                    {selectedDevice.deviceCode}
                  </p>
                </div>
                <div className="border-t border-gray-200/60 dark:border-gray-700/60 pt-2.5 mt-2">
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest font-semibold">
                    หมายเลขซีเรียล (Serial Number)
                  </p>
                  <p className="font-mono text-xs font-semibold text-gray-600 dark:text-gray-300 mt-0.5">
                    {selectedDevice.serialNumber}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 print:hidden">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 flex items-center justify-center gap-2 shadow-none active:scale-[0.98] transition-all duration-150 cursor-pointer"
              >
                <PrinterIcon className="w-4.5 h-4.5" />
                <span>พิมพ์ป้าย</span>
              </button>
              <button
                onClick={() => setSelectedDevice(null)}
                className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-600 font-semibold transition-colors cursor-pointer"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 transition-all duration-300">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-sm shadow-lg border border-gray-200 dark:border-gray-700 relative overflow-hidden">
            <div className="flex items-center gap-2 mb-4 mt-1">
              <TrashIcon className="w-6 h-6 text-rose-600 dark:text-rose-400" />
              <h2 className="text-xl font-bold text-rose-600 dark:text-rose-400">ลบอุปกรณ์?</h2>
            </div>
            <p className="text-gray-600 dark:text-gray-300 mb-6 text-sm leading-relaxed">
              คุณแน่ใจหรือไม่ว่าต้องการลบอุปกรณ์นี้?
              การกระทำนี้ไม่สามารถย้อนกลับได้และจะลบข้อมูลอุปกรณ์ทั้งหมดอย่างถาวร
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg font-medium transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-all shadow-none active:scale-[0.98] cursor-pointer"
              >
                {deleteMutation.isPending ? "กำลังลบ..." : "ลบอุปกรณ์"}
              </button>
            </div>
          </div>
        </div>
      )}

      {unpairId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 transition-all duration-300">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-sm shadow-lg border border-gray-200 dark:border-gray-700 relative overflow-hidden">
            <div className="flex items-center gap-2 mb-4 mt-1">
              <LinkSlashIcon className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              <h2 className="text-xl font-bold text-amber-600 dark:text-amber-400">
                ยกเลิกการผูกอุปกรณ์?
              </h2>
            </div>
            <p className="text-gray-600 dark:text-gray-300 mb-6 text-sm leading-relaxed">
              คุณแน่ใจหรือไม่ว่าต้องการยกเลิกการผูกอุปกรณ์นี้?
              การกระทำนี้จะยกเลิกการเชื่อมต่อกับผู้สูงอายุปัจจุบันและรีเซ็ตสถานะการผูก
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setUnpairId(null)}
                className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg font-medium transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleUnpair}
                disabled={unpairMutation.isPending}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700 disabled:opacity-50 transition-all shadow-none active:scale-[0.98] cursor-pointer"
              >
                {unpairMutation.isPending ? "กำลังยกเลิก..." : "ยกเลิกการผูก"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ป้ายพิมพ์: render ไว้เสมอเมื่อ selectedDevice เปิดอยู่ ซ่อนบนหน้าจอ แสดงเฉพาะตอน print */}
      {selectedDevice && <DeviceLabelSheet device={selectedDevice} />}
    </>
  );
}
