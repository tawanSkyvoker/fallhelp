#!/usr/bin/env node

// คัดลอกไฟล์ template env/secret ไปเป็นไฟล์ใช้งานจริงแบบปลอดภัย
// ใช้ตอนตั้งโปรเจกต์รอบแรกหรือ reset env โดยไม่เขียนทับไฟล์เดิมถ้าไม่ได้สั่ง `--force`

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const FORCE = process.argv.includes("--force");

const targets = [
  ["apps/backend-api/.env.example", "apps/backend-api/.env"],
  ["apps/mobile/.env.example", "apps/mobile/.env"],
  ["apps/admin/.env.example", "apps/admin/.env"],
  [
    "firmware/esp32/src/main_firmware/mqtt_secrets.h.example",
    "firmware/esp32/src/main_firmware/mqtt_secrets.h",
  ],
  [
    "firmware/esp32/src/sensor_tuning/wifi_secrets.h.example",
    "firmware/esp32/src/sensor_tuning/wifi_secrets.h",
  ],
];

let copied = 0;
let skipped = 0;
let missing = 0;
let linked = 0;

for (const [fromRel, toRel] of targets) {
  const from = path.join(ROOT, fromRel);
  const to = path.join(ROOT, toRel);

  if (!fs.existsSync(from)) {
    console.error(`[env:setup] missing template: ${fromRel}`);
    missing += 1;
    continue;
  }

  if (fs.existsSync(to) && !FORCE) {
    console.log(`[env:setup] skip existing: ${toRel}`);
    skipped += 1;
    continue;
  }

  fs.copyFileSync(from, to);
  console.log(`[env:setup] copied ${fromRel} -> ${toRel}`);
  copied += 1;
}

const rootEnv = path.join(ROOT, ".env");
const backendEnvRel = "apps/backend-api/.env";
const backendEnv = path.join(ROOT, backendEnvRel);

if (!fs.existsSync(backendEnv)) {
  console.error(
    `[env:setup] missing backend env for Docker Compose: ${backendEnvRel}`,
  );
  missing += 1;
} else if (fs.existsSync(rootEnv)) {
  const rootEnvStat = fs.lstatSync(rootEnv);
  const target = rootEnvStat.isSymbolicLink() ? fs.readlinkSync(rootEnv) : null;

  if (target === backendEnvRel) {
    console.log(`[env:setup] skip existing: .env -> ${backendEnvRel}`);
  } else {
    console.log("[env:setup] skip existing: .env");
    console.log(
      "[env:setup] note: docker compose reads root .env automatically",
    );
  }
  skipped += 1;
} else {
  try {
    fs.symlinkSync(backendEnvRel, rootEnv, "file");
    console.log(`[env:setup] linked .env -> ${backendEnvRel}`);
    linked += 1;
  } catch (error) {
    console.warn(
      `[env:setup] could not create root .env symlink: ${error.message}`,
    );
    console.warn(
      "[env:setup] fallback: run docker compose with --env-file apps/backend-api/.env",
    );
  }
}

console.log(
  `[env:setup] done (copied=${copied}, skipped=${skipped}, linked=${linked}, missing=${missing})`,
);
console.log(
  "[env:setup] note: firmware secret files are local-only and should not be committed",
);
process.exit(missing > 0 ? 1 : 0);
