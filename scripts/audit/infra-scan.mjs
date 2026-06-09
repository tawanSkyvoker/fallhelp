#!/usr/bin/env node

// สคริปต์สแกน runtime/config/documentation drift ของทั้ง repo
// ใช้รวมผลตรวจ env, AI instructions และคำสั่ง verify หลัก เพื่อให้สถานะ PASS/FAIL น่าเชื่อถือขึ้น

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { getWindowsCmdInvocation } from "../lib/process-helpers.mjs";

const ROOT = process.cwd();
const ARGS = new Set(process.argv.slice(2));
const SKIP_RUNTIME = ARGS.has("--skip-runtime-checks");
const STRICT_MODE = ARGS.has("--strict");
const SKIP_INTEGRATION_CHECKS = ARGS.has("--skip-integration-checks");
const IGNORE_DIRS = new Set([
  ".git",
  ".agent",
  "node_modules",
  "dist",
  ".expo",
  ".next",
  "coverage",
]);
const IGNORED_ENV_KEYS = {
  backend: new Set([
    "JEST_DETECT_OPEN_HANDLES",
    "DEVICE_ONLINE_THRESHOLD_MS",
    "MQTT_CONFIG_ACK_TIMEOUT_MS",
    "WIFI_CONFIGURING_STALE_MS",
  ]),
  mobile: new Set(),
  admin: new Set(),
};
const APP_DIRS = {
  backend: path.join(ROOT, "apps", "backend-api"),
  mobile: path.join(ROOT, "apps", "mobile"),
  admin: path.join(ROOT, "apps", "admin"),
};
const BACKEND_ENV_TEMPLATE_FILES = [path.join(ROOT, "docker-compose.yml")];

function createRuntimeCheck(name, args, cwd = ROOT, env = process.env) {
  return { name, args, cwd, env };
}

function createNodeToolCheck(name, toolRelativePath, args = [], cwd = ROOT, env = process.env) {
  return createRuntimeCheck(
    name,
    [process.execPath, path.join(ROOT, toolRelativePath), ...args],
    cwd,
    env,
  );
}

function createSkippedCheck(name, reason) {
  return {
    name,
    ok: false,
    status: null,
    preview: reason,
    blockedBySandbox: true,
  };
}

function getBaseRuntimeChecks() {
  return [
    createRuntimeCheck("backend build", ["npm", "run", "--prefix", "apps/backend-api", "build"]),
    createNodeToolCheck("admin build", "node_modules/vite/bin/vite.js", ["build"], APP_DIRS.admin),
    createRuntimeCheck(
      "backend unit tests (ci)",
      ["npm", "run", "--prefix", "apps/backend-api", "test:ci"],
    ),
    createRuntimeCheck(
      "mobile light tests (no watchman)",
      [
        "npm",
        "run",
        "--prefix",
        "apps/mobile",
        "test:light",
        "--",
        "--runInBand",
        "--watchman=false",
      ],
    ),
    createRuntimeCheck(
      "docker compose config",
      ["docker", "compose", "config"],
      ROOT,
    ),
  ];
}

function getStrictRuntimeChecks() {
  return [
    createRuntimeCheck("backend lint", ["npm", "run", "--prefix", "apps/backend-api", "lint"]),
    createNodeToolCheck(
      "mobile lint",
      "node_modules/eslint/bin/eslint.js",
      ["."],
      APP_DIRS.mobile,
    ),
    createRuntimeCheck("admin lint", ["npm", "run", "--prefix", "apps/admin", "lint"]),
    createRuntimeCheck("backend typecheck", ["npm", "run", "--prefix", "apps/backend-api", "typecheck"]),
    createNodeToolCheck(
      "mobile typecheck",
      "node_modules/typescript/bin/tsc",
      ["--noEmit"],
      APP_DIRS.mobile,
    ),
    createNodeToolCheck(
      "admin typecheck",
      "node_modules/typescript/bin/tsc",
      ["-b", "--pretty", "false"],
      APP_DIRS.admin,
    ),
  ];
}

