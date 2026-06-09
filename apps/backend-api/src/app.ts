/**
 * app.ts
 *
 * Express app กลางของ backend
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - โหลด environment variables ก่อนประกอบแอป
 * - ตั้งค่า middleware หลัก เช่น CORS, body parser และ rate limit
 * - mount REST routes, internal health route และ static uploads
 * - วาง not found และ global error handler ไว้ท้ายสุด
 */

import dotenv from 'dotenv';
dotenv.config();

import express, { Express } from 'express';
import cors from 'cors';
import path from 'node:path';

import routes from './routes';
import healthRoutes from './routes/internal/healthRoutes';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { apiLimiter } from './middlewares/rateLimit';
import { isAllowedClientOrigin } from './config/origin';

const app: Express = express();

// เชื่อใจ reverse proxy เช่น Cloudflare/nginx เพื่ออ่าน IP จริงและใช้กับ rate limit ได้แม่นขึ้น
app.set('trust proxy', 1);

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedClientOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }),
);

// เปิดรับ JSON และ form body สำหรับ endpoint ทั่วไปของระบบ
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// จำกัด request ทุก endpoint ใต้ /api เพื่อลดการยิงถี่ผิดปกติ
app.use('/api', apiLimiter);

// REST API หลักทั้งหมดของ backend
// ไฟล์ถัดไป: routes/index.ts
app.use('/api', routes);

// health endpoint ภายในสำหรับ monitor สถานะ backend
// ไฟล์ถัดไป: routes/internal/healthRoutes.ts
app.use('/internal/health', healthRoutes);

// ให้ client โหลดไฟล์ที่อัปโหลดไว้ เช่น รูปโปรไฟล์
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ต้องวางท้ายสุด เพื่อให้ request ผ่าน routes ก่อนแล้วค่อยเข้าสู่ error handler
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
