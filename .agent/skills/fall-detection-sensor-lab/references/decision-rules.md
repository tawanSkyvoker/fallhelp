# Fall Detection Sensor Lab Selection & Reporting Rules

Use this reference when turning collected trials into selected data and ch.3/ch.5 tables.

## Evidence First

- Run `npm run sensor-lab -- validate` and read PASS/FAIL before selecting
- Cross-check every pick against `runs/Sxx/session_notes.md` and `notes.md`
- Use measured CSV values, never anecdotal or invented numbers

## Selection Patterns (per `selection_guide.md`)

- Fall case: pick trials with clear impact, high `posture_delta_deg`,
  `decision = suspected_fall`
- Non-fall / false-alarm candidate: high magnitude but `posture_delta_deg`
  below threshold, `decision = ignored` (e.g. `sit_hard`)
- Motion: continuous movement without a fall decision (e.g. `running_light`)
- Baseline: values near resting, no fall event (e.g. `standing_still`)
- Skip trials with severe notes (MQTT drop, device detached) or label mismatch

## Reporting Rules

- ch.3 (`examples_for_fall_detection_sensor_lab.md`): show one fall case + magnitude/postureDelta
  calculation templates + decision logic
- ch.5 (`examples_for_chapter_5.md`): Thai table — Trial / ท่าพื้นฐานที่ทดสอบ /
  ประเภท / Magnitude / Posture Delta / ผลที่ระบบตรวจจับ / สรุป
- Translate `activity_label`, `expected_type`, `decision` to Thai per
  `chapter_usage.md`
- Keep reporting focused on collected sensor values, activity labels, and decision traces.
- Never claim real results until real CSV exists; `examples/` is format only
