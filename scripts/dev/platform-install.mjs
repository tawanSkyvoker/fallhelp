#!/usr/bin/env node

// ตรวจความพร้อมของ dependency และสร้าง postinstall stamp ตาม scope ที่ร้องขอ
// ใช้เป็น preflight กลางก่อนรัน build/dev/script สำคัญ เพื่อกันปัญหา environment drift

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..", "..");
const STAMP_FILE = ".fallhelp-platform.json";

const SCOPES = {
  root: ".",
  backend: "apps/backend-api",
  mobile: "apps/mobile",
  admin: "apps/admin",
};

const args = process.argv.slice(2);
const command = args[0];
const optionArgs = args.slice(1);

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

const profileOption = pullOption(optionArgs, "--profile");
const profile = profileOption.value || "default";
const selectedScopes = profileOption.rest;

function resolveScope(scopeName) {
  const relPath = SCOPES[scopeName];
  if (!relPath) {
    throw new Error(
      `Unknown scope "${scopeName}". Expected one of: ${Object.keys(SCOPES).join(", ")}`,
    );
  }

  return {
    name: scopeName,
    dir: path.resolve(ROOT, relPath),
    nodeModulesDir: path.resolve(ROOT, relPath, "node_modules"),
    stampPath: path.resolve(ROOT, relPath, "node_modules", STAMP_FILE),
  };
}

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

