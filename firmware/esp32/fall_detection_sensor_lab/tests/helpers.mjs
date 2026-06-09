import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dir = path.dirname(fileURLToPath(import.meta.url));
export const TESTS_DIR = __dir;
export const ROOT = path.resolve(__dir, "..");
export const SCRIPTS_DIR = path.join(ROOT, "scripts");
export const FLOW = path.join(ROOT, "node-red", "flows", "fall-detection-sensor-lab-flow.v2.json");
export const SCHEMA = path.join(ROOT, "csv_schema.md");
export const FW = path.resolve(ROOT, "..", "src", "sensor_tuning", "MPU6050_Sensor.ino");
export const FW_MAIN = path.resolve(ROOT, "..", "src", "main_firmware", "MPU6050_Sensor.ino");
export const PACKAGE_JSON = path.resolve(ROOT, "..", "..", "..", "package.json");
export const REPO_ROOT = path.resolve(ROOT, "..", "..", "..");
export const DOCKER_COMPOSE = path.join(REPO_ROOT, "docker-compose.yml");
export const BACKEND_ENV_EXAMPLE = path.join(REPO_ROOT, "apps", "backend-api", ".env.example");
export const NODE_RED_DOCKERFILE = path.join(ROOT, "node-red", "Dockerfile");
export const NODE_RED_ENTRYPOINT = path.join(ROOT, "node-red", "docker-entrypoint.sh");
export const DASHBOARD_PACKAGE_JSON = path.join(
  REPO_ROOT,
  "node_modules",
  "@flowfuse",
  "node-red-dashboard",
  "package.json",
);
export const DASHBOARD_NODES_DIR = path.join(
  REPO_ROOT,
  "node_modules",
  "@flowfuse",
  "node-red-dashboard",
  "nodes",
);

export function createChecker() {
  let failures = 0;
  function check(name, cond, detail) {
    if (cond) {
      console.log(`PASS  ${name}`);
    } else {
      failures++;
      console.log(`FAIL  ${name}${detail ? `\n        - ${detail}` : ""}`);
    }
  }
  return { check, getFailures: () => failures };
}

export function loadFlow() {
  return JSON.parse(fs.readFileSync(FLOW, "utf8"));
}

export function makeRun(code) {
  return new Function("msg", "flow", "global", "env", "node", code);
}

export const PLAN = [
  ["standing_still", "non_fall", 2],
  ["walking_normal", "non_fall", 2],
  ["running_light", "non_fall", 3],
  ["sit_normal", "non_fall", 2],
  ["sit_hard", "non_fall", 3],
  ["side_fall_left", "fall", 3],
  ["side_fall_right", "fall", 3],
  ["forward_fall", "fall", 3],
  ["backward_fall", "fall", 3],
];

export const TRIALS = (() => {
  const trials = [];
  let n = 0;
  for (const [activity, type, count] of PLAN) {
    for (let i = 0; i < count; i++) {
      n++;
      trials.push({
        trialId: `T${String(n).padStart(2, "0")}`,
        activityLabel: activity,
        expectedType: type,
      });
    }
  }
  return trials;
})();

export function payloads(trial) {
  const fall = trial.expectedType === "fall";
  const base = {
    ax: 0.12, ay: 0.08, az: 0.98, gx: 0.5, gy: 0.4, gz: 0.1,
    impactThreshold: 2.0, postureThreshold: 45, stabilizeMs: 1500,
  };
  const sample = {
    ...base, type: "imu_sample", state: "IDLE", decision: "sample",
    timestamp: 1000, svmRaw: 1.03, svmFiltered: 1.01,
    pitch: 6.8, roll: 4.5, pitchBefore: 0, rollBefore: 0,
    pitchAfter: 0, rollAfter: 0, pitchDelta: 0, rollDelta: 0, postureDelta: 0,
  };
  const impact = {
    ...base, type: "imu_impact", state: "IMPACT_DETECTED", decision: "pending",
    timestamp: 1700, ax: 1.42, ay: 1.66, az: 0.88,
    svmRaw: fall ? 2.35 : 2.14, svmFiltered: fall ? 2.31 : 2.12,
    pitch: 7.5, roll: 4.8, pitchBefore: 7.5, rollBefore: 4.8,
    pitchAfter: 0, rollAfter: 0, pitchDelta: 0, rollDelta: 0, postureDelta: 0,
  };
  const postureDelta = fall ? 58.2 : 22.0;
  const decision = {
    ...base, type: "imu_decision", state: "POSTURE_CHECK",
    decision: fall ? "suspected_fall" : "ignored",
    timestamp: 3200, ax: 0.4, ay: 0.82, az: 1.05,
    svmRaw: fall ? 1.39 : 1.08, svmFiltered: fall ? 1.22 : 1.09,
    pitch: 19.2, roll: 63.0, pitchBefore: 7.5, rollBefore: 4.8,
    pitchAfter: 19.2, rollAfter: 63.0,
    pitchDelta: 11.7, rollDelta: postureDelta, postureDelta,
  };
  return [sample, impact, decision];
}
