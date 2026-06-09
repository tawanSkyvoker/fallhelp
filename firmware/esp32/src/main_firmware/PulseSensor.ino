/**
 * @file PulseSensor.ino
 * @brief PulseSensor: โมดูลวัดชีพจรของ Prototype firmware
 *
 * หน้าที่หลัก:
 * - อ่านสัญญาณจาก XD-58C ผ่าน PulseSensorPlayground
 * - คัดกรอง beat ด้วยหลายชั้นของ signal quality / IBI / BPM jump
 * - คำนวณ BPM, confidence, zone แล้วส่งผลไปใช้ต่อในระบบรวม
 *
 * หมายเหตุ:
 * - ไฟล์นี้ยังอิงค่าจูนของ Prototype firmware ปัจจุบัน
 * - ถ้ามีค่าชุดใหม่จาก sensor tuning ค่อยย้ายกลับมาแบบเจาะจงในรอบถัดไป
 */

#include <ArduinoJson.h>
#include <PubSubClient.h>

// ทริคสำคัญสำหรับ ESP32: บังคับไม่ให้ไลบรารีใช้ Hardware Interrupt
// เพื่อกันบอร์ดค้าง (Stalled) ตอนทำงานร่วมกับ WiFi/MQTT
#ifndef USE_ARDUINO_INTERRUPTS
#define USE_ARDUINO_INTERRUPTS false
#endif
#include <PulseSensorPlayground.h>
#include "types.h"

// ============================================================================
// [1] ค่าคงที่ของ Pulse Sensor และ risk guardrails (Configuration)
// ============================================================================

// ฮาร์ดแวร์เซนเซอร์ชีพจร
#define PULSE_SENSOR_PIN 34

#define PULSE_ADC_RESOLUTION_BITS 10 // ความละเอียดการอ่านค่า (10-bit = 0 ถึง 1023)
#define PULSE_ADC_MAX_VALUE 1023
#define PULSE_THRESHOLD_10BIT 480 // จุดตัดกึ่งกลางของคลื่นชีพจร
// ลดจาก 550 (ค่า default สำหรับนิ้ว) → 480 เพื่อเพิ่ม sensitivity สำหรับใบหู (earlobe)
// ใบหู perfusion ต่ำกว่านิ้ว → peak สัญญาณไม่สูงเท่า → ต้องลด threshold ให้ไลบรารีจับได้
// ค่า raw value ใน log อยู่แถว 430-560 → threshold 550 สูงเกินไป (ลด threshold = เพิ่ม sensitivity)

#define PPG_MOVING_AVG_WINDOW 5 // จำนวนข้อมูลที่นำมาหาค่าเฉลี่ยเพื่อกรองสัญญาณให้เนียนขึ้น (Smoothing)

// เกณฑ์โซนการเต้นของหัวใจ (BPM)
#define HR_LOW_THRESHOLD 60  // ต่ำกว่า 60 = low
#define HR_NORMAL_MIN 60     // 60-100 = normal
#define HR_NORMAL_MAX 100    // เกิน 100 = high
#define HR_VALID_BPM_MAX 180 // เกินนี้ถือเป็นสัญญาณรบกวน

// รอให้ beat เริ่มนิ่งก่อนค่อยตรวจ zone
#define MIN_STABLE_BEATS 5

#define HEART_RATE_PUBLISH_INTERVAL_MS 2000 // ส่งข้อมูลขึ้นแอปทุกๆ 2 วินาที
#define HEART_RATE_STALE_TIMEOUT_MS 1500    // ถ้าหลุดจากใบหูเกิน 1.5 วินาที ให้รีเซ็ตค่าเป็น 0 (ลดจาก 3s เพื่อให้แอปขึ้น -- เร็วขึ้น)

// กู้คืนเมื่อไม่มี sample — ถ้า library ไม่คืน sample มานาน ให้ reinit sensor
#define PPG_NO_SAMPLE_WARN_INTERVAL_MS 3000UL // เตือนทุก 3 วิ
#define PPG_NO_SAMPLE_RECOVERY_MS 15000UL     // reinit หลัง 15 วิ

