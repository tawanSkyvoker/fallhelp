/**
 * @file AlertSystem.ino
 * @brief ระบบเสียงแจ้งเตือนของ sensor_tuning ผ่าน speaker (GPIO25)
 *
 * - แจ้งเตือน fall แบบ triple-beep ต่อเนื่องจนกว่าจะยกเลิก
 * - คุม mute/unmute ของ speaker ระหว่างรอบจูน
 * - แยก path ระหว่าง alert ปกติกับ alert ที่ต้องเล่นซ้ำจนกว่าจะ cancel
 *
 * ข้อจำกัด:
 * - ไฟล์นี้ดูแลเสียงเท่านั้น ไม่ตัดสินเหตุการณ์การล้มแทนเซนเซอร์
 * - รอบจูน hardware-only จะบูตแบบ mute เพื่อไม่ให้เสียงรบกวนการเก็บข้อมูล
 */

#include "types.h"
#include "build_profile.h"

// ============================================================================
// [1] การตั้งค่าและค่าคงที่ (Configuration & Constants)
// ============================================================================

#define SPEAKER_PIN 25 // GPIO25 (รองรับ PWM) - ขา output ของ speaker

// โทนเสียงแจ้งเตือน (Hz)
#define TONE_FALL 800 // โทนสำหรับ fall detection

// ระยะเวลาเสียงแจ้งเตือน
#define ALERT_DURATION_SHORT 200   // ms - beep สั้น
#define ALERT_DURATION_MEDIUM 500  // ms - beep กลาง
#define ALERT_DURATION_LONG 1000   // ms - beep ยาว
#define ALERT_PATTERN_INTERVAL 300 // ms - เว้นระหว่าง beep ใน pattern

// คุม PWM output
// ลด duty เพื่อให้เสียงเบาลงโดยไม่ต้องแก้ฮาร์ดแวร์
#define SPEAKER_PWM_FREQ 2000
#define SPEAKER_PWM_RESOLUTION 8 // 8-bit -> duty range 0-255
#define SPEAKER_PWM_DUTY 128     // 50% duty สำหรับความดังสูงสุด
#define FALL_ALERT_REPEAT_INTERVAL                                             \
  1500 // ms - เล่น fall alert ซ้ำจนกว่าจะยกเลิก

// รูปแบบเสียงแจ้งเตือน
#define PATTERN_SINGLE 1 // beep เดี่ยว
#define PATTERN_DOUBLE 2 // beep คู่
#define PATTERN_TRIPLE 3 // beep สามครั้ง

// ============================================================================
// [2] ตัวแปรสถานะของโมดูล (Module State)
// ============================================================================

AlertSystemState alertState = {false, 0, 0, 0, 0, false};
bool speakerPwmAttached = false;
// รอบจูนแบบ hardware-only จะปิดเสียงเริ่มต้นไว้ เพื่อลดผลกระทบต่อ data
bool speakerOutputEnabled =
    FALLHELP_SPEAKER_OUTPUT_ENABLED_DEFAULT ? true : false;
bool fallAlertActive = false;
unsigned long lastFallAlertPlayTime = 0;

// ============================================================================
// [3] ฟังก์ชันประกาศล่วงหน้า (Forward Declarations)
// ============================================================================

bool initAlertSystem();
void playTone(int frequency, unsigned long duration);
void playToneForce(int frequency, unsigned long duration);
void playPattern(int pattern, int frequency);
void playPatternForce(int pattern, int frequency);
void alertFall();
void stopAlert();
void cancelFallAlert();
void updateAlertSystem();
bool ensureSpeakerPwmAttached();
void hardMuteSpeaker();
void setSpeakerOutputEnabled(bool enabled);
bool isSpeakerOutputEnabled();
bool isFallAlertActive();
// ไม่มี blinkLED() เพราะบอร์ดชุดนี้ไม่มี LED hardware

// ============================================================================
// [4] การเริ่มต้นและ helper ภายใน (Initialization & Internal Helpers)
// ============================================================================

/**
 * เริ่มต้นระบบแจ้งเตือน
 *
 * ใช้แนวทาง silent boot โดยบังคับขา speaker ให้ LOW ก่อน
 * แล้วค่อยผูก PWM ด้วย duty = 0 เพื่อกันเสียงดังแหลมตอนเปิดเครื่อง
 *
 * @return true เมื่อระบบแจ้งเตือนพร้อมใช้งาน
 */
