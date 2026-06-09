#!/usr/bin/env node

// สคริปต์ตรวจสอบคุณภาพคอมเมนต์ในโค้ดแบบ context-aware
//
// แนวคิดหลัก:
// - ไม่ใช้เกณฑ์เดียวกับทุกไฟล์ เพราะ screen, util, component และ script มีหน้าที่ต่างกัน
// - แยกผลลัพธ์เป็น 2 ระดับ:
//   - blocking: ควรหยุดก่อน merge หรือก่อนปิดงาน
//   - warning: ควรเก็บคุณภาพให้ดีขึ้น แต่ยังไม่ถึงขั้นบล็อกงาน
//
// วิธีใช้:
//   npm run audit:comments:strict
//   node scripts/audit/audit-comments.mjs --strict

import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const IS_STRICT_MODE = process.argv.includes("--strict");
const SELF_AUDIT_FILE = path.join(ROOT, "scripts", "audit", "audit-comments.mjs");

const TARGET_DIRS = [
  path.join(ROOT, "apps/backend-api/src"),
  path.join(ROOT, "apps/mobile/app"),
  path.join(ROOT, "apps/mobile/components"),
  path.join(ROOT, "apps/mobile/constants"),
  path.join(ROOT, "apps/mobile/context"),
  path.join(ROOT, "apps/mobile/hooks"),
  path.join(ROOT, "apps/mobile/services"),
  path.join(ROOT, "apps/mobile/utils"),
  path.join(ROOT, "apps/admin/src"),
  path.join(ROOT, "firmware", "esp32", "src"),
  path.join(ROOT, "scripts"),
];

const IGNORE_DIRS = new Set([
  ".git",
  ".agent",
  "node_modules",
  "dist",
  ".expo",
  ".next",
  "coverage",
  "__tests__",
  "generated",
]);

const RULE_NAMES = {
  0: "Vague English Stubs",
  1: "Missing Thai Language",
  2: "Missing Structured Coverage",
  3: "Missing File Header",
  4: "English-only JSDoc",
  5: "Trivial Comments",
  6: "English-only Inline",
  7: "Poor Comment Quality",
};

const SCOPE_CONFIGS = {
  "backend-core": {
    label: "Backend Core",
    headerMinLines: 30,
    densityMinLines: 60,
    minCommentLines: 3,
    blockingRules: new Set([0, 3]),
  },
  "backend-utils": {
    label: "Backend Utils",
    headerMinLines: 55,
    densityMinLines: 90,
    minCommentLines: 2,
    blockingRules: new Set([0]),
  },
  "mobile-screens": {
    label: "Mobile Screens",
    headerMinLines: 30,
    densityMinLines: 60,
    minCommentLines: 3,
    blockingRules: new Set([0, 3]),
  },
  "mobile-components": {
    label: "Mobile Components",
    headerMinLines: 80,
    densityMinLines: 100,
    minCommentLines: 2,
    blockingRules: new Set([0]),
  },
  "mobile-shared": {
    label: "Mobile Shared Logic",
    headerMinLines: 40,
    densityMinLines: 70,
    minCommentLines: 2,
    blockingRules: new Set([0, 3]),
  },
  "mobile-utils": {
    label: "Mobile Utils",
    headerMinLines: 55,
    densityMinLines: 90,
    minCommentLines: 2,
    blockingRules: new Set([0]),
  },
  "firmware-source": {
    label: "Firmware Source",
    headerMinLines: 30,
    densityMinLines: 70,
    minCommentLines: 2,
    blockingRules: new Set([0, 3]),
  },
  "admin-core": {
    label: "Admin Core",
    headerMinLines: 30,
    densityMinLines: 60,
    minCommentLines: 3,
    blockingRules: new Set([0, 3]),
  },
  "repo-scripts": {
    label: "Repo Scripts",
    headerMinLines: 25,
    densityMinLines: 50,
    minCommentLines: 3,
    blockingRules: new Set([0, 3]),
  },
  generic: {
    label: "Generic Source",
    headerMinLines: 40,
    densityMinLines: 80,
    minCommentLines: 2,
    blockingRules: new Set([0]),
  },
};

// ==================== Utilities ====================

