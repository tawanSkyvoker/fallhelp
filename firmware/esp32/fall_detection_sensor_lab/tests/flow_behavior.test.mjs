import { createChecker, loadFlow, makeRun } from "./helpers.mjs";

export function run() {
  const { check, getFailures } = createChecker();
  const flowNodes = loadFlow();
  const fnSrc = {};
  for (const node of flowNodes) {
    if (node.type === "function") fnSrc[node.id] = node.func;
  }

  if (!fnSrc.fn_init || !fnSrc.fn_start || !fnSrc.fn_trialdone) {
    check("function node sources available for behavior tests", false,
      "fn_init/fn_start/fn_trialdone missing — flow_structure tests should have caught this");
    return getFailures();
  }

  const runInit = makeRun(fnSrc.fn_init);
  const runStart = makeRun(fnSrc.fn_start);
  const runLive = makeRun(fnSrc.fn_live);
  const runTrialDone = makeRun(fnSrc.fn_trialdone);
  const runReadiness = makeRun(fnSrc.fn_readiness);
  const runDashboardDefaults = makeRun(fnSrc.fn_dashboard_defaults);

  // fn_init sets CSV header global
  const initStore = { flow: {}, global: {} };
  const initCtx = {
    flow: { get: (k) => initStore.flow[k], set: (k, v) => (initStore.flow[k] = v) },
    global: { get: (k) => initStore.global[k], set: (k, v) => (initStore.global[k] = v) },
    env: { get: () => undefined },
    node: { status: () => {} },
  };
  runInit({}, initCtx.flow, initCtx.global, initCtx.env, initCtx.node);
  const header = initStore.global["FALL_SENSOR_LAB_CSV_HEADER"];
  check("fn_init sets CSV header global", typeof header === "string" && header.includes("session_id"));

  // guard: Start without Dashboard activity metadata refuses
  {
    const s = { flow: {}, global: { FALL_SENSOR_LAB_CSV_HEADER: header } };
    const c = {
      flow: { get: (k) => s.flow[k], set: (k, v) => (s.flow[k] = v) },
      global: { get: (k) => s.global[k], set: (k, v) => (s.global[k] = v) },
      env: { get: () => undefined },
      node: { status: () => {} },
    };
    const out = runStart({}, c.flow, c.global, c.env, c.node);
    check(
      "guard: Start without Dashboard activity metadata refuses",
      out == null && s.flow["recording"] !== true,
    );
  }

  // fn_trialdone: stop during recording — increments trialSeq, clears recording
  {
    const tdCode = fnSrc.fn_trialdone;
    check("flow exports fn_trialdone", typeof tdCode === "string");

    function runTrialDone(state) {
      const st = { flow: { ...state } };
      const cx = {
        flow: { get: (k) => st.flow[k], set: (k, v) => (st.flow[k] = v) },
        global: { get: () => undefined, set: () => {} },
        env: { get: (k) => (k === "SENSOR_LAB_SESSION_ID" ? "S01" : undefined) },
        node: { status: () => {}, send: () => {} },
      };
      const out = makeRun(tdCode)({}, cx.flow, cx.global, cx.env, cx.node);
      return { out, flow: st.flow };
    }

    const r1 = runTrialDone({
      recording: true, pendingSeq: 5, trialSeq: 4,
      sessionId: "S01", countdownActive: false, countdownTimer: null,
    });
    const status1 = Array.isArray(r1.out) ? r1.out[1] : null;
    check(
      "Stop during recording: increments trialSeq + CSV saved",
      r1.flow.trialSeq === 5 && r1.flow.recording === false &&
      status1 && /Stopped \/ CSV saved/.test(status1.payload),
      JSON.stringify({ seq: r1.flow.trialSeq, status: status1 && status1.payload }),
    );

    const r2 = runTrialDone({
      recording: false, countdownActive: true,
      pendingSeq: 5, trialSeq: 4, sessionId: "S01", countdownTimer: null,
    });
    const status2 = Array.isArray(r2.out) ? r2.out[1] : null;
    check(
      "Stop during countdown: cancels, NO trialSeq increment, no CSV saved",
      r2.flow.trialSeq === 4 && r2.flow.countdownActive === false &&
      status2 && /Countdown cancelled/.test(status2.payload) &&
      !/CSV saved/.test(status2.payload),
      JSON.stringify({ seq: r2.flow.trialSeq, status: status2 && status2.payload }),
    );
  }

  // fn_live: display-only dashboard 2.1 outputs keep original payload contract
  {
    const s = { flow: {} };
    const c = {
      flow: { get: (k) => s.flow[k], set: (k, v) => (s.flow[k] = v) },
      global: { get: () => undefined, set: () => {} },
      env: { get: () => undefined },
      node: { status: () => {} },
    };
    const out = runLive({
      payload: {
        type: "imu_sample",
        ax: 0.1234, ay: 0.2345, az: 0.9876,
        gx: 1.234, gy: 2.345, gz: 3.456,
        svmFiltered: 1.2345,
        pitch: 6.78, roll: 9.12,
        pitchDelta: 1.11, rollDelta: 2.22, postureDelta: 3.33,
        state: "IDLE",
        decision: "sample",
      },
    }, c.flow, c.global, c.env, c.node);
    check(
      "Live display groups acceleration, gyro, impact, posture/orientation, and decision text",
      Array.isArray(out) &&
        Array.isArray(out[0].payload?.groups) &&
        out[0].payload.groups.some((g) => g.title === "Acceleration" && g.items.some((i) => i.label === "AX" && i.value === "0.123g")) &&
        out[0].payload.groups.some((g) => g.title === "Gyroscope") &&
        out[0].payload.groups.some((g) => g.title === "Impact" && g.items.some((i) => i.label === "Magnitude (SVM)" && i.value === "1.234g")) &&
        out[0].payload.groups.some((g) => g.title === "Posture" && g.items.some((i) => i.label === "Pitch" && i.value === "6.78deg")) &&
        out[0].payload.groups.some((g) => g.title === "Decision"),
      Array.isArray(out) ? JSON.stringify(out[0].payload) : JSON.stringify(out),
    );
    check(
      "Live charts split svmFiltered impact from pitch, roll, and postureDelta",
      Array.isArray(out) &&
        out[1] &&
        out[1].topic === "Magnitude (SVM)" &&
        out[1].payload === 1.234 &&
        out[2] &&
        out[2].topic === "Pitch" &&
        out[2].payload === 6.78 &&
        out[3] &&
        out[3].topic === "Roll" &&
        out[3].payload === 9.12 &&
        out[4] &&
        out[4].topic === "Delta" &&
        out[4].payload === 3.33,
      JSON.stringify(Array.isArray(out) ? out.slice(1, 5) : out),
    );
  }

  // fn_dashboard_defaults: startup dashboard placeholders are visible without changing trial state.
  {
    const s = { flow: { recording: false, sessionId: "S01", trialSeq: 0 } };
    const c = {
      flow: { get: (k) => s.flow[k], set: (k, v) => (s.flow[k] = v) },
      global: { get: () => undefined, set: () => {} },
      env: { get: () => undefined },
      node: { status: () => {} },
    };
    const out = runDashboardDefaults({}, c.flow, c.global, c.env, c.node);
    check(
      "Dashboard defaults emit metadata refresh and Last Saved CSV placeholder",
      Array.isArray(out) &&
        out[0] &&
        out[0].payload?.lastSavedCsv === "-" &&
        out[1] &&
        out[1].payload?.groups?.some((g) => g.title === "Acceleration") &&
        out[1].payload?.groups?.some((g) => g.title === "Posture") &&
        s.flow.recording === false,
      JSON.stringify(out),
    );
  }

  // fn_readiness: operator dashboard status is grouped and badge-driven, not pipe-separated debug text.
  {
    const now = Date.now();
    const s = {
      flow: {
        mqttConnected: true,
        recording: true,
        countdownActive: false,
        sessionId: "S01",
        trialSeq: 0,
        trialMeta: { activityLabel: "walking_normal", expectedType: "non_fall" },
        lastLabMsgTs: now - 1000,
        lastImuSampleTs: now - 1000,
      },
    };
    const c = {
      flow: { get: (k) => s.flow[k], set: (k, v) => (s.flow[k] = v) },
      global: { get: () => undefined, set: () => {} },
      env: { get: () => undefined },
      node: { status: () => {} },
    };
    const out = runReadiness({}, c.flow, c.global, c.env, c.node);
    check(
      "System Status uses status/detail/trial field groups",
        out &&
        out.payload?.statusItems?.some((i) => i.label === "MQTT" && i.value === "connected" && i.color === "green") &&
        out.payload?.statusItems?.some((i) => i.label === "Device" && i.value === "Online" && i.color === "green") &&
        out.payload?.statusItems?.some((i) => i.label === "IMU" && i.value === "recent" && i.color === "green") &&
        !out.payload?.statusItems?.some((i) => i.label === "Warning") &&
        out.payload?.detailItems?.some((i) => i.label === "Current activity" && i.value === "walking_normal") &&
        out.payload?.detailItems?.some((i) => i.label === "Current expected type" && i.value === "non_fall") &&
        out.payload?.detailItems?.some((i) => i.label === "Topic" && i.value === "device/+/lab/imu"),
      JSON.stringify(out),
    );
    check(
      "Combined output includes trialItems with State and Last CSV",
      out &&
        out.payload?.trialItems?.some((i) => i.label === "Session" && i.value === "S01") &&
        out.payload?.trialItems?.some((i) => i.label === "State" && i.value === "recording" && i.color === "blue") &&
        out.payload?.trialItems?.some((i) => i.label === "Activity" && i.value === "walking_normal"),
      JSON.stringify(out?.payload?.trialItems),
    );
    check(
      "Combined status output keeps readiness detail fields without pipe-separated text",
      out &&
        out.payload?.items?.some((i) => i.label === "Last seen age") &&
        out.payload?.items?.some((i) => i.label === "Current activity" && i.value === "walking_normal") &&
        out.payload?.items?.some((i) => i.label === "Topic" && i.value === "device/+/lab/imu") &&
        !JSON.stringify(out.payload?.items).includes(" | "),
      JSON.stringify(out?.payload?.items),
    );
  }

  return getFailures();
}
