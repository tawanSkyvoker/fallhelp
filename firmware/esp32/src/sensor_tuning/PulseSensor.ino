/**
 * @file PulseSensor.ino
 * @brief flow สำหรับ Pulse Sensor XD-58C ในโหมดจูน hardware-only
 *
 * ตำแหน่งเซนเซอร์: หนีบหู (earlobe clip)
 * - เนื้อเยื่อบางทำให้ signal amplitude ดี
 * - motion artifact น้อยกว่าข้อมือ
 * - perfusion ต่ำกว่านิ้วเล็กน้อย จึงใช้ SIGNAL_AMP_MIN ต่ำลง
 *
 * แนวทางไฟล์นี้:
 * - ใช้ PulseSensorPlayground เป็นแหล่ง sample/beat/BPM หลัก 100%
 * - ทำ Moving Average (window=5) ให้ log/plot นิ่งขึ้น
 *   โดยไม่แตะ beat detection ภายใน library
 * - มี Signal Quality Gate ก่อนรับ beat
 * - มี IBI Validation เป็น safety net เพิ่ม
 * - คุมการส่ง MQTT ตามการเปลี่ยน zone และ interval
 */

#include <ArduinoJson.h>
#include <PubSubClient.h>
#ifndef USE_ARDUINO_INTERRUPTS
// โหมด ESP32 + PulseSensorPlayground v2.5.0: ใช้ software timer path เป็นค่าเริ่มต้น
#define USE_ARDUINO_INTERRUPTS false
#endif
#include "types.h"
#include <PulseSensorPlayground.h>

// ============================================================================
// [1] การตั้งค่าของ Pulse Sensor (Pulse Sensor Configuration)
// ============================================================================

#define PULSE_SENSOR_PIN 34 // GPIO34 (ADC1_CH6)

#define PULSE_ADC_RESOLUTION_BITS 10
#define PULSE_ADC_MAX_VALUE 1023
#define PULSE_THRESHOLD_10BIT 480

#define VALID_BPM_MIN 40
#define VALID_BPM_MAX 180

// การทำ Moving Average (อ้างอิง: ESP32 ADC noise ±6-10 LSB)
// ใช้เพื่อให้ค่าใน log/plot นิ่งขึ้นเท่านั้น; beat/BPM ยังมาจาก library โดยตรง
#define SMOOTHING_WINDOW 5

// ด่านตรวจ Signal Quality (library ไม่ตรวจ amplitude เอง)
// หนีบหูมี perfusion ต่ำกว่านิ้ว จึงลด min threshold amp = P - T จาก getPulseAmplitude()
#define SIGNAL_AMP_MIN 15
#define SIGNAL_AMP_MAX 400

// ตรวจ IBI (library มีแค่ N>250ms และไม่มี upper limit)
// ผูก IBI กับ BPM range ให้สอดคล้องกันเสมอ:
// - min IBI = 60000 / BPM_MAX
// - max IBI = 60000 / BPM_MIN
#define VALID_IBI_MIN_MS (60000 / VALID_BPM_MAX)
#define VALID_IBI_MAX_MS (60000 / VALID_BPM_MIN)

// ตัวจำกัด BPM jump — ถ้า BPM กระโดดเกิน 25 ในจังหวะเดียว ถือว่าเป็น motion artifact
#define BPM_JUMP_MAX 30

// ค่าเฉลี่ย BPM จาก 4 beat ล่าสุดเพื่อลดค่ากระโดด
#define BPM_MOVING_AVG_WINDOW 4

// ช่วง warm-up — ต้องรอให้หัวใจเต้นติดต่อกัน 5 ครั้งก่อนตรวจ zone
#define MIN_STABLE_BEATS 5

#define HR_LOW_THRESHOLD 60 // Bradycardia < 60 BPM (มาตรฐานทางการแพทย์)
#define HR_NORMAL_MAX 100   // Tachycardia > 100 BPM (มาตรฐานทางการแพทย์)

#define HEART_RATE_STALE_TIMEOUT_MS 1500UL
#define PPG_NO_SAMPLE_WARN_INTERVAL_MS 3000UL
#define PPG_NO_SAMPLE_RECOVERY_MS 15000UL

