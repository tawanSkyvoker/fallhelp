#!/usr/bin/env node
/**
 * ตัว launcher กลางสำหรับเปิด backend, mobile และ admin พร้อมกัน
 * โฟกัสหลักคือจัดการ child process ข้าม platform และปิดทั้งชุดให้สะอาดเมื่อผู้ใช้กด Ctrl+C
 *
 * Usage:
 *   node scripts/dev/dev-all.mjs              # all three
 *   node scripts/dev/dev-all.mjs --no-admin   # backend + mobile only
 *   node scripts/dev/dev-all.mjs --no-mobile  # backend + admin only
 */

import { spawn } from "child_process";
import net from "net";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { getNpmInvocation } from "../lib/process-helpers.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");

const args = process.argv.slice(2);
const skipAdmin = args.includes("--no-admin");
const skipMobile = args.includes("--no-mobile");

// ─── Color helpers (ANSI) ───────────────────────────────────────
const COLORS = {
  API: "\x1b[32m", // สีเขียวสำหรับ backend API
  Mobile: "\x1b[34m", // สีน้ำเงินสำหรับ mobile dev server
  Admin: "\x1b[35m", // สีชมพูอมม่วงสำหรับ admin dev server
  reset: "\x1b[0m",
};

function prefix(name) {
  return `${COLORS[name] || ""}[${name}]${COLORS.reset}`;
}

// ─── Service definitions ────────────────────────────────────────
const services = [];

function createNpmService(name, npmArgs, cwd) {
  const invocation = getNpmInvocation(npmArgs, { cwd });

  return {
    name,
    cmd: invocation.command,
    args: invocation.args,
    cwd: invocation.cwd ?? cwd,
  };
}

// backend ใช้ tsx watch + DEBUG namespace เพื่อให้ log ฝั่ง server อ่าน trace ได้ง่าย
services.push(createNpmService("API", ["run", "debug", "--prefix", "apps/backend-api"], ROOT));

if (!skipMobile) {
  services.push(createNpmService("Mobile", ["run", "start"], resolve(ROOT, "apps/mobile")));
}

if (!skipAdmin) {
  services.push(createNpmService("Admin", ["run", "dev", "--prefix", "apps/admin"], ROOT));
}

const requiredPorts = [
  { name: "API", port: 3000 },
  { name: "Mobile", port: 8081 },
];

// ─── Process management ─────────────────────────────────────────
const children = [];
let isShuttingDown = false;

function getChildEnv() {
  const env = { ...process.env };

  if (process.platform === "linux") {
    const tempValues = [env.TMPDIR, env.TMP, env.TEMP].filter(Boolean);
    const usesWindowsMountTemp = tempValues.some((value) =>
      value.replace(/\\/g, "/").startsWith("/mnt/c/"),
    );

    if (usesWindowsMountTemp) {
      // tsx ใช้ temp dir ทำ IPC pipe; บน WSL ห้ามปล่อยให้ไปอยู่ใต้ /mnt/c เพราะ bind socket ไม่รองรับ
      env.TMPDIR = "/tmp";
      env.TMP = "/tmp";
      env.TEMP = "/tmp";
    }
  }

  return env;
}

function isPortAvailable(port) {
  return new Promise((resolvePromise) => {
    const server = net.createServer();

    server.once("error", () => {
      resolvePromise(false);
    });

    server.once("listening", () => {
      server.close(() => resolvePromise(true));
    });

    server.listen(port, "127.0.0.1");
  });
}

function killAll() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log("\n⏹️  Shutting down all services...");

  for (const { proc, name } of children) {
    if (proc.exitCode !== null) continue; // ข้าม process ที่ปิดไปแล้ว

    try {
      if (process.platform === "win32") {
        // Windows ต้องใช้ taskkill /T เพื่อเก็บลูกหลาน process ให้หมดทั้ง tree
        spawn("taskkill", ["/pid", String(proc.pid), "/T", "/F"], {
          stdio: "ignore",
          windowsHide: true,
        });
      } else {
        // Unix ใช้ process group ที่สร้างตอน spawn เพื่อปิดทั้งชุดในครั้งเดียว
        process.kill(-proc.pid, "SIGKILL");
      }
      console.log(`  ✗ ${name} killed (pid ${proc.pid})`);
    } catch {
      // บาง process อาจปิดไปก่อนแล้ว ไม่ต้องถือว่าเป็น error
    }
  }

  // เผื่อเวลาให้ taskkill หรือ signal ฝั่ง OS ปิด process tree ให้ครบก่อนออกจากตัว launcher
  setTimeout(() => {
    process.exit(0);
  }, 800);
}

// ─── Spawn services ─────────────────────────────────────────────
for (const target of requiredPorts) {
  // ตรวจพอร์ตสำคัญก่อน เพื่อไม่ให้ Expo/Vite ล้มแบบครึ่งๆ กลางๆ ตอนรันหลาย service พร้อมกัน
  if (!(await isPortAvailable(target.port))) {
    console.error(
      `\n[preflight] ${target.name} port ${target.port} is already in use.`,
    );
    console.error(
      `[preflight] Stop the existing process first or run \`npm run dev:stop\` before \`npm run dev:all\`.`,
    );
    process.exit(1);
  }
}

for (const svc of services) {
  const proc = spawn(svc.cmd, svc.args, {
    cwd: svc.cwd,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: false,
    detached: process.platform !== "win32", // Unix สร้าง process group ใหม่ไว้ใช้ตอน kill ทั้งชุด
    shell: false,
    env: getChildEnv(),
  });

  children.push({ proc, name: svc.name });

  const tag = prefix(svc.name);

  proc.stdout.on("data", (data) => {
    const lines = data.toString().split("\n");
    for (const line of lines) {
      if (line.trim()) console.log(`${tag} ${line}`);
    }
  });

  proc.stderr.on("data", (data) => {
    const lines = data.toString().split("\n");
    for (const line of lines) {
      if (line.trim()) console.log(`${tag} ${line}`);
    }
  });

  proc.on("exit", (code) => {
    console.log(`${tag} exited (code ${code})`);
    // ถ้าตัวใดตัวหนึ่งล้ม ให้ปิดที่เหลือด้วยเพื่อกัน dev suite อยู่ในสถานะครึ่งทำงานครึ่งพัง
    if (!isShuttingDown && code !== 0) {
      console.log(`${tag} crashed — stopping all services...`);
      killAll();
    }
  });

  console.log(`${tag} started (pid ${proc.pid})`);
}

// ─── Signal handlers ────────────────────────────────────────────
process.on("SIGINT", killAll);
process.on("SIGTERM", killAll);

// Windows มักส่ง SIGINT จาก npm script ไม่เสถียร จึงต้องมี fallback เพิ่ม
if (process.platform === "win32") {
  // readline ช่วยจับ Ctrl+C ได้ผ่าน close event เมื่อ SIGINT จาก npm ไม่มาครบ
  const readline = await import("readline");
  const rl = readline.createInterface({ input: process.stdin });
  rl.on("close", killAll);
  // เสริม raw stdin อีกชั้นเพื่อให้ stop dev suite ได้แม้ terminal บางตัว handle signal แปลก
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", (key) => {
      // Ctrl+C = \x03
      if (key[0] === 0x03) {
        killAll();
      }
    });
  }
}

console.log(
  `\n🚀 ${services.map((s) => s.name).join(" + ")} running. Press Ctrl+C to stop.\n`,
);
