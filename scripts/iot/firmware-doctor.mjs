#!/usr/bin/env node

// ตรวจสภาพแวดล้อมขั้นต่ำสำหรับ workflow firmware บนเครื่องปัจจุบัน
// เน้นเช็กสิ่งที่พบบ่อยว่าเป็นสาเหตุของ compile/upload/monitor ไม่ผ่าน

import { accessSync, constants as fsConstants, existsSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  REQUIRED_CORE,
  REQUIRED_LIBRARIES,
  detectBoardPorts,
  getDefaultSerialPort,
  listUnixSerialCandidates,
  resolveArduinoCliBinary,
  runArduinoCli,
} from "./firmware-shared.mjs";

const arduinoCli = resolveArduinoCliBinary();
const effectivePort = getDefaultSerialPort({ env: process.env, arduinoCli });

let failures = 0;
let warnings = 0;

function printSection(title) {
  console.log(`\n[doctor] ${title}`);
}

function pass(message) {
  console.log(`  PASS  ${message}`);
}

function warn(message) {
  warnings += 1;
  console.log(`  WARN  ${message}`);
}

function fail(message) {
  failures += 1;
  console.log(`  FAIL  ${message}`);
}

function safeTrim(text) {
  return text ? text.trim() : "";
}

function getCurrentGroupNames() {
  const result = spawnSync("id", ["-nG"], {
    encoding: "utf8",
  });

  if (result.error || result.status !== 0) {
    return [];
  }

  return result.stdout
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

printSection("arduino-cli");
const versionResult = runArduinoCli(["version"]);
if (versionResult.error) {
  if (versionResult.error.code === "ENOENT") {
    fail(`arduino-cli not found at ${arduinoCli}`);
    console.log("        Install arduino-cli or set ARDUINO_CLI to the correct binary path.");
  } else {
    fail(`unable to execute arduino-cli: ${versionResult.error.message}`);
  }
} else if (versionResult.status !== 0) {
  fail(`arduino-cli version failed: ${safeTrim(versionResult.stderr) || safeTrim(versionResult.stdout)}`);
} else {
  pass(`binary: ${arduinoCli}`);
  pass(`version: ${safeTrim(versionResult.stdout)}`);
}

printSection("esp32 core");
const coreListResult = runArduinoCli(["core", "list"]);
if (coreListResult.error) {
  fail(`unable to query installed cores: ${coreListResult.error.message}`);
} else if (coreListResult.status !== 0) {
  fail(`arduino-cli core list failed: ${safeTrim(coreListResult.stderr) || safeTrim(coreListResult.stdout)}`);
} else {
  const coreLines = coreListResult.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const installedCoreLine = coreLines.find((line) => line.startsWith(`${REQUIRED_CORE} `));

  if (!installedCoreLine) {
    fail(`missing required core ${REQUIRED_CORE}`);
    console.log("        Install it with: ~/.local/bin/arduino-cli core install esp32:esp32");
  } else {
    pass(`installed: ${installedCoreLine}`);
  }
}

printSection("libraries");
const libListResult = runArduinoCli(["lib", "list"]);
if (libListResult.error) {
  fail(`unable to query installed libraries: ${libListResult.error.message}`);
} else if (libListResult.status !== 0) {
  fail(`arduino-cli lib list failed: ${safeTrim(libListResult.stderr) || safeTrim(libListResult.stdout)}`);
} else {
  const libOutput = libListResult.stdout;
  for (const library of REQUIRED_LIBRARIES) {
    if (libOutput.includes(library)) {
      pass(`${library} installed`);
    } else {
      fail(`${library} missing`);
    }
  }

  if (!REQUIRED_LIBRARIES.every((library) => libOutput.includes(library))) {
    console.log("        Install missing libraries with: node scripts/iot/firmware-arduino-cli.mjs deps");
  }
}

printSection("serial port");
if (process.platform === "win32") {
  pass(`effective port: ${effectivePort}`);
} else {
  const currentGroups = getCurrentGroupNames();

  if (!existsSync(effectivePort)) {
    fail(`port not found: ${effectivePort}`);
  } else {
    pass(`effective port: ${effectivePort}`);

    try {
      accessSync(effectivePort, fsConstants.R_OK | fsConstants.W_OK);
      const stat = statSync(effectivePort);
      pass(`port is readable/writable (mode ${stat.mode.toString(8).slice(-3)})`);
    } catch (error) {
      fail(`port is not readable/writable: ${error.message}`);
      if (error.code === "EACCES") {
        if (!currentGroups.includes("dialout")) {
          console.log("        Current shell is not in group 'dialout'.");
          console.log("        Fix: sudo usermod -aG dialout $USER");
          console.log("        Then fully restart the login session, or run: newgrp dialout");
        } else {
          console.log("        Current shell sees 'dialout' but access is still denied.");
          console.log("        Try reopening the terminal/WSL session, or unplug/replug the USB device.");
        }
      }
    }
  }

  const candidates = listUnixSerialCandidates();
  if (candidates.length === 0) {
    warn("no /dev/ttyUSB* or /dev/ttyACM* devices found");
  } else {
    pass(`serial candidates: ${candidates.join(", ")}`);
  }
}

printSection("board discovery");
const boardDiscovery = detectBoardPorts({ arduinoCli });
if (!boardDiscovery.ok) {
  if (boardDiscovery.error.includes("operation not permitted")) {
    warn("board discovery is blocked in this environment; run again in a normal interactive shell if needed");
  } else {
    warn(`unable to query board list: ${boardDiscovery.error}`);
  }
} else if (boardDiscovery.ports.length === 0) {
  warn("arduino-cli board list did not detect any board");
} else {
  for (const portInfo of boardDiscovery.ports) {
    const label = [
      portInfo.address,
      portInfo.protocol ? `protocol=${portInfo.protocol}` : null,
      portInfo.boardName ? `board=${portInfo.boardName}` : null,
      portInfo.label ? `label=${portInfo.label}` : null,
    ]
      .filter(Boolean)
      .join(" | ");
    pass(label);
  }
}

printSection("summary");
if (failures > 0) {
  console.log(`  FAIL  ${failures} critical issue(s), ${warnings} warning(s)`);
  process.exit(1);
}

console.log(`  PASS  environment looks ready (${warnings} warning(s))`);
