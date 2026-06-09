#!/usr/bin/env node
/**
 * convert-alias-to-relative.mjs
 *
 * แปลง import aliases แบบ `@/...` ที่ใช้ภายใน `apps/admin/src` และ `apps/mobile`
 * ให้เป็น relative imports (`../...` หรือ `./...`)
 *
 * Usage:
 *   node scripts/dev/convert-alias-to-relative.mjs --check
 *   node scripts/dev/convert-alias-to-relative.mjs --write
 *
 * เหมาะสำหรับ: หลังจากยกเลิกการตั้งค่า bundler alias และต้องการให้
 * โค้ดใช้ path ตรงกับ runtime/node/tsc โดยไม่ต้องพึ่งพา `paths`/`baseUrl`.
 *
 * ข้อควรระวัง:
 * - สคริปต์อิงโครงสร้าง alias ปัจจุบัน: admin `@/*` → `apps/admin/src/*`,
 *   mobile `@/*` → `apps/mobile/*`
 * - ใช้ `--check` เพื่อดูรายการก่อน และใช้ `--write` เมื่อต้องการเขียนไฟล์
 * - รองรับเฉพาะ specifier ที่เป็น string literal ตรง ๆ
 */

import fs from "fs/promises";
import path from "path";
import * as glob from "glob";

const args = new Set(process.argv.slice(2));
const shouldWrite = args.has("--write");
const shouldCheck = args.has("--check") || !shouldWrite;
const root = path.resolve(process.cwd());

const TARGETS = [
  {
    name: "admin",
    rootDir: path.join(root, "apps", "admin"),
    aliasRoot: path.join(root, "apps", "admin", "src"),
    patterns: ["apps/admin/src/**/*.{ts,tsx,js,jsx}"],
  },
  {
    name: "mobile",
    rootDir: path.join(root, "apps", "mobile"),
    aliasRoot: path.join(root, "apps", "mobile"),
    patterns: ["apps/mobile/**/*.{ts,tsx,js,jsx}"],
  },
];

const IGNORE_PATTERNS = [
  "**/node_modules/**",
  "**/dist/**",
  "**/coverage/**",
  "apps/mobile/.expo/**",
];

const STATIC_FROM_ALIAS_RE = /\b(from)\s+(["'])@\/([^"']+)\2/g;
const SIDE_EFFECT_ALIAS_RE = /\b(import)\s+(["'])@\/([^"']+)\2/g;
const CALL_ALIAS_RE =
  /\b(import|require|jest\.(?:mock|doMock|unmock))\(\s*(["'])@\/([^"']+)\2/g;

function findTarget(file) {
  return TARGETS.find((target) => file.startsWith(target.rootDir + path.sep));
}

function resolveAliasTarget(file, aliasPath) {
  const target = findTarget(file);
  return target ? path.join(target.aliasRoot, aliasPath) : null;
}

function makeRelative(fromFile, toAbs) {
  const fromDir = path.dirname(fromFile);
  let rel = path.relative(fromDir, toAbs);
  if (!rel.startsWith(".")) rel = "./" + rel;
  rel = rel.replace(/\.(?:ts|tsx|js|jsx)$/i, "");
  return rel.split(path.sep).join("/");
}

function convertContent(file, content) {
  const replaceStatic = (match, keyword, quote, aliasPath) => {
    const target = resolveAliasTarget(file, aliasPath);
    if (!target) return match;
    return `${keyword} ${quote}${makeRelative(file, target)}${quote}`;
  };

  const replaceCall = (match, callee, quote, aliasPath) => {
    const target = resolveAliasTarget(file, aliasPath);
    if (!target) return match;
    return `${callee}(${quote}${makeRelative(file, target)}${quote}`;
  };

  return content
    .replace(STATIC_FROM_ALIAS_RE, replaceStatic)
    .replace(SIDE_EFFECT_ALIAS_RE, replaceStatic)
    .replace(CALL_ALIAS_RE, replaceCall);
}

async function processFile(file) {
  const orig = await fs.readFile(file, "utf8");
  const content = convertContent(file, orig);
  if (content !== orig) {
    if (shouldWrite) {
      await fs.writeFile(file, content, "utf8");
      console.log("Patched", path.relative(root, file));
    }
    return true;
  }
  return false;
}

async function main() {
  if (args.has("--help")) {
    console.log("Usage: node scripts/dev/convert-alias-to-relative.mjs [--check|--write]");
    return;
  }

  console.log("Scanning alias targets...");
  const files = new Set();
  for (const target of TARGETS) {
    for (const pattern of target.patterns) {
      const matches = glob.sync(pattern, {
        cwd: root,
        nodir: true,
        ignore: IGNORE_PATTERNS,
      });
      matches.forEach((file) => files.add(path.resolve(root, file)));
    }
  }

  let changedCount = 0;
  console.log("Found", files.size, "files");
  for (const file of files) {
    const changed = await processFile(file);
    if (changed) {
      changedCount += 1;
      if (shouldCheck) console.log("Would patch", path.relative(root, file));
    }
  }

  if (shouldCheck && changedCount > 0) {
    console.log(`Found ${changedCount} file(s) with @/ aliases. Re-run with --write to patch.`);
    process.exitCode = 1;
    return;
  }

  console.log(shouldWrite ? `Done. Patched ${changedCount} file(s).` : "Done. No @/ aliases found.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
