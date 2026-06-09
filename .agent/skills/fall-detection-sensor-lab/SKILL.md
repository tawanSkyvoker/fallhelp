---
name: fall-detection-sensor-lab
description: >
  Fall Detection Sensor Lab specialist for FallHelp. Use when running or reviewing
  IMU data-collection trials under firmware/esp32/fall_detection_sensor_lab/,
  validating raw CSV, selecting representative trials, and generating thesis ch.3/ch.5
  support tables. This is lab data collection only.
---

# Fall Detection Sensor Lab

Use this skill when a task touches `firmware/esp32/fall_detection_sensor_lab/**`,
`firmware/esp32/START_HERE.md`, collected CSVs, `session_notes.md`, `notes.md`,
or the exports for thesis ch.3 / ch.5.

## Core Workflow

1. Read `AGENTS.md` for canonical safety and terminology rules.
2. Read `docs/ai/AI_QUICKSTART.md` for validation and routing.
3. Read `docs/ai/firmware.md` for firmware context and runtime contracts.
4. Read `firmware/esp32/START_HERE.md` for the data-collection quickstart.
5. Read `firmware/esp32/fall_detection_sensor_lab/README.md` for the lab workflow and file conventions.
6. Inspect the real session files (`runs/Sxx/`), schema, and scripts before any action.
7. Run the lab scripts (`npm run sensor-lab -- validate` / `summarize` / `chapters`) as evidence; never invent results.

## When To Use This Skill

- Setting up or reviewing Basic Activity Collection trials (9 activities, 24 trials)
- Running or interpreting `validate_sensor_lab_log.mjs`, `summarize_selected.mjs`, `generate_chapter_examples.mjs`
- Filling `runs/Sxx/session_notes.md` or `notes.md`
- Selecting representative trials into `runs/Sxx/selected/` per `selection_guide.md`
- Producing `exports/examples_for_fall_detection_sensor_lab.md` / `examples_for_chapter_5.md`

## Non-Negotiable Rules

- 1 Trial = 1 activity = 1 CSV; never merge activities into one file
- Never guess `activityLabel` — use the user-provided label
- Example/export files show **format only**; never claim real results until real CSV is collected
- This is Basic Activity Collection lab work; keep outputs focused on collected sensor values,
  activity labels, and decision traces.
- `sensor_tuning` publishes `device/{serial}/lab/imu` only; never modify `main_firmware`
  logic or the runtime event topics

## Selective References

- `references/phase-order.md` for the collection sequence and stop/go gates
- `references/file-contract.md` for required files, naming rules, and script entrypoints
- `references/decision-rules.md` for selection criteria and ch.3/ch.5 reporting language

## Cross-Stack Reminder

If collection findings imply a payload, timing, or alert-flow contract problem, escalate back to the firmware / backend / mobile path instead of treating it as a pure threshold issue.

This skill is for evidence-driven Fall Detection Sensor Lab work. `AGENTS.md` remains the canonical policy source.
