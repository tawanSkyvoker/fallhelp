import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * สร้างไฟล์ Markdown สำหรับบทที่ 3 และบทที่ 5 เพื่อใช้ประกอบรายงานโครงงาน/ปริญญานิพนธ์
 * โดยดึงข้อมูลตัวแทน (Representative Data) จากไฟล์ selected_values_table.csv
 *
 * Usage:
 *   node generate_chapter_examples.mjs <selected_values_table.csv> [out_dir]
 *   node generate_chapter_examples.mjs ../exports/selected_values_table.csv ../exports
 *
 * Output:
 *   <out_dir>/examples_for_fall_detection_sensor_lab.md
 *   <out_dir>/examples_for_chapter_5.md
 *
 * หมายเหตุ: สคริปต์นี้เป็นเพียงการอ่านข้อมูลเพื่อแปลงฟอร์แมต จะไม่มีการแก้ไขไฟล์ CSV ต้นฉบับ
 */

// พจนานุกรมแปลชื่อท่าทางการทดสอบ (Activity) เป็นภาษาไทย
const ACTIVITY_TH = {
  standing_still: "ยืนนิ่ง",
  walking_normal: "เดินปกติ",
  running_light: "วิ่งเบา ๆ",
  sit_normal: "นั่งลงปกติ",
  sit_hard: "นั่งลงแรง",
  side_fall_left: "ล้มด้านซ้าย",
  side_fall_right: "ล้มด้านขวา",
  forward_fall: "ล้มไปข้างหน้า",
  backward_fall: "ล้มไปข้างหลัง",
};

// พจนานุกรมแปลประเภทการทดสอบ (Type)
const TYPE_TH = { non_fall: "ไม่ล้ม", fall: "ล้ม" };

// พจนานุกรมแปลผลการตัดสินใจของระบบ (Decision)
const DECISION_TH = {
  ignored: "ไม่พบการล้ม",
  suspected_fall: "ตรวจพบการล้ม",
  fall_confirmed: "ยืนยันการล้ม",
  fall_cancelled: "ยกเลิกการแจ้งเตือน",
  pending: "รอผล",
};

function printUsage() {
  console.log("Usage: node generate_chapter_examples.mjs <selected_values_table.csv> [out_dir]");
  console.log("Example: node generate_chapter_examples.mjs ../exports/selected_values_table.csv ../exports");
}

// ฟังก์ชันแปลงข้อความ CSV เป็น Object Array
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { header: [], rows: [] };
  const header = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row = {};
    header.forEach((h, i) => {
      row[h] = (cells[i] ?? "").trim();
    });
    return row;
  });
  return { header, rows };
}

// ฟังก์ชันสร้างเนื้อหา Markdown สำหรับบทที่ 3 (โครงสร้างระบบและตัวอย่างการคำนวณ)
function buildChapter3(rows) {
  const fall = rows.find((r) => r.decision === "suspected_fall") || rows[0];
  const lines = [];
  lines.push("# ตัวอย่างสำหรับ Fall Detection Sensor Lab");
  lines.push("");
  lines.push("> สร้างอัตโนมัติจาก selected_values_table.csv");
  lines.push("");
  if (!fall) {
    lines.push("_ยังไม่มีข้อมูล selected_");
    return lines.join("\n") + "\n";
  }
  lines.push("## ตัวอย่าง Fall Case");
  lines.push("");
  lines.push("| Field | Value |");
  lines.push("|---|---:|");
  lines.push(`| Activity | ${fall.activity_label} |`);
  lines.push(`| Trial | ${fall.trial_id} |`);
  lines.push(`| Magnitude | ${fall.magnitude_g}g |`);
  lines.push(`| postureDelta | ${fall.posture_delta_deg}° |`);
  lines.push(`| decision | ${fall.decision} |`);
  lines.push("");
  lines.push("## วิธีคำนวณ magnitude");
  lines.push("");
  lines.push("```text");
  lines.push("SVM = √(ax² + ay² + az²)");
  lines.push("```");
  lines.push("");
  lines.push("## วิธีคำนวณ postureDelta");
  lines.push("");
  lines.push("```text");
  lines.push("pitchDelta = |pitchAfter - pitchBefore|");
  lines.push("rollDelta  = |rollAfter - rollBefore|");
  lines.push("postureDelta = max(pitchDelta, rollDelta)");
  lines.push("```");
  lines.push("");
  lines.push("## การตัดสิน");
  lines.push("");
  lines.push("```text");
  lines.push("Fall Suspected = (magnitude > impactThreshold) AND (postureDelta > postureThreshold)");
  lines.push("```");
  return lines.join("\n") + "\n";
}

