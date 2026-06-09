// mqtt-check.mjs — ตรวจสอบว่า Mosquitto native service running บน localhost:1883
//
// Usage:
//   npm run mqtt:check

import net from "node:net";
import os from "node:os";

const HOST = "localhost";
const PORT = 1883;
const TIMEOUT = 3000;

const isWindows = os.platform() === "win32";

function checkTcp(host, port, timeout) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    socket
      .on("connect", () => {
        socket.destroy();
        resolve(true);
      })
      .on("error", () => {
        socket.destroy();
        resolve(false);
      })
      .on("timeout", () => {
        socket.destroy();
        resolve(false);
      })
      .connect(port, host);
  });
}

function printSetupHint() {
  console.error("\n  Mosquitto is not running on localhost:1883.\n");
  if (isWindows) {
    console.error("  Windows — install & start:");
    console.error("    choco install mosquitto");
    console.error(
      '    Copy config\\mosquitto\\mosquitto.conf → "C:\\Program Files\\mosquitto\\mosquitto.conf"'
    );
    console.error(
      '    Start-Service mosquitto   (or: net start mosquitto, or via Services.msc)\n'
    );
    console.error("  Verify:");
    console.error("    netstat -ano | findstr :1883\n");
  } else {
    console.error("  Linux — install & start:");
    console.error("    sudo apt install mosquitto");
    console.error(
      "    sudo cp config/mosquitto/mosquitto.conf /etc/mosquitto/conf.d/fallhelp.conf"
    );
    console.error(
      "    sudo systemctl enable --now mosquitto\n"
    );
    console.error("  Verify:");
    console.error("    sudo systemctl status mosquitto\n");
  }
}

const ok = await checkTcp(HOST, PORT, TIMEOUT);

if (ok) {
  console.log(`  Mosquitto reachable at ${HOST}:${PORT}`);
  process.exit(0);
} else {
  printSetupHint();
  process.exit(1);
}