// ============================================================================
// [2] ระดับความมั่นใจของ BPM (Confidence Level)
// ============================================================================
// ใช้จำนวน beat ที่ผ่านเกตต่อเนื่องเพื่อยกระดับความน่าเชื่อถือของ BPM
#define CONFIDENCE_CONSECUTIVE_MEDIUM 3 // >= 3 beat ดีต่อเนื่อง = medium
#define CONFIDENCE_CONSECUTIVE_HIGH 8   // >= 8 beat ดีต่อเนื่อง = high

// การตั้งค่าตรวจคุณภาพการวางนิ้ว (Signal Quality)
#define SIGNAL_QUALITY_WINDOW_MS 4000 // ตรวจคุณภาพทุก 4 วินาที
#define SIGNAL_CONTACT_RANGE_MIN 30   // ต่ำกว่านี้มักเป็นสัญญาณอ่อนหรือ noise
#define SIGNAL_CONTACT_RANGE_MAX 600  // สวิงเกิน 600 = motion artifact แรง
#define VALID_BPM_MIN 40

// ตรวจ amplitude ของ beat ล่าสุดก่อนรับเข้า pipeline
#define SIGNAL_AMP_MIN 15
#define SIGNAL_AMP_MAX 400

// ระยะห่างระหว่าง beat ต้องสอดคล้องกับ BPM ที่รับได้
#define VALID_IBI_MIN_MS (60000 / HR_VALID_BPM_MAX)
#define VALID_IBI_MAX_MS (60000 / VALID_BPM_MIN)

// กัน BPM กระโดดผิดปกติในจังหวะเดียว
#define BPM_JUMP_MAX 30

// เฉลี่ย BPM ขาออกเพื่อลด spike ของตัวเลข
#define BPM_MOVING_AVG_WINDOW 4

// ============================================================================
// [3] สถานะภายในของโมดูล PPG (Module State)
// ============================================================================
PulseSensorPlayground pulseSensor;
PulseSensorData pulseData = {0, 0.0, 0, "unknown", false, 0, 0, {0}, 0, 0};

unsigned long lastPpgRawLogTime = 0;
bool pulsePlotterMode = false; // เปิดส่งค่าเข้า Serial Plotter

// บัฟเฟอร์ smoothing ของ raw waveform
int ppgSmoothingBuffer[PPG_MOVING_AVG_WINDOW] = {0};
int ppgSmoothingIndex = 0;
int ppgSmoothingCount = 0;
long ppgSmoothingSum = 0;
int smoothedPulseValue = 0;

// บัฟเฟอร์ smoothing ของ BPM
int bpmSmoothingBuffer[BPM_MOVING_AVG_WINDOW] = {0};
int bpmSmoothingIndex = 0;
int bpmSmoothingCount = 0;
long bpmSmoothingSum = 0;

// ตัวแปรสำหรับตรวจคุณภาพสัญญาณ
unsigned long signalWindowStartMs = 0;
int signalWindowMin = PULSE_ADC_MAX_VALUE;
int signalWindowMax = 0;
int currentSignalRange = 0;
bool signalQualityGood = false; // สถานะคุณภาพสัญญาณในรอบล่าสุด

// จำ BPM ล่าสุดที่รับไว้เพื่อกัน jump
int lastAcceptedBpm = 0;

// ติดตาม beat ที่ผ่าน/ไม่ผ่านเกตติดต่อกัน
int consecutiveGoodBeats = 0;      // beat ที่ผ่านทุก gate ติดต่อกัน
int consecutiveRejected = 0;       // beat ที่ถูก reject ติดต่อกัน
String currentConfidence = "none"; // none / low / medium / high

// สถานะการกู้คืนเมื่อไม่มี sample
unsigned long lastPpgLibrarySampleMs = 0;
unsigned long lastPpgNoSampleWarnMs = 0;
unsigned long lastPpgRecoveryAttemptMs = 0;

// กันการจอง hardware timer ซ้ำระหว่าง reinit
static bool pulseSensorTimerAllocated = false;