// คุมอัตราการ publish (ทุก beat = ~80 msg/min ที่ 80 BPM ซึ่งเยอะเกินจำเป็น)
#define NORMAL_ZONE_PUBLISH_INTERVAL_MS 1000UL
#define ALERT_ZONE_PUBLISH_INTERVAL_MS 1000UL

// ทำให้ Serial Plotter ลื่นขึ้น
#define PLOTTER_REFRESH_RATE_MS 20UL // 50 Hz ให้กราฟไหลลื่น

// ============================================================================
// [2] สถานะภายในของโมดูล (Module State)
// ============================================================================

PulseSensorPlayground pulseSensor;
PulseSensorData pulseData = {0, 0.0, 0, "unknown", false, 0, 0, {0}, 0, 0};

unsigned long lastPpgRawLogTime = 0;
unsigned long lastPpgPlotLogTime = 0;
unsigned long lastPpgRawPublishTime = 0;
bool pulsePlotterMode = false;

// สถานะ Moving Average
int smoothBuffer[SMOOTHING_WINDOW] = {0};
int smoothBufferIndex = 0;
bool smoothBufferFilled = false;
int smoothedPulseValue = 0;

// สถานะคุมการ publish
String lastPublishedZone = "unknown";
unsigned long lastPublishTime = 0;

// สถานะ BPM Jump Limiter
int lastAcceptedBpm = 0;

// สถานะ BPM Moving Average
int bpmSmoothingBuffer[BPM_MOVING_AVG_WINDOW] = {0};
int bpmSmoothingIndex = 0;
int bpmSmoothingCount = 0;
long bpmSmoothingSum = 0;

unsigned long lastPpgLibrarySampleMs = 0;
unsigned long lastPpgNoSampleWarnMs = 0;
unsigned long lastPpgRecoveryAttemptMs = 0;

// ============================================================================
// [3] การประกาศการเชื่อมต่อกับโมดูลอื่น (External Dependencies)
// ============================================================================

void sensorLogf(uint16_t category, const char *fmt, ...);
bool isSensorLogEnabled(uint16_t category);
unsigned long getSensorRawLogIntervalMs();
extern PubSubClient mqtt;
extern String deviceSerial;

// ============================================================================
// [4] ฟังก์ชันประกาศล่วงหน้า (Forward Declarations)
// ============================================================================

bool initPulseSensor();
void readPulseSensor();
void applyHeartRateStaleTimeout(unsigned long now);
void detectHeartRateZone();
void publishHeartRateEvent(String eventType);
void publishPulseRejectedEvent(String reason, int amp, int ibiMs);
void publishPulseRawEvent();
void resetPulseSensor();
void setPulsePlotterMode(bool enabled);
bool isPulsePlotterMode();
void printHeartRateZoneConfig();

// ============================================================================
// [5] การเริ่มต้นโมดูล (Initialization)
// ============================================================================

/**
 * เริ่มต้น Pulse Sensor และรีเซ็ตสถานะเริ่มต้นของโมดูล
 *
 * ใช้ library `PulseSensorPlayground` เป็นแหล่ง beat detection หลัก
 * ส่วน logic ในไฟล์นี้ทำหน้าที่ gate, smooth และ publish เท่านั้น
 *
 * @return true เมื่อเซนเซอร์พร้อมใช้งาน
 */
bool initPulseSensor()
{
  pinMode(PULSE_SENSOR_PIN, INPUT);

  analogReadResolution(PULSE_ADC_RESOLUTION_BITS);
  analogSetAttenuation(ADC_11db);

  pulseSensor.analogInput(PULSE_SENSOR_PIN);
  pulseSensor.setSerial(Serial);
  pulseSensor.setThreshold(PULSE_THRESHOLD_10BIT);

  if (!pulseSensor.begin())
  {
    pulseData.isInitialized = false;
    sensorLogf(SENSOR_LOG_SYSTEM,
               "PulseSensor Playground init failed (pin=%d threshold=%d)",
               PULSE_SENSOR_PIN, PULSE_THRESHOLD_10BIT);
    return false;
  }

  pulseData.isInitialized = true;
  pulseData.heartRate = 0;
  pulseData.zone = "unknown";
  pulseData.lastPeakTime = 0;

  int initialRaw = analogRead(PULSE_SENSOR_PIN);
  pulseData.rawValue = initialRaw;
  pulseData.voltage = (initialRaw / (float)PULSE_ADC_MAX_VALUE) * 3.3f;
  smoothedPulseValue = initialRaw;

  lastPpgLibrarySampleMs = millis();
  lastPpgNoSampleWarnMs = 0;
  lastPpgRecoveryAttemptMs = 0;

  sensorLogf(SENSOR_LOG_PPG_EVENT,
             "PulseSensor Playground initialized: raw=%d v=%.2f threshold=%d "
             "hwTimer=%s",
             pulseData.rawValue, pulseData.voltage, PULSE_THRESHOLD_10BIT,
             pulseSensor.UsingHardwareTimer ? "true" : "false");

  return true;
}

