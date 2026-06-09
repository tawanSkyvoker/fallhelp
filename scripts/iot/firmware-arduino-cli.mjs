#!/usr/bin/env node

// helper กลางสำหรับ compile/upload firmware ผ่าน arduino-cli
// ลดการจำ path sketch, FQBN และพอร์ตเอง โดยยังเปิดทางให้ override ผ่าน env หรือ extra args

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  REQUIRED_LIBRARIES,
  getDefaultSerialPort,
  resolveArduinoCliBinary,
} from "./firmware-shared.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..", "..");
const ARDUINO_CLI = resolveArduinoCliBinary();

const VARIANTS = {
  main: {
    name: "main_firmware",
    sketchDir: path.join(ROOT, "firmware", "esp32", "src", "main_firmware"),
    fqbn: "esp32:esp32:esp32:PartitionScheme=huge_app",
  },
  main_firmware: {
    name: "main_firmware",
    sketchDir: path.join(ROOT, "firmware", "esp32", "src", "main_firmware"),
    fqbn: "esp32:esp32:esp32:PartitionScheme=huge_app",
  },
  tuning: {
    name: "sensor_tuning",
    sketchDir: path.join(ROOT, "firmware", "esp32", "src", "sensor_tuning"),
    fqbn: "esp32:esp32:esp32",
  },
  sensor_tuning: {
    name: "sensor_tuning",
    sketchDir: path.join(ROOT, "firmware", "esp32", "src", "sensor_tuning"),
    fqbn: "esp32:esp32:esp32",
  },
};

const args = process.argv.slice(2);
const command = args[0];
const variantKey = args[1] || "main";
const variant = VARIANTS[variantKey];

function printUsage() {
  console.log(`firmware-arduino-cli

Usage:
  node scripts/iot/firmware-arduino-cli.mjs deps
  node scripts/iot/firmware-arduino-cli.mjs compile [main|tuning] [-- <extra args>]
  node scripts/iot/firmware-arduino-cli.mjs upload [main|tuning] [-- <extra args>]

Environment:
  ARDUINO_CLI    Override arduino-cli binary path
  FIRMWARE_PORT   Override serial port (default: first detected board, else /dev/ttyUSB0 or COM3)
  FIRMWARE_FQBN   Override board FQBN for compile/upload
`);
}

if (!command || command === "--help" || command === "-h") {
  printUsage();
  process.exit(0);
}

if (command !== "deps" && command !== "compile" && command !== "upload") {
  console.error(`[firmware] unknown command: ${command}`);
  printUsage();
  process.exit(1);
}

if (command !== "deps" && !variant) {
  console.error(`[firmware] unknown variant: ${variantKey}`);
  printUsage();
  process.exit(1);
}

const separatorIndex = args.indexOf("--");
const extraArgs = separatorIndex >= 0 ? args.slice(separatorIndex + 1) : args.slice(2);
const port = getDefaultSerialPort({ env: process.env, arduinoCli: ARDUINO_CLI, cwd: ROOT });
const fqbn = process.env.FIRMWARE_FQBN || variant.fqbn;

const commandArgs =
  command === "deps"
    ? ["lib", "install", ...REQUIRED_LIBRARIES, ...extraArgs]
    : command === "compile"
    ? ["compile", "--fqbn", fqbn, variant.sketchDir, ...extraArgs]
    : ["upload", "-p", port, "--fqbn", fqbn, variant.sketchDir, ...extraArgs];

if (command === "deps") {
  console.log("[firmware] install required Arduino libraries");
  console.log(`[firmware] libraries: ${REQUIRED_LIBRARIES.join(", ")}`);
} else {
  console.log(`[firmware] ${command} ${variant.name}`);
  console.log(`[firmware] fqbn: ${fqbn}`);
}
if (command === "upload") {
  console.log(`[firmware] port: ${port}`);
}

const child = spawn(ARDUINO_CLI, commandArgs, {
  cwd: ROOT,
  stdio: "inherit",
});

process.on("SIGINT", () => {
  child.kill("SIGTERM");
  process.exit(0);
});

child.on("error", (error) => {
  if (error.code === "ENOENT") {
    console.error(`[firmware] arduino-cli not found: ${ARDUINO_CLI}`);
    console.error("[firmware] install arduino-cli or set ARDUINO_CLI to the correct binary path, then run again.");
    process.exit(1);
  }

  console.error(`[firmware] failed: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