// ============================================================================
// [4] การเชื่อมต่อกับโมดูลอื่น (External Dependencies)
// ============================================================================

void sensorLogf(uint16_t category, const char *fmt, ...);
bool isSensorLogEnabled(uint16_t category);
unsigned long getSensorRawLogIntervalMs();
extern PubSubClient mqtt;
extern String deviceSerial;

// ============================================================================
// [5] ประกาศฟังก์ชันล่วงหน้า (Forward Declarations)
// ============================================================================

bool initPulseSensor();
void readPulseSensor();
void detectHeartRateZone();
void publishHeartRateReading();
void resetPulseSensor();
void setPulsePlotterMode(bool enabled);
bool isPulsePlotterMode();

// ============================================================================
// [6] ฟังก์ชันประมวลผลสัญญาณเบื้องต้น (Signal Processing Helpers)
// ============================================================================

// เริ่มหน้าต่างตรวจคุณภาพสัญญาณใหม่
static void resetSignalQualityWindow(unsigned long nowMs, int sample)
{
  signalWindowStartMs = nowMs;
  signalWindowMin = sample;
  signalWindowMax = sample;
  currentSignalRange = 0;
}

// ใช้ running min/max เพื่อให้ quality gate ไม่แกว่งแรงตอนเปลี่ยนหน้าต่าง
static void updateSignalQuality(unsigned long nowMs, int sample)
{
  if (signalWindowStartMs == 0)
  {
    resetSignalQualityWindow(nowMs, sample);
    return;
  }

  // อัปเดตช่วงสัญญาณในหน้าต่างปัจจุบัน
  if (sample < signalWindowMin)
    signalWindowMin = sample;
  if (sample > signalWindowMax)
    signalWindowMax = sample;
  currentSignalRange = signalWindowMax - signalWindowMin;

  // ครบช่วงแล้วค่อย shrink window เข้าหา sample ปัจจุบัน
  if (nowMs - signalWindowStartMs >= SIGNAL_QUALITY_WINDOW_MS)
  {
    signalWindowMin = signalWindowMin + (sample - signalWindowMin) / 4;
    signalWindowMax = signalWindowMax - (signalWindowMax - sample) / 4;
    if (signalWindowMin > signalWindowMax)
      signalWindowMin = signalWindowMax = sample;
    signalWindowStartMs = nowMs;
  }

  // ตรวจว่า range ของสัญญาณยังอยู่ในช่วงที่น่าเชื่อถือหรือไม่
  bool nextQuality = currentSignalRange >= SIGNAL_CONTACT_RANGE_MIN &&
                     currentSignalRange <= SIGNAL_CONTACT_RANGE_MAX;

  if (nextQuality != signalQualityGood)
  {
    signalQualityGood = nextQuality;
    sensorLogf(SENSOR_LOG_PPG_EVENT,
               "PPG quality changed: %s (range=%d, min=%d, max=%d)",
               signalQualityGood ? "GOOD" : "POOR", currentSignalRange,
               signalWindowMin, signalWindowMax);
  }
}

// smoothing สำหรับ raw waveform ที่ใช้ทั้ง log และ plotter
static void updateSmoothedValue(int rawValue)
{
  ppgSmoothingSum -= ppgSmoothingBuffer[ppgSmoothingIndex];
  ppgSmoothingBuffer[ppgSmoothingIndex] = rawValue;
  ppgSmoothingSum += rawValue;
  ppgSmoothingIndex = (ppgSmoothingIndex + 1) % PPG_MOVING_AVG_WINDOW;

  if (ppgSmoothingCount < PPG_MOVING_AVG_WINDOW)
  {
    ppgSmoothingCount++;
  }

  smoothedPulseValue = ppgSmoothingCount > 0
                           ? (int)(ppgSmoothingSum / ppgSmoothingCount)
                           : rawValue;
}

