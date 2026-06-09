import fs from "node:fs";
import path from "node:path";
import {
  createChecker,
  DASHBOARD_NODES_DIR,
  DASHBOARD_PACKAGE_JSON,
  loadFlow,
  PACKAGE_JSON,
} from "./helpers.mjs";

export function run() {
  const { check, getFailures } = createChecker();
  const flowNodes = loadFlow();

  // JSON parse + duplicate node IDs
  check("flow JSON parses without error", Array.isArray(flowNodes));
  const ids = flowNodes.map((n) => n.id);
  const dups = ids.filter((x, i) => ids.indexOf(x) !== i);
  check("no duplicate node IDs", dups.length === 0, dups.join(", "));

  // Function node exports
  const fnSrc = {};
  for (const node of flowNodes) {
    if (node.type === "function") fnSrc[node.id] = node.func;
  }
  for (const id of ["fn_init", "fn_start", "fn_buildrow", "fn_trialdone", "fn_countdown"]) {
    check(`flow exports ${id}`, typeof fnSrc[id] === "string");
  }

  // Activity buttons (Dashboard 2.0 ui-button)
  const ACT = [
    "standing_still", "walking_normal", "running_light", "sit_normal", "sit_hard",
    "side_fall_left", "side_fall_right", "forward_fall", "backward_fall",
  ];
  const btns = flowNodes.filter((x) => x.type === "ui-button" && x.topic === "activity");
  const btnPayloads = btns.map((b) => b.payload).sort();
  check(
    "dashboard has all 9 activity buttons (ui-button)",
    ACT.slice().sort().every((a, i) => btnPayloads[i] === a) && btns.length === 9,
    btnPayloads.join(","),
  );
  check("dashboard has Session ID input (ui-text-input)",
    flowNodes.some((x) => x.type === "ui-text-input"));
  check(
    "dashboard has 10s countdown function",
    flowNodes.some(
      (x) => x.id === "fn_countdown" &&
        /setInterval/.test(x.func) && /var left = 10;/.test(x.func),
    ),
  );
  check(
    "dashboard has Stop button + auto trial counter",
    flowNodes.some((x) => x.type === "ui-button" && x.topic === "stop") &&
    flowNodes.some((x) => x.id === "fn_trialdone" && /trialSeq/.test(x.func)),
  );
  check(
    "dashboard has status / live / chart widgets",
    flowNodes.some((x) => x.type === "ui-chart") &&
    flowNodes.filter((x) => x.type === "ui-template").length >= 3,
  );
  check(
    "dashboard title uses Fall Detection Sensor Lab as the operator-facing name",
    flowNodes.some((x) =>
      x.id === "ui_base_334" &&
        x.type === "ui-base" &&
        x.name === "Fall Detection Sensor Lab Dashboard",
    ) &&
    flowNodes.some((x) =>
      x.id === "ui_page_334" &&
        x.type === "ui-page" &&
        x.name === "Fall Detection Sensor Lab",
    ),
  );
  check(
    "Trial Control splits normal activities and fall simulations into clear columns",
    flowNodes.some((x) =>
      x.id === "ui_trial_normal_header" &&
        x.type === "ui-template" &&
        x.group === "ui_grp_ctrl" &&
        /Normal \/ Daily Activities/.test(x.format || ""),
    ) &&
    flowNodes.some((x) =>
      x.id === "ui_trial_fall_header" &&
        x.type === "ui-template" &&
        x.group === "ui_grp_ctrl" &&
        /Fall Simulations/.test(x.format || ""),
    ) &&
    ["standing_still", "walking_normal", "running_light", "sit_normal", "sit_hard"].every((payload) => {
      const n = flowNodes.find((x) => x.type === "ui-button" && x.payload === payload);
      return n && n.group === "ui_grp_ctrl" && n.width === 3 && n.order % 2 === 1;
    }) &&
    ["side_fall_left", "side_fall_right", "forward_fall", "backward_fall"].every((payload) => {
      const n = flowNodes.find((x) => x.type === "ui-button" && x.payload === payload);
      return n && n.group === "ui_grp_ctrl" && n.width === 3 && n.order % 2 === 0;
    }),
  );
  const impactChart = flowNodes.find((x) => x.id === "ui_chart_impact");
  const postureChart = flowNodes.find((x) => x.id === "ui_chart_attitude");
  const accelerationChart = flowNodes.find((x) => x.id === "ui_chart_ac");
  const gyroscopeChart = flowNodes.find((x) => x.id === "ui_chart_gy");
  check(
    "dashboard splits impact, attitude, acceleration, and gyroscope charts",
    impactChart &&
      impactChart.type === "ui-chart" &&
      /Impact Magnitude \(SVM\)/.test(impactChart.label || "") &&
      impactChart.showLegend === true &&
      impactChart.xAxisLabel === "Time" &&
      impactChart.yAxisLabel === "SVM Filtered (g)" &&
      postureChart &&
      postureChart.type === "ui-chart" &&
      /Attitude & Posture Delta/.test(postureChart.label || "") &&
      !/Posture \/ Orientation Change/.test(postureChart.label || "") &&
      !/Attitude \/ Posture Change/.test(postureChart.label || "") &&
      postureChart.showLegend === true &&
      postureChart.xAxisLabel === "Time" &&
      postureChart.yAxisLabel === "Degrees (deg)" &&
      accelerationChart &&
      accelerationChart.type === "ui-chart" &&
      /Acceleration/.test(accelerationChart.label || "") &&
      accelerationChart.xAxisLabel === "Time" &&
      accelerationChart.yAxisLabel === "Acceleration (g)" &&
      gyroscopeChart &&
      gyroscopeChart.type === "ui-chart" &&
      /Gyroscope/.test(gyroscopeChart.label || "") &&
      gyroscopeChart.xAxisLabel === "Time" &&
      gyroscopeChart.yAxisLabel === "Gyroscope (deg/s)",
    flowNodes
      .filter((x) => x.type === "ui-chart")
      .map((x) => `${x.id}:${x.label}:${x.xAxisLabel}:${x.yAxisLabel}:legend=${x.showLegend}`)
      .join(", "),
  );
  check(
    "dashboard 2.1 exposes trial metadata and recording health without a separate Last Saved CSV widget",
    flowNodes.some((x) => x.id === "ui_trial_meta" && x.type === "ui-template") &&
    !flowNodes.some((x) => x.id === "ui_last_saved"),
  );
  check(
    "dashboard 2.1 sends idle metadata and Last Saved CSV placeholders on startup",
    flowNodes.some((x) =>
      x.id === "inj_dashboard_defaults" &&
        x.type === "inject" &&
        x.once === true &&
        x.wires[0]?.includes("fn_dashboard_defaults"),
    ) &&
    flowNodes.some((x) =>
      x.id === "fn_dashboard_defaults" &&
        x.outputs === 2 &&
        x.wires[0]?.includes("fn_trial_meta") &&
        x.wires[1]?.includes("ui_live") &&
        /Acceleration/.test(x.func) &&
        /Posture/.test(x.func) &&
        /lastSavedCsv:\s*"-"/.test(x.func),
    ),
  );
  check(
    "dashboard 2.1 updates trial metadata through countdown and stop transitions",
    flowNodes.some((x) =>
      x.id === "fn_trial_meta" &&
        x.outputs === 1 &&
        x.wires[0]?.includes("ui_trial_meta"),
    ) &&
    flowNodes.some((x) =>
      x.id === "fn_countdown" &&
        x.outputs === 3 &&
        x.wires[2]?.includes("fn_trial_meta") &&
        /recordingState:\s*"countdown"/.test(x.func) &&
        /recordingState:\s*"recording"/.test(x.func),
    ) &&
    flowNodes.some((x) =>
      x.id === "fn_trialdone" &&
        x.outputs === 3 &&
        x.wires[2]?.includes("fn_trial_meta") &&
        /recordingState:\s*"stopped"/.test(x.func),
    ),
  );
  check(
    "dashboard 2.1 keeps svmFiltered as display source without introducing magnitude payload",
    flowNodes.some((x) =>
      x.id === "fn_live" &&
        /p\.svmFiltered/.test(x.func) &&
        /Magnitude \(SVM\)/.test(x.func) &&
        /p\.pitch/.test(x.func) &&
        /p\.roll/.test(x.func) &&
        /p\.postureDelta/.test(x.func) &&
        !/p\.magnitude|msg\.payload\.magnitude|payload:\s*[^}]*magnitude/.test(x.func),
    ),
  );
  check(
    "dashboard 2.1 renders operator status badges instead of pipe-separated debug text",
    flowNodes.some((x) =>
      x.id === "fn_readiness" &&
        /statusItems/.test(x.func) &&
        /MQTT/.test(x.func) &&
        /Device/.test(x.func) &&
        /IMU/.test(x.func) &&
        !/ \| /.test(x.func),
    ) &&
    flowNodes.some((x) =>
      x.id === "ui_trial_meta" &&
        x.type === "ui-template" &&
        /fh-status-bar/.test(x.format || ""),
    ),
  );
  check(
    "dashboard 2.1 metadata and recording health are grouped readable fields",
    flowNodes.some((x) =>
      x.id === "fn_trial_meta" &&
        /items/.test(x.func) &&
        /Session ID/.test(x.func) &&
        /Trial ID/.test(x.func) &&
        /Activity Label/.test(x.func) &&
        /Expected Type/.test(x.func) &&
        /Recording State/.test(x.func) &&
        /Last Saved CSV/.test(x.func) &&
        !/ \| /.test(x.func),
    ) &&
    flowNodes.some((x) =>
      x.id === "fn_readiness" &&
        /Last seen age/.test(x.func) &&
        /Warning/.test(x.func) &&
        !/MQTT connected=/.test(x.func),
    ),
  );
  check(
    "dashboard 2.1 operator sections use templates that render field grids",
    ["ui_live", "ui_trial_meta"].every((id) => {
      const n = flowNodes.find((x) => x.id === id);
      return n &&
        n.type === "ui-template" &&
        /<template>/.test(n.format || "") &&
        /v-for=/.test(n.format || "");
    }),
  );
  check(
    "combined trial & system info card uses appropriate widget height and avoids inner scroll overflow",
    flowNodes.some((x) =>
      x.id === "ui_trial_meta" &&
        x.type === "ui-template" &&
        x.height === 4 &&
        /overflow:\s*hidden/.test(x.format || "") &&
        /text-overflow:\s*ellipsis/.test(x.format || ""),
    ),
  );
  check(
    "dashboard 2.1 has visible data-health warning text",
    flowNodes.some((x) =>
      x.id === "fn_readiness" &&
        /Warning: No recent IMU sample/.test(x.func) &&
        /Last seen age/.test(x.func),
    ),
  );
  check(
    "dashboard has readiness status (fn_readiness + tick + combined template)",
    flowNodes.some((x) => x.id === "fn_readiness") &&
    flowNodes.some((x) => x.id === "inj_status_tick") &&
    flowNodes.some((x) => x.id === "ui_trial_meta" && x.type === "ui-template"),
  );
  check(
    "Dashboard 2.0 config nodes present (ui-base/ui-page/ui-group)",
    flowNodes.some((x) => x.type === "ui-base") &&
    flowNodes.some((x) => x.type === "ui-page") &&
    flowNodes.filter((x) => x.type === "ui-group").length >= 4,  // Trial Control, Trial & System Info, Live Sensor, Live Charts = 4 groups
  );
  check(
    "no legacy Dashboard v1 node types remain (ui_*)",
    !flowNodes.some((x) => /^ui_/.test(x.type)),
    flowNodes.filter((x) => /^ui_/.test(x.type)).map((x) => x.type).join(","),
  );
  check(
    "dashboard does NOT add audio/beep nodes",
    !flowNodes.some((x) => /audio|sound|beep/i.test(x.type)),
  );
  check(
    "no old manual inject workflow nodes",
    !flowNodes.some((x) =>
      ["inj_meta", "fn_setmeta", "inj_start", "inj_stop"].includes(x.id),
    ) && !/Set Trial Meta|edit me/i.test(JSON.stringify(flowNodes)),
  );

  // Package.json: Dashboard 2.0 declared, v1 removed
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, "utf8"));
  check(
    "FlowFuse Dashboard 2.0 declared, v1 removed",
    !!(pkg.devDependencies && pkg.devDependencies["@flowfuse/node-red-dashboard"]) &&
    !(pkg.devDependencies && pkg.devDependencies["node-red-dashboard"]),
  );

  const dashboardPkg = JSON.parse(fs.readFileSync(DASHBOARD_PACKAGE_JSON, "utf8"));
  const declaredDashboardNodes = dashboardPkg["node-red"]?.nodes || {};
  const dashboardTypes = [
    "ui-base",
    "ui-page",
    "ui-group",
    "ui-theme",
    "ui-button",
    "ui-text-input",
    "ui-text",
    "ui-chart",
    "ui-template",
  ];
  const usedDashboardTypes = [...new Set(flowNodes
    .filter((n) => /^ui-/.test(n.type))
    .map((n) => n.type))].sort();
  check(
    "installed FlowFuse Dashboard package declares every used ui-* type",
    usedDashboardTypes.every((type) => declaredDashboardNodes[type]),
    usedDashboardTypes.filter((type) => !declaredDashboardNodes[type]).join(","),
  );
  check(
    "flow only uses expected Dashboard 2.0 node types",
    usedDashboardTypes.every((type) => dashboardTypes.includes(type)),
    usedDashboardTypes.filter((type) => !dashboardTypes.includes(type)).join(","),
  );

  const dashboardNodeFiles = {
    "ui-base": path.join(DASHBOARD_NODES_DIR, "config", "ui_base.html"),
    "ui-page": path.join(DASHBOARD_NODES_DIR, "config", "ui_page.html"),
    "ui-group": path.join(DASHBOARD_NODES_DIR, "config", "ui_group.html"),
    "ui-theme": path.join(DASHBOARD_NODES_DIR, "config", "ui_theme.html"),
    "ui-button": path.join(DASHBOARD_NODES_DIR, "widgets", "ui_button.html"),
    "ui-text-input": path.join(DASHBOARD_NODES_DIR, "widgets", "ui_text_input.html"),
    "ui-text": path.join(DASHBOARD_NODES_DIR, "widgets", "ui_text.html"),
    "ui-chart": path.join(DASHBOARD_NODES_DIR, "widgets", "ui_chart.html"),
    "ui-template": path.join(DASHBOARD_NODES_DIR, "widgets", "ui_template.html"),
  };
  const dashboardRequiredFields = {
    "ui-base": ["name", "path", "includeClientData", "headerContent", "navigationStyle"],
    "ui-page": ["name", "ui", "path", "layout", "theme", "breakpoints", "visible", "disabled"],
    "ui-group": ["name", "page", "width", "height", "order", "showTitle", "visible", "disabled"],
    "ui-theme": ["name", "colors", "sizes"],
    "ui-button": ["group", "label", "order", "width", "height", "payload", "payloadType", "topic", "topicType"],
    "ui-text-input": ["group", "label", "order", "width", "height", "topic", "topicType", "mode", "delay", "passthru"],
    "ui-text": ["group", "order", "width", "height", "label", "format", "layout"],
    "ui-chart": ["group", "label", "order", "width", "height", "chartType", "action", "removeOlder", "removeOlderUnit"],
    "ui-template": ["group", "order", "width", "height", "format", "storeOutMessages", "passthru", "resendOnRefresh", "templateScope"],
  };
  for (const type of dashboardTypes) {
    const html = fs.readFileSync(dashboardNodeFiles[type], "utf8");
    const fields = dashboardRequiredFields[type];
    check(
      `installed Dashboard 2.0 ${type} schema exposes required flow fields`,
      fields.every((field) => new RegExp(`\\b${field}\\s*:`).test(html)),
      fields.filter((field) => !new RegExp(`\\b${field}\\s*:`).test(html)).join(","),
    );
    check(
      `flow ${type} nodes use installed Dashboard 2.0 field names`,
      flowNodes
        .filter((n) => n.type === type)
        .every((node) => fields.every((field) => Object.prototype.hasOwnProperty.call(node, field))),
      flowNodes
        .filter((n) => n.type === type)
        .filter((node) => !fields.every((field) => Object.prototype.hasOwnProperty.call(node, field)))
        .map((node) => node.id)
        .join(","),
    );
  }

  // Safety: no hardcoded MQTT hostname in flow broker node
  const brokerNodes = flowNodes.filter((n) => n.type === "mqtt-broker");
  check(
    "no hardcoded MQTT hostname in flow broker node",
    brokerNodes.every((n) => {
      const b = String(n.broker || "");
      return b === "" || b === "${MQTT_BROKER_HOST}" || b.startsWith("${env.");
    }),
    brokerNodes.map((n) => `${n.id}=${n.broker}`).join(", "),
  );
  check(
    "MQTT broker reads host/port/credentials from env placeholders",
    brokerNodes.every((n) =>
      n.broker === "${MQTT_BROKER_HOST}" &&
      n.port === "${MQTT_BROKER_PORT}" &&
      n.credentials &&
      n.credentials.user === "${MQTT_USERNAME}" &&
      n.credentials.password === "${MQTT_PASSWORD}",
    ),
    brokerNodes.map((n) => `${n.id}=${n.broker}:${n.port}`).join(", "),
  );

  return getFailures();
}
