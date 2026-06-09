#!/usr/bin/env node

import fs from "node:fs";
import { resolveScriptPath, runProcessOrExit } from "../lib/process-helpers.mjs";

const helperPath = resolveScriptPath("dev/platform-install.mjs");
const scopeName = process.argv[2];

if (!scopeName) {
  console.error("Usage: node scripts/dev/postinstall-stamp.mjs <backend|mobile|admin>");
  process.exit(1);
}

if (!fs.existsSync(helperPath)) {
  console.log(`[platform:stamp] skip ${scopeName}: root helper not available in this install context`);
  process.exit(0);
}

runProcessOrExit(null, process.execPath, [helperPath, "stamp", scopeName]);