bool initAlertSystem()
{
  // กันเสียงดังตอนบูตของ Grove Speaker:
  // ตั้งขาเป็น output และบังคับ LOW ก่อนเริ่ม PWM
  pinMode(SPEAKER_PIN, OUTPUT);
  digitalWrite(SPEAKER_PIN, LOW);

  // ผูก PWM ด้วย duty = 0 เพื่อให้เงียบไว้ก่อน
  ledcAttach(SPEAKER_PIN, SPEAKER_PWM_FREQ, SPEAKER_PWM_RESOLUTION);
  ledcWrite(SPEAKER_PIN, 0); // duty 0 = 0V
  speakerPwmAttached = true;

  // ไม่มี LED hardware ในชุดนี้

  alertState.isInitialized = true;

  Serial.println("✅ Alert System initialized (Silent Boot)");
  Serial.printf("Speaker output default: %s\n",
                speakerOutputEnabled ? "ENABLED" : "DISABLED");
  if (!speakerOutputEnabled) {
    Serial.println("ℹ️ Speaker is muted in hardware-only tuning build. Use "
                   "'speaker' command only when needed for audio tests.");
  }

  return true;
}

/** ตรวจให้แน่ใจว่า PWM พร้อมก่อนสร้างเสียง */
bool ensureSpeakerPwmAttached()
{
  if (speakerPwmAttached) {
    return true;
  }

  // โดยปกติผูกไว้ตอน init แล้ว แต่เช็กซ้ำเผื่อพลาด
  if (!speakerPwmAttached) {
    if (!ledcAttach(SPEAKER_PIN, SPEAKER_PWM_FREQ, SPEAKER_PWM_RESOLUTION)) {
      Serial.println("❌ LEDC attach failed");
      return false;
    }
    speakerPwmAttached = true;
  }
  return true;
}

/** ปิดเสียง speaker โดยตัด PWM แล้วบังคับขาให้กลับ LOW */
void hardMuteSpeaker()
{
  if (speakerPwmAttached) {
    ledcWriteTone(SPEAKER_PIN, 0);
    ledcWrite(SPEAKER_PIN, 0); // บังคับ duty = 0
  } else {
    pinMode(SPEAKER_PIN, OUTPUT);
    digitalWrite(SPEAKER_PIN, LOW);
  }
}

// ============================================================================
// [5] การสร้างเสียงและ pattern (Tone & Pattern Control)
// ============================================================================

/** เล่น tone ตามความถี่และระยะเวลาที่กำหนด */
void playTone(int frequency, unsigned long duration)
{
  if (!speakerOutputEnabled) {
    stopAlert();
    return;
  }

  if (frequency <= 0) {
    // ปิดเสียง
    stopAlert();
    return;
  }

  if (!ensureSpeakerPwmAttached()) {
    hardMuteSpeaker();
    alertState.isPlaying = false;
    return;
  }

  // ใช้ LEDC helper ของ ESP32 Arduino Core เพื่อสร้าง tone โดยตรง
  ledcWriteTone(SPEAKER_PIN, frequency);
  ledcWrite(SPEAKER_PIN, SPEAKER_PWM_DUTY);
  alertState.isPlaying = true;
  alertState.alertStartTime = millis();
  alertState.alertDuration = duration;
}

