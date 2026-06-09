#!/bin/sh
set -e

# Ensure the runs directory exists (CSV output target).
mkdir -p /data/runs

# Keep the lab flow aligned with the source baked into the image.
# สำรอง flow เก่าไว้ก่อน sync เพื่อไม่ลบงานที่เคยแก้ผ่าน Node-RED editor แบบถาวร
if [ ! -f /data/flows.json ]; then
    echo "[entrypoint] Initialising Fall Detection Sensor Lab flow in /data/flows.json"
    cp /source/flows.json /data/flows.json
elif ! cmp -s /source/flows.json /data/flows.json; then
    backup="/data/flows.backup.$(date +%Y%m%d%H%M%S).json"
    echo "[entrypoint] Updating /data/flows.json from baked source flow (backup: $backup)"
    cp /data/flows.json "$backup"
    cp /source/flows.json /data/flows.json
else
    echo "[entrypoint] Fall Detection Sensor Lab flow already matches baked source"
fi

# Keep MQTT runtime fields tied to Docker/env values on every start.
# This updates only broker configuration, not dashboard behavior or CSV logic.
node <<'NODE'
const fs = require("fs");
const file = "/data/flows.json";
const flows = JSON.parse(fs.readFileSync(file, "utf8"));
const useTls = String(process.env.MQTT_USE_TLS || "false").toLowerCase() === "true";

for (const node of flows) {
  if (node.type !== "mqtt-broker" || node.id !== "mqtt_broker_sensor_lab") continue;
  node.name = useTls ? "MQTT Broker (TLS env)" : "MQTT Broker (env)";
  node.broker = "${MQTT_BROKER_HOST}";
  node.port = "${MQTT_BROKER_PORT}";
  node.usetls = useTls;
  node.credentials = {
    user: "${MQTT_USERNAME}",
    password: "${MQTT_PASSWORD}",
  };
}

fs.writeFileSync(file, JSON.stringify(flows, null, 2) + "\n");
NODE

echo ""
echo "[entrypoint] Dashboard: http://127.0.0.1:${NODE_RED_PORT:-1880}/ui/fall-detection-sensor-lab"
echo "[entrypoint] Editor:    http://127.0.0.1:${NODE_RED_PORT:-1880}/#flow/tab_fall_sensor_lab"
echo ""
exec node-red --userDir /data