// ============================================================================
// [6] การอ่านค่าและประมวลผล beat (Sampling & Beat Processing)
// ============================================================================

/**
 * อ่าน sample ล่าสุดจาก PulseSensorPlayground แล้วคัดกรอง beat ทีละชั้น
 *
 * ลำดับ gate สำคัญ:
 * 1. signal amplitude
 * 2. inter-beat interval (IBI)
 * 3. BPM range
 * 4. BPM jump limiter
 */
void readPulseSensor()
{
  if (!pulseData.isInitialized && !initPulseSensor())
  {
    return;
  }

  unsigned long now = millis();
  bool sawNewSample = pulseSensor.sawNewSample();

  // โหมด ESP32 + PulseSensorPlayground (hardware timer path):
  // ฟังก์ชัน getLatestSample()/sawStartOfBeat() ยังอัปเดตต่อได้
  // แม้ sawNewSample() จะไม่ toggle สม่ำเสมอ
  if (!pulseSensor.UsingHardwareTimer && !sawNewSample)
  {
    if (lastPpgLibrarySampleMs > 0 &&
        now - lastPpgLibrarySampleMs >= PPG_NO_SAMPLE_WARN_INTERVAL_MS &&
        now - lastPpgNoSampleWarnMs >= PPG_NO_SAMPLE_WARN_INTERVAL_MS)
    {
      lastPpgNoSampleWarnMs = now;
      sensorLogf(SENSOR_LOG_PPG_EVENT,
                 "No new sample from PulseSensorPlayground (software mode) "
                 "for %lu ms",
                 now - lastPpgLibrarySampleMs);
    }

    applyHeartRateStaleTimeout(now);

    if (lastPpgLibrarySampleMs > 0 &&
        now - lastPpgLibrarySampleMs >= PPG_NO_SAMPLE_RECOVERY_MS &&
        now - lastPpgRecoveryAttemptMs >= PPG_NO_SAMPLE_RECOVERY_MS)
    {
      lastPpgRecoveryAttemptMs = now;
      sensorLogf(
          SENSOR_LOG_PPG_EVENT,
          "PPG recovery: re-initialize sensor after %lu ms without sample",
          now - lastPpgLibrarySampleMs);
      pulseData.isInitialized = false;
      resetPulseSensor();
    }
    return;
  }

  int rawValue = pulseSensor.getLatestSample();
  if (rawValue < 0)
  {
    return;
  }
  lastPpgLibrarySampleMs = now;

  pulseData.rawValue = rawValue;
  pulseData.voltage = (rawValue / (float)PULSE_ADC_MAX_VALUE) * 3.3f;

  // ทำ Moving Average smoothing
  smoothBuffer[smoothBufferIndex] = rawValue;
  smoothBufferIndex = (smoothBufferIndex + 1) % SMOOTHING_WINDOW;
  if (!smoothBufferFilled && smoothBufferIndex == 0)
    smoothBufferFilled = true;
  int count = smoothBufferFilled ? SMOOTHING_WINDOW : smoothBufferIndex;
  if (count == 0)
    count = 1;
  int sum = 0;
  for (int i = 0; i < count; i++)
    sum += smoothBuffer[i];
  smoothedPulseValue = sum / count;

  if (pulseSensor.sawStartOfBeat())
  {
    int bpm = pulseSensor.getBeatsPerMinute();
    int ibiMs = pulseSensor.getInterBeatIntervalMs();
    int amp = pulseSensor.getPulseAmplitude();

    // ========================================================================
    // [Algorithm] BPM Filter Gates (ตัวกรอง 4 ด่านสำหรับคัดกรองสัญญาณชีพจร)
    // จุดประสงค์: เนื่องจากเซนเซอร์แบบออปติคอล (PPG) มักจะไวต่อแสงและไวต่อการขยับตัว (Motion Artifacts) 
    // หากไม่กรองเลย ค่าที่ได้จะแกว่งมั่วซั่ว (เช่น กระโดดไป 200 BPM)
    // ========================================================================

    // ด่านที่ 1 (ด่านกรองความสูงคลื่น): Signal Quality — ตรวจ amplitude จาก library (P - T)
    // ถ้าน้อยไปแปลว่าสวมไม่แน่น ถ้ามากไปแปลว่ามีคนไปขยับหรือกดเซนเซอร์แรงเกินไป
    if (amp < SIGNAL_AMP_MIN || amp > SIGNAL_AMP_MAX)
    {
      sensorLogf(SENSOR_LOG_PPG_EVENT,
                 "Beat rejected (signal quality): amp=%d (valid=%d-%d)", amp,
                 SIGNAL_AMP_MIN, SIGNAL_AMP_MAX);
      publishPulseRejectedEvent("signal_quality", amp, ibiMs);
      return;
    }

    // ด่านที่ 2 (ด่านความสม่ำเสมอ): IBI Validation — safety net เสริม library ที่มีแค่ N>250ms
    // ระยะเวลาที่ห่างกันระหว่างตุ้บที่ 1 และ 2 (IBI) ต้องสอดคล้องกับค่า BPM ที่เป็นไปได้
    // ผูกค่ากับ VALID_BPM_MIN/MAX เพื่อไม่ให้เงื่อนไขขัดกันเอง
    if (ibiMs < VALID_IBI_MIN_MS || ibiMs > VALID_IBI_MAX_MS)
    {
      sensorLogf(SENSOR_LOG_PPG_EVENT,
                 "Beat rejected (IBI): ibi=%dms (valid=%d-%d)", ibiMs,
                 VALID_IBI_MIN_MS, VALID_IBI_MAX_MS);
      publishPulseRejectedEvent("ibi", amp, ibiMs);
      return;
    }

    // ด่านที่ 3: BPM Range
    if (bpm < VALID_BPM_MIN || bpm > VALID_BPM_MAX)
    {
      sensorLogf(SENSOR_LOG_PPG_EVENT,
                 "Beat rejected (range): bpm=%d amp=%d (valid=%d-%d)", bpm,
                 amp, VALID_BPM_MIN, VALID_BPM_MAX);
      publishPulseRejectedEvent("bpm_range", amp, ibiMs);
      return;
    }

    // ด่านที่ 4 (ด่านจำกัดการกระโดด): BPM Jump Limiter — ป้องกันค่าแกว่งแบบผิดธรรมชาติในวินาทีเดียว
    // เช่น วินาทีก่อนเต้น 70 BPM วินาทีนี้เด้งไป 120 BPM แบบนี้คือ Noise แน่นอน (กระโดดเกิน 30 = motion artifact)
    if (lastAcceptedBpm > 0 && abs(bpm - lastAcceptedBpm) > BPM_JUMP_MAX)
    {
      sensorLogf(SENSOR_LOG_PPG_EVENT, "Beat rejected (jump): bpm=%d prev=%d delta=%d",
                 bpm, lastAcceptedBpm, abs(bpm - lastAcceptedBpm));
      publishPulseRejectedEvent("bpm_jump", amp, ibiMs);
      return;
    }

    // ผ่านทุก gate แล้วจึงรับ beat

    // คำนวณ Moving Average ของ BPM
    bpmSmoothingSum -= bpmSmoothingBuffer[bpmSmoothingIndex];
    bpmSmoothingBuffer[bpmSmoothingIndex] = bpm;
    bpmSmoothingSum += bpm;
    bpmSmoothingIndex = (bpmSmoothingIndex + 1) % BPM_MOVING_AVG_WINDOW;
    if (bpmSmoothingCount < BPM_MOVING_AVG_WINDOW)
    {
      bpmSmoothingCount++;
    }
    int smoothedBpm = bpmSmoothingCount > 0 ? (int)(bpmSmoothingSum / bpmSmoothingCount) : bpm;

    pulseData.heartRate = smoothedBpm;
    pulseData.lastPeakTime = now;
    pulseData.peakCount++;
    lastAcceptedBpm = bpm; // jump limiter ยังอ้างอิง raw bpm
    detectHeartRateZone();
    sensorLogf(SENSOR_LOG_PPG_EVENT, "Beat accepted: raw=%d smoothed=%d ibi=%dms amp=%d",
               bpm, smoothedBpm, ibiMs, amp);

    {
      // คุมการ publish
      bool zoneChanged = (pulseData.zone != lastPublishedZone);
      bool isAlertZone = (pulseData.zone == "low" || pulseData.zone == "high");
      unsigned long interval = isAlertZone ? ALERT_ZONE_PUBLISH_INTERVAL_MS
                                           : NORMAL_ZONE_PUBLISH_INTERVAL_MS;
      bool intervalElapsed = (now - lastPublishTime >= interval);

      if (zoneChanged || intervalElapsed)
      {
        publishHeartRateEvent(pulseData.zone);
        lastPublishedZone = pulseData.zone;
        lastPublishTime = now;
      }
    }
  }

  applyHeartRateStaleTimeout(now);
  detectHeartRateZone();

  // ต้อง publish เมื่อ zone เปลี่ยนหรือครบ interval แม้ BPM จะเป็น 0
  bool zoneChanged = (pulseData.zone != lastPublishedZone);
  bool isAlertZone = (pulseData.zone == "low" || pulseData.zone == "high");
  unsigned long interval = isAlertZone ? ALERT_ZONE_PUBLISH_INTERVAL_MS
                                       : NORMAL_ZONE_PUBLISH_INTERVAL_MS;
  bool intervalElapsed = (now - lastPublishTime >= interval);

  if (zoneChanged || intervalElapsed)
  {
    publishHeartRateEvent(pulseData.zone);
    lastPublishedZone = pulseData.zone;
    lastPublishTime = now;
  }
}

