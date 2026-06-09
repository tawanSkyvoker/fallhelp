
/**
 * @file AlertSystem.ino
 * @brief AlertSystem: ระบบควบคุมลำโพงเตือนของ `main_firmware`
 *
 * หน้าที่หลัก:
 * - จัดการเสียงแจ้งเตือนที่เกี่ยวกับ fall flow และสถานะสำคัญของเครื่อง
 * - แยก normal tone ออกจาก force tone เพื่อให้ alert สำคัญยังดังได้แม้ผู้ใช้ปิดเสียงทั่วไป
 * - คงการวนเสียงเตือนหกล้มแบบ non-blocking ใน loop ให้สอดคล้องกับ cancel window
 */

#include "types.h"

// ============================================================================
// [1] ค่าคงที่ของเสียงและรูปแบบจังหวะ (Tone & Pattern Configuration)
// ============================================================================

#define SPEAKER_PIN 25

#define TONE_FALL 1800
#define TONE_BATTERY_LOW 600
#define TONE_SUCCESS 500

#define ALERT_DURATION_SHORT 200
#define ALERT_DURATION_MEDIUM 500
#define ALERT_DURATION_LONG 1000
#define ALERT_PATTERN_INTERVAL 300

// PWM ของ ESP32 ที่ใช้ขับ Grove - Speaker
#define SPEAKER_PWM_FREQ 2000
#define SPEAKER_PWM_RESOLUTION 8
#define SPEAKER_PWM_DUTY 190

// เสียง fall alert จะถูกเล่นซ้ำเป็นรอบ ๆ จนกว่าจะถูก cancel หรือ flow จบ
#define FALL_ALERT_REPEAT_INTERVAL 800

#define PATTERN_SINGLE 1
#define PATTERN_DOUBLE 2
#define PATTERN_TRIPLE 3

// ============================================================================
// [2] สถานะภายในของระบบเสียง (Alert State)
// ============================================================================

AlertSystemState alertState = {false, 0, 0, 0, 0, false};
bool speakerPwmAttached = false;
bool speakerOutputEnabled = true;
bool fallAlertActive = false;
unsigned long lastFallAlertPlayTime = 0;

// non-blocking pattern player — แทน delay() ระหว่าง beep
struct PatternPlayer {
  bool active;
  bool forceMode;
  int frequency;
  int step;
  int totalSteps;
  unsigned long nextStepAt;
};
PatternPlayer patternPlayer = {false, false, 0, 0, 0, 0};

// ============================================================================
// [3] ฟังก์ชันเริ่มต้นและผูกฮาร์ดแวร์ลำโพง (Initialization & Hardware)
// ============================================================================

bool initAlertSystem()
{
  // บังคับขาลำโพงเป็น LOW ตั้งแต่ต้นเพื่อลด boot pop/noise ของ Grove - Speaker
  pinMode(SPEAKER_PIN, OUTPUT);
  digitalWrite(SPEAKER_PIN, LOW);

  // attach PWM แล้วเคลียร์ duty เป็น 0 ก่อนเพื่อให้เริ่มต้นแบบเงียบ
  ledcAttach(SPEAKER_PIN, SPEAKER_PWM_FREQ, SPEAKER_PWM_RESOLUTION);
  ledcWrite(SPEAKER_PIN, 0);
  speakerPwmAttached = true;

  alertState.isInitialized = true;

  if (isRuntimeSerialOutputEnabled())
    Serial.println("✅ Alert System initialized (Silent Boot)");

  return true;
}

// ยืนยันว่า PWM path ยังผูกกับลำโพงอยู่ก่อนสั่งเล่นเสียง
bool ensureSpeakerPwmAttached()
{
  if (!speakerPwmAttached)
  {
    if (!ledcAttach(SPEAKER_PIN, SPEAKER_PWM_FREQ, SPEAKER_PWM_RESOLUTION))
    {
      if (isRuntimeSerialOutputEnabled())
        Serial.println("❌ LEDC attach failed");
      return false;
    }
    speakerPwmAttached = true;
  }
  return true;
}

// ปิดเสียงแบบ hard mute ใช้ตอน stop alert หรือ recovery path
void hardMuteSpeaker()
{
  if (speakerPwmAttached)
  {
    ledcWriteTone(SPEAKER_PIN, 0);
    ledcWrite(SPEAKER_PIN, 0);
  }
  else
  {
    pinMode(SPEAKER_PIN, OUTPUT);
    digitalWrite(SPEAKER_PIN, LOW);
  }
}

// ============================================================================
// [4] ฟังก์ชันเล่นเสียง (Tone Playback)
// ============================================================================

// เสียงทั่วไปจะเคารพ user setting ของลำโพง
void playTone(int frequency, unsigned long duration)
{
  if (!speakerOutputEnabled || frequency <= 0)
  {
    stopAlert();
    return;
  }

  if (!ensureSpeakerPwmAttached())
  {
    hardMuteSpeaker();
    alertState.isPlaying = false;
    return;
  }

  ledcWriteTone(SPEAKER_PIN, frequency);
  ledcWrite(SPEAKER_PIN, SPEAKER_PWM_DUTY);
  alertState.isPlaying = true;
  alertState.alertStartTime = millis();
  alertState.alertDuration = duration;
}

