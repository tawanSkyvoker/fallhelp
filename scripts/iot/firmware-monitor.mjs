#!/usr/bin/env node

// ตัวช่วยเปิด firmware serial monitor ของโปรเจกต์ผ่าน `arduino-cli monitor`
// ใช้เพื่อดู serial output จาก ESP32 โดยลดขั้นตอนการจำพอร์ตและ baud rate เอง

import { spawn } from "node:child_process";
import {
  getDefaultSerialPort,
  resolveArduinoCliBinary,
} from "./firmware-shared.mjs";

const args = process.argv.slice(2);
const firstArg = args[0];
const hasExplicitPort = firstArg && !firstArg.startsWith("-");
const arduinoCli = resolveArduinoCliBinary();
const port = hasExplicitPort
  ? firstArg
  : getDefaultSerialPort({ env: process.env, arduinoCli });
const extraArgs = hasExplicitPort ? args.slice(1) : args;

const commandArgs = ["monitor", "-p", port, "-c", "115200", ...extraArgs];

const child = spawn(arduinoCli, commandArgs, {
  stdio: "inherit",
});

process.on("SIGINT", () => {
  child.kill("SIGTERM");
  process.exit(0);
});

child.on("error", (error) => {
  if (error.code === "ENOENT") {
    console.error(`[monitor] arduino-cli not found: ${arduinoCli}`);
    console.error("[monitor] install arduino-cli or set ARDUINO_CLI to the correct binary path, then run again.");
    process.exit(1);
  }
  console.error(`[monitor] failed: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
