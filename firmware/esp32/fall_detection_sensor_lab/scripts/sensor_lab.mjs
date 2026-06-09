#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

/**
 * ตัวรันคำสั่ง (CLI Entrypoint) หลักสำหรับ Fall Detection Sensor Lab
 *
 * สคริปต์นี้เป็นตัวกลาง (Wrapper) ในการเรียกใช้ฟังก์ชันย่อยต่างๆ ของ Lab:
 * - validate: ตรวจสอบความสมบูรณ์ของไฟล์ CSV
 * - summarize: สรุปผลจากไฟล์ CSV หลายไฟล์
 * - chapters: สร้างเอกสาร Markdown บทที่ 3 และ 5
 * - node-red: จัดการ Docker Container ของ Node-RED
 * - test: รันเทสต์ตรวจสอบระบบ
 */

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..", "..");
const LAB_ROOT = path.resolve(import.meta.dirname, "..");
const RUNTIME_DIR = path.join(LAB_ROOT, "node-red", "runtime");
const RAW_DIR = path.join(LAB_ROOT, "runs", "S01", "raw");
const SELECTED_DIR = path.join(LAB_ROOT, "runs", "S01", "selected");
const EXPORTS_DIR = path.join(LAB_ROOT, "exports");
const SELECTED_TABLE = path.join(EXPORTS_DIR, "selected_values_table.csv");
const SOURCE_FLOW = path.join(LAB_ROOT, "node-red", "flows", "fall-detection-sensor-lab-flow.v2.json");
const RUNTIME_FLOW = path.join(LAB_ROOT, "node-red", "runtime", "flows.json");
const ENV_FILE = path.join(REPO_ROOT, "apps", "backend-api", ".env");

// แมปปิ้งชื่อคำสั่ง (CLI commands) ไปยังฟังก์ชันที่ต้องเรียกใช้
const COMMANDS = new Map([
  ["validate", () => runNode("validate_sensor_lab_log.mjs", [arg(1) || RAW_DIR])],
  ["summarize", () => runNode("summarize_selected.mjs", [arg(1) || SELECTED_DIR, arg(2) || SELECTED_TABLE])],
  ["chapters", () => runNode("generate_chapter_examples.mjs", [arg(1) || SELECTED_TABLE, arg(2) || EXPORTS_DIR])],
  ["all", runAll],
  ["test", () => runNode(path.join("..", "tests", "run_all.mjs"), [])],
  ["node-red", runNodeRed],
  ["nr", runNodeRed],
  ["help", help],
  ["--help", help],
  ["-h", help],
]);

const args = process.argv.slice(2);
const command = args[0] || "help";
const handler = COMMANDS.get(command);

if (!handler) {
  console.error(`Unknown sensor-lab command: ${command}`);
  help(1);
} else {
  process.exit(handler() ?? 0);
}

function arg(index) {
  return args[index];
}

function runNode(scriptName, scriptArgs) {
  return run(process.execPath, [path.join(import.meta.dirname, scriptName), ...scriptArgs]);
}

// ฟังก์ชันรันคำสั่ง pipeline ทั้งหมดต่อเนื่องกัน (validate -> summarize -> chapters)
function runAll() {
  let code = runNode("validate_sensor_lab_log.mjs", [RAW_DIR]);
  if (code !== 0) return code;
  code = runNode("summarize_selected.mjs", [SELECTED_DIR, SELECTED_TABLE]);
  if (code !== 0) return code;
  return runNode("generate_chapter_examples.mjs", [SELECTED_TABLE, EXPORTS_DIR]);
}

// ฟังก์ชันจัดการคำสั่งที่เกี่ยวข้องกับ Node-RED และ Docker
function runNodeRed() {
  const action = arg(1) || "up";
  const rest = args.slice(2);

  if (action === "sync-flow") {
    syncFlow();
    return 0;
  }

  if (action === "clean") {
    cleanRuntime();
    return 0;
  }

  const base = composeBaseArgs();
  const actions = {
    build: ["build", "node-red"],
    up: ["up", "-d", "node-red"],
    down: ["down"],
    restart: ["restart", "node-red"],
    rebuild: ["up", "-d", "--build", "--force-recreate", "node-red"],
    logs: ["logs", "-f", "node-red"],
    ps: ["ps", "node-red"],
    config: ["config"],
  };

  const composeArgs = actions[action];
  if (!composeArgs) {
    console.error(`Unknown node-red action: ${action}`);
    nodeRedHelp(1);
    return 1;
  }

  return run("docker", [...base, ...composeArgs, ...rest]);
}

function composeBaseArgs() {
  const args = ["compose"];
  if (fs.existsSync(ENV_FILE)) {
    args.push("--env-file", ENV_FILE);
  }
  args.push("--profile", "lab");
  return args;
}

// ฟังก์ชันคัดลอกไฟล์ source json ของ Node-RED ไปยัง runtime volume ของ Docker
function syncFlow() {
  fs.mkdirSync(path.dirname(RUNTIME_FLOW), { recursive: true });
  fs.copyFileSync(SOURCE_FLOW, RUNTIME_FLOW);
  console.log(`Synced ${path.relative(REPO_ROOT, SOURCE_FLOW)}`);
  console.log(`  -> ${path.relative(REPO_ROOT, RUNTIME_FLOW)}`);
}

// ฟังก์ชันล้างข้อมูล (Clean) ภายใน runtime volume เพื่อให้ Node-RED เริ่มต้นแบบ Fresh Start
function cleanRuntime() {
  if (!fs.existsSync(RUNTIME_DIR)) {
    console.log(`Runtime dir does not exist: ${path.relative(REPO_ROOT, RUNTIME_DIR)}`);
    return;
  }
  const entries = fs.readdirSync(RUNTIME_DIR);
  if (entries.length === 0) {
    console.log("Runtime dir already clean.");
    return;
  }
  for (const entry of entries) {
    const full = path.join(RUNTIME_DIR, entry);
    fs.rmSync(full, { recursive: true, force: true });
  }
  console.log(`Cleaned ${entries.length} entries from ${path.relative(REPO_ROOT, RUNTIME_DIR)}/`);
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: REPO_ROOT,
    stdio: "inherit",
    shell: false,
  });
  if (result.error) {
    console.error(result.error.message);
    return 1;
  }
  return result.status ?? 1;
}

function help(exitCode = 0) {
  console.log(`Usage: npm run sensor-lab -- <command>

Commands:
  validate [raw_dir_or_csv]        Validate raw CSV files
  summarize [selected_dir] [out]   Build exports/selected_values_table.csv
  chapters [table_csv] [out_dir]   Build chapter markdown exports
  all                              Run validate -> summarize -> chapters
  test                             Run the full sensor-lab test pipeline
  node-red <action>                Manage Node-RED Docker/runtime

Node-RED actions:
  build       docker compose build node-red
  up          start node-red in the background
  down        stop and remove containers
  rebuild     build and force-recreate node-red
  restart     restart node-red
  logs        follow node-red logs
  ps          show node-red status
  config      render compose config
  sync-flow   copy source flow to node-red/runtime/flows.json
  clean       remove stale node-red/runtime/ files for a fresh start
`);
  process.exit(exitCode);
}

function nodeRedHelp(exitCode = 0) {
  console.log("Usage: npm run sensor-lab -- node-red <build|up|down|rebuild|restart|logs|ps|config|sync-flow|clean>");
  process.exit(exitCode);
}
