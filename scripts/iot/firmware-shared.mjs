#!/usr/bin/env node

// helper กลางสำหรับ firmware tooling
// รวม logic หา arduino-cli, port เริ่มต้น, และ board discovery ให้ใช้ร่วมกันข้าม OS

import { existsSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

export const REQUIRED_LIBRARIES = [
  "ArduinoJson",
  "PubSubClient",
  "PulseSensor Playground",
  "MPU6050",
];

export const REQUIRED_CORE = "esp32:esp32";

function getArduinoCliCandidates() {
  const home = os.homedir();

  if (process.platform === "win32") {
    return [
      path.join(home, "AppData", "Local", "Programs", "Arduino CLI", "arduino-cli.exe"),
      path.join(home, "arduino-cli", "arduino-cli.exe"),
      path.join(home, "scoop", "shims", "arduino-cli.exe"),
      path.join(home, ".local", "bin", "arduino-cli.exe"),
      "arduino-cli.exe",
    ];
  }

  return [
    path.join(home, ".local", "bin", "arduino-cli"),
    "arduino-cli",
  ];
}

export function resolveArduinoCliBinary(env = process.env) {
  if (env.ARDUINO_CLI) {
    return env.ARDUINO_CLI;
  }

  for (const candidate of getArduinoCliCandidates()) {
    if (!candidate.includes(path.sep) || existsSync(candidate)) {
      return candidate;
    }
  }

  return process.platform === "win32" ? "arduino-cli.exe" : "arduino-cli";
}

export function runArduinoCli(args, options = {}) {
  const {
    arduinoCli = resolveArduinoCliBinary(),
    cwd,
    encoding = "utf8",
  } = options;

  return spawnSync(arduinoCli, args, {
    cwd,
    encoding,
  });
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function getEntryPortAddress(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  return entry.port?.address ?? entry.address ?? null;
}

function getEntryBoardName(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  return entry.matching_boards?.[0]?.name ?? entry.board?.name ?? null;
}

export function detectBoardPorts(options = {}) {
  const {
    arduinoCli = resolveArduinoCliBinary(),
    cwd,
    discoveryTimeout = "1s",
  } = options;

  const result = runArduinoCli(["board", "list", "--json", "--discovery-timeout", discoveryTimeout], {
    arduinoCli,
    cwd,
  });

  if (result.error || result.status !== 0) {
    return {
      ok: false,
      error: result.error?.message ?? result.stderr?.trim() ?? result.stdout?.trim() ?? "board list failed",
      ports: [],
    };
  }

  const parsed = safeJsonParse(result.stdout);
  const ports = Array.isArray(parsed?.detected_ports)
    ? parsed.detected_ports
        .map((entry) => {
          const address = getEntryPortAddress(entry);
          if (!address) {
            return null;
          }

          return {
            address,
            protocol: entry.port?.protocol ?? entry.protocol ?? null,
            label: entry.port?.label ?? entry.label ?? null,
            boardName: getEntryBoardName(entry),
          };
        })
        .filter(Boolean)
    : [];

  return {
    ok: true,
    ports,
    raw: parsed,
  };
}

export function getDefaultSerialPort(options = {}) {
  const {
    env = process.env,
    arduinoCli = resolveArduinoCliBinary(env),
    cwd,
  } = options;

  const override = env.FIRMWARE_PORT || env.MONITOR_PORT || env.ARDUINO_PORT;
  if (override) {
    return override;
  }

  const detected = detectBoardPorts({ arduinoCli, cwd });
  if (detected.ok && detected.ports.length > 0) {
    return detected.ports[0].address;
  }

  return process.platform === "win32" ? "COM3" : "/dev/ttyUSB0";
}

export function listUnixSerialCandidates() {
  const devDir = "/dev";
  if (!existsSync(devDir)) {
    return [];
  }

  return readdirSync(devDir)
    .filter((entry) => entry.startsWith("ttyUSB") || entry.startsWith("ttyACM"))
    .map((entry) => path.join(devDir, entry))
    .sort();
}