// ============================================================================
// [7] การเริ่มต้นโมดูล Pulse Sensor (Initialization)
// ============================================================================
bool initPulseSensor()
{
  static bool hwInitialized = false;
  if (!hwInitialized)
  {
    pinMode(PULSE_SENSOR_PIN, INPUT);

    // normalize ADC ให้ตรงกับ threshold ที่จูนไว้บนสเกล 10-bit
    analogReadResolution(PULSE_ADC_RESOLUTION_BITS);
    analogSetAttenuation(ADC_11db);

    pulseSensor.analogInput(PULSE_SENSOR_PIN);
    pulseSensor.setSerial(Serial);
    pulseSensor.setThreshold(PULSE_THRESHOLD_10BIT);

    hwInitialized = true;
  }

  // สำคัญ: begin() จอง gptimer ของ ESP32 และไลบรารีไม่มี path คืน timer
  // จึงต้องกันการเรียกซ้ำเพื่อไม่ให้ firmware leak timer แล้วค้างภายหลัง
  if (!pulseSensorTimerAllocated)
  {
    if (!pulseSensor.begin())
    {
      pulseData.isInitialized = false;
      sensorLogf(SENSOR_LOG_SYSTEM,
                 "PulseSensor Playground init failed (pin=%d threshold=%d)",
                 PULSE_SENSOR_PIN, PULSE_THRESHOLD_10BIT);
      return false;
    }
    pulseSensorTimerAllocated = true;
  }

  pulseData.isInitialized = true;
  pulseData.heartRate = 0;
  pulseData.zone = "unknown";
  pulseData.lastPeakTime = 0;

  int initialRaw = analogRead(PULSE_SENSOR_PIN);
  pulseData.rawValue = initialRaw;
  pulseData.voltage = (initialRaw / (float)PULSE_ADC_MAX_VALUE) * 3.3f; // แปลงเป็นโวลต์
  smoothedPulseValue = initialRaw;

  consecutiveGoodBeats = 0;
  consecutiveRejected = 0;
  currentConfidence = "none";
  lastPpgLibrarySampleMs = millis();
  lastPpgNoSampleWarnMs = 0;
  lastPpgRecoveryAttemptMs = 0;

  resetSignalQualityWindow(millis(), initialRaw);

  sensorLogf(SENSOR_LOG_PPG_EVENT,
             "PulseSensor Playground initialized: raw=%d v=%.2f threshold=%d",
             pulseData.rawValue, pulseData.voltage, PULSE_THRESHOLD_10BIT);

  return true;
}

// ============================================================================
// [8] วงรอบอ่านค่าและคัดกรอง beat (Main Update Loop)
// ============================================================================

// confidence ถูก derive จาก quality gate และจำนวน beat ที่ผ่านต่อเนื่อง
static void updateConfidence()
{
  String prev = currentConfidence;
  if (pulseData.heartRate == 0 || !signalQualityGood)
  {
    currentConfidence = "none";
  }
  else if (consecutiveGoodBeats >= CONFIDENCE_CONSECUTIVE_HIGH && signalQualityGood)
  {
    currentConfidence = "high";
  }
  else if (consecutiveGoodBeats >= CONFIDENCE_CONSECUTIVE_MEDIUM)
  {
    currentConfidence = "medium";
  }
  else
  {
    currentConfidence = "low";
  }
  if (currentConfidence != prev)
  {
    sensorLogf(SENSOR_LOG_PPG_EVENT, "Confidence changed: %s -> %s (goodBeats=%d rejected=%d)",
               prev.c_str(), currentConfidence.c_str(), consecutiveGoodBeats, consecutiveRejected);
  }
}

