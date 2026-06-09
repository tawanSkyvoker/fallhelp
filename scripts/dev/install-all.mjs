#!/usr/bin/env node

// install-all.mjs — ติดตั้ง dependencies ของ root และแต่ละแอปย่อยตามลำดับเดียวกันทุกครั้ง
// ─────────────────────────────────────────────────────────────────────────────
// script นี้รวมขั้นตอน install ไว้จุดเดียวเพื่อลดการลืมลง package ของบาง workspace
// และปิดท้ายด้วย platform:check เพื่อจับแพ็กเกจ native ที่ไม่ครบก่อนเริ่มพัฒนา

import { runNpmOrExit } from "../lib/process-helpers.mjs";

runNpmOrExit("[install:all] installing all workspace dependencies", ["install"]);

runNpmOrExit("[install:all] verifying platform-specific native packages", [
  "run",
  "platform:check",
]);
