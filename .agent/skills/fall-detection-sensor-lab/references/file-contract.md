# Fall Detection Sensor Lab File Contract

Use this reference when checking whether a session folder is complete and analyzable.

## Canonical Paths

- Root: `firmware/esp32/fall_detection_sensor_lab/`
- Docs: `README.md`, `trial_protocol.md`, `csv_schema.md`, `selection_guide.md`, `chapter_usage.md`, `notes.md`
- Node-RED flow: `node-red/flows/fall-detection-sensor-lab-flow.v2.json`
- Scripts: `firmware/esp32/fall_detection_sensor_lab/scripts/validate_sensor_lab_log.mjs`, `firmware/esp32/fall_detection_sensor_lab/scripts/summarize_selected.mjs`, `firmware/esp32/fall_detection_sensor_lab/scripts/generate_chapter_examples.mjs`
- Examples (format only): `examples/raw/`, `examples/selected/`, `examples/exports/`

## Required Session Artifacts

- Raw (from Node-RED, 1 Trial = 1 CSV):
  - `runs/Sxx/raw/Sxx_Txx_<activity_label>.csv`
  - `runs/Sxx/session_notes.md`
- Selected (AI-picked per `selection_guide.md`):
  - `runs/Sxx/selected/*.csv`
- Exports (generated, never hand-edited):
  - `exports/selected_values_table.csv`
  - `exports/examples_for_fall_detection_sensor_lab.md`
  - `exports/examples_for_chapter_5.md`

Raw CSV header must match `csv_schema.md` (validated by `validate_sensor_lab_log.mjs`):
a row of `type=imu_decision` with `svm_filtered_g` and `posture_delta_deg` is required.

## Command Entry Points

- `npm run sensor-lab -- validate` — validate raw CSV vs schema
- `npm run sensor-lab -- summarize` — selected/ → `exports/selected_values_table.csv`
- `npm run sensor-lab -- chapters` — table → ch.3 / ch.5 markdown
- `npm run sensor-lab -- all` — all three in order
- `npm run sensor-lab -- node-red rebuild` — rebuild + recreate Node-RED lab service

If files do not match the naming contract, the scripts may skip them.
Scripts never modify raw files.