void readPulseSensor()
{
  if (!pulseData.isInitialized && !initPulseSensor())
    return;

  unsigned long now = millis();

  // software timer path ต้องเรียก sawNewSample() ถี่พอ ไม่เช่นนั้น library จะไม่เลื่อน state
  bool sawNew = pulseSensor.sawNewSample();

  // recovery path เมื่อ sample ขาดหายต่อเนื่องนานเกินกว่าที่ยอมรับได้
  if (sawNew)
  {
    lastPpgLibrarySampleMs = now;
  }
  else
  {
    if (lastPpgLibrarySampleMs > 0 &&
        now - lastPpgLibrarySampleMs >= PPG_NO_SAMPLE_WARN_INTERVAL_MS &&
        now - lastPpgNoSampleWarnMs >= PPG_NO_SAMPLE_WARN_INTERVAL_MS)
    {
      lastPpgNoSampleWarnMs = now;
      sensorLogf(SENSOR_LOG_PPG_EVENT, "No new sample for %lu ms", now - lastPpgLibrarySampleMs);
    }
    if (lastPpgLibrarySampleMs > 0 &&
        now - lastPpgLibrarySampleMs >= PPG_NO_SAMPLE_RECOVERY_MS &&
        now - lastPpgRecoveryAttemptMs >= PPG_NO_SAMPLE_RECOVERY_MS)
    {
      lastPpgRecoveryAttemptMs = now;
      sensorLogf(SENSOR_LOG_PPG_EVENT, "PPG recovery: reinit after %lu ms without sample", now - lastPpgLibrarySampleMs);
      pulseData.isInitialized = false;
      resetPulseSensor();
      return;
    }
  }

  int rawValue = pulseSensor.getLatestSample();
  if (rawValue < 0)
    return;

  pulseData.rawValue = rawValue;
  pulseData.voltage = (rawValue / (float)PULSE_ADC_MAX_VALUE) * 3.3f;

  updateSmoothedValue(rawValue);
  updateSignalQuality(now, rawValue);

  // beat gate ทั้งหมดถูกออกแบบให้ยอมรับ sensitivity ของ Prototype firmware ก่อน แล้วค่อยกัน noise
  if (pulseSensor.sawStartOfBeat())
  {
    int bpm = pulseSensor.getBeatsPerMinute();
    int ibiMs = pulseSensor.getInterBeatIntervalMs(); // ระยะเวลาระหว่างจังหวะ (ms)
    int amp = pulseSensor.getPulseAmplitude();        // ความสูง Peak-to-Trough ของ beat นี้

    // ========================================================================
    // [Algorithm] BPM Filter Gates (ตัวกรอง 6 ด่านสำหรับคัดกรองสัญญาณชีพจร)
    // จุดประสงค์: เนื่องจากเซนเซอร์แบบออปติคอล (PPG) มักจะไวต่อแสงและไวต่อการขยับตัว (Motion Artifacts) 
    // หากไม่กรองเลย ค่าที่ได้จะแกว่งมั่วซั่ว (เช่น กระโดดไป 200 BPM)
    // ========================================================================

    // Gate 1A (ด่านกรองความสูงคลื่น): แอมพลิจูด (ความแรงของคลื่น) ต้องอยู่ในเกณฑ์ที่คนปกติเป็นไปได้ 
    // ถ้าน้อยไปแปลว่าสวมไม่แน่น ถ้ามากไปแปลว่ามีคนไปขยับหรือกดเซนเซอร์แรงเกินไป
    if (amp < SIGNAL_AMP_MIN || amp > SIGNAL_AMP_MAX)
    {
      sensorLogf(SENSOR_LOG_PPG_EVENT, "Beat rejected (amp): bpm=%d amp=%d (valid=%d-%d)",
                 bpm, amp, SIGNAL_AMP_MIN, SIGNAL_AMP_MAX);
      consecutiveGoodBeats = 0;
      consecutiveRejected++;
      updateConfidence();
      return;
    }

    // Gate 1B: quality ของสัญญาณรวมในหน้าต่างเวลาต้องดีพอ
    if (!signalQualityGood)
    {
      sensorLogf(SENSOR_LOG_PPG_EVENT, "Beat rejected (quality): bpm=%d ibi=%dms amp=%d range=%d",
                 bpm, ibiMs, amp, currentSignalRange);
      consecutiveGoodBeats = 0;
      consecutiveRejected++;
      updateConfidence();
      return;
    }

    // Gate 2 (ด่านความสม่ำเสมอ): ระยะเวลาที่ห่างกันระหว่างตุ้บที่ 1 และ 2 (IBI) 
    // ต้องสอดคล้องกับค่า BPM ที่เป็นไปได้ ไม่ใช่ว่า BPM ต่ำแต่จังหวะรัวๆ
    if (ibiMs < VALID_IBI_MIN_MS || ibiMs > VALID_IBI_MAX_MS)
    {
      sensorLogf(SENSOR_LOG_PPG_EVENT, "Beat rejected (IBI): ibi=%dms (valid=%d-%d)",
                 ibiMs, VALID_IBI_MIN_MS, VALID_IBI_MAX_MS);
      consecutiveGoodBeats = 0;
      consecutiveRejected++;
      updateConfidence();
      return;
    }

    // Gate 3: BPM physiologic range
    if (bpm < VALID_BPM_MIN || bpm > HR_VALID_BPM_MAX)
    {
      sensorLogf(SENSOR_LOG_PPG_EVENT, "Beat rejected (range): bpm=%d (valid=%d-%d)",
                 bpm, VALID_BPM_MIN, HR_VALID_BPM_MAX);
      consecutiveGoodBeats = 0;
      consecutiveRejected++;
      updateConfidence();
      return;
    }

    // Gate 4 (ด่านจำกัดการกระโดด): ป้องกันค่าแกว่งแบบผิดธรรมชาติในวินาทีเดียว
    // เช่น วินาทีก่อนเต้น 70 BPM วินาทีนี้เด้งไป 120 BPM แบบนี้คือ Noise แน่นอน
    if (lastAcceptedBpm > 0 && abs(bpm - lastAcceptedBpm) > BPM_JUMP_MAX)
    {
      sensorLogf(SENSOR_LOG_PPG_EVENT, "Beat rejected (jump): bpm=%d prev=%d delta=%d (max=%d)",
                 bpm, lastAcceptedBpm, abs(bpm - lastAcceptedBpm), BPM_JUMP_MAX);
      consecutiveGoodBeats = 0;
      consecutiveRejected++;
      updateConfidence();
      return;
    }

    // Gate 5: กรองเฉพาะ extreme spikes เพื่อไม่ให้ไปลด sensitivity เกินจำเป็น
    if (amp > (SIGNAL_AMP_MAX * 0.9) && (bpm < 35 || bpm > 200))
    {
      sensorLogf(SENSOR_LOG_PPG_EVENT, "Beat rejected (extreme spike): bpm=%d amp=%d (amp>90%%max, bpm out of physiologic range)",
                 bpm, amp);
      consecutiveGoodBeats = 0;
      consecutiveRejected++;
      updateConfidence();
      return;
    }

    // Gate 6: ถ้า reject ติดกันเยอะ ให้รอให้สัญญาณกลับมานิ่งก่อน
    if (consecutiveRejected >= 5)
    {
      sensorLogf(SENSOR_LOG_PPG_EVENT, "Beat rejected (consecutive): consecutive_rejected=%d - waiting for stable signal",
                 consecutiveRejected);
      updateConfidence();
      return;
    }

    // ผ่านทุก gate แล้วจึงยอมรับ beat นี้เข้า BPM pipeline
    consecutiveGoodBeats++;
    consecutiveRejected = 0;

    // smoothing ที่ output BPM เพื่อลดการแกว่งของตัวเลขที่แอปจะแสดงผล
    bpmSmoothingSum -= bpmSmoothingBuffer[bpmSmoothingIndex];
    bpmSmoothingBuffer[bpmSmoothingIndex] = bpm;
    bpmSmoothingSum += bpm;
    bpmSmoothingIndex = (bpmSmoothingIndex + 1) % BPM_MOVING_AVG_WINDOW;
    if (bpmSmoothingCount < BPM_MOVING_AVG_WINDOW)
    {
      bpmSmoothingCount++;
    }

    // คำนวณค่าเฉลี่ย BPM ปัจจุบัน
    int smoothedBpm = bpmSmoothingCount > 0 ? (int)(bpmSmoothingSum / bpmSmoothingCount) : bpm;

    pulseData.heartRate = smoothedBpm;
    pulseData.lastPeakTime = now;
    pulseData.peakCount++;
    lastAcceptedBpm = bpm;

    sensorLogf(SENSOR_LOG_PPG_EVENT, "Beat accepted: raw=%d smoothed=%d ibi=%dms amp=%d range=%d good=%d",
               bpm, smoothedBpm, ibiMs, amp, currentSignalRange, consecutiveGoodBeats);
    updateConfidence();
  }

  // stale/reset path: ถ้าสัญญาณหายหรือคุณภาพตก ให้คืนค่า BPM เป็น 0 เพื่อไม่ให้แอปค้างค่าเก่า
  if (!signalQualityGood || (pulseData.lastPeakTime > 0 && now - pulseData.lastPeakTime > HEART_RATE_STALE_TIMEOUT_MS))
  {
    if (pulseData.heartRate != 0)
    {
      pulseData.heartRate = 0;
      lastAcceptedBpm = 0;
      pulseData.peakCount = 0;
      consecutiveGoodBeats = 0;
      consecutiveRejected = 0;

      // ล้างตาราง Moving Average
      bpmSmoothingIndex = 0;
      bpmSmoothingCount = 0;
      bpmSmoothingSum = 0;
      for (int i = 0; i < BPM_MOVING_AVG_WINDOW; i++)
      {
        bpmSmoothingBuffer[i] = 0;
      }
    }
  }

  updateConfidence();
  detectHeartRateZone();
}

