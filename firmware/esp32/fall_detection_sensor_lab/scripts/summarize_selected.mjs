import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * รวมไฟล์ CSV ของเซสชันที่ถูกคัดเลือก (Selected) ให้เป็นไฟล์สรุปตารางเดียว (selected_values_table.csv)
 *
 * Usage:
 *   node summarize_selected.mjs <selected_dir> [output_csv]
 *   node summarize_selected.mjs ../runs/S01/selected ../exports/selected_values_table.csv
 *
 * Logic (รองรับข้อมูลหลายรูปแบบ):
 *   - อ่านทุกไฟล์ .csv ใน selected_dir
 *   - ถ้าไฟล์เป็น raw multi-row (มีคอลัมน์ `type` ครบทุกตัวอย่าง):
 *       * magnitude_g = ดึงค่า max(svm_filtered_g) จากแถว type=imu_impact
 *                       (ถ้าไม่มี impact จะใช้ max(svm_filtered_g) ของทั้ง Trial แทน)
 *       * posture_delta_deg, decision = ดึงจากแถว type=imu_decision
 *   - ถ้าไฟล์เป็น aggregated single-row (ไฟล์แบบสรุปบรรทัดเดียว):
 *       * อ่านค่าตรงจากแถวสุดท้ายได้เลย
 *
 * หมายเหตุ: ไม่มีการเขียนทับไฟล์ในโฟลเดอร์ selected จะเขียนเฉพาะไฟล์ output
 */

// โครงสร้างคอลัมน์สำหรับไฟล์ CSV ผลลัพธ์
const OUTPUT_COLUMNS = [
  "trial_id", "activity_label", "expected_type",
  "magnitude_g", "posture_delta_deg", "decision", "summary",
];