/**
 * ล้าง BPM เมื่อไม่มี beat ใหม่เข้ามานานเกิน timeout ที่กำหนด
 */
void applyHeartRateStaleTimeout(unsigned long now)
{
  if (pulseData.lastPeakTime > 0 &&
      now - pulseData.lastPeakTime > HEART_RATE_STALE_TIMEOUT_MS)
  {
    if (pulseData.heartRate != 0)
    {
      pulseData.heartRate = 0;
      lastAcceptedBpm = 0;
      pulseData.peakCount = 0;

      // ล้างตาราง BPM Moving Average
      bpmSmoothingIndex = 0;
      bpmSmoothingCount = 0;
      bpmSmoothingSum = 0;
      for (int i = 0; i < BPM_MOVING_AVG_WINDOW; i++)
      {
        bpmSmoothingBuffer[i] = 0;
      }
    }
  }
}

/**
 * จำแนกโซนชีพจรจาก BPM ที่ผ่านการคัดกรองแล้ว
 */
void detectHeartRateZone()
{
  if (pulseData.heartRate == 0)
  {
    pulseData.zone = "unknown";
    return;
  }

  // ช่วง warm-up: หน่วงการแจ้งเตือนช่วงแรกที่เซนเซอร์เพิ่งจับสัญญาณได้
  if (pulseData.peakCount < MIN_STABLE_BEATS)
  {
    pulseData.zone = "normal";
    return;
  }

  if (pulseData.heartRate < HR_LOW_THRESHOLD)
  {
    pulseData.zone = "low";
  }
  else if (pulseData.heartRate <= HR_NORMAL_MAX)
  {
    pulseData.zone = "normal";
  }
  else
  {
    pulseData.zone = "high";
  }
}