// ============================================================================
// [9] การจัดกลุ่มโซนชีพจร (Zone Classification)
// ============================================================================

// แปลง BPM เป็นโซนที่ mobile/app ใช้แสดงผลและตัดสินใจแจ้งเตือน
void detectHeartRateZone()
{
  if (pulseData.heartRate == 0)
  {
    pulseData.zone = "unknown";
    return;
  }

  // รอให้ beat เริ่มนิ่งก่อนค่อยจัดโซน
  if (pulseData.peakCount < MIN_STABLE_BEATS)
  {
    pulseData.zone = "normal";
    return;
  }

  if (pulseData.heartRate < HR_LOW_THRESHOLD)
  {
    pulseData.zone = "low";
  }
  else if (pulseData.heartRate >= HR_NORMAL_MIN && pulseData.heartRate <= HR_NORMAL_MAX)
  {
    pulseData.zone = "normal";
  }
  else
  {
    pulseData.zone = "high";
  }
}

// ============================================================================
// [10] การส่งข้อมูลชีพจรขึ้น MQTT (MQTT Publish)
// ============================================================================

// ส่ง heartbeat snapshot แบบบางให้ backend/mobile ใช้แสดงผลสถานะล่าสุด
void publishHeartRateReading()
{
  if (!mqtt.connected())
    return;

  String topic = "device/" + deviceSerial + "/heartrate";
  JsonDocument doc;

  bool isLow = pulseData.zone == "low";
  bool isHigh = pulseData.zone == "high";
  bool isAbnormal = isLow || isHigh;

  doc["timestamp"] = millis();
  doc["heartRate"] = pulseData.heartRate;
  doc["zone"] = pulseData.zone;
  doc["confidence"] = currentConfidence;
  doc["isAbnormal"] = isAbnormal;

  if (isLow)
  {
    doc["alertType"] = "LOW";
  }
  else if (isHigh)
  {
    doc["alertType"] = "HIGH";
  }

  char buffer[256];
  serializeJson(doc, buffer);

  if (mqtt.publish(topic.c_str(), buffer))
  {
    sensorLogf(SENSOR_LOG_PPG_EVENT, "Heart rate reading published: %d BPM", pulseData.heartRate);
  }
  else
  {
    sensorLogf(SENSOR_LOG_PPG_EVENT, "Failed to publish heart rate reading");
  }
}