// เสียงสำคัญ เช่น fall alert จะไม่สนการ mute ทั่วไป
void playToneForce(int frequency, unsigned long duration)
{
  if (frequency <= 0)
  {
    stopAlert();
    return;
  }

  if (!ensureSpeakerPwmAttached())
  {
    hardMuteSpeaker();
    alertState.isPlaying = false;
    return;
  }

  ledcWriteTone(SPEAKER_PIN, frequency);
  ledcWrite(SPEAKER_PIN, SPEAKER_PWM_DUTY);
  alertState.isPlaying = true;
  alertState.alertStartTime = millis();
  alertState.alertDuration = duration;
}

// เริ่ม pattern แบบ non-blocking — beep แรกดังทันที beep ถัดไปจัดการใน updateAlertSystem()
void startPatternPlayer(int pattern, int frequency, bool forceMode)
{
  int steps = (pattern == PATTERN_SINGLE) ? 1 : (pattern == PATTERN_DOUBLE) ? 2 : 3;
  patternPlayer = {true, forceMode, frequency, 0, steps, 0};

  unsigned long dur = (steps == 1) ? ALERT_DURATION_MEDIUM : ALERT_DURATION_SHORT;
  if (forceMode) playToneForce(frequency, dur);
  else playTone(frequency, dur);

  if (steps > 1)
    patternPlayer.nextStepAt = millis() + ALERT_DURATION_SHORT + ALERT_PATTERN_INTERVAL;
  else
    patternPlayer.active = false; // single = เสร็จหลังเล่น
}

void playPattern(int pattern, int frequency) { startPatternPlayer(pattern, frequency, false); }
void playPatternForce(int pattern, int frequency) { startPatternPlayer(pattern, frequency, true); }

// ============================================================================
// [5] Event Triggers ของระบบเสียง (Event Triggers)
// ============================================================================

void alertFall()
{
  if (!fallAlertActive)
  {
    if (isRuntimeSerialOutputEnabled())
      Serial.println("🔊 MAX VOLUME Fall Alert (single tone, continuous)");
  }
  fallAlertActive = true;
  lastFallAlertPlayTime = millis();
  // ใช้เสียงดังครั้งเดียว ไม่เพิ่ม pattern ซับซ้อนให้ผู้สวมใส่งง
  playPatternForce(PATTERN_SINGLE, TONE_FALL);
}

void alertBatteryLow()
{
  if (isRuntimeSerialOutputEnabled())
    Serial.println("🔊 Low Battery Alert!");
  playPattern(PATTERN_DOUBLE, TONE_BATTERY_LOW);
}

void alertSuccess()
{
  if (isRuntimeSerialOutputEnabled())
    Serial.println("🔊 Success Alert!");
  playTone(TONE_SUCCESS, ALERT_DURATION_SHORT);
}

void stopAlert()
{
  hardMuteSpeaker();
  alertState.isPlaying = false;
}

void cancelFallAlert()
{
  if (!fallAlertActive) return;

  fallAlertActive = false;
  patternPlayer.active = false; // หยุด pattern ที่ค้างอยู่ทันที
  stopAlert();
  if (isRuntimeSerialOutputEnabled())
    Serial.println("✅ Fall alert cancelled");
}

void setSpeakerOutputEnabled(bool enabled)
{
  speakerOutputEnabled = enabled;
  if (!enabled && !fallAlertActive)
  {
    stopAlert();
  }
}

bool isSpeakerOutputEnabled() { return speakerOutputEnabled; }
bool isFallAlertActive() { return fallAlertActive; }

// ============================================================================
// [6] วงรอบอัปเดตใน loop (Loop Update)
// ============================================================================

void updateAlertSystem()
{
  if (!alertState.isInitialized && !initAlertSystem())
    return;

  // หยุดเสียงเมื่อครบ duration
  if (alertState.isPlaying &&
      millis() - alertState.alertStartTime >= alertState.alertDuration)
  {
    stopAlert();
  }

  // เลื่อน pattern ไปขั้นถัดไปเมื่อถึงเวลา
  if (patternPlayer.active && !alertState.isPlaying &&
      millis() >= patternPlayer.nextStepAt)
  {
    patternPlayer.step++;
    if (patternPlayer.step >= patternPlayer.totalSteps)
    {
      patternPlayer.active = false;
    }
    else
    {
      bool isLast = (patternPlayer.step == patternPlayer.totalSteps - 1);
      if (patternPlayer.forceMode)
        playToneForce(patternPlayer.frequency, ALERT_DURATION_SHORT);
      else
        playTone(patternPlayer.frequency, ALERT_DURATION_SHORT);
      patternPlayer.nextStepAt = millis() + ALERT_DURATION_SHORT +
                                 (isLast ? 0 : ALERT_PATTERN_INTERVAL);
    }
  }

  // วนซ้ำ fall alert pattern เมื่อ pattern ก่อนหน้าจบแล้วครบ interval
  if (fallAlertActive && !patternPlayer.active && !alertState.isPlaying &&
      millis() - lastFallAlertPlayTime >= FALL_ALERT_REPEAT_INTERVAL)
  {
    lastFallAlertPlayTime = millis();
    startPatternPlayer(PATTERN_SINGLE, TONE_FALL, true);
  }
}

bool isAlertSystemReady() { return alertState.isInitialized; }
bool isAlertPlaying() { return alertState.isPlaying; }