function getIntegrationRuntimeChecks() {
  return [
    createRuntimeCheck(
      "backend integration tests",
      ["npm", "run", "--prefix", "apps/backend-api", "test:integration", "--", "--watchman=false"],
    ),
  ];
}

function walkFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, out);
      continue;
    }
    out.push(full);
  }
  return out;
}

function parseEnvExample(filePath) {
  if (!fs.existsSync(filePath)) return new Set();
  const text = fs.readFileSync(filePath, "utf8");
  return new Set([...text.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]));
}

function collectEnvKeys(baseDir, { includeImportMeta = false } = {}) {
  const keys = new Set();
  if (!fs.existsSync(baseDir)) return keys;
  const files = walkFiles(baseDir).filter((f) =>
    /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f),
  );
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    for (const m of text.matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g))
      keys.add(m[1]);
    for (const m of text.matchAll(/process\.env\[['"]([A-Z][A-Z0-9_]+)['"]\]/g))
      keys.add(m[1]);
    for (const m of text.matchAll(/requireEnv\(\s*['"]([A-Z][A-Z0-9_]*)['"]/g))
      keys.add(m[1]);
    if (includeImportMeta) {
      for (const m of text.matchAll(/import\.meta\.env\.([A-Z][A-Z0-9_]+)/g))
        keys.add(m[1]);
      for (const m of text.matchAll(/import\.meta\.env\[['"]([A-Z][A-Z0-9_]+)['"]\]/g))
        keys.add(m[1]);
    }
  }
  return keys;
}

function collectTemplateEnvKeysFromFiles(filePaths) {
  const keys = new Set();
  for (const file of filePaths) {
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    for (const m of text.matchAll(/\$\{([A-Z][A-Z0-9_]*)(?:(?::?[-+?=][^}]*)?)\}/g)) {
      keys.add(m[1]);
    }
  }
  return keys;
}

function collectTemplateEnvKeys(baseDir) {
  const keys = new Set();
  if (!fs.existsSync(baseDir)) return keys;
  const files = walkFiles(baseDir).filter((f) => /\.(yml|yaml|json)$/.test(f));
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    for (const m of text.matchAll(/\$\{([A-Z][A-Z0-9_]*)(?:(?::?[-+?=][^}]*)?)\}/g)) {
      keys.add(m[1]);
    }
  }
  return keys;
}

function stripFencedCode(text) {
  return text.replace(/```[\s\S]*?```/g, "");
}

function parseMarkdownLinks(text) {
  const links = [];
  const cleaned = stripFencedCode(text);
  const re = /!?\[[^\]]*]\(([^)\n]+)\)/g;
  let m;
  while ((m = re.exec(cleaned))) {
    links.push(m[1].trim());
  }
  return links;
}

function normalizeLinkTarget(rawLink) {
  if (!rawLink) return null;
  let link = rawLink.trim();
  if (link.startsWith("<") && link.endsWith(">"))
    link = link.slice(1, -1).trim();
  if (
    !link ||
    link.startsWith("#") ||
    link.startsWith("http://") ||
    link.startsWith("https://") ||
    link.startsWith("mailto:") ||
    link.startsWith("tel:")
  ) {
    return null;
  }
  if (link.includes(" ")) {
    link = link.split(/\s+/)[0];
  }
  link = link.split("#")[0].split("?")[0];
  return link || null;
}

function scanMarkdownLinks() {
  const mdFiles = walkFiles(ROOT).filter((f) => f.endsWith(".md"));
  const missing = [];

  for (const file of mdFiles) {
    const relFile = path.relative(ROOT, file);
    if (relFile.startsWith(".agent/")) continue;

    const text = fs.readFileSync(file, "utf8");
    const rawLinks = parseMarkdownLinks(text);
    for (const raw of rawLinks) {
      const targetRel = normalizeLinkTarget(raw);
      if (!targetRel) continue;

      const targetAbs = path.normalize(
        path.join(path.dirname(file), targetRel),
      );
      if (!fs.existsSync(targetAbs)) {
        missing.push({
          file: relFile,
          link: raw,
          target: path.relative(ROOT, targetAbs),
        });
      }
    }
  }
  return missing;
}

function runCommandCheck(name, args, cwd = ROOT, env = process.env) {
  const [rawCommand, ...commandArgs] = args;
  const needsWindowsCmdWrapper =
    process.platform === "win32" &&
    (rawCommand === "npm" || rawCommand === "npx" || rawCommand === "docker");
  const invocation = needsWindowsCmdWrapper
    ? getWindowsCmdInvocation(
        [rawCommand === "npm" ? "npm.cmd" : rawCommand === "npx" ? "npx.cmd" : "docker.exe", ...commandArgs],
        cwd,
      )
    : { command: rawCommand, args: commandArgs, cwd };

  const result = spawnSync(invocation.command, invocation.args, {
    cwd: invocation.cwd ?? cwd,
    encoding: "utf8",
    env,
    shell: false,
  });

  const ok = result.status === 0;
  const spawnError = result.error ?? null;
  const stdout = (result.stdout || "").trim();
  const stderr = (result.stderr || "").trim();
  const errorText = spawnError
    ? `${spawnError.name}: ${spawnError.message}`.trim()
    : "";
  const preview = [stdout, stderr, errorText]
    .filter(Boolean)
    .join("\n")
    .split("\n")
    .slice(0, 12)
    .join("\n");

  const blockedBySandbox =
    !ok &&
    !!spawnError &&
    (spawnError.code === "EPERM" ||
      spawnError.code === "EACCES" ||
      /access is denied/i.test(spawnError.message) ||
      /operation not permitted/i.test(spawnError.message));

  return {
    name,
    ok,
    status: result.status,
    preview,
    blockedBySandbox,
  };
}

function hasCommand(command) {
  const probe = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(probe, [command], {
    encoding: "utf8",
    env: process.env,
  });
  return result.status === 0;
}

function scanEnvDrift() {
  const backendUsedAll = new Set([
    ...collectEnvKeys(APP_DIRS.backend),
    ...collectTemplateEnvKeys(APP_DIRS.backend),
    ...collectTemplateEnvKeysFromFiles(BACKEND_ENV_TEMPLATE_FILES),
  ]);
  const backendUsed = [...backendUsedAll]
    .filter((k) => !IGNORED_ENV_KEYS.backend.has(k))
    .sort();
  const backendExample = parseEnvExample(
    path.join(APP_DIRS.backend, ".env.example"),
  );
  const backendMissing = backendUsed.filter((k) => !backendExample.has(k));
  const backendExtra = [...backendExample]
    .filter((k) => !backendUsed.includes(k))
    .sort();

  const mobileUsedAll = collectEnvKeys(APP_DIRS.mobile);
  const mobileUsed = [...mobileUsedAll]
    .filter(
      (k) =>
        (k.startsWith("EXPO_PUBLIC_") || k === "GOOGLE_SERVICES_JSON_BASE64") &&
        !IGNORED_ENV_KEYS.mobile.has(k),
    )
    .sort();
  const mobileExample = parseEnvExample(
    path.join(APP_DIRS.mobile, ".env.example"),
  );
  const mobileMissing = mobileUsed.filter((k) => !mobileExample.has(k));
  const mobileExtra = [...mobileExample]
    .filter((k) => !mobileUsed.includes(k))
    .sort();

  const adminUsedAll = collectEnvKeys(APP_DIRS.admin, {
    includeImportMeta: true,
  });
  const adminUsed = [...adminUsedAll]
    .filter((k) => k.startsWith("VITE_") && !IGNORED_ENV_KEYS.admin.has(k))
    .sort();
  const adminExamplePath = path.join(APP_DIRS.admin, ".env.example");
  const adminExample = parseEnvExample(adminExamplePath);
  const adminMissing = adminUsed.filter((k) => !adminExample.has(k));
  const adminExtra = [...adminExample]
    .filter((k) => !adminUsed.includes(k))
    .sort();

  return {
    backend: { missing: backendMissing, extra: backendExtra },
    mobile: { missing: mobileMissing, extra: mobileExtra },
    admin: {
      missing: adminMissing,
      extra: adminExtra,
      hasExample: fs.existsSync(adminExamplePath),
    },
  };
}

function runRuntimeChecks({
  strictMode = false,
  skipIntegrationChecks = false,
} = {}) {
  const checks = [...getBaseRuntimeChecks()];

  if (strictMode) {
    checks.push(...getStrictRuntimeChecks());
    if (!skipIntegrationChecks) {
      checks.push(...getIntegrationRuntimeChecks());
    }
  }

  return checks.map(({ name, args, cwd, env }) => {
    if (args[0] === "docker" && !hasCommand("docker")) {
      return createSkippedCheck(
        name,
        "docker command not available in this environment",
      );
    }

    return runCommandCheck(name, args, cwd, env);
  });
}

function printList(title, items) {
  console.log(`\n${title}`);
  if (items.length === 0) {
    console.log("  - none");
    return;
  }
  for (const item of items) {
    console.log(`  - ${item}`);
  }
}

function main() {
  console.log("=== Infra Consistency Scan ===");
  console.log(`root: ${ROOT}`);
  console.log(`strict mode: ${STRICT_MODE ? "enabled" : "disabled"}`);
  if (STRICT_MODE) {
    console.log(
      `strict integration checks: ${SKIP_INTEGRATION_CHECKS ? "skipped" : "enabled"}`,
    );
  }
  console.log(`runtime checks: ${SKIP_RUNTIME ? "skipped" : "enabled"}`);

  const missingLinks = scanMarkdownLinks();
  const env = scanEnvDrift();
  const runtimeResults = SKIP_RUNTIME
    ? []
    : runRuntimeChecks({
        strictMode: STRICT_MODE,
        skipIntegrationChecks: SKIP_INTEGRATION_CHECKS,
      });
  const runtimeBlocked = runtimeResults.filter((r) => r.blockedBySandbox);
  const runtimeFails = runtimeResults.filter((r) => !r.ok && !r.blockedBySandbox);

  console.log(`\n[links] broken local links: ${missingLinks.length}`);
  if (missingLinks.length > 0) {
    for (const issue of missingLinks.slice(0, 60)) {
      console.log(`  - ${issue.file} :: ${issue.link} -> ${issue.target}`);
    }
    if (missingLinks.length > 60) {
      console.log(`  ... and ${missingLinks.length - 60} more`);
    }
  }

  console.log("\n[env] missing keys in .env.example");
  printList("  backend", env.backend.missing);
  printList("  mobile", env.mobile.missing);
  printList("  admin", env.admin.missing);

  console.log("\n[env] extra keys in .env.example (warning)");
  printList("  backend", env.backend.extra);
  printList("  mobile", env.mobile.extra);
  printList("  admin", env.admin.extra);

  if (!SKIP_RUNTIME) {
    console.log(
      `\n[runtime] checks: ${runtimeResults.length}, failures: ${runtimeFails.length}, skipped: ${runtimeBlocked.length}`,
    );
    for (const result of runtimeResults) {
      console.log(
        `  - ${result.ok ? "PASS" : result.blockedBySandbox ? "SKIP" : "FAIL"}: ${result.name}`,
      );
      if (!result.ok && result.preview) {
        console.log(`    ${result.preview.replace(/\n/g, "\n    ")}`);
      }
    }
    if (runtimeBlocked.length > 0) {
      console.log(
        "\n[runtime] note: skipped checks were blocked by process execution restrictions in the current environment. Re-run those commands directly in a normal local shell before release.",
      );
    }
  }

  const hasBlockingIssues =
    missingLinks.length > 0 ||
    env.backend.missing.length > 0 ||
    env.mobile.missing.length > 0 ||
    env.admin.missing.length > 0 ||
    runtimeFails.length > 0;

  console.log(`\nresult: ${hasBlockingIssues ? "FAIL" : "PASS"}`);
  process.exit(hasBlockingIssues ? 1 : 0);
}

main();
