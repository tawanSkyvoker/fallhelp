// mqtt-monitor.mjs — Developer tool สำหรับ monitor MQTT messages จาก ESP32 แบบ realtime
// ใช้ debug ระบบ Fall Detection และ Heart Rate โดยไม่ต้องเปิด backend
// รองรับ HiveMQ Cloud (TLS) และ Mosquitto local
//
// Usage:
//   npm run mqtt:monitor              → อ่าน MQTT_BROKER_URL จาก apps/backend-api/.env
//   npm run mqtt:monitor:local        → Mosquitto local (mqtt://localhost:1883)
//   npm run mqtt:monitor -- --verbose → แสดง raw JSON ทั้งหมด
//   npm run mqtt:monitor -- --topic "device/+/heartrate"  → กรองเฉพาะ topic

import { connect } from "mqtt";
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// โหลด env จาก apps/backend-api/.env — MQTT credentials อยู่ฝั่ง backend
loadEnv({
  path: path.resolve(__dirname, "../../apps/backend-api/.env"),
  quiet: true,
});

// ─── Topics ที่ subscribe (ตรงกับ topics.ts) ─────────────────────────────────
const ALL_TOPICS = [
  "device/+/cmd",
  "device/+/cmd_ack",
  "device/+/fall",
  "device/+/heartrate",
  "device/+/status",
  "device/+/event",
  "device/+/config/ack",
  "device/+/lwt",
  "events/+",
];

// ─── Parser arguments ────────────────────────────────────────────────────────
function parseArgs(argv) {
  const result = {
    broker: process.env.MQTT_BROKER_URL || "mqtt://localhost:1883",
    username: process.env.MQTT_USERNAME || "",
    password: process.env.MQTT_PASSWORD || "",
    filterTopic: null,
    verbose: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--verbose" || arg === "-v") {
      result.verbose = true;
    } else if (arg === "--broker" && i + 1 < argv.length) {
      const val = argv[++i];
      // shortcut สำหรับสลับไปใช้ Mosquitto local service
      result.broker =
        val === "mosquitto" ? "mqtt://localhost:1883" : val;
      result.username = "";
      result.password = "";
    } else if (arg === "--topic" && i + 1 < argv.length) {
      result.filterTopic = argv[++i];
    }
  }
  return result;
}

function printHelp() {
  console.log(`
mqtt-monitor — FallHelp MQTT Debug Monitor

Usage:
  npm run mqtt:monitor                        HiveMQ Cloud (apps/backend-api/.env)
  npm run mqtt:monitor:local                  Mosquitto local
  npm run mqtt:monitor -- --topic <pattern>   Filter specific topic
  npm run mqtt:monitor -- --verbose           Show raw JSON payload
  npm run mqtt:monitor -- --help              Show this help

Flags:
  --broker mosquitto   Switch to mqtt://localhost:1883 (no auth)
  --broker <url>       Custom broker URL
  --topic <pattern>    Subscribe only to this topic (MQTT wildcard ok)
  --verbose            Show full raw JSON for every message
`);
}

// ─── Formatting helpers ───────────────────────────────────────────────────────
// แสดงเวลาปัจจุบันในรูป HH:MM:SS.mmm
function ts() {
  return (
    new Date().toLocaleTimeString("th-TH", { hour12: false }) +
    "." +
    String(Date.now() % 1000).padStart(3, "0")
  );
}

// คำนวณ latency จาก deviceTimestampMs หรือ timestamp
// ถ้าเป็น millis() จาก ESP32 (ไม่ใช่ Unix ms) จะข้ามการคำนวณ
function calcLatency(payload) {
  const deviceMs = payload.deviceTimestampMs ?? payload.timestamp;
  if (typeof deviceMs !== "number") return null;
  // device millis() มักน้อยกว่า 1e10 (< 115 วัน) — ถ้าใหญ่กว่าคือ Unix ms จริง
  if (deviceMs > 1e10) {
    const lat = Date.now() - deviceMs;
    return lat > 0 && lat < 60000 ? lat : null;
  }
  return null;
}

function fmtLatency(lat) {
  return lat !== null ? ` | lat: ${lat}ms` : "";
}