// ============================================================================
// [11] การรีเซ็ตสถานะภายใน (State Reset)
// ============================================================================

// รีเซ็ต state ทั้งหมดเมื่อเซนเซอร์หลุดหรือ recovery path ทำงาน
void resetPulseSensor()
{
  pulseData.peakCount = 0;
  pulseData.lastPeakTime = 0;
  pulseData.heartRate = 0;
  pulseData.zone = "unknown";
  pulseData.rawValue = 0;
  pulseData.voltage = 0.0;

  ppgSmoothingIndex = 0;
  ppgSmoothingCount = 0;
  ppgSmoothingSum = 0;
  smoothedPulseValue = 0;
  for (int i = 0; i < PPG_MOVING_AVG_WINDOW; i++)
  {
    ppgSmoothingBuffer[i] = 0;
  }

  signalWindowStartMs = 0;
  signalWindowMin = PULSE_ADC_MAX_VALUE;
  signalWindowMax = 0;
  currentSignalRange = 0;
  signalQualityGood = false;

  lastAcceptedBpm = 0;
  consecutiveGoodBeats = 0;
  consecutiveRejected = 0;
  currentConfidence = "none";
  lastPpgLibrarySampleMs = 0;
  lastPpgNoSampleWarnMs = 0;
  lastPpgRecoveryAttemptMs = 0;
}

