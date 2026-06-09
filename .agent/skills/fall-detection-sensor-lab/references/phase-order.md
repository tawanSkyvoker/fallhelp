# Fall Detection Sensor Lab Collection Order

Use this reference when deciding what to run next or whether a collection round is valid.

## Default Sequence (`FALLHELP_SINGLE_SENSOR_MPU6050`)

1. Prepare firmware, profile, logging, and the Node-RED flow
   `fall-detection-sensor-lab-flow.v2.json`
2. Per trial: set metadata → Start Trial → perform 1 activity → Stop Trial
   (1 Trial = 1 CSV in `runs/Sxx/raw/`)
3. Collect the 9 activities for the configured trial counts (24 trials total),
   non-fall first where practical, fall activities on a padded surface
4. After the session: fill `runs/Sxx/session_notes.md` and `notes.md`
5. `npm run sensor-lab -- validate` over `runs/Sxx/raw/`
6. Select representative trials into `runs/Sxx/selected/` per `selection_guide.md`
7. `npm run sensor-lab -- summarize` → `npm run sensor-lab -- chapters`

Activities: standing_still, walking_normal, running_light, sit_normal,
sit_hard, side_fall_left, side_fall_right, forward_fall, backward_fall.

## Stop / Go Rules

- A trial is usable when:
  - `activity_label` matches the activity actually performed
  - it has an `imu_decision` row with `svm_filtered_g` and `posture_delta_deg`
  - `note` records no severe issue (MQTT drop, device detached)
- A trial fails validation:
  - fix the cause and re-collect that trial before selecting it
- Enough data:
  - per `selection_guide.md` targets (fall 2–3, non-fall 2–3, etc.) are met
- Out of scope:
  - Keep this lab focused on collected IMU values, activity labels, and decision traces.
