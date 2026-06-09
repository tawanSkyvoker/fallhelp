#!/usr/bin/env node

/**
 * สคริปต์ตรวจ instruction drift ของไฟล์ AI ใน repo นี้
 *
 * เป้าหมาย:
 * 1) ตรวจว่าไฟล์ instruction หลักยังมีอยู่ครบ
 * 2) ตรวจว่า adapter files ยังชี้กลับมาที่ AGENTS.md ตามสถาปัตยกรรมกลาง
 * 3) ตรวจว่า markdown links และ path reference ใน instruction ยังชี้ไปไฟล์จริง
 * 4) จับ path / ข้อความเก่าที่เคยทำให้ docs drift เช่น scheduler path เดิม
 *
 * วิธีใช้:
 *   npm run audit:instructions
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DISCOVERY_DIRS = [
  ".github/agents",
  ".github/skills",
  ".claude/commands",
  ".agent/skills",
  "docs/ai",
];
const AUDIT_EXTENSIONS = new Set([".md", ".mdc"]);

const REQUIRED_FILES = [
  "AGENTS.md",
  "GEMINI.md",
  "CLAUDE.md",
  ".github/copilot-instructions.md",
  ".github/agents/architecture.md",
  ".claude/commands/debug-ble-provisioning.md",
  ".claude/commands/debug-mqtt-device-flow.md",
  ".claude/commands/firmware.md",
  ".claude/commands/qa-review.md",
  ".claude/commands/testing-report.md",
  ".claude/commands/write-docs.md",
  ".github/skills/new-api-endpoint/SKILL.md",
  ".github/skills/new-mobile-screen/SKILL.md",
  ".github/skills/new-mqtt-handler/SKILL.md",
  ".github/skills/firmware/SKILL.md",
  ".github/skills/debug-ble-provisioning/SKILL.md",
  ".github/skills/debug-mqtt-device-flow/SKILL.md",
  ".agent/skills/diagram-expert/SKILL.md",
  ".agent/skills/diagram-expert/references/uml-standards.md",
  ".agent/skills/diagram-expert/references/mermaid-syntax.md",
  ".agent/skills/diagram-expert/references/output-structure.md",
  ".agent/skills/diagram-expert/references/use-case.md",
  ".agent/skills/diagram-expert/references/class-diagram.md",
  ".agent/skills/diagram-expert/references/sequence-diagram.md",
  ".agent/skills/diagram-expert/references/er-diagram.md",
  ".agent/skills/diagram-expert/references/selection-policy.md",
  ".agent/skills/diagram-expert/references/language-policy.md",
  ".agent/skills/fallhelp-fullstack-agent/SKILL.md",
  ".agent/skills/iot-firmware-expert/SKILL.md",
  ".agent/skills/iot-firmware-expert/references/coding-playbook.md",
  ".agent/skills/iot-firmware-expert/references/sensor-tuning-playbook.md",
  ".agent/skills/iot-firmware-expert/references/debug-checklist.md",
  ".agent/skills/fall-detection-sensor-lab/SKILL.md",
  ".agent/skills/fall-detection-sensor-lab/references/phase-order.md",
  ".agent/skills/fall-detection-sensor-lab/references/file-contract.md",
  ".agent/skills/fall-detection-sensor-lab/references/decision-rules.md",
  ".agent/skills/fallhelp-fullstack-agent/references/commenting.md",
  ".agent/skills/fallhelp-fullstack-agent/references/cross-stack-checklist.md",
  ".agent/skills/fallhelp-fullstack-agent/references/docs-sync.md",
  ".agent/skills/fallhelp-fullstack-agent/references/drift-checklist.md",
  ".agent/skills/fallhelp-fullstack-agent/references/module-routing.md",
  ".agent/skills/fallhelp-fullstack-agent/references/invariants.md",
  ".agent/skills/fallhelp-fullstack-agent/references/validation.md",
  ".agent/skills/testing-expert/SKILL.md",
  ".agent/skills/testing-expert/references/fallhelp-patterns.md",
  ".agent/skills/testing-expert/references/feature-report-template.md",
  ".agent/skills/testing-expert/references/testing-theory.md",
  ".agents/skills/link-workspace-packages/SKILL.md",
  ".agents/skills/monitor-ci/SKILL.md",
  ".agents/skills/monitor-ci/references/fix-flows.md",
  ".agents/skills/nx-generate/SKILL.md",
  ".agents/skills/nx-import/SKILL.md",
  ".agents/skills/nx-import/references/ESLINT.md",
  ".agents/skills/nx-import/references/GRADLE.md",
  ".agents/skills/nx-import/references/JEST.md",
  ".agents/skills/nx-import/references/NEXT.md",
  ".agents/skills/nx-import/references/TURBOREPO.md",
  ".agents/skills/nx-import/references/VITE.md",
  ".agents/skills/nx-plugins/SKILL.md",
  ".agents/skills/nx-run-tasks/SKILL.md",
  ".agents/skills/nx-workspace/SKILL.md",
  ".agents/skills/nx-workspace/references/AFFECTED.md",
  "docs/ai/AI_QUICKSTART.md",
  "docs/ai/AI_MODULE_ROUTER.md",
  "docs/ai/agent-reference.md",
  "docs/ai/system_overview.md",
  "docs/ai/backend.md",
  "docs/ai/mobile.md",
  "docs/ai/admin.md",
  "docs/ai/firmware.md",
];

const FILE_EXPECTATIONS = [
  {
    file: "GEMINI.md",
    requiredSnippets: [
      "AGENTS.md",
      "docs/ai/AI_QUICKSTART.md",
      "docs/ai/AI_MODULE_ROUTER.md",
      "docs/ai/system_overview.md",
      "/memory refresh",
    ],
  },
  {
    file: "CLAUDE.md",
    requiredSnippets: [
      "AGENTS.md",
      "docs/ai/AI_QUICKSTART.md",
      "docs/ai/AI_MODULE_ROUTER.md",
      "docs/ai/system_overview.md",
    ],
  },
  {
    file: ".github/copilot-instructions.md",
    requiredSnippets: [
      "AGENTS.md",
      "docs/ai/AI_QUICKSTART.md",
      "docs/ai/AI_MODULE_ROUTER.md",
    ],
  },
  {
    file: ".github/agents/architecture.md",
    requiredSnippets: ["AGENTS.md", "docs/ai/"],
  },
  {
    file: ".agent/skills/diagram-expert/SKILL.md",
    requiredSnippets: [
      "references/uml-standards.md",
      "references/mermaid-syntax.md",
      "references/output-structure.md",
      "references/selection-policy.md",
      "references/language-policy.md",
      "references/use-case.md",
      "references/class-diagram.md",
      "references/sequence-diagram.md",
      "references/er-diagram.md",
    ],
  },
  {
    file: ".github/skills/new-api-endpoint/SKILL.md",
    requiredSnippets: ["AGENTS.md", "docs/ai/backend.md"],
  },
  {
    file: ".github/skills/new-mobile-screen/SKILL.md",
    requiredSnippets: ["AGENTS.md", "docs/ai/mobile.md"],
  },
  {
    file: ".github/skills/new-mqtt-handler/SKILL.md",
    requiredSnippets: ["AGENTS.md", "docs/ai/backend.md"],
  },
  {
    file: ".github/skills/firmware/SKILL.md",
    requiredSnippets: [
      "AGENTS.md",
      "docs/ai/firmware.md",
      ".agent/skills/iot-firmware-expert/SKILL.md",
      ".agent/skills/fall-detection-sensor-lab/SKILL.md",
      "sensor-tuning",
      "pulse-signal",
    ],
  },
  {
    file: ".github/skills/debug-ble-provisioning/SKILL.md",
    requiredSnippets: ["AGENTS.md", "docs/ai/firmware.md", "docs/ai/mobile.md"],
  },
  {
    file: ".github/skills/debug-mqtt-device-flow/SKILL.md",
    requiredSnippets: [
      "AGENTS.md",
      "docs/ai/firmware.md",
      "docs/ai/backend.md",
    ],
  },
  {
    file: ".claude/commands/firmware.md",
    requiredSnippets: [
      "AGENTS.md",
      "docs/ai/firmware.md",
      "firmware/esp32/START_HERE.md",
      ".agent/skills/iot-firmware-expert/SKILL.md",
      "sensor-tuning",
      "pulse-signal",
    ],
  },
  {
    file: ".claude/commands/debug-ble-provisioning.md",
    requiredSnippets: [
      "AGENTS.md",
      "docs/ai/firmware.md",
      "docs/ai/mobile.md",
      ".agent/skills/iot-firmware-expert/SKILL.md",
    ],
  },
  {
    file: ".claude/commands/debug-mqtt-device-flow.md",
    requiredSnippets: [
      "AGENTS.md",
      "docs/ai/firmware.md",
      "docs/ai/backend.md",
      ".agent/skills/iot-firmware-expert/SKILL.md",
    ],
  },
  {
    file: ".agent/skills/fallhelp-fullstack-agent/SKILL.md",
    requiredSnippets: [
      "AGENTS.md",
      "docs/ai/AI_QUICKSTART.md",
      "docs/ai/AI_MODULE_ROUTER.md",
      "docs/ai/agent-reference.md",
      "references/commenting.md",
      "references/cross-stack-checklist.md",
      "references/docs-sync.md",
      "references/drift-checklist.md",
      "references/module-routing.md",
      "references/invariants.md",
      "references/validation.md",
    ],
  },
  {
    file: ".agent/skills/iot-firmware-expert/SKILL.md",
    requiredSnippets: [
      "AGENTS.md",
      "docs/ai/AI_QUICKSTART.md",
      "docs/ai/firmware.md",
      "firmware/esp32/START_HERE.md",
      "references/coding-playbook.md",
      "references/sensor-tuning-playbook.md",
      "references/debug-checklist.md",
    ],
  },
  {
    file: ".agent/skills/fall-detection-sensor-lab/SKILL.md",
    requiredSnippets: [
      "AGENTS.md",
      "docs/ai/AI_QUICKSTART.md",
      "docs/ai/firmware.md",
      "firmware/esp32/START_HERE.md",
      "firmware/esp32/fall_detection_sensor_lab/README.md",
      "references/phase-order.md",
      "references/file-contract.md",
      "references/decision-rules.md",
    ],
  },
  {
    file: ".agent/skills/testing-expert/SKILL.md",
    requiredSnippets: ["docs/testing/", "references/fallhelp-patterns.md"],
  },
];

const THIN_WRAPPER_LIMITS = [
  { file: "CLAUDE.md", maxNonEmptyLines: 80 },
  { file: "GEMINI.md", maxNonEmptyLines: 45 },
  { file: ".github/copilot-instructions.md", maxNonEmptyLines: 40 },
  { file: ".github/agents/architecture.md", maxNonEmptyLines: 45 },
  { prefix: ".claude/commands/", maxNonEmptyLines: 45 },
  { prefix: ".github/skills/", maxNonEmptyLines: 45 },
];

const FORBIDDEN_PATTERNS = [
  {
    pattern: "apps/backend-api/src/otpScheduler.ts",
    reason:
      "path นี้เลิกใช้แล้ว ปัจจุบันต้องอ้าง apps/backend-api/src/schedulers/otpScheduler.ts",
  },
];

const PATH_PREFIXES = [
  "AGENTS.md",
  "CLAUDE.md",
  ".github/",
  ".agent/",
  "docs/",
  "apps/backend-api/",
  "apps/mobile/",
  "apps/admin/",
  "firmware/esp32/",
  "scripts/",
];

function toAbsolute(relPath) {
  return path.join(ROOT, relPath);
}

function fileExists(relPath) {
  return fs.existsSync(toAbsolute(relPath));
}

function readText(relPath) {
  return fs.readFileSync(toAbsolute(relPath), "utf8");
}

function walkInstructionFiles(dir, out = []) {
  const absoluteDir = toAbsolute(dir);
  if (!fs.existsSync(absoluteDir)) return out;

  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    const absolutePath = path.join(absoluteDir, entry.name);
    const relPath = path.relative(ROOT, absolutePath);

    if (entry.isDirectory()) {
      walkInstructionFiles(relPath, out);
      continue;
    }

    if (
      AUDIT_EXTENSIONS.has(path.extname(entry.name))
    ) {
      out.push(relPath);
    }
  }

  return out;
}

function collectAuditTargets() {
  const discovered = DISCOVERY_DIRS.flatMap((dir) => walkInstructionFiles(dir));
  return [...new Set([...REQUIRED_FILES, ...discovered])].sort();
}

function normalizeLinkTarget(rawLink) {
  if (!rawLink) return null;
  let link = rawLink.trim();

  if (link.startsWith("<") && link.endsWith(">")) {
    link = link.slice(1, -1).trim();
  }

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

  return link.split("#")[0].split("?")[0].trim() || null;
}

function stripFencedCode(text) {
  return text.replace(/```[\s\S]*?```/g, "");
}

function parseMarkdownLinks(text) {
  const links = [];
  const cleaned = stripFencedCode(text);
  const regex = /!?\[[^\]]*]\(([^)\n]+)\)/g;
  let match;

  while ((match = regex.exec(cleaned)) !== null) {
    links.push(match[1].trim());
  }

  return links;
}

// ดึง path จาก inline code เฉพาะที่ดูเหมือนเป็น path ของ repo จริง
function parseInlineRepoPaths(text) {
  const refs = [];
  const regex = /`([^`\n]+)`/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const candidate = match[1].trim().replace(/[.,;:]$/, "");
    if (
      candidate.includes("*") ||
      candidate.includes("...") ||
      candidate.includes("Txx") ||
      candidate.includes("<") ||
      candidate.includes(">") ||
      candidate.includes("{") ||
      candidate.includes("}")
    ) {
      continue;
    }
    if (
      PATH_PREFIXES.some(
        (prefix) => candidate === prefix || candidate.startsWith(prefix),
      )
    ) {
      refs.push(candidate);
    }
  }

  return refs;
}

function scanMissingRequiredFiles(issues) {
  for (const relPath of REQUIRED_FILES) {
    if (!fileExists(relPath)) {
      issues.push(`missing required file: ${relPath}`);
    }
  }
}

function scanFileExpectations(issues) {
  for (const entry of FILE_EXPECTATIONS) {
    if (!fileExists(entry.file)) continue;
    const text = readText(entry.file);

    for (const snippet of entry.requiredSnippets) {
      if (!text.includes(snippet)) {
        issues.push(`${entry.file} missing expected reference: ${snippet}`);
      }
    }
  }

  // Determine which .github/skills dirs are project-owned (in REQUIRED_FILES)
  const projectSkillPrefixes = new Set(
    REQUIRED_FILES.filter((f) => f.startsWith(".github/skills/")).map(
      (f) => f.split("/").slice(0, 3).join("/") + "/",
    ),
  );

  for (const relPath of collectAuditTargets().filter(fileExists)) {
    const isProjectSkill =
      relPath.startsWith(".github/skills/") &&
      [...projectSkillPrefixes].some((prefix) => relPath.startsWith(prefix));

    if (
      relPath === "CLAUDE.md" ||
      relPath === ".github/copilot-instructions.md" ||
      relPath === ".github/agents/architecture.md" ||
      relPath.startsWith(".claude/commands/") ||
      isProjectSkill
    ) {
      const text = readText(relPath);
      for (const snippet of [
        "AGENTS.md",
        "docs/ai/AI_QUICKSTART.md",
        "docs/ai/AI_MODULE_ROUTER.md",
      ]) {
        if (!text.includes(snippet)) {
          issues.push(`${relPath} missing canonical reference: ${snippet}`);
        }
      }
    }
  }
}

function countNonEmptyLines(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0).length;
}

function scanThinWrapperLimits(issues) {
  const projectSkillPrefixes = new Set(
    REQUIRED_FILES.filter((f) => f.startsWith(".github/skills/")).map(
      (f) => f.split("/").slice(0, 3).join("/") + "/",
    ),
  );

  for (const relPath of collectAuditTargets().filter(fileExists)) {
    // Skip thin-wrapper check for Nx-generated skills (not project-owned)
    if (
      relPath.startsWith(".github/skills/") &&
      ![...projectSkillPrefixes].some((prefix) => relPath.startsWith(prefix))
    )
      continue;

    const rule = THIN_WRAPPER_LIMITS.find((entry) =>
      "file" in entry
        ? entry.file === relPath
        : relPath.startsWith(entry.prefix),
    );

    if (!rule) continue;

    const nonEmptyLines = countNonEmptyLines(readText(relPath));
    if (nonEmptyLines > rule.maxNonEmptyLines) {
      issues.push(
        `${relPath} exceeds thin-wrapper limit (${nonEmptyLines} > ${rule.maxNonEmptyLines})`,
      );
    }
  }
}

function scanForbiddenPatterns(issues) {
  for (const relPath of collectAuditTargets().filter(fileExists)) {
    const text = readText(relPath);
    for (const rule of FORBIDDEN_PATTERNS) {
      if (text.includes(rule.pattern)) {
        issues.push(
          `${relPath} contains forbidden reference "${rule.pattern}" (${rule.reason})`,
        );
      }
    }
  }
}

function scanReferences(issues) {
  for (const relPath of collectAuditTargets().filter(fileExists)) {
    const absolutePath = toAbsolute(relPath);
    const text = readText(relPath);

    for (const rawLink of parseMarkdownLinks(text)) {
      const target = normalizeLinkTarget(rawLink);
      if (!target) continue;

      const resolved = path.normalize(
        path.join(path.dirname(absolutePath), target),
      );
      if (!fs.existsSync(resolved)) {
        issues.push(`${relPath} has broken markdown link: ${rawLink}`);
      }
    }

    for (const repoPath of parseInlineRepoPaths(text)) {
      const resolved = path.normalize(path.join(ROOT, repoPath));
      if (!fs.existsSync(resolved)) {
        issues.push(`${relPath} references missing repo path: ${repoPath}`);
      }
    }
  }
}

function main() {
  const issues = [];

  console.log("=== AI Instruction Drift Audit ===\n");

  scanMissingRequiredFiles(issues);
  scanFileExpectations(issues);
  scanThinWrapperLimits(issues);
  scanForbiddenPatterns(issues);
  scanReferences(issues);

  if (issues.length === 0) {
    console.log(
      "PASS: all required AI instruction files and references look consistent.",
    );
    process.exit(0);
  }

  console.log(`FAIL: found ${issues.length} issue(s).\n`);
  for (const issue of issues) {
    console.log(`- ${issue}`);
  }

  process.exit(1);
}

main();