const JS_TS_SOURCE_REGEX = /\.(ts|tsx|js|jsx|mjs|cjs)$/i;
const FIRMWARE_SOURCE_REGEX = /\.(ino|h|hpp|cpp)(?:\.example)?$/i;
const SECRET_FIRMWARE_HEADERS = new Set(["mqtt_secrets.h", "wifi_secrets.h"]);

function toNormalizedPath(targetPath) {
  return targetPath.split(path.sep).join("/");
}

function isFirmwareSourcePath(filePath) {
  return toNormalizedPath(filePath).includes("/firmware/esp32/src/");
}

function isEligibleFirmwareSource(filePath) {
  const baseName = path.basename(filePath);
  if (SECRET_FIRMWARE_HEADERS.has(baseName)) {
    return false;
  }

  return FIRMWARE_SOURCE_REGEX.test(baseName);
}

function isSupportedSourceFile(filePath) {
  const baseName = path.basename(filePath);
  if (JS_TS_SOURCE_REGEX.test(baseName)) return true;
  if (isFirmwareSourcePath(filePath) && isEligibleFirmwareSource(filePath)) return true;
  return false;
}

// สำรวจโฟลเดอร์แบบ recursive เพื่อหาไฟล์ source ที่ควร audit
function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;

    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, out);
    } else if (isSupportedSourceFile(full)) {
      out.push(full);
    }
  }

  return out;
}

function getScriptKind(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case ".ts":
      return ts.ScriptKind.TS;
    case ".tsx":
      return ts.ScriptKind.TSX;
    case ".js":
      return ts.ScriptKind.JS;
    case ".jsx":
      return ts.ScriptKind.JSX;
    case ".mjs":
      return ts.ScriptKind.JS;
    case ".cjs":
      return ts.ScriptKind.JS;
    default:
      return ts.ScriptKind.Unknown;
  }
}

function getLanguageVariant(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ext === ".tsx" || ext === ".jsx"
    ? ts.LanguageVariant.JSX
    : ts.LanguageVariant.Standard;
}

function extractCommentsWithRegex(code) {
  const comments = [];
  const commentRegex = /\/\*[\s\S]*?\*\/|\/\/.*$/gm;
  let match;

  while ((match = commentRegex.exec(code)) !== null) {
    const content = match[0].trim();

    if (
      content.includes("eslint-disable") ||
      content.includes("ts-ignore") ||
      content.includes("ts-expect-error") ||
      content.includes("prettier-ignore") ||
      /^(\/\/|\/\*)\s*http(s)?:\/\//.test(content)
    ) {
      continue;
    }

    const lineNum = code.substring(0, match.index).split("\n").length;
    comments.push({
      type: content.startsWith("//") ? "line" : "block",
      content,
      line: lineNum,
    });
  }

  return comments;
}

// ดึงคอมเมนต์จาก token stream จริงของ TypeScript scanner
// เพื่อลด false positive จากการใช้ regex ไล่ raw text ตรง ๆ
function extractComments(code, filePath) {
  if (!JS_TS_SOURCE_REGEX.test(path.basename(filePath))) {
    return extractCommentsWithRegex(code);
  }

  const comments = [];
  const sourceFile = ts.createSourceFile(
    filePath,
    code,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(filePath),
  );
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    getLanguageVariant(filePath),
    code,
  );

  let token = scanner.scan();
  while (token !== ts.SyntaxKind.EndOfFileToken) {
    if (
      token !== ts.SyntaxKind.SingleLineCommentTrivia &&
      token !== ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      token = scanner.scan();
      continue;
    }

    const content = scanner.getTokenText().trim();

    if (
      content.includes("eslint-disable") ||
      content.includes("ts-ignore") ||
      content.includes("ts-expect-error") ||
      content.includes("prettier-ignore") ||
      /^(\/\/|\/\*)\s*http(s)?:\/\//.test(content)
    ) {
      token = scanner.scan();
      continue;
    }

    const lineNum =
      ts.getLineAndCharacterOfPosition(sourceFile, scanner.getTokenPos()).line + 1;
    comments.push({
      type: content.startsWith("//") ? "line" : "block",
      content,
      line: lineNum,
    });

    token = scanner.scan();
  }

  return comments;
}

