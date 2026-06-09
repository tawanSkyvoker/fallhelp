import fs from "node:fs";
import {
  createChecker,
  loadFlow,
  FLOW,
  SCHEMA,
  FW,
  FW_MAIN,
  DOCKER_COMPOSE,
  BACKEND_ENV_EXAMPLE,
  NODE_RED_DOCKERFILE,
  NODE_RED_ENTRYPOINT,
} from "./helpers.mjs";

export function run() {
  const { check, getFailures } = createChecker();
  const flowNodes = loadFlow();
  const fnSrc = {};
  for (const node of flowNodes) {
    if (node.type === "function") fnSrc[node.id] = node.func;
  }

  // firmware <-> flow <-> schema contract
  const fwSrc = fs.readFileSync(FW, "utf8");
  const defStart = fwSrc.lastIndexOf("void publishLabImuLog");
  const after = fwSrc.slice(defStart);
  const block = after.slice(0, after.indexOf("\n}\n"));
  const fwKeys = [...block.matchAll(/doc\["([a-zA-Z]+)"\]/g)].map((m) => m[1]);
  check(
    "firmware publishLabImuLog emits keys",
    fwKeys.length >= 20,
    `found ${fwKeys.length}`,
  );

  const buildrow = fnSrc.fn_buildrow || "";
  const missingInFlow = fwKeys.filter(
    (k) => !new RegExp(`p\\.${k}\\b`).test(buildrow),
  );
  check(
    "every firmware payload key is consumed by the flow",
    missingInFlow.length === 0,
    `unmapped: ${missingInFlow.join(", ")}`,
  );

  const schemaHeader = "session_id,trial_id,activity_label,expected_type,timestamp_ms,type,state,ax_g,ay_g,az_g,gx_dps,gy_dps,gz_dps,svm_raw_g,svm_filtered_g,pitch_deg,roll_deg,pitch_before_deg,roll_before_deg,pitch_after_deg,roll_after_deg,pitch_delta_deg,roll_delta_deg,posture_delta_deg,impact_threshold_g,posture_threshold_deg,stabilize_ms,decision,note";
  const schemaMd = fs.readFileSync(SCHEMA, "utf8");
  const schemaMissing = schemaHeader.split(",").filter(
    (c) => !schemaMd.includes("`" + c + "`"),
  );
  check(
    "every CSV column is documented in csv_schema.md",
    schemaMissing.length === 0,
    `undocumented: ${schemaMissing.join(", ")}`,
  );

  // imu_sample only in sensor_tuning, not in main_firmware
  const fwMainSrc = fs.readFileSync(FW_MAIN, "utf8");
  check(
    "firmware publishes imu_sample (sensor_tuning lab only)",
    /publishLabImuLog\("imu_sample"/.test(fwSrc) && !/imu_sample/.test(fwMainSrc),
    "imu_sample must exist in sensor_tuning and NOT in main_firmware",
  );

  // no hardcoded MQTT credentials in flow JSON; env placeholders are allowed
  const flowText = fs.readFileSync(FLOW, "utf8");
  const flowObj = JSON.parse(flowText);
  let secretFound = false;
  for (const n of flowObj) {
    const creds = n.credentials || {};
    if (
      (creds.user && creds.user !== "${MQTT_USERNAME}") ||
      (creds.password && creds.password !== "${MQTT_PASSWORD}")
    ) {
      secretFound = true;
    }
  }
  check("no hardcoded MQTT credentials in flow JSON", !secretFound);

  check(
    "flow does not hardcode HiveMQ host",
    !/[-a-z0-9]+\.s1\.[-a-z0-9.]*hivemq\.cloud/i.test(flowText) &&
      !/HiveMQ Cloud \(Fall Detection Sensor Lab\)/.test(flowText),
  );
  check(
    "lab MQTT topic remains device/+/lab/imu",
    flowObj.some((n) => n.type === "mqtt in" && n.topic === "device/+/lab/imu") &&
      flowText.includes("device/+/lab/imu") &&
      !flowText.includes("device/+/event") &&
      !flowText.includes("device/+/status"),
  );
  check(
    "dashboard display does not introduce MQTT payload field aliases",
    !/p\.magnitude|payload\.magnitude|p\.impactMagnitude|payload\.impactMagnitude/.test(flowText) &&
      /p\.svmFiltered/.test(flowText) &&
      /p\.pitch/.test(flowText) &&
      /p\.roll/.test(flowText) &&
      /p\.postureDelta/.test(flowText),
  );
  check(
    "CSV schema header remains the Fall Detection Sensor Lab locked column set",
    (fnSrc.fn_init || "").includes(schemaHeader) &&
      !/(orientation|magnitude|status_badge|recording_state)/.test(schemaHeader),
  );

  const compose = fs.readFileSync(DOCKER_COMPOSE, "utf8");
  check(
    "docker compose mounts node-red runtime under the lab node-red folder",
    /node-red:/.test(compose) &&
      /profiles:\s*\n\s*-\s*lab/.test(compose) &&
      /fall_detection_sensor_lab\/node-red\/runtime:\/data/.test(compose) &&
      !/fall_detection_sensor_lab\/\.nodered:\/data/.test(compose) &&
      !/node_red_data:\/data/.test(compose),
  );
  check(
    "docker compose mounts runs folder for CSV output",
    /fall_detection_sensor_lab\/runs:\/data\/runs/.test(compose) &&
      /SENSOR_LAB_RUNS_DIR:\s*['"]\/data\/runs['"]/.test(compose),
  );
  check(
    "docker compose passes MQTT env fields to node-red",
    ["MQTT_BROKER_HOST", "MQTT_BROKER_PORT", "MQTT_USE_TLS", "MQTT_USERNAME", "MQTT_PASSWORD"]
      .every((name) => compose.includes(name)),
  );

  const envExample = fs.readFileSync(BACKEND_ENV_EXAMPLE, "utf8");
  check(
    ".env.example documents Node-RED MQTT host/port/TLS placeholders",
    ["MQTT_BROKER_HOST=host.docker.internal", "MQTT_BROKER_PORT=1883", "MQTT_USE_TLS=false", "NODE_RED_PORT=1880"]
      .every((line) => envExample.includes(line)),
  );

  const dockerfile = fs.readFileSync(NODE_RED_DOCKERFILE, "utf8");
  check(
    "Node-RED Dockerfile installs FlowFuse Dashboard 2.0 and bakes v2 source flow",
    dockerfile.includes("@flowfuse/node-red-dashboard") &&
      dockerfile.includes("fall-detection-sensor-lab-flow.v2.json"),
  );

  const entrypoint = fs.readFileSync(NODE_RED_ENTRYPOINT, "utf8");
  check(
    "Node-RED entrypoint syncs baked source flow into runtime volume",
    entrypoint.includes("cmp -s /source/flows.json /data/flows.json") &&
      entrypoint.includes("flows.backup.") &&
      entrypoint.includes("cp /source/flows.json /data/flows.json"),
  );
  check(
    "Node-RED entrypoint applies MQTT TLS/env runtime patch",
    entrypoint.includes("MQTT_USE_TLS") &&
      entrypoint.includes("${MQTT_BROKER_HOST}") &&
      entrypoint.includes("${MQTT_USERNAME}") &&
      entrypoint.includes("${MQTT_PASSWORD}"),
  );

  return getFailures();
}
