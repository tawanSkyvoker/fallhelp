#!/usr/bin/env node
/**
 * fix-eslint-brace-expansion.mjs
 *
 * Patches minimatch@3.x ทุก instance ใน node_modules ที่ยังใช้ API เก่าของ brace-expansion
 *
 * ปัญหา: nx ดึง brace-expansion@5.x ขึ้น root (เปลี่ยน export จาก function → named object)
 *         minimatch@3.x ทำ var expand = require('brace-expansion') แล้วเรียก expand() ตรงๆ
 *         → TypeError: expand is not a function
 *
 * รันโดย postinstall หลัง npm install ทุกครั้ง
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const NODE_MODULES = join(ROOT, 'node_modules');

const OLD = "var expand = require('brace-expansion')";
const NEW =
  "var _braceExpansion = require('brace-expansion'); var expand = typeof _braceExpansion === 'function' ? _braceExpansion : _braceExpansion.expand";

let targets;
try {
  const result = execSync(`grep -rl "${OLD}" "${NODE_MODULES}" --include="minimatch.js"`, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  targets = result.trim().split('\n').filter(Boolean);
} catch {
  targets = [];
}

let patched = 0;

for (const target of targets) {
  try {
    const content = readFileSync(target, 'utf8');
    if (content.includes(NEW)) continue;
    if (content.includes(OLD)) {
      writeFileSync(target, content.replace(OLD, NEW), 'utf8');
      console.log(`  patched: ${target.replace(ROOT + '/', '')}`);
      patched++;
    }
  } catch {
    // ไฟล์ไม่มีในบางเครื่อง ข้ามได้
  }
}

if (patched > 0) {
  console.log(`fix-eslint-brace-expansion: ${patched} file(s) patched`);
}