// บันทึก stamp ลงใน node_modules ของ scope นั้น เพื่อจดว่า install เกิดบน platform ไหน
function writeStamp(scopeName) {
  const scope = resolveScope(scopeName);
  if (!fs.existsSync(scope.nodeModulesDir)) {
    console.warn(
      `[platform:stamp] skip ${scope.name}: node_modules not found at ${path.relative(ROOT, scope.nodeModulesDir)}`,
    );
    return;
  }

  const payload = {
    scope: scope.name,
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    createdAt: new Date().toISOString(),
    npmUserAgent: process.env.npm_config_user_agent || null,
  };

  fs.writeFileSync(scope.stampPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(
    `[platform:stamp] wrote ${path.relative(ROOT, scope.stampPath)} for ${process.platform}/${process.arch} on ${process.version}`,
  );
}

// ใช้เช็ก optional native packages ที่มักพังเมื่อย้าย node_modules ข้าม OS หรือ architecture
function existsInNodeModules(scope, relativePath) {
  return fs.existsSync(path.join(scope.nodeModulesDir, relativePath));
}

function hasNativeCandidate(scope, trigger, candidate) {
  const candidateLocations = [
    candidate,
    path.posix.join(trigger, "node_modules", candidate),
  ];

  return candidateLocations.some((relativePath) =>
    existsInNodeModules(scope, relativePath),
  );
}

function getExpectedCandidates(kind) {
  const target = `${process.platform}/${process.arch}`;

  const candidateMap = {
    rollup: {
      "linux/x64": ["@rollup/rollup-linux-x64-gnu", "@rollup/rollup-linux-x64-musl"],
      "linux/arm64": ["@rollup/rollup-linux-arm64-gnu", "@rollup/rollup-linux-arm64-musl"],
      "win32/x64": ["@rollup/rollup-win32-x64-msvc", "@rollup/rollup-win32-x64-gnu"],
      "win32/arm64": ["@rollup/rollup-win32-arm64-msvc"],
      "darwin/x64": ["@rollup/rollup-darwin-x64"],
      "darwin/arm64": ["@rollup/rollup-darwin-arm64"],
    },
    esbuild: {
      "linux/x64": ["@esbuild/linux-x64"],
      "linux/arm64": ["@esbuild/linux-arm64"],
      "linux/arm": ["@esbuild/linux-arm"],
      "win32/x64": ["@esbuild/win32-x64"],
      "win32/arm64": ["@esbuild/win32-arm64"],
      "darwin/x64": ["@esbuild/darwin-x64"],
      "darwin/arm64": ["@esbuild/darwin-arm64"],
    },
    lightningcss: {
      "linux/x64": ["lightningcss-linux-x64-gnu", "lightningcss-linux-x64-musl"],
      "linux/arm64": ["lightningcss-linux-arm64-gnu", "lightningcss-linux-arm64-musl"],
      "win32/x64": ["lightningcss-win32-x64-msvc"],
      "win32/arm64": ["lightningcss-win32-arm64-msvc"],
      "darwin/x64": ["lightningcss-darwin-x64"],
      "darwin/arm64": ["lightningcss-darwin-arm64"],
    },
    tailwindOxide: {
      "linux/x64": ["@tailwindcss/oxide-linux-x64-gnu", "@tailwindcss/oxide-linux-x64-musl"],
      "linux/arm64": ["@tailwindcss/oxide-linux-arm64-gnu", "@tailwindcss/oxide-linux-arm64-musl"],
      "win32/x64": ["@tailwindcss/oxide-win32-x64-msvc"],
      "win32/arm64": ["@tailwindcss/oxide-win32-arm64-msvc"],
      "darwin/x64": ["@tailwindcss/oxide-darwin-x64"],
      "darwin/arm64": ["@tailwindcss/oxide-darwin-arm64"],
    },
  };

  return candidateMap[kind]?.[target] || [];
}

function collectNativeIssues(scope) {
  const shouldCheckEsbuild = profile !== "backend-build";

  const checks = [
    {
      label: "Rollup native binary",
      trigger: "rollup/dist/native.js",
      candidates: getExpectedCandidates("rollup"),
    },
    ...(shouldCheckEsbuild
      ? [
          {
            label: "esbuild native binary",
            trigger: "esbuild/lib/main.js",
            candidates: getExpectedCandidates("esbuild"),
          },
        ]
      : []),
    {
      label: "Lightning CSS native binary",
      trigger: "lightningcss",
      candidates: getExpectedCandidates("lightningcss"),
    },
    {
      label: "Tailwind Oxide native binary",
      trigger: "@tailwindcss/oxide",
      candidates: getExpectedCandidates("tailwindOxide"),
    },
  ];

  const issues = [];

  for (const check of checks) {
    if (!check.candidates.length) continue;
    if (!existsInNodeModules(scope, check.trigger)) continue;

    const found = check.candidates.some((candidate) =>
      hasNativeCandidate(scope, check.trigger, candidate),
    );
    if (!found) {
      issues.push({
        label: check.label,
        expected: check.candidates,
      });
    }
  }

  return issues;
}

function getReinstallCommand(scopeName) {
  if (scopeName === "root") return "npm ci";
  return `npm ci --prefix ${SCOPES[scopeName]}`;
}

// ตรวจความพร้อมของ scope เดียวแล้วคืนข้อความที่แสดงใน CLI ได้ทันที
function checkScope(scopeName) {
  const scope = resolveScope(scopeName);
  if (!fs.existsSync(scope.nodeModulesDir)) {
    return {
      ok: false,
      messages: [
        `[platform:check] ${scope.name}: node_modules is missing`,
        `  Fix: run \`${getReinstallCommand(scope.name)}\` on this OS`,
      ],
    };
  }

  const messages = [];
  const stamp = readJsonSafe(scope.stampPath);
  if (stamp) {
    if (stamp.platform !== process.platform || stamp.arch !== process.arch) {
      return {
        ok: false,
        messages: [
          `[platform:check] ${scope.name}: install stamp mismatch`,
          `  Installed for: ${stamp.platform}/${stamp.arch}`,
          `  Current OS:    ${process.platform}/${process.arch}`,
          `  Fix: delete \`${path.posix.join(scope.name === "root" ? "" : scope.name, "node_modules").replace(/^\/$/, "node_modules")}\` and run \`${getReinstallCommand(scope.name)}\``,
        ],
      };
    }

    if (process.env.CI === "true") {
      messages.push(
        `[platform:check] ${scope.name}: install stamp matches current CI runner`,
      );
      messages.push(`[platform:check] ${scope.name}: OK`);
      return { ok: true, messages };
    }
  } else {
    messages.push(
      `[platform:check] ${scope.name}: install stamp not found, using native-package heuristics`,
    );
  }

  const nativeIssues = collectNativeIssues(scope);
  if (nativeIssues.length > 0) {
    const issueLines = nativeIssues.flatMap((issue) => [
      `[platform:check] ${scope.name}: ${issue.label} is missing for ${process.platform}/${process.arch}`,
      `  Expected one of: ${issue.expected.join(", ")}`,
    ]);

    return {
      ok: false,
      messages: [
        ...messages,
        ...issueLines,
        `  This usually means node_modules was copied from another OS or optional native packages were skipped.`,
        `  Fix: delete \`${path.posix.join(scope.name === "root" ? "" : scope.name, "node_modules").replace(/^\/$/, "node_modules")}\` and run \`${getReinstallCommand(scope.name)}\``,
      ],
    };
  }

  messages.push(`[platform:check] ${scope.name}: OK`);
  return { ok: true, messages };
}

function main() {
  if (command !== "stamp" && command !== "check") {
    console.error("Usage:");
    console.error("  node scripts/dev/platform-install.mjs stamp <root|backend|mobile|admin>");
    console.error(
      "  node scripts/dev/platform-install.mjs check [root backend mobile admin] [--profile=default|backend-build]",
    );
    process.exit(1);
  }

  if (command === "stamp") {
    const scopeName = selectedScopes[0] || "root";
    writeStamp(scopeName);
    return;
  }

  const scopesToCheck =
    selectedScopes.length > 0 ? selectedScopes : ["root", "backend", "mobile", "admin"];

  const results = scopesToCheck.map(checkScope);
  for (const result of results) {
    for (const message of result.messages) {
      console.log(message);
    }
  }

  if (results.some((result) => !result.ok)) {
    process.exit(1);
  }
}

main();