/** เล่น tone ผ่าน path ที่ใช้กับ alert แบบวนซ้ำ */
void playToneForce(int frequency, unsigned long duration)
{
  // เคารพ runtime mute เพื่อให้ช่วงจูนเงียบได้จริง
  if (!speakerOutputEnabled) {
    stopAlert();
    return;
  }

  if (frequency <= 0) {
    stopAlert();
    return;
  }

  if (!ensureSpeakerPwmAttached()) {
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

/** เล่น alert pattern ตามประเภทที่กำหนด */
void playPattern(int pattern, int frequency)
{
  switch (pattern) {
  case PATTERN_SINGLE:
    playTone(frequency, ALERT_DURATION_MEDIUM);
    break;

  case PATTERN_DOUBLE:
    playTone(frequency, ALERT_DURATION_SHORT);
    delay(ALERT_PATTERN_INTERVAL);
    playTone(frequency, ALERT_DURATION_SHORT);
    break;

  case PATTERN_TRIPLE:
    for (int i = 0; i < 3; i++) {
      playTone(frequency, ALERT_DURATION_SHORT);
      if (i < 2)
        delay(ALERT_PATTERN_INTERVAL);
    }
    break;
  }
}

// ============================================================================
// [6] ฟังก์ชันแจ้งเตือนหลัก (Alert Control Flow)
// ============================================================================

/** เริ่ม alert เมื่อพบ fall */
void alertFall()
{
  if (!fallAlertActive) {
    Serial.println("🔊 Fall Detection Alert (continuous until cancel)");
  }
  fallAlertActive = true;
  lastFallAlertPlayTime = millis();
  playPatternForce(PATTERN_TRIPLE, TONE_FALL);
}

/** หยุด alert ที่กำลังทำงาน */
void stopAlert()
{
  hardMuteSpeaker();
  alertState.isPlaying = false;
}

/** ยกเลิก fall alert ที่กำลังทำงาน (ใช้กับปุ่ม cancel) */
void cancelFallAlert()
{
  if (!fallAlertActive)
    return;

  fallAlertActive = false;
  stopAlert();
  Serial.println("✅ Fall alert cancelled");
}

/** เปิดหรือปิด speaker ระหว่าง runtime */
void setSpeakerOutputEnabled(bool enabled)
{
  speakerOutputEnabled = enabled;
  if (!enabled && !fallAlertActive) {
    stopAlert();
  }
}

/** เล่น pattern ผ่าน path ที่ใช้กับ alert แบบวนซ้ำ */
void playPatternForce(int pattern, int frequency)
{
  if (!speakerOutputEnabled) {
    stopAlert();
    return;
  }

  switch (pattern) {
  case PATTERN_SINGLE:
    playToneForce(frequency, ALERT_DURATION_MEDIUM);
    break;

  case PATTERN_DOUBLE:
    playToneForce(frequency, ALERT_DURATION_SHORT);
    delay(ALERT_PATTERN_INTERVAL);
    playToneForce(frequency, ALERT_DURATION_SHORT);
    break;

  case PATTERN_TRIPLE:
    for (int i = 0; i < 3; i++) {
      playToneForce(frequency, ALERT_DURATION_SHORT);
      if (i < 2)
        delay(ALERT_PATTERN_INTERVAL);
    }
    break;
  }
}

/** ตรวจว่า speaker output เปิดอยู่หรือไม่ */
bool isSpeakerOutputEnabled() { return speakerOutputEnabled; }

/** ตรวจว่า fall alert แบบต่อเนื่องกำลังทำงานอยู่หรือไม่ */
bool isFallAlertActive() { return fallAlertActive; }

// ไม่มี blinkLED() เพราะระบบปัจจุบันไม่มี LED hardware

// ============================================================================
// [7] วนรอบอัปเดตและสถานะสาธารณะ (Main Update & Public Status)
// ============================================================================

/** อัปเดต Alert System ใน main loop */
void updateAlertSystem()
{
  if (!alertState.isInitialized && !initAlertSystem()) {
    return;
  }

  // หยุดเสียงเมื่อครบเวลา
  if (alertState.isPlaying) {
    if (millis() - alertState.alertStartTime >= alertState.alertDuration) {
      stopAlert();
    }
  }

  if (fallAlertActive && !alertState.isPlaying &&
      millis() - lastFallAlertPlayTime >= FALL_ALERT_REPEAT_INTERVAL) {
    lastFallAlertPlayTime = millis();
    playPatternForce(PATTERN_TRIPLE, TONE_FALL);
  }
}

// ============================================================================
// [8] ฟังก์ชันตรวจสถานะสาธารณะ (Public Status Helpers)
// ============================================================================

/** ตรวจว่า alert system เริ่มต้นแล้วหรือยัง */
bool isAlertSystemReady() { return alertState.isInitialized; }

/** ตรวจว่ากำลังเล่น alert อยู่หรือไม่ */
bool isAlertPlaying() { return alertState.isPlaying; }
