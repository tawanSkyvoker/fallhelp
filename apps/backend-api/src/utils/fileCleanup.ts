/**
 * fileCleanup.ts
 *
 * Utility สำหรับลบไฟล์รูปโปรไฟล์เก่าจาก disk
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - แยกชื่อไฟล์จาก URL หรือ path ของรูปโปรไฟล์
 * - ป้องกัน path traversal ก่อนลบไฟล์
 * - ลบไฟล์เก่าจาก uploads/profiles
 * - log warning เมื่อ cleanup ล้มเหลว โดยไม่ทำให้ flow หลักพัง
 */

import path from 'path';
import fs from 'fs';

import logger from './logger';

const uploadsDir = path.join(__dirname, '../../uploads/profiles');

export function extractFilenameFromUrl(url: string): string | null {
  try {
    const urlPath = new URL(url).pathname;
    const filename = path.basename(urlPath);

    return filename || null;
  } catch {
    // ถ้า URL parsing ไม่ผ่าน ให้ fallback ไปแยกจาก path string ตรง ๆ
    const parts = url.split('/');
    const filename = parts[parts.length - 1];

    return filename || null;
  }
}

export async function deleteOldProfileImage(imageUrl: string | null | undefined): Promise<void> {
  if (!imageUrl) return;

  const filename = extractFilenameFromUrl(imageUrl);

  if (!filename) return;

  // ใช้ basename เพื่อป้องกัน path traversal จากชื่อไฟล์ที่ไม่คาดคิด
  const sanitizedFilename = path.basename(filename);

  /* istanbul ignore next — defensive guard: extractFilenameFromUrl never returns path-separated filenames */
  if (sanitizedFilename !== filename) {
    logger.warn('Suspicious filename in cleanup', { filename });
    return;
  }

  const filePath = path.join(uploadsDir, sanitizedFilename);

  const resolvedPath = path.resolve(filePath);
  const resolvedUploadsDir = path.resolve(uploadsDir);

  /* istanbul ignore next — defensive guard: path.basename already strips traversal sequences */
  if (!resolvedPath.startsWith(resolvedUploadsDir)) {
    logger.warn('Path traversal attempt in cleanup', { filename });
    return;
  }

  try {
    if (fs.existsSync(resolvedPath)) {
      await fs.promises.unlink(resolvedPath);
      logger.info('Deleted old profile image', { filename });
    }
  } catch (error) {
    // ลบรูปเก่าเป็น side effect รอง จึง log warning แต่ไม่ throw ให้ update profile ล้ม
    logger.warn('Failed to delete old profile image', { filename, error });
  }
}