// ─── Topic handlers (แสดงข้อมูลต่าง topic) ───────────────────────────────────
function handleFall(deviceId, payload) {
  const eventField = payload.event ?? payload.type;
  const isSuspected =
    eventField === "suspected_fall" ||
    (typeof eventField === "string" && eventField.includes("suspect"));
  const isCancelled =
    eventField === "fall_cancelled" || eventField === "fall_cancel";

  let icon = "🚨";
  let label = "FALL     ";
  if (isSuspected) {
    icon = "⚠️ ";
    label = "SUSPECTED";
  }
  if (isCancelled) {
    icon = "✅";
    label = "CANCELLED";
  }

  const mag =
    typeof payload.magnitude === "number"
      ? ` | mag: ${payload.magnitude.toFixed(2)}`
      : "";
  const posture =
    typeof payload.postureDelta === "number"
      ? ` | posture: ${payload.postureDelta.toFixed(1)}°`
      : "";
  const cancel =
    typeof payload.cancelTimeoutMs === "number"
      ? ` | cancel: ${payload.cancelTimeoutMs}ms`
      : "";
  const lat = fmtLatency(calcLatency(payload));

  console.log(
    `[${ts()}] ${icon} ${label} | ${deviceId}${mag}${posture}${cancel}${lat}`,
  );
}

function handleHeartRate(deviceId, payload) {
  const bpm = payload.heartRate ?? payload.bpm;
  const zone = payload.zone ? ` | zone: ${payload.zone}` : "";
  const conf = payload.confidence ? ` | conf: ${payload.confidence}` : "";
  const alert = payload.alertType ? ` | ⚠️ ${payload.alertType}` : "";
  const lat = fmtLatency(calcLatency(payload));

  console.log(
    `[${ts()}] 💓 HEARTRATE | ${deviceId} | ${bpm ?? "?"} BPM${zone}${conf}${alert}${lat}`,
  );
}

function handleStatus(deviceId, payload) {
  const state = payload.online ? "🟢 online" : "🔴 offline";
  const rssi =
    typeof payload.signalStrength === "number"
      ? ` | RSSI: ${payload.signalStrength}dBm`
      : "";
  const ip = payload.ip ? ` | IP: ${payload.ip}` : "";
  const lwt = payload._lwt ? " [LWT]" : "";
  console.log(
    `[${ts()}] 📡 STATUS   | ${deviceId} | ${state}${rssi}${ip}${lwt}`,
  );
}

function handleConfigAck(deviceId, payload) {
  const ok = payload.success ? "✅ ok" : "❌ failed";
  const req = payload.requestId ? ` | reqId: ${payload.requestId}` : "";
  const reason = payload.reason ? ` | reason: ${payload.reason}` : "";
  const ip = payload.ip ? ` | ip: ${payload.ip}` : "";
  console.log(
    `[${ts()}] ⚙️  CONFIG/ACK | ${deviceId} | ${ok}${req}${reason}${ip}`,
  );
}

function handleCmd(deviceId, payload) {
  const cmd = payload.cmd ?? payload.command ?? payload.action ?? "?";
  console.log(`[${ts()}] 🕹️  CMD       | ${deviceId} | ${cmd}`);
}

function handleCmdAck(deviceId, payload) {
  const cmd = payload.cmd ?? "?";
  const status = payload.status ? ` | status: ${payload.status}` : "";
  const ok =
    payload.ok === true || payload.success === true || payload.status === "ok"
      ? "✅ ok"
      : "⚠️ ack";
  const message = payload.message ? ` | msg: ${payload.message}` : "";
  const requestId = payload.requestId ? ` | reqId: ${payload.requestId}` : "";
  console.log(
    `[${ts()}] 🤖 CMD/ACK   | ${deviceId} | ${ok} | ${cmd}${status}${message}${requestId}`,
  );
}

function handleEvent(deviceId, payload) {
  const typeLabel = payload.type ?? payload.event ?? "?";
  console.log(`[${ts()}] 📨 EVENT    | ${deviceId} | type: ${typeLabel}`);
  // Delegate sub-types
  if (typeof typeLabel === "string") {
    if (typeLabel.includes("fall") || typeLabel.includes("suspected")) {
      handleFall(deviceId, payload);
    } else if (
      ["heart_rate", "heart_rate_high", "heart_rate_low", "hr"].includes(
        typeLabel,
      )
    ) {
      handleHeartRate(deviceId, payload);
    }
  }
}

function handleLwt(deviceId) {
  console.log(
    `[${ts()}] 💀 LWT      | ${deviceId} | อุปกรณ์หลุด (broker triggered)`,
  );
}

