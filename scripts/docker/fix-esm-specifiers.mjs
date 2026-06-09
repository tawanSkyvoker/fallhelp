#!/usr/bin/env node

// เติม .js ให้ relative import ใน dist หลัง TypeScript build สำหรับ Node ESM runtime
// ใช้เฉพาะ Docker build ของ backend เพื่อเลี่ยงการแตะ source TypeScript โดยตรง
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const [, , targetDirArg] = process.argv;

if (!targetDirArg) {
  console.error("Usage: node scripts/docker/fix-esm-specifiers.mjs <target-dir>");
  process.exit(1);
}

const targetDir = path.resolve(targetDirArg);

// จำกัดขอบเขตการแก้เฉพาะไฟล์ JavaScript output และ import แบบ relative เท่านั้น
const FILE_EXTENSIONS = new Set([".js", ".mjs", ".cjs"]);
const SPECIFIER_EXTENSIONS = [".js", ".mjs", ".cjs", ".json"];
const IMPORT_PATTERNS = [
  /(from\s+)(['"])(\.{1,2}\/[^'"]+)\2/g,
  /(import\s+)(['"])(\.{1,2}\/[^'"]+)\2/g,
  /(import\s*\(\s*)(['"])(\.{1,2}\/[^'"]+)\2/g,
];

await walk(targetDir);

async function walk(currentDir) {
  // เดินไฟล์แบบ recursive เพราะ output ของ TypeScript มีหลายชั้นตามโครงสร้าง source
  const entries = await fsp.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      await walk(fullPath);
      continue;
    }

    if (!FILE_EXTENSIONS.has(path.extname(entry.name))) {
      continue;
    }

    await rewriteFile(fullPath);
  }
}

async function rewriteFile(filePath) {
  const original = await fsp.readFile(filePath, "utf8");
  let updated = original;

  // Rewrite เฉพาะ specifier ที่ resolve เป็นไฟล์จริง เพื่อไม่สร้าง path ปลอมใน dist
  for (const pattern of IMPORT_PATTERNS) {
    updated = updated.replace(pattern, (match, prefix, quote, specifier) => {
      const resolved = resolveSpecifier(filePath, specifier);
      return resolved ? `${prefix}${quote}${resolved}${quote}` : match;
    });
  }

  if (updated !== original) {
    await fsp.writeFile(filePath, updated, "utf8");
  }
}

function resolveSpecifier(filePath, specifier) {
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
    return null;
  }

  if (SPECIFIER_EXTENSIONS.some((extension) => specifier.endsWith(extension))) {
    return null;
  }

  const basePath = path.resolve(path.dirname(filePath), specifier);
  const fileCandidate = `${basePath}.js`;
  const indexCandidate = path.join(basePath, "index.js");

  // รองรับทั้งไฟล์ตรงและ barrel index.js ตาม output ที่ backend build สร้างไว้
  if (fs.existsSync(fileCandidate)) {
    return `${specifier}.js`;
  }

  if (fs.existsSync(indexCandidate)) {
    return `${specifier}/index.js`;
  }

  return null;
}
