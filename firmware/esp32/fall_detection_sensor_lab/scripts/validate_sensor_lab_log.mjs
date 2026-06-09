import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * ตรวจสอบความถูกต้องสมบูรณ์ (Validation) ของไฟล์ข้อมูลดิบ (Raw CSV) จาก Fall Detection Sensor Lab
 *
 * Usage:
 *   node validate_sensor_lab_log.mjs <raw_dir_or_csv>
 *   node validate_sensor_lab_log.mjs ../runs/S01/raw
 *
 * เงื่อนไขการตรวจสอบ:
 *   - ต้องมีคอลัมน์ครบตาม Schema (REQUIRED_COLUMNS)
 *   - ข้อมูล Metadata (session_id, trial_id, activity_label, expected_type) ห้ามเป็นค่าว่าง
 *   - ต้องมีแถวที่ type=imu_decision อย่างน้อย 1 แถว เพื่อยืนยันว่าการเก็บข้อมูลสมบูรณ์
 *     (ยกเว้นกรณี expected_type=non_fall ที่อาจมีแค่ imu_sample ถือว่าผ่าน)
 *   - แถวที่เป็น decision ต้องมีค่าตัวแปรสำคัญครบถ้วน (svm_filtered_g, posture_delta_deg, decision)
 *
 * หมายเหตุ: สคริปต์นี้จะไม่แก้ไขไฟล์ข้อมูลดิบใดๆ และจะแสดงผลเป็น PASS/FAIL พร้อมบอกข้อผิดพลาด
 */

// รายชื่อคอลัมน์ทั้งหมดที่ต้องมีในไฟล์ CSV ตามมาตรฐาน (Schema)
const REQUIRED_COLUMNS = [
  "session_id", "trial_id", "activity_label", "expected_type",
  "timestamp_ms", "type", "state",
  "ax_g", "ay_g", "az_g", "gx_dps", "gy_dps", "gz_dps",
  "svm_raw_g", "svm_filtered_g",
  "pitch_deg", "roll_deg",
  "pitch_before_deg", "roll_before_deg", "pitch_after_deg", "roll_after_deg",
  "pitch_delta_deg", "roll_delta_deg", "posture_delta_deg",
  "impact_threshold_g", "posture_threshold_deg", "stabilize_ms",
  "decision", "note",
];

// รายชื่อคอลัมน์ Metadata ที่ห้ามเป็นค่าว่าง
const METADATA_COLUMNS = ["session_id", "trial_id", "activity_label", "expected_type"];

function printUsage() {
  console.log("Usage: node validate_sensor_lab_log.mjs <raw_dir_or_csv>");
  console.log("Example: node validate_sensor_lab_log.mjs ../runs/S01/raw");
}

/**
 * ฟังก์ชัน Parser พื้นฐานสำหรับแยกข้อความ CSV
 * (รองรับ comma-separated แต่ไม่รองรับคอมมาที่อยู่ภายในเครื่องหมายคำพูด (quoted comma))
 */
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

// ฟังก์ชันสำหรับตรวจสอบความถูกต้องของไฟล์ทีละไฟล์
function validateFile(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const { header, rows } = parseCsv(text);
  const errors = [];
  const infos = [];

  const missingCols = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missingCols.length > 0) {
    errors.push(`missing columns: ${missingCols.join(", ")}`);
  }

  if (rows.length === 0) {
    errors.push("no data rows");
  }

  for (const col of METADATA_COLUMNS) {
    if (header.includes(col)) {
      const blank = rows.some((r) => !r[col] || r[col].length === 0);
      if (blank) errors.push(`metadata column "${col}" has blank value`);
    }
  }

  const decisionRows = rows.filter((r) => r.type === "imu_decision");
  const sampleRows = rows.filter((r) => r.type === "imu_sample");
  const expectedType = rows.length > 0 ? rows[0].expected_type : "";

  if (decisionRows.length === 0) {
    if (expectedType === "non_fall" && sampleRows.length > 0) {
      infos.push(
        `non_fall trial: no imu_decision (sample-only, ${sampleRows.length} imu_sample rows) — OK`,
      );
    } else {
      errors.push("no row with type=imu_decision");
    }
  }

  for (const dr of decisionRows) {
    if (!dr.svm_filtered_g) errors.push("imu_decision row missing svm_filtered_g");
    if (!dr.posture_delta_deg) errors.push("imu_decision row missing posture_delta_deg");
    if (!dr.decision) errors.push("imu_decision row missing decision");
  }

  return { errors, infos };
}

// ฟังก์ชันสำหรับรวบรวมรายชื่อไฟล์ .csv ทั้งหมดในโฟลเดอร์เป้าหมาย
function collectCsvFiles(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) return target.endsWith(".csv") ? [target] : [];
  return fs
    .readdirSync(target)
    .filter((f) => f.endsWith(".csv"))
    .map((f) => path.join(target, f))
    .sort();
}

// ฟังก์ชันหลักที่ทำงานตรวจสอบไฟล์ทั้งหมดและพิมพ์รายงานผล
export function validateTarget(target, output = console.log, errorOutput = console.error) {
  if (!target) {
    output("Usage: node validate_sensor_lab_log.mjs <raw_dir_or_csv>");
    output("Example: node validate_sensor_lab_log.mjs ../runs/S01/raw");
    return { exitCode: 1, passed: 0, total: 0 };
  }
  if (!fs.existsSync(target)) {
    errorOutput(`Path not found: ${target}`);
    output("Usage: node validate_sensor_lab_log.mjs <raw_dir_or_csv>");
    output("Example: node validate_sensor_lab_log.mjs ../runs/S01/raw");
    return { exitCode: 1, passed: 0, total: 0 };
  }

  const files = collectCsvFiles(target);
  if (files.length === 0) {
    errorOutput(`No .csv files found in: ${target}`);
    return { exitCode: 1, passed: 0, total: 0 };
  }

  let failed = 0;
  for (const file of files) {
    const { errors, infos } = validateFile(file);
    const name = path.basename(file);
    if (errors.length === 0) {
      output(`PASS  ${name}`);
    } else {
      failed++;
      output(`FAIL  ${name}`);
      for (const e of errors) output(`        - ${e}`);
    }
    for (const i of infos) output(`        i ${i}`);
  }

  output(`\n${files.length - failed}/${files.length} files passed`);
  return {
    exitCode: failed > 0 ? 1 : 0,
    passed: files.length - failed,
    total: files.length,
  };
}

function main() {
  const result = validateTarget(process.argv[2]);
  process.exit(result.exitCode);
}

if (import.meta.url === `file://${process.argv[1]}` || (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]))) {
  main();
}