// ============================================================================
// [7] การ publish เหตุการณ์ผ่าน MQTT (MQTT Publishing)
// ============================================================================

/**
 * ส่ง heartbeat/event snapshot ที่ผ่าน gate แล้วไปยัง broker สำหรับเก็บหลักฐานรอบจูน
 */
void publishHeartRateEvent(String eventType)
{
  if (!mqtt.connected())
  {
    return;
  }

  String topic = "device/" + deviceSerial + "/event";
  JsonDocument doc;
  doc["type"] = "heart_rate";
  doc["event"] = eventType;
  doc["timestamp"] = millis();
  doc["heartRate"] = pulseData.heartRate;
  doc["zone"] = pulseData.zone;
  doc["rawValue"] = pulseData.rawValue;
  doc["smoothedValue"] = smoothedPulseValue;
  doc["voltage"] = pulseData.voltage;

  // เก็บ key เดิมไว้เพื่อให้ downstream compatibility ไม่พัง
  doc["signalAmplitude"] = pulseSensor.getPulseAmplitude();
  doc["ibi"] = pulseSensor.getInterBeatIntervalMs();
  doc["signalQuality"] = "gated";

  char buffer[320];
  serializeJson(doc, buffer);

  if (!mqtt.publish(topic.c_str(), buffer))
  {
    sensorLogf(SENSOR_LOG_PPG_EVENT, "Failed to publish heart rate event");
  }
}

