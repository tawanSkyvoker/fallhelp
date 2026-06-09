#!/usr/bin/env node

// orchestration entry สำหรับ `dev:all` และชุด dev ย่อยของ repo
// ตรวจ scope ที่ต้องใช้ก่อน แล้วค่อยส่งต่อไปยัง launcher หลักเพื่อไม่ให้ dev server ล้มกลางทาง

import { resolveScriptPath, runProcessOrExit } from "../lib/process-helpers.mjs";

const args = process.argv.slice(2);
const allowedArgs = new Set(["--no-admin", "--no-mobile"]);

for (const arg of args) {
  if (!allowedArgs.has(arg)) {
    console.error(`Unknown option: ${arg}`);
    console.error("Usage: node scripts/dev/run-dev-suite.mjs [--no-admin] [--no-mobile]");
    process.exit(1);
  }
}

const scopes = ["backend"];
if (!args.includes("--no-mobile")) {
  scopes.push("mobile");
}
if (!args.includes("--no-admin")) {
  scopes.push("admin");
}

const platformArgs = [resolveScriptPath("dev/platform-install.mjs"), "check", ...scopes];
runProcessOrExit(`[run-dev] verifying ${scopes.join(", ")}`, process.execPath, platformArgs);

const devAllArgs = [resolveScriptPath("dev/dev-all.mjs"), ...args];
runProcessOrExit("[run-dev] starting dev suite", process.execPath, devAllArgs);