// ฟังก์ชันสร้างเนื้อหา Markdown สำหรับบทที่ 5 (สรุปผลการทดลองตารางรวม)
function buildChapter5(rows) {
  const lines = [];
  lines.push("# ตัวอย่างสำหรับบทที่ 5");
  lines.push("");
  lines.push("> สร้างอัตโนมัติจาก selected_values_table.csv");
  lines.push("");
  lines.push("## ตารางผลการทดสอบจาก Basic Activity Collection");
  lines.push("");
  lines.push("| Trial | ท่าพื้นฐานที่ทดสอบ | ประเภท | Magnitude | Posture Delta | ผลที่ระบบตรวจจับ | สรุป |");
  lines.push("|---|---|---|---:|---:|---|---|");
  for (const r of rows) {
    const act = ACTIVITY_TH[r.activity_label] ?? r.activity_label;
    const typ = TYPE_TH[r.expected_type] ?? r.expected_type;
    const dec = DECISION_TH[r.decision] ?? r.decision;
    const mag = r.magnitude_g ? `${r.magnitude_g}g` : "-";
    const pd = r.posture_delta_deg ? `${r.posture_delta_deg}°` : "-";
    lines.push(`| ${r.trial_id} | ${act} | ${typ} | ${mag} | ${pd} | ${dec} | ${r.summary || "-"} |`);
  }
  return lines.join("\n") + "\n";
}

// ฟังก์ชันหลักที่รับคำสั่งผ่าน CLI แล้วจัดการเรียกใช้งานฟังก์ชันย่อยต่างๆ
export function generateChapterExamples(inputCsv, outDir, output = console.log, errorOutput = console.error) {
  if (!inputCsv) {
    output("Usage: node generate_chapter_examples.mjs <selected_values_table.csv> [out_dir]");
    output("Example: node generate_chapter_examples.mjs ../exports/selected_values_table.csv ../exports");
    return { exitCode: 1, ch3: "", ch5: "" };
  }
  if (!fs.existsSync(inputCsv) || !fs.statSync(inputCsv).isFile()) {
    errorOutput(`File not found: ${inputCsv}`);
    output("Usage: node generate_chapter_examples.mjs <selected_values_table.csv> [out_dir]");
    output("Example: node generate_chapter_examples.mjs ../exports/selected_values_table.csv ../exports");
    return { exitCode: 1, ch3: "", ch5: "" };
  }

  const { rows } = parseCsv(fs.readFileSync(inputCsv, "utf8"));
  if (rows.length === 0) {
    errorOutput("No data rows in input CSV");
    return { exitCode: 1, ch3: "", ch5: "" };
  }

  const resolvedOutDir = outDir || path.dirname(inputCsv);
  fs.mkdirSync(resolvedOutDir, { recursive: true });
  const ch3 = path.join(resolvedOutDir, "examples_for_fall_detection_sensor_lab.md");
  const ch5 = path.join(resolvedOutDir, "examples_for_chapter_5.md");
  fs.writeFileSync(ch3, buildChapter3(rows), "utf8");
  fs.writeFileSync(ch5, buildChapter5(rows), "utf8");

  output(`Wrote ${ch3}`);
  output(`Wrote ${ch5}`);
  return { exitCode: 0, ch3, ch5 };
}

function main() {
  const result = generateChapterExamples(process.argv[2], process.argv[3]);
  process.exit(result.exitCode);
}

if (import.meta.url === `file://${process.argv[1]}` || (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]))) {
  main();
}