/**
 * ส่งเหตุผลของ beat ที่ถูก reject เพื่อให้ย้อนดู gate ที่ทำงานได้จาก CSV/log
 */
void publishPulseRejectedEvent(String reason, int amp, int ibiMs)
{
  if (!mqtt.connected())
  {
    return;
  }

  String topic = "device/" + deviceSerial + "/event";
  JsonDocument doc;
  doc["type"] = "pulse_rejected";
  doc["reason"] = reason;
  doc["timestamp"] = millis();
  doc["signalAmplitude"] = amp;
  doc["ibi"] = ibiMs;
  doc["rawValue"] = pulseData.rawValue;

  char buffer[128];
  serializeJson(doc, buffer);

  if (!mqtt.publish(topic.c_str(), buffer))
  {
    sensorLogf(SENSOR_LOG_PPG_EVENT, "Failed to publish rejected event");
  }
}

/**
 * ส่ง raw snapshot เป็นระยะเมื่อเปิด PPG raw log เพื่อเก็บไฟล์ดูสัญญาณ
 */
void publishPulseRawEvent()
{
  if (!mqtt.connected())
  {
    return;
  }

  String topic = "device/" + deviceSerial + "/event";
  JsonDocument doc;
  doc["type"] = "pulse_raw";
  doc["timestamp"] = millis();
  doc["rawValue"] = pulseData.rawValue;
  doc["smoothedValue"] = smoothedPulseValue;
  doc["voltage"] = pulseData.voltage;
  doc["heartRate"] = pulseData.heartRate;
  doc["zone"] = pulseData.zone;
  doc["signalAmplitude"] = pulseSensor.getPulseAmplitude();
  doc["ibi"] = pulseSensor.getInterBeatIntervalMs();

  char buffer[320];
  serializeJson(doc, buffer);

  if (!mqtt.publish(topic.c_str(), buffer))
  {
    sensorLogf(SENSOR_LOG_PPG_EVENT, "Failed to publish pulse_raw event");
  }
}

// ============================================================================
// [8] การรีเซ็ตสถานะภายใน (State Reset)
// ============================================================================

/**
 * รีเซ็ต state ทั้งหมดของโมดูล เพื่อเตรียมเริ่ม session ใหม่อย่างสะอาด
 */
void resetPulseSensor()
{
  pulseData.peakCount = 0;
  pulseData.lastPeakTime = 0;
  pulseData.heartRate = 0;
  pulseData.zone = "unknown";
  pulseData.rawValue = 0;
  pulseData.voltage = 0.0;

  // รีเซ็ต smooth buffer
  for (int i = 0; i < SMOOTHING_WINDOW; i++)
    smoothBuffer[i] = 0;
  smoothBufferIndex = 0;
  smoothBufferFilled = false;
  smoothedPulseValue = 0;

  // รีเซ็ต buffer ของ BPM Moving Average
  bpmSmoothingIndex = 0;
  bpmSmoothingCount = 0;
  bpmSmoothingSum = 0;
  for (int i = 0; i < BPM_MOVING_AVG_WINDOW; i++)
    bpmSmoothingBuffer[i] = 0;

  // รีเซ็ตตัวคุมการ publish
  lastPublishedZone = "unknown";
  lastPublishTime = 0;

  lastPpgLibrarySampleMs = 0;
  lastPpgNoSampleWarnMs = 0;
  lastPpgRecoveryAttemptMs = 0;
  lastPpgRawLogTime = 0;
  lastPpgPlotLogTime = 0;
  lastPpgRawPublishTime = 0;

  lastAcceptedBpm = 0;
}