// ============================================================================
// [12] Hook ที่ SensorManager เรียกใช้ (Update Routine)
// ============================================================================

void updatePulseSensor()
{
  readPulseSensor();

  if (!pulseData.isInitialized)
    return;

  // raw log ใช้สำหรับตรวจรูปสัญญาณระหว่างทดลองเท่านั้น
  if (isSensorLogEnabled(SENSOR_LOG_PPG_RAW) &&
      millis() - lastPpgRawLogTime >= getSensorRawLogIntervalMs())
  {
    lastPpgRawLogTime = millis();
    sensorLogf(SENSOR_LOG_PPG_RAW,
               "raw=%d smooth=%d v=%.2f bpm=%d zone=%s range=%d quality=%s",
               pulseData.rawValue, smoothedPulseValue, pulseData.voltage,
               pulseData.heartRate, pulseData.zone.c_str(), currentSignalRange,
               signalQualityGood ? "good" : "poor");
  }

  // plotter mode ใช้ดูรูปทรงคลื่นแบบสด
  if (pulsePlotterMode)
  {
    if (isRuntimeSerialOutputEnabled())
      Serial.printf("%d,%d,%d\n", pulseData.rawValue, smoothedPulseValue, pulseData.heartRate);
  }

  static String lastZone = "";
  static unsigned long lastHrPublishTime = 0;
  unsigned long now = millis();

  // log เมื่อ zone เปลี่ยนเพื่อดูพฤติกรรมของตัวจัดกลุ่ม
  if (pulseData.zone != lastZone && pulseData.heartRate > 0)
  {
    sensorLogf(SENSOR_LOG_PPG_EVENT,
               "Zone changed: %s -> %s (BPM=%d low<%d normal=%d-%d high>%d)",
               lastZone.c_str(), pulseData.zone.c_str(), pulseData.heartRate,
               HR_LOW_THRESHOLD, HR_NORMAL_MIN, HR_NORMAL_MAX, HR_NORMAL_MAX);
    lastZone = pulseData.zone;
  }

  // publish เป็นระยะ แม้ BPM จะเป็น 0 เพื่อให้ UI รู้ว่าค่าปัจจุบันยังไม่พร้อม
  if (now - lastHrPublishTime >= HEART_RATE_PUBLISH_INTERVAL_MS)
  {
    publishHeartRateReading();
    lastHrPublishTime = now;
  }
}

// ============================================================================
// [13] API สาธารณะของโมดูล (Public Module API)
// ============================================================================

PulseSensorData getPulseSensorData() { return pulseData; }
bool isPulseSensorReady() { return pulseData.isInitialized; }

// plotter mode ถูกคุมจาก CLI เพื่อหลีกเลี่ยง log ปะปนกับ structured output
void setPulsePlotterMode(bool enabled) { pulsePlotterMode = enabled; }
bool isPulsePlotterMode() { return pulsePlotterMode; }
