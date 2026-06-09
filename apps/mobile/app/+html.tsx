/**
 * Web HTML Root
 *
 * ไฟล์นี้ใช้เฉพาะตอนรันแอปบน Web
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - กำหนดโครงสร้าง HTML หลักของเว็บ
 * - ตั้งค่า meta พื้นฐานสำหรับ browser
 * - reset style ของ ScrollView ให้ทำงานถูกต้องบนเว็บ
 */

import { ScrollViewStyleReset } from 'expo-router/html';

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/* reset style เพื่อให้ ScrollView ของ React Native แสดงผลถูกบน Web */}
        <ScrollViewStyleReset />
      </head>

      <body>{children}</body>
    </html>
  );
}