// ============================================================================
// [9] Hook ของ loop หลัก (Loop Hooks)
// ============================================================================

/**
 * entrypoint หลักของโมดูล PPG ที่ถูกเรียกจาก loop รวม
 */
void updatePulseSensor()
{
  readPulseSensor();

  if (!pulseData.isInitialized)
  {
    return;
  }

  unsigned long now = millis();

  if (isSensorLogEnabled(SENSOR_LOG_PPG_RAW) &&
      now - lastPpgRawLogTime >= getSensorRawLogIntervalMs())
  {
    lastPpgRawLogTime = now;
    sensorLogf(SENSOR_LOG_PPG_RAW, "raw=%d smooth=%d v=%.2f bpm=%d zone=%s",
               pulseData.rawValue, smoothedPulseValue, pulseData.voltage,
               pulseData.heartRate, pulseData.zone.c_str());
  }

  // ส่ง raw snapshots ผ่าน MQTT เพื่อเก็บ CSV สำหรับตรวจสัญญาณ
  if (isSensorLogEnabled(SENSOR_LOG_PPG_RAW) &&
      now - lastPpgRawPublishTime >= getSensorRawLogIntervalMs())
  {
    lastPpgRawPublishTime = now;
    publishPulseRawEvent();
  }

  if (pulsePlotterMode && now - lastPpgPlotLogTime >= PLOTTER_REFRESH_RATE_MS)
  {
    lastPpgPlotLogTime = now;
    Serial.printf("%d,%d,%d\n", pulseData.rawValue, smoothedPulseValue,
                  pulseData.heartRate);
  }
}

// ============================================================================
// [10] API สาธารณะของโมดูล (Public Module API)
// ============================================================================

PulseSensorData getPulseSensorData() { return pulseData; }

bool isPulseSensorReady() { return pulseData.isInitialized; }

void setPulsePlotterMode(bool enabled)
{
  pulsePlotterMode = enabled;
  lastPpgPlotLogTime = 0;
}

bool isPulsePlotterMode() { return pulsePlotterMode; }

/**
 * พิมพ์ค่ากำหนดสำคัญของ pipeline PPG รอบปัจจุบัน
 */
void printHeartRateZoneConfig()
{
  Serial.println("BPM source: PulseSensorPlayground (library-only mode)");
  Serial.println("Sensor placement: Earlobe clip");
  Serial.printf("Pulse threshold: %d (10-bit)\n", PULSE_THRESHOLD_10BIT);
  Serial.printf("Beat accept range: %d-%d bpm\n", VALID_BPM_MIN, VALID_BPM_MAX);
  Serial.printf("Smoothing: Moving Average window=%d\n", SMOOTHING_WINDOW);
  Serial.printf("Signal quality gate: amp=%d-%d\n", SIGNAL_AMP_MIN,
                SIGNAL_AMP_MAX);
  Serial.printf("IBI validation: %d-%dms\n", VALID_IBI_MIN_MS,
                VALID_IBI_MAX_MS);
  Serial.printf("Zone: low<%d normal=%d-%d high>%d\n",
                HR_LOW_THRESHOLD, HR_LOW_THRESHOLD, HR_NORMAL_MAX,
                HR_NORMAL_MAX);
  Serial.printf("Publish: normal=%lus alert=%lus\n",
                NORMAL_ZONE_PUBLISH_INTERVAL_MS / 1000,
                ALERT_ZONE_PUBLISH_INTERVAL_MS / 1000);
  Serial.printf("Stale timeout: %lu ms\n", HEART_RATE_STALE_TIMEOUT_MS);
  Serial.printf("No-sample recovery: %lu ms\n", PPG_NO_SAMPLE_RECOVERY_MS);
}
