#!/usr/bin/env node

// ตัวช่วย launch Node-RED สำหรับ Fall Detection Sensor Lab แบบ host fallback
// sync source flow เข้า runtime userDir เพื่อให้พฤติกรรมใกล้ Docker path

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const isWindows = process.platform === "win32";

function pullOption(argv, name) {
  const idx = argv.findIndex((arg) => arg === name || arg.startsWith(`${name}=`));
  if (idx < 0) return { value: null, rest: argv };

  const current = argv[idx];
  if (current.startsWith(`${name}=`)) {
    const value = current.slice(name.length + 1).trim();
    const rest = argv.slice(0, idx).concat(argv.slice(idx + 1));
    return { value: value || null, rest };
  }

  const next = argv[idx + 1];
  const hasNext = typeof next === "string" && !next.startsWith("-");
  const value = hasNext ? next : null;
  const removeCount = hasNext ? 2 : 1;
  const rest = argv.slice(0, idx).concat(argv.slice(idx + removeCount));
  return { value, rest };
}

// ตรวจว่าผู้ใช้ส่ง userDir มาเองแล้วหรือไม่ เพื่อไม่ไป override ค่า CLI ที่ตั้งใจใช้
function hasUserDirArg(argv) {
  return argv.some(
    (arg) => arg === "--userDir" || arg === "-u" || arg.startsWith("--userDir=") || arg.startsWith("-u="),
  );
}

// ทำ path ให้ Node-RED ใช้ใน env ได้เสถียรทั้ง Windows และ Unix
function normalizeDirForEnv(dirPath) {
  return dirPath.replace(/\\/g, "/").replace(/\/+$/, "") + "/";
}

// ค้นหา entry ของ Node-RED จาก candidate หลักตามวิธีติดตั้งที่ทีมใช้บ่อย
function resolveNodeRedEntry() {
  const candidates = [];
  const appData = process.env.APPDATA;
  const npmPrefix = process.env.NPM_CONFIG_PREFIX;

  candidates.push(path.join(ROOT, "node_modules", "node-red", "red.js"));

  if (appData) {
    candidates.push(path.join(appData, "npm", "node_modules", "node-red", "red.js"));
  }

  if (npmPrefix) {
    candidates.push(path.join(npmPrefix, "node_modules", "node-red", "red.js"));
  }

  if (isWindows && process.env.USERPROFILE) {
    candidates.push(path.join(process.env.USERPROFILE, "AppData", "Roaming", "npm", "node_modules", "node-red", "red.js"));
  }

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

const labDirOption = pullOption(args, "--lab-dir");
const cliArgs = labDirOption.rest;

const defaultLabDir = path.join(ROOT, "firmware", "esp32", "fall_detection_sensor_lab");
const labDir = path.resolve(labDirOption.value || process.env.FALLHELP_SENSOR_LAB_DIR || defaultLabDir);
const runtimeDir = path.join(labDir, "node-red", "runtime");
const sourceFlow = path.join(labDir, "node-red", "flows", "fall-detection-sensor-lab-flow.v2.json");
const runtimeFlow = path.join(runtimeDir, "flows.json");
const runsDir = path.join(labDir, "runs");
const nodeRedEntry = resolveNodeRedEntry();

if (!nodeRedEntry) {
  console.error("[node-red] Node-RED is not installed.");
  console.error("[node-red] Run `npm install` at the root first.");
  console.error("[node-red] Then run `node scripts/iot/node-red-launch.mjs` again.");
  process.exit(1);
}

fs.mkdirSync(runtimeDir, { recursive: true });
fs.mkdirSync(runsDir, { recursive: true });

if (fs.existsSync(sourceFlow) && !fs.existsSync(runtimeFlow)) {
  fs.copyFileSync(sourceFlow, runtimeFlow);
  console.log(`[node-red] Initialised runtime flow: ${path.relative(ROOT, runtimeFlow)}`);
}

const launchArgs = [nodeRedEntry];
if (!hasUserDirArg(cliArgs)) {
  launchArgs.push("--userDir", runtimeDir);
}
launchArgs.push(...cliArgs);

const child = spawn(process.execPath, launchArgs, {
  stdio: "inherit",
  env: {
    ...process.env,
    FALLHELP_SENSOR_LAB_DIR: normalizeDirForEnv(labDir),
    SENSOR_LAB_RUNS_DIR: process.env.SENSOR_LAB_RUNS_DIR || normalizeDirForEnv(runsDir).replace(/\/$/, ""),
  },
});

child.on("error", (error) => {
  console.error(`[node-red] Failed to start Node-RED: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