// ─── Stats Tracker ────────────────────────────────────────────────────────────
const stats = {
  counts: {},
  latencies: [],
  total: 0,
  reset() {
    this.counts = {};
    this.latencies = [];
    this.total = 0;
  },
  record(type, lat) {
    this.counts[type] = (this.counts[type] ?? 0) + 1;
    this.total++;
    if (lat !== null) this.latencies.push(lat);
  },
  print() {
    const countStr = Object.entries(this.counts)
      .map(([k, v]) => `${k}: ${v}`)
      .join(" | ");
    const avgLat =
      this.latencies.length > 0
        ? Math.round(
            this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length,
          )
        : "-";
    console.log("─".repeat(62));
    console.log(
      `Stats (last 10s): ${countStr || "ไม่มีข้อมูล"} | avg_lat: ${avgLat}ms | total: ${this.total}`,
    );
    console.log("─".repeat(62));
    this.reset();
  },
};

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  const isHiveMQ =
    opts.broker.includes("hivemq") || opts.broker.startsWith("mqtts://");
  const brokerLabel = isHiveMQ ? "HiveMQ Cloud" : opts.broker;
  const topicsToSub = opts.filterTopic ? [opts.filterTopic] : ALL_TOPICS;

  console.log(`\n🔌 FallHelp MQTT Monitor`);
  console.log(`   Broker : ${brokerLabel}`);
  console.log(`   Topics : ${topicsToSub.join(", ")}`);
  console.log(`   Verbose: ${opts.verbose}\n`);

  const client = connect(opts.broker, {
    username: opts.username || undefined,
    password: opts.password || undefined,
    reconnectPeriod: 3000,
    connectTimeout: 10000,
    rejectUnauthorized: isHiveMQ,
  });

  // ─── Events ───────────────────────────────────────────────────────────────
  client.on("connect", () => {
    console.log(`✅ Connected to ${brokerLabel}\n`);
    topicsToSub.forEach((topic) => {
      client.subscribe(topic, { qos: 1 }, (err) => {
        if (err) console.error(`❌ Subscribe error ${topic}: ${err.message}`);
        else console.log(`📡 Subscribed: ${topic}`);
      });
    });
    console.log("");
  });

  client.on("error", (err) => {
    console.error(`❌ MQTT Error: ${err.message}`);
  });

  client.on("offline", () =>
    console.log("⚠️  Offline — กำลังเชื่อมต่อใหม่..."),
  );
  client.on("reconnect", () => console.log("🔄 Reconnecting..."));

  client.on("message", (topic, buf) => {
    let payload = {};
    try {
      payload = JSON.parse(buf.toString());
    } catch {
      console.log(
        `[${ts()}] ⚠️  INVALID JSON on ${topic}: ${buf.toString().slice(0, 100)}`,
      );
      return;
    }

    if (opts.verbose) {
      console.log(
        `[${ts()}] [RAW] ${topic}\n`,
        JSON.stringify(payload, null, 2),
      );
    }

    // ดึง deviceId จาก topic: "device/{id}/fall" → "id"
    const parts = topic.split("/");
    const deviceId =
      parts[0] === "device" || parts[0] === "events" ? parts[1] : parts[0];

    let type = "other";
    let lat = calcLatency(payload);

    if (topic.endsWith("/cmd")) {
      type = "cmd";
      handleCmd(deviceId, payload);
    } else if (topic.endsWith("/cmd_ack")) {
      type = "cmd_ack";
      handleCmdAck(deviceId, payload);
    } else if (topic.includes("/lwt")) {
      type = "lwt";
      handleLwt(deviceId);
    } else if (topic.includes("/fall")) {
      type = "fall";
      handleFall(deviceId, payload);
    } else if (topic.includes("/heartrate")) {
      type = "heartrate";
      handleHeartRate(deviceId, payload);
    } else if (topic.includes("/status")) {
      type = "status";
      handleStatus(deviceId, payload);
    } else if (topic.includes("/config/ack")) {
      type = "config_ack";
      handleConfigAck(deviceId, payload);
    } else if (topic.endsWith("/event") || topic.startsWith("events/")) {
      type = payload.type ?? "event";
      handleEvent(deviceId, payload);
    }

    stats.record(type, lat);
  });

  // ─── Print stats ทุก 10 วินาที ────────────────────────────────────────────
  setInterval(() => stats.print(), 10_000);

  // ─── Graceful shutdown ────────────────────────────────────────────────────
  const shutdown = () => {
    console.log("\n🔌 Disconnecting...");
    client.end(true, () => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

void main();