function classifyScope(relPath) {
  const normalized = toNormalizedPath(relPath);

  if (normalized.startsWith("apps/backend-api/src/utils/")) return "backend-utils";
  if (normalized.startsWith("apps/backend-api/src/")) return "backend-core";
  if (normalized.startsWith("apps/mobile/app/")) return "mobile-screens";
  if (normalized.startsWith("apps/mobile/components/")) return "mobile-components";
  if (
    normalized.startsWith("apps/mobile/context/") ||
    normalized.startsWith("apps/mobile/hooks/") ||
    normalized.startsWith("apps/mobile/services/")
  ) {
      return "mobile-shared";
  }
  if (normalized.startsWith("apps/mobile/constants/")) return "mobile-utils";
  if (normalized.startsWith("apps/mobile/utils/")) return "mobile-utils";
  if (normalized.startsWith("apps/admin/src/")) return "admin-core";
  if (normalized.startsWith("firmware/esp32/src/")) return "firmware-source";
  if (normalized.startsWith("scripts/")) return "repo-scripts";

  return "generic";
}

function getScopeConfig(relPath) {
  return SCOPE_CONFIGS[classifyScope(relPath)] ?? SCOPE_CONFIGS.generic;
}

function createIssue(rule, line, msg, scope) {
  return {
    line,
    rule,
    severity: scope.blockingRules.has(rule) ? "blocking" : "warning",
    msg,
  };
}

// ==================== Regex Patterns ====================

const THAI_REGEX = /[\u0E00-\u0E7F]/;
const VAGUE_ENGLISH_REGEX =
  /^(?:\/\/|\/\*|\*)\s*(fix(ed)?( bug)?|test(ing)?|update(d)?|todo|refactor(ing)?|remove(d)?|handle|improve|add(ed)?|change(d)?)(?:\s*\.*)?\s*(\*\/)?$/i;

// จับคอมเมนต์สั้นที่แค่พูดซ้ำสิ่งที่โค้ดบอกอยู่แล้ว โดยไม่ได้อธิบายเหตุผลหรือผลกระทบ
const TRIVIAL_THAI_PATTERNS = [
  /^\/\/\s*สร้างตัวแปร\s*\w*\s*$/,
  /^\/\/\s*เช็[กค]เงื่อนไข\s*$/,
  /^\/\/\s*ประกาศตัวแปร\s*\w*\s*$/,
  /^\/\/\s*เรียกใช้ฟังก์ชัน\s*\w*\s*$/,
  /^\/\/\s*คืนค่า\s*$/,
  /^\/\/\s*ส่งค่ากลับ\s*$/,
  /^\/\/\s*วนลูป\s*$/,
];

const LOW_SIGNAL_ENGLISH_PATTERNS = [
  /^(?:use|using)\b.+\bcontext$/i,
  /^get .+ first$/i,
  /^fetch .+$/i,
  /^render(?: .+)?$/i,
  /^format(?: .+)?$/i,
  /^helpers?$/i,
  /^public api$/i,
  /^shared presenter$/i,
  /^path builder$/i,
  /^api mutation$/i,
  /^loading state$/i,
];

const ENGLISH_ONLY_SECTION_PATTERNS = [
  /^(?:ui\s+)?state$/i,
  /^data fetching$/i,
  /^form hydration$/i,
  /^change detection$/i,
  /^normalization$/i,
  /^mutation$/i,
  /^event handlers?$/i,
  /^render(?: .+)?$/i,
  /^loading state$/i,
  /^public api$/i,
  /^helpers?$/i,
];

const SECTION_BORDER_REGEX = /[─\-~]{2,}/;

// ==================== Rule Checks ====================

