import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createChecker, loadFlow, makeRun, TRIALS, payloads } from "./helpers.mjs";
import { validateTarget } from "../scripts/validate_sensor_lab_log.mjs";
import { summarizeSelected } from "../scripts/summarize_selected.mjs";
import { generateChapterExamples } from "../scripts/generate_chapter_examples.mjs";

export function run() {
  const { check, getFailures } = createChecker();
  const flowNodes = loadFlow();
  const fnSrc = {};
  for (const node of flowNodes) {
    if (node.type === "function") fnSrc[node.id] = node.func;
  }

  if (!fnSrc.fn_init || !fnSrc.fn_start || !fnSrc.fn_buildrow) {
    check("function node sources available for csv pipeline tests", false,
      "fn_init/fn_start/fn_buildrow missing — flow_structure tests should have caught this");
    return getFailures();
  }

  const runInit = makeRun(fnSrc.fn_init);
  const runStart = makeRun(fnSrc.fn_start);
  const runRow = makeRun(fnSrc.fn_buildrow);

  function fileNode(msg) {
    fs.mkdirSync(path.dirname(msg.filename), { recursive: true });
    fs.appendFileSync(msg.filename, msg.payload + "\n", "utf8");
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "r334-"));
  try {
    const runsDir = path.join(tmp, "runs");
    const store = { flow: {}, global: {} };
    const ctx = {
      flow: { get: (k) => store.flow[k], set: (k, v) => (store.flow[k] = v) },
      global: { get: (k) => store.global[k], set: (k, v) => (store.global[k] = v) },
      env: {
        get: (k) =>
          k === "SENSOR_LAB_RUNS_DIR" ? runsDir
          : k === "SENSOR_LAB_SESSION_ID" ? "S01"
          : undefined,
      },
      node: { status: () => {} },
    };

    runInit({}, ctx.flow, ctx.global, ctx.env, ctx.node);
    const header = store.global["FALL_SENSOR_LAB_CSV_HEADER"];

    // 24 trials: Start -> sensor stream
    for (const t of TRIALS) {
      const startMsg = { ...t, note: "" };
      const out = runStart(startMsg, ctx.flow, ctx.global, ctx.env, ctx.node);
      const headerMsg = Array.isArray(out) ? out[0] : out;
      if (headerMsg) fileNode(headerMsg);
      for (const p of payloads(t)) {
        const m = { topic: "device/ESP32TEST/lab/imu", payload: p };
        const row = runRow(m, ctx.flow, ctx.global, ctx.env, ctx.node);
        check(`row built ${t.trialId} ${p.type}`, row && typeof row.payload === "string");
        fileNode(row);
      }
      store.flow["recording"] = false; // Stop Trial
    }

    const rawDir = path.join(runsDir, "S01", "raw");
    const files = fs.readdirSync(rawDir).filter((f) => f.endsWith(".csv")).sort();
    check("24 trial CSV files created", files.length === 24, `got ${files.length}`);

    const schemaHeader = "session_id,trial_id,activity_label,expected_type,timestamp_ms,type,state,ax_g,ay_g,az_g,gx_dps,gy_dps,gz_dps,svm_raw_g,svm_filtered_g,pitch_deg,roll_deg,pitch_before_deg,roll_before_deg,pitch_after_deg,roll_after_deg,pitch_delta_deg,roll_delta_deg,posture_delta_deg,impact_threshold_g,posture_threshold_deg,stabilize_ms,decision,note";
    let headerOk = true, decisionOk = true;
    for (const f of files) {
      const lines = fs.readFileSync(path.join(rawDir, f), "utf8").trim().split("\n");
      if (lines[0] !== schemaHeader) headerOk = false;
      if (!lines.some((l) => l.split(",")[5] === "imu_decision")) decisionOk = false;
    }
    check("every CSV header matches schema", headerOk);
    check("every trial has an imu_decision row", decisionOk);

    // guard: re-Start same trial does not duplicate header
    const t1 = TRIALS[0];
    const reout = runStart({ ...t1, note: "" }, ctx.flow, ctx.global, ctx.env, ctx.node);
    const t1file = path.join(rawDir, `S01_${t1.trialId}_${t1.activityLabel}.csv`);
    const hdrCount = fs.readFileSync(t1file, "utf8")
      .trim().split("\n").filter((l) => l === schemaHeader).length;
    check(
      "guard: re-Start same trial does not duplicate header",
      reout == null && hdrCount === 1,
      `header lines=${hdrCount}`,
    );

    // validate_sensor_lab_log
    const validateLines = [];
    const validateResult = validateTarget(rawDir, (line) => validateLines.push(line), (line) => validateLines.push(line));
    const validateOut = validateLines.join("\n");
    check("validate_sensor_lab_log exit 0", validateResult.exitCode === 0, "non-zero exit");
    check(
      "validate reports 24/24 passed",
      /24\/24 files passed/.test(validateOut),
      validateOut.trim().split("\n").pop(),
    );

    // summarize_selected
    const selDir = path.join(runsDir, "S01", "selected");
    fs.mkdirSync(selDir, { recursive: true });
    const picks = [
      "S01_T10_sit_hard.csv",
      "S01_T13_side_fall_left.csv",
      "S01_T19_forward_fall.csv",
    ];
    for (const f of picks) {
      check(`raw exists to select: ${f}`, fs.existsSync(path.join(rawDir, f)));
      fs.copyFileSync(path.join(rawDir, f), path.join(selDir, f));
    }
    const svt = path.join(tmp, "selected_values_table.csv");
    summarizeSelected(selDir, svt, () => {}, () => {});
    const svtRows = fs.readFileSync(svt, "utf8").trim().split("\n");
    check("summarize wrote 3 selected rows", svtRows.length === 4, `got ${svtRows.length - 1}`);
    const fallRow = svtRows.find((l) => l.startsWith("T13"));
    const fc = fallRow ? fallRow.split(",") : [];
    check(
      "summarize uses imu_impact peak for magnitude (not decision row)",
      !!fallRow && fc[3] === "2.31",
      fallRow,
    );
    check(
      "summarize keeps imu_decision posture_delta + decision (2dp)",
      !!fallRow && fc[4] === "58.20" && fallRow.includes("suspected_fall"),
      fallRow,
    );

    // non-fall sample-only trial
    const sampleOnly = path.join(rawDir, "S01_T01_standing_still.csv");
    const soLines = fs
      .readFileSync(sampleOnly, "utf8")
      .trim()
      .split("\n")
      .filter((l, i) => i === 0 || l.split(",")[5] === "imu_sample");
    const soDir = path.join(tmp, "sampleonly");
    fs.mkdirSync(soDir, { recursive: true });
    fs.writeFileSync(
      path.join(soDir, "S01_T01_standing_still.csv"),
      soLines.join("\n") + "\n",
    );
    const soValLines = [];
    const soValResult = validateTarget(soDir, (line) => soValLines.push(line), (line) => soValLines.push(line));
    const soValOut = soValLines.join("\n");
    check("validate non-fall sample-only exit 0", soValResult.exitCode === 0, "non-zero exit");
    check(
      "validate passes non-fall sample-only with info note",
      /1\/1 files passed/.test(soValOut) && /sample-only/.test(soValOut),
      soValOut.trim().split("\n").join(" | "),
    );
    const soSvt = path.join(tmp, "sampleonly_table.csv");
    summarizeSelected(soDir, soSvt, () => {}, () => {});
    const soRow = fs.readFileSync(soSvt, "utf8").trim().split("\n").pop();
    check(
      "summarize uses peak svm for non-fall sample-only trial",
      soRow.split(",")[3] === "1.01",
      soRow,
    );

    // generate chapter markdown
    generateChapterExamples(svt, tmp, () => {}, () => {});
    const ch3 = fs.readFileSync(path.join(tmp, "examples_for_fall_detection_sensor_lab.md"), "utf8");
    const ch5 = fs.readFileSync(path.join(tmp, "examples_for_chapter_5.md"), "utf8");
    check("ch.3 markdown has Fall Case", ch3.includes("ตัวอย่าง Fall Case"));
    check(
      "ch.5 markdown Thai table + translation",
      ch5.includes("ท่าพื้นฐานที่ทดสอบ") &&
      ch5.includes("ล้มด้านซ้าย") &&
      ch5.includes("ตรวจพบการล้ม"),
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  return getFailures();
}
