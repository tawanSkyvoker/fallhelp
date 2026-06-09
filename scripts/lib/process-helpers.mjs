// helper กลางสำหรับสคริปต์ใน repo ที่ต้อง spawn process หรือรัน npm script
// แยก logic การเรียกคำสั่งตาม platform เพื่อให้สคริปต์ระดับบนสั้นและสม่ำเสมอ

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT = path.resolve(__dirname, "..", "..");

// คืนชื่อ executable ของ npm ตาม platform เพื่อให้การเรียกผ่าน script กลางไม่ต้องเดาเองทุกไฟล์
export function getNpmExecutable() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

// helper สำหรับ path แบบ UNC เช่น \\wsl.localhost\Ubuntu\... ที่ cmd.exe ใช้เป็น cwd ตรง ๆ ไม่ได้
export function isWindowsUncPath(targetPath) {
  if (process.platform !== "win32" || typeof targetPath !== "string") {
    return false;
  }

  const normalized = targetPath.replace(/\//g, "\\");
  return /^\\\\[^\\]/.test(normalized);
}

export function quoteForWindowsCmd(value) {
  if (!/[\s"&|<>^()]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
}

function getWindowsCmdFallbackCwd() {
  const systemRoot = process.env.SystemRoot;
  if (typeof systemRoot === "string" && systemRoot.length > 0) {
    const parsed = path.parse(systemRoot);
    return parsed.root || systemRoot;
  }

  return "C:\\";
}

// รวมการเรียก cmd.exe แบบรองรับ UNC path โดยใช้ pushd map ไปยัง temp drive อัตโนมัติเมื่อจำเป็น
export function getWindowsCmdInvocation(commandParts, cwd = ROOT) {
  const commandText = commandParts.map(quoteForWindowsCmd).join(" ");
  const uncSafePrefix = isWindowsUncPath(cwd)
    ? `pushd ${quoteForWindowsCmd(cwd)} && `
    : "";

  return {
    command: process.env.ComSpec || "cmd.exe",
    args: ["/d", "/s", "/c", `${uncSafePrefix}${commandText}`],
    cwd: isWindowsUncPath(cwd) ? getWindowsCmdFallbackCwd() : cwd,
  };
}

// resolve path ของ script กลางจาก repo root เพื่อให้ caller ไม่ต้องคำนวณ path ซ้ำ
export function resolveScriptPath(scriptName) {
  return path.resolve(ROOT, "scripts", scriptName);
}

// รวมรูปแบบการเรียก npm บน Windows/Unix ให้อยู่หลัง API เดียว
export function getNpmInvocation(args, options = {}) {
  const targetCwd = options.cwd ?? ROOT;

  if (process.platform === "win32") {
    return getWindowsCmdInvocation(["npm.cmd", ...args], targetCwd);
  }

  return {
    command: getNpmExecutable(),
    args,
    cwd: targetCwd,
  };
}

// รัน process แบบ sync แล้วโยน error runtime กลับให้ caller ตัดสินใจต่อ
export function runProcess(label, command, args, options = {}) {
  if (label) {
    console.log(label);
  }

  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    stdio: options.stdio ?? "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  return result.status ?? 1;
}

// helper สำหรับ command ที่ต้องหยุด flow ทันทีถ้า exit code ไม่ใช่ 0
export function runProcessOrExit(label, command, args, options = {}) {
  const exitCode = runProcess(label, command, args, options);
  if (exitCode !== 0) {
    process.exit(exitCode);
  }

  return exitCode;
}

export function runNpmOrExit(label, npmArgs, options = {}) {
  const invocation = getNpmInvocation(npmArgs, options);
  return runProcessOrExit(label, invocation.command, invocation.args, {
    ...options,
    cwd: invocation.cwd ?? options.cwd,
  });
}