function checkFileHeader(code, totalLines, scope) {
  if (totalLines < scope.headerMinLines) return null;

  const firstFiveLines = code.split("\n").slice(0, 5).join("\n");
  const hasComment =
    /\/\/[^/]/.test(firstFiveLines) || /\/\*/.test(firstFiveLines);

  const hasMeaningfulComment =
    hasComment &&
    firstFiveLines
      .split("\n")
      .some(
        (line) =>
          (/\/\//.test(line) || /\/\*/.test(line)) &&
          !line.includes("eslint") &&
          !line.includes("ts-ignore") &&
          !line.includes("ts-expect-error") &&
          !line.includes("prettier")
      );

  if (!hasMeaningfulComment) {
    return createIssue(
      3,
      1,
      `ไฟล์ ${totalLines} บรรทัดใน scope ${scope.label} ยังไม่มี File Header ใน 5 บรรทัดแรก — AI และคนอ่านจะจับภาพรวมได้ช้า`,
      scope,
    );
  }

  return null;
}

function checkCommentDensity(totalLines, commentLineCount, scope) {
  if (totalLines < scope.densityMinLines) return null;
  if (commentLineCount >= scope.minCommentLines) return null;

  return createIssue(
    2,
    1,
    `ไฟล์ใหญ่ (${totalLines} บรรทัด) ใน scope ${scope.label} มีคอมเมนต์เพียง ${commentLineCount} บรรทัด — ควรเติมคำอธิบายจุดที่มี logic หรือข้อจำกัด`,
    scope,
  );
}

function normalizeCommentText(rawText) {
  return rawText
    .replace(/^\{\/\*\s*/, "")
    .replace(/\s*\*\/\}$/, "")
    .replace(/^\/\/\s*/, "")
    .replace(/^\/\*\s*/, "")
    .replace(/^\*\s*/, "")
    .replace(/\s*\*\/$/, "")
    .trim();
}

function stripSectionDecorators(text) {
  return text
    .replace(/^[─\-~\s]+/, "")
    .replace(/[─\-~\s]+$/, "")
    .trim();
}

function isSectionBannerComment(rawText) {
  const normalized = normalizeCommentText(rawText);
  return /^[─\-~]{2,}\s+/.test(normalized) || /\s[─\-~]{2,}$/.test(normalized);
}

function analyzeCommentStructure(code) {
  const lines = code.split("\n");
  const commentLines = [];
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      continue;
    }

    const startsJsxBlock = trimmed.startsWith("{/*");
    const startsLineComment = trimmed.startsWith("//");
    const startsBlockComment = trimmed.startsWith("/*");
    const isBlockBody =
      inBlockComment ||
      trimmed.startsWith("*") ||
      trimmed.startsWith("*/") ||
      trimmed.endsWith("*/}");

    if (!startsJsxBlock && !startsLineComment && !startsBlockComment && !isBlockBody) {
      continue;
    }

    commentLines.push({
      line: i + 1,
      raw: trimmed,
      normalized: normalizeCommentText(trimmed),
    });

    if (startsJsxBlock || startsBlockComment) {
      const closesInline = trimmed.includes("*/");
      inBlockComment = !closesInline;
      continue;
    }

    if (inBlockComment && (trimmed.includes("*/") || trimmed.endsWith("*/}"))) {
      inBlockComment = false;
    }
  }

  const headerCommentCount = commentLines.filter((line) => line.line <= 5).length;
  const sectionCommentCount = commentLines.filter((line) => {
    if (!isSectionBannerComment(line.raw)) return false;
    if (!line.normalized || !THAI_REGEX.test(line.normalized)) return false;

    const content = stripSectionDecorators(line.normalized);
    return content.length > 0 && content.length <= 80;
  }).length;

  const explanatoryCommentCount = commentLines.filter((line) => {
    if (line.line <= 5) return false;
    if (isSectionBannerComment(line.raw)) return false;
    if (!THAI_REGEX.test(line.normalized)) return false;
    if (line.normalized.length < 18) return false;
    if (/eslint|ts-ignore|ts-expect-error|prettier-ignore/.test(line.normalized)) return false;
    return true;
  }).length;

  return {
    commentLines,
    commentLineCount: commentLines.length,
    hasFileHeader: headerCommentCount > 0,
    sectionCommentCount,
    explanatoryCommentCount,
  };
}

