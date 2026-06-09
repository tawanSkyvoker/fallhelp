# Sensor Tuning Playbook

Use this reference when adjusting thresholds, sensitivity profiles, or sensor-lab workflow.

## Tuning Principles

- Tune one parameter per cycle
- Record why the parameter changed and what symptom it targets
- Separate false-alarm reduction from missed-detection recovery; do not tune both blindly in one step
- Prefer evidence from ADL and simulated-fall runs over intuition

## Sensor Lab Flow

1. Confirm the current profile and threshold values
2. Run or review ADL results for false positives
3. Run or review simulated falls for missed detections
4. Adjust one threshold or sensitivity profile
5. Re-run the smallest meaningful validation loop
6. Record the outcome in session notes / report docs

## Decision Heuristics

- False alarm too high during ADL:
  - reduce sensitivity or raise the relevant trigger threshold carefully
- Missed detection too high during simulated falls:
  - increase sensitivity or lower the relevant trigger threshold carefully
- Unclear whether SVM or posture logic is failing:
  - inspect logs first; do not tune two independent thresholds at once

## Do Not Forget

- The cancel window is not a general tuning knob
- Tuning impacts backend/mobile alert behavior indirectly through event volume and timing
- If the project keeps a report or session note for the run, update it in the same work session