// ฟังก์ชันแสดงวิธีใช้งานสคริปต์
function printUsage() {
  console.log("Usage: node summarize_selected.mjs <selected_dir> [output_csv]");
  console.log("Example: node summarize_selected.mjs ../runs/S01/selected ../exports/selected_values_table.csv");
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

// ฟังก์ชันแปลงค่าเป็นตัวเลข (ข้ามค่าที่ไม่ใช่ตัวเลข)
function toNum(v) {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * ฟังก์ชันจำกัดจุดทศนิยมสำหรับการแสดงผลในรายงานบทที่ 5
 * หากเป็นค่าว่าง จะส่งกลับเป็นสตริงว่าง ("")
 */
function fixed(v, dp) {
  if (v === "" || v === undefined || v === null) return "";
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n.toFixed(dp) : "";
}

/**
 * สรุปผลการทดลอง 1 Trial (ดึงค่าจาก Header และ Row ทั้งหมดในไฟล์)
 * - ถ้าเป็น raw multi-row (มี `type`): จะหาค่า peak magnitude จาก impact
 * - ถ้าเป็น aggregated (ไม่มี `type`): จะอ่านค่าตรงๆ จากแถวสุดท้าย
 */
function summarizeTrial(header, rows) {
  const last = rows[rows.length - 1];
  const base = {
    trial_id: last.trial_id ?? "",
    activity_label: last.activity_label ?? "",
    expected_type: last.expected_type ?? "",
  };

  if (!header.includes("type")) {
    return {
      ...base,
      magnitude_g: last.svm_filtered_g ?? "",
      posture_delta_deg: last.posture_delta_deg ?? "",
      decision: last.decision ?? "",
      summary: last.summary ?? "",
    };
  }

  // กรณีข้อมูลเป็น raw multi-row: จัดการดึงค่าสูงสุด (Peak) จากจังหวะกระแทก (impact)
  const impactRows = rows.filter((r) => r.type === "imu_impact");
  const impactPeak = impactRows
    .map((r) => toNum(r.svm_filtered_g))
    .filter((n) => n !== null);
  const allPeak = rows
    .map((r) => toNum(r.svm_filtered_g))
    .filter((n) => n !== null);

  let magnitude = "";
  let note = "";
  if (impactPeak.length > 0) {
    magnitude = String(Math.max(...impactPeak));
  } else if (allPeak.length > 0) {
    magnitude = String(Math.max(...allPeak));
    note = "ทำกิจกรรมปกติโดยไม่มีการแจ้งเตือน";
  } else {
    note = "ไม่มีข้อมูลแรงกระแทก";
  }

  const decisionRow = rows.filter((r) => r.type === "imu_decision").pop();
  
  let summary = "";
  if (decisionRow) {
    const dec = decisionRow.decision;
    if (dec === "suspected_fall" || dec === "fall_confirmed") {
      summary = "ตรวจพบการหกล้มและแจ้งเตือนภัยสำเร็จ";
    } else if (dec === "fall_cancelled") {
      summary = "ตรวจพบการล้มแต่ผู้สวมใส่กดยกเลิกใน 15 วินาที";
    } else {
      summary = "ทำกิจกรรมปกติโดยไม่มีการแจ้งเตือน";
    }
  } else {
  // Override summary if there's an explicit note in the decision row or last row
  const finalSummary = (decisionRow && decisionRow.note) || last.summary || last.note || note || summary;
  return {
    ...base,
    magnitude_g: magnitude,
    posture_delta_deg: decisionRow ? decisionRow.posture_delta_deg ?? "" : "",
    decision: decisionRow ? decisionRow.decision ?? "ignored" : "ignored",
    summary: finalSummary,
  };
}

// ฟังก์ชันหลีกหนีอักขระพิเศษ (Escape) สำหรับเขียนลง CSV
function csvEscape(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ฟังก์ชันหลักที่วนลูปอ่านไฟล์ในโฟลเดอร์ และรวมข้อมูลเข้าด้วยกัน
export function summarizeSelected(selectedDir, outputCsv, output = console.log, errorOutput = console.error) {
  if (!selectedDir) {
    output("Usage: node summarize_selected.mjs <selected_dir> [output_csv]");
    output("Example: node summarize_selected.mjs ../runs/S01/selected ../exports/selected_values_table.csv");
    return { exitCode: 1, rows: 0, outputCsv: "" };
  }
  if (!fs.existsSync(selectedDir) || !fs.statSync(selectedDir).isDirectory()) {
    errorOutput(`Directory not found: ${selectedDir}`);
    output("Usage: node summarize_selected.mjs <selected_dir> [output_csv]");
    output("Example: node summarize_selected.mjs ../runs/S01/selected ../exports/selected_values_table.csv");
    return { exitCode: 1, rows: 0, outputCsv: "" };
  }

  const resolvedOutputCsv =
    outputCsv || path.resolve(selectedDir, "..", "..", "..", "exports", "selected_values_table.csv");

  const files = fs
    .readdirSync(selectedDir)
    .filter((f) => f.endsWith(".csv"))
    .map((f) => path.join(selectedDir, f))
    .sort();

  if (files.length === 0) {
    errorOutput(`No .csv files found in: ${selectedDir}`);
    return { exitCode: 1, rows: 0, outputCsv: resolvedOutputCsv };
  }

  const outRows = [];
  for (const file of files) {
    const { header, rows } = parseCsv(fs.readFileSync(file, "utf8"));
    if (rows.length === 0) {
      console.warn(`skip empty: ${path.basename(file)}`);
      continue;
    }
    const s = summarizeTrial(header, rows);
    // Chapter 5 export precision: magnitude_g 2dp, posture_delta_deg 2dp
    s.magnitude_g = fixed(s.magnitude_g, 2);
    s.posture_delta_deg = fixed(s.posture_delta_deg, 2);
    outRows.push(s);
  }

  const lines = [OUTPUT_COLUMNS.join(",")];
  for (const row of outRows) {
    lines.push(OUTPUT_COLUMNS.map((c) => csvEscape(row[c])).join(","));
  }

  fs.mkdirSync(path.dirname(resolvedOutputCsv), { recursive: true });
  fs.writeFileSync(resolvedOutputCsv, lines.join("\n") + "\n", "utf8");

  output(`Wrote ${outRows.length} rows -> ${resolvedOutputCsv}`);
  return { exitCode: 0, rows: outRows.length, outputCsv: resolvedOutputCsv };
}

function main() {
  const result = summarizeSelected(process.argv[2], process.argv[3]);
  process.exit(result.exitCode);
}

if (import.meta.url === `file://${process.argv[1]}` || (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]))) {
  main();
}