function estimateLogicSignals(code) {
  const patterns = [
    /\buseEffect\s*\(/g,
    /\bReact\.useEffect\s*\(/g,
    /\buseQuery\s*\(/g,
    /\buseMutation\s*\(/g,
    /\buseInfiniteQuery\s*\(/g,
    /\buseCallback\s*\(/g,
    /\buseMemo\s*\(/g,
    /\buseReducer\s*\(/g,
    /\bhandle[A-Z]\w*\s*=/g,
    /\bconst\s+\w+\s*=\s*async\b/g,
    /\bfunction\s+\w+\s*\(/g,
    /\bif\s*\(/g,
    /\bswitch\s*\(/g,
    /\bfor\s*\(/g,
    /\bwhile\s*\(/g,
    /\btry\s*\{/g,
    /\bcatch\s*(?:\(|\{)/g,
  ];

  return patterns.reduce((total, pattern) => total + (code.match(pattern) || []).length, 0);
}

function checkCommentDensityWithContext(totalLines, commentInfo, scope, logicSignals) {
  if (totalLines < scope.densityMinLines) return null;
  if (logicSignals < 6) return null;
  if (
    commentInfo.hasFileHeader ||
    commentInfo.sectionCommentCount > 0 ||
    commentInfo.explanatoryCommentCount > 0
  ) {
    return null;
  }

  return createIssue(
    2,
    1,
    `ไฟล์ใหญ่ (${totalLines} บรรทัด) ใน scope ${scope.label} มี logic ค่อนข้างหนัก แต่ยังไม่พบทั้ง file header, section comments และคอมเมนต์อธิบายจุดสำคัญ`,
    scope,
  );
}

function checkOrphanedEnglishJSDoc(comments, scope) {
  const issues = [];

  for (const comment of comments) {
    if (comment.type !== "block" || !comment.content.startsWith("/**")) {
      continue;
    }

    const descriptionLines = comment.content
      .split("\n")
      .filter((line) => {
        const trimmed = line.trim().replace(/^\*\s?/, "").trim();
        return (
          trimmed.length > 0 &&
          !trimmed.startsWith("/**") &&
          !trimmed.startsWith("*/") &&
          !trimmed.startsWith("@")
        );
      });

    if (descriptionLines.length < 2) continue;

    if (!THAI_REGEX.test(comment.content)) {
      issues.push(
        createIssue(
          4,
          comment.line,
          `JSDoc block เป็นภาษาอังกฤษล้วน (${descriptionLines.length} บรรทัด) — ควรมีคำอธิบายภาษาไทยด้วย`,
          scope,
        ),
      );
    }
  }

  return issues;
}

function checkTrivialComments(comments, scope) {
  const issues = [];

  for (const comment of comments) {
    if (comment.type !== "line") continue;

    for (const pattern of TRIVIAL_THAI_PATTERNS) {
      if (pattern.test(comment.content)) {
        issues.push(
          createIssue(
            5,
            comment.line,
            `คอมเมนต์ "${comment.content.trim()}" เป็นการแปลตรงที่ไม่ช่วยอธิบายบริบท — ควรอธิบาย "ทำไม" หรือ "ผลกระทบ" แทน`,
            scope,
          ),
        );
        break;
      }
    }
  }

  return issues;
}

function checkEnglishInlineComments(comments, scope) {
  const issues = [];

  for (const comment of comments) {
    if (comment.type !== "line") continue;
    if (THAI_REGEX.test(comment.content)) continue;

    const text = comment.content.replace(/^\/\/\s*/, "").trim();

    if (!text) continue;
    if (/^[=\-~#*─━┄]{2,}/.test(text) || /[=\-~#*─━┄]{2,}$/.test(text)) {
      continue;
    }
    if (/^[\p{Emoji}\s]+$/u.test(text)) continue;
    if (/^https?:\/\//.test(text)) continue;
    if (/[;{}()[\]`$=>]/.test(text)) continue;
    if (/%[sdfo]/.test(text) || /^['"]/.test(text)) continue;
    if (/^@\w+/.test(text)) continue;

    const englishWords = text.match(/[a-zA-Z]{2,}/g) || [];
    if (englishWords.length >= 6) {
      const preview = text.length > 60 ? `${text.slice(0, 57)}...` : text;
      issues.push(
        createIssue(
          6,
          comment.line,
          `Inline comment เป็นภาษาอังกฤษล้วน: "${preview}" — ควรแปลเป็นไทยหรือผสมไทย+คำเทคนิคอังกฤษ`,
          scope,
        ),
      );
    }
  }

  return issues;
}

function checkPoorCommentQuality(commentInfo, scope) {
  const issues = [];

  for (const line of commentInfo.commentLines) {
    const normalized = stripSectionDecorators(line.normalized);
    if (!normalized) continue;

    const englishWords = normalized.match(/[a-zA-Z]{2,}/g) || [];
    const hasThai = THAI_REGEX.test(normalized);
    const isSectionComment = isSectionBannerComment(line.raw);

    if (
      isSectionComment &&
      !hasThai &&
      englishWords.length > 0 &&
      ENGLISH_ONLY_SECTION_PATTERNS.some((pattern) => pattern.test(normalized))
    ) {
      issues.push(
        createIssue(
          7,
          line.line,
          `Section comment เป็นภาษาอังกฤษล้วน: "${normalized}" — ควรใช้ไทยเป็นหลักและใส่ English hint ในวงเล็บถ้าจำเป็น`,
          scope,
        ),
      );
      continue;
    }

    if (isSectionComment && normalized.length > 80) {
      issues.push(
        createIssue(
          7,
          line.line,
          `Section comment ยาวเกิน guideline: "${normalized.slice(0, 60)}${normalized.length > 60 ? "..." : ""}" — ควรย่อให้เหลือหัวข้อสั้น 1 บรรทัด`,
          scope,
        ),
      );
      continue;
    }

    if (
      !hasThai &&
      englishWords.length > 0 &&
      normalized.length <= 48 &&
      LOW_SIGNAL_ENGLISH_PATTERNS.some((pattern) => pattern.test(normalized))
    ) {
      issues.push(
        createIssue(
          7,
          line.line,
          `คอมเมนต์ low-signal: "${normalized}" — ควรอธิบายเป็นไทยให้ชัดว่าจุดนี้สำคัญอย่างไร`,
          scope,
        ),
      );
    }
  }

  return issues;
}

// ==================== Main Audit ====================

function auditFile(filePath) {
  // ไฟล์นี้มี regex สำหรับจับ block comments อยู่ใน source เอง
  // ถ้าสแกนตัวเองด้วย parser แบบ regex จะเกิด false positive จาก pattern `/\* ... */`
  if (filePath === SELF_AUDIT_FILE) {
    const code = fs.readFileSync(filePath, "utf8");
    const commentInfo = analyzeCommentStructure(code);
    return {
      file: filePath,
      relPath: path.relative(ROOT, filePath),
      scopeKey: classifyScope(path.relative(ROOT, filePath)),
      scopeLabel: getScopeConfig(path.relative(ROOT, filePath)).label,
      issues: [],
      totalLines: code.split("\n").length,
      commentLineCount: commentInfo.commentLineCount,
    };
  }

  const relPath = path.relative(ROOT, filePath);
  const scope = getScopeConfig(relPath);
  const code = fs.readFileSync(filePath, "utf8");
  const totalLines = code.split("\n").length;
  const comments = extractComments(code, filePath);
  const commentInfo = analyzeCommentStructure(code);
  const logicSignals = estimateLogicSignals(code);

  const issues = [];
  let hasThai = false;
  let commentLineCount = commentInfo.commentLineCount;

  for (const comment of comments) {
    if (THAI_REGEX.test(comment.content)) {
      hasThai = true;
    }

    if (VAGUE_ENGLISH_REGEX.test(comment.content)) {
      issues.push(
        createIssue(
          0,
          comment.line,
          `คอมเมนต์คลุมเครือ: "${comment.content.trim()}" — ควรอธิบายให้ชัดว่า logic นี้ทำอะไรและทำไปเพื่ออะไร`,
          scope,
        ),
      );
    }
  }

  if (comments.length > 0 && !hasThai) {
    issues.push(
      createIssue(
        1,
        1,
        "มีคอมเมนต์แต่ไม่มีภาษาไทยเลย — ควรอธิบายอย่างน้อยภาพรวมของไฟล์หรือเหตุผลของ logic เป็นภาษาไทย",
        scope,
      ),
    );
  }

  const densityIssue = checkCommentDensityWithContext(
    totalLines,
    commentInfo,
    scope,
    logicSignals,
  );
  if (densityIssue) issues.push(densityIssue);

  const headerIssue = checkFileHeader(code, totalLines, scope);
  if (headerIssue) issues.push(headerIssue);

  issues.push(...checkOrphanedEnglishJSDoc(comments, scope));
  issues.push(...checkTrivialComments(comments, scope));
  issues.push(...checkEnglishInlineComments(comments, scope));
  issues.push(...checkPoorCommentQuality(commentInfo, scope));

  return {
    file: filePath,
    relPath,
    scopeKey: classifyScope(relPath),
    scopeLabel: scope.label,
    issues,
    totalLines,
    commentLineCount,
  };
}

// ==================== Summary Report ====================

function printGroupedResults(allResults) {
  const groupedResults = {};

  for (const result of allResults) {
    if (result.issues.length === 0) continue;

    const moduleName = result.relPath.split(path.sep)[0];
    if (!groupedResults[moduleName]) {
      groupedResults[moduleName] = [];
    }

    groupedResults[moduleName].push(result);
  }

  const modules = Object.keys(groupedResults).sort();
  for (const moduleName of modules) {
    console.log(`\n\x1b[36m=== ${moduleName.toUpperCase()} MODULE ===\x1b[0m`);

    for (const result of groupedResults[moduleName]) {
      console.log(
        `\x1b[33m[!] ${result.relPath}\x1b[0m (${result.scopeLabel}, ${result.totalLines} lines, ${result.commentLineCount} comment lines)`,
      );

      for (const issue of result.issues) {
        const severityTag =
          issue.severity === "blocking"
            ? "\x1b[31m[blocking]\x1b[0m"
            : "\x1b[33m[warning]\x1b[0m";

        console.log(`    ${severityTag} Rule ${issue.rule}: ${issue.msg}`);
      }

      console.log("");
    }
  }
}

function printSummary(allResults, filesToScan) {
  const ruleCount = {};
  const scopeCount = {};
  let totalIssues = 0;
  let totalWarnings = 0;
  let totalBlocking = 0;
  let filesWithIssues = 0;

  for (const result of allResults) {
    scopeCount[result.scopeKey] = (scopeCount[result.scopeKey] || 0) + 1;

    if (result.issues.length === 0) continue;
    filesWithIssues++;

    for (const issue of result.issues) {
      ruleCount[issue.rule] = (ruleCount[issue.rule] || 0) + 1;
      totalIssues++;

      if (issue.severity === "blocking") {
        totalBlocking++;
      } else {
        totalWarnings++;
      }
    }
  }

  console.log(
    `Audit complete. Scanned ${filesToScan.length} files and found ${totalIssues} issues across ${filesWithIssues} files.`,
  );
  console.log(
    `Severity summary: ${totalBlocking} blocking, ${totalWarnings} warnings.\n`,
  );
  console.log("Heuristic scope: source coverage + comment structure + baseline quality checks.\n");

  console.log("📦 Coverage by Scope:");
  for (const [scopeKey, count] of Object.entries(scopeCount).sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    console.log(`  - ${SCOPE_CONFIGS[scopeKey].label}: ${count} files`);
  }

  console.log("\n📊 Summary by Rule:");
  for (const [rule, name] of Object.entries(RULE_NAMES)) {
    const count = ruleCount[rule] || 0;
    const icon = count === 0 ? "✅" : "⚠️";
    console.log(`  ${icon} Rule ${rule} (${name}): ${count} issues`);
  }

  if (totalIssues === 0) {
    console.log(
      "\n✅ Current heuristic checks passed for comment coverage and baseline quality.",
    );
    return { totalBlocking, totalWarnings };
  }

  console.log("\n💡 Audit policy:");
  console.log("  - blocking: ควรแก้ก่อน merge หรือก่อนปิดงาน");
  console.log("  - warning: คุณภาพยังดีขึ้นได้ แต่ยังไม่บล็อกงานในโหมดปกติ");
  console.log(
    `  - strict mode: ${IS_STRICT_MODE ? "เปิดอยู่" : "ปิดอยู่"}${IS_STRICT_MODE ? " — warning จะทำให้ fail ด้วย" : " — ใช้ --strict หากต้องการให้ warning fail ด้วย"}`,
  );

  return { totalBlocking, totalWarnings };
}

// ==================== Entry Point ====================

function main() {
  console.log("=== 🧠 AI Context & Code Comment Quality Audit ===\n");

  const filesToScan = [];
  for (const dir of TARGET_DIRS) {
    walkFiles(dir, filesToScan);
  }

  console.log(`Scanning ${filesToScan.length} source files...\n`);

  const allResults = filesToScan.map(auditFile);
  printGroupedResults(allResults);

  const { totalBlocking, totalWarnings } = printSummary(allResults, filesToScan);

  if (totalBlocking > 0) {
    process.exitCode = 1;
    return;
  }

  if (IS_STRICT_MODE && totalWarnings > 0) {
    process.exitCode = 1;
  }
}

main();
