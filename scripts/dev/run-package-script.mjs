#!/usr/bin/env node

// ตัวกลางรัน npm script ตาม scope ของแพ็กเกจ พร้อม preflight profile ที่เกี่ยวข้อง
// ใช้ลดการเขียนคำสั่งซ้ำระหว่าง backend/mobile/admin และทำให้ error path เหมือนกัน

import { resolveScriptPath, runNpmOrExit, runProcessOrExit } from "../lib/process-helpers.mjs";

const SCOPE_PREFIXES = {
  backend: "apps/backend-api",
  mobile: "apps/mobile",
  admin: "apps/admin",
};

const args = process.argv.slice(2);
const scopeName = args[0];
const scriptName = args[1];
const optionArgs = args.slice(2);

function pullOption(argv, name) {
  const idx = argv.findIndex((arg) => arg === name || arg.startsWith(`${name}=`));
  if (idx < 0) return { value: null, rest: argv };

  const current = argv[idx];
  if (current.startsWith(`${name}=`)) {
    const value = current.slice(name.length + 1).trim();
    return {
      value: value || null,
      rest: argv.slice(0, idx).concat(argv.slice(idx + 1)),
    };
  }

  const next = argv[idx + 1];
  const hasNext = typeof next === "string" && !next.startsWith("-");
  const value = hasNext ? next : null;
  const removeCount = hasNext ? 2 : 1;
  return {
    value,
    rest: argv.slice(0, idx).concat(argv.slice(idx + removeCount)),
  };
}

if (!scopeName || !scriptName) {
  console.error(
    "Usage: node scripts/dev/run-package-script.mjs <backend|mobile|admin> <script> [--profile=<name>] [-- <extra args>]",
  );
  process.exit(1);
}

// แยก `--profile` ออกจากอาร์กิวเมนต์อื่น เพื่อให้ส่งต่อ extra args ไป npm script ได้ตรงรูปแบบเดิม
const separatorIndex = optionArgs.indexOf("--");
const preArgs = separatorIndex >= 0 ? optionArgs.slice(0, separatorIndex) : optionArgs;
const extraArgs = separatorIndex >= 0 ? optionArgs.slice(separatorIndex + 1) : [];
const profileOption = pullOption(preArgs, "--profile");
const profile = profileOption.value;

if (profileOption.rest.length > 0) {
  console.error(`Unknown option(s): ${profileOption.rest.join(" ")}`);
  process.exit(1);
}

const platformArgs = [resolveScriptPath("dev/platform-install.mjs"), "check", scopeName];
if (profile) {
  platformArgs.push(`--profile=${profile}`);
}

// รัน preflight ก่อนทุกครั้ง เพื่อกัน command ที่ต้องพึ่ง native package ล้มแบบอธิบายยาก
runProcessOrExit(`[run-package] verifying ${scopeName}`, process.execPath, platformArgs);

const targetPrefix = SCOPE_PREFIXES[scopeName];
if (!targetPrefix) {
  console.error(`Unknown scope: ${scopeName}`);
  process.exit(1);
}

const npmArgs = ["run", scriptName, "--prefix", targetPrefix];
if (extraArgs.length > 0) {
  npmArgs.push("--", ...extraArgs);
}

runNpmOrExit(`[run-package] running ${scopeName}:${scriptName}`, npmArgs);
