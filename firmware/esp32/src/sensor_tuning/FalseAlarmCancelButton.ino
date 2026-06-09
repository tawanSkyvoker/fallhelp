/**
 * @file FalseAlarmCancelButton.ino
 * @brief จัดการปุ่มยกเลิก false alarm ของ flow การตรวจล้ม
 *
 * หน้าที่หลัก:
 * - ดูแลการกดปุ่ม GPIO27 สำหรับยกเลิก suspected fall ภายในช่วงเวลาที่กำหนด
 * - ส่ง event `fall_cancelled` ไปยัง MQTT เมื่อการกดยังอยู่ใน cancel window
 * - ประสานกับ AlertSystem เพื่อหยุดเสียงแจ้งเตือนฝั่งอุปกรณ์
 *
 * ข้อจำกัด:
 * - ไฟล์นี้ไม่ยืนยันผลแทน backend แต่ทำหน้าที่ส่งสัญญาณ cancel จากฝั่งผู้สวมใส่เท่านั้น
 * - ถ้า timeout หมดแล้ว การกดปุ่มต้องไม่ย้อน state ของเหตุการณ์เดิม
 */

#include "types.h"

// ============================================================================
// [1] การตั้งค่าและตัวแปรสถานะ (Configuration & State)
// ============================================================================

#define FALSE_ALARM_BTN_PIN 27 // GPIO27 (Large Push Button Module)
#define DEBOUNCE_DELAY 50      // ms - หน่วง debounce

FalseAlarmCancelButtonState cancelButtonState = {HIGH,  HIGH,  0, 0,
                                                 false, false, 0, ""};
bool cancelButtonConfirmed = false;
bool cancelActionHandledOnPress = false;
bool suppressNextReleaseAction = false;

// ============================================================================
// [2] ฟังก์ชันประกาศล่วงหน้า (Forward Declarations)
// ============================================================================

bool initFalseAlarmCancelButton();
void updateFalseAlarmCancelButton();
void handleCancelButtonPress();
void handleCancelButtonRelease();
void publishCancelEvent();
void setLastFallTimestamp(unsigned long timestamp);
void refreshCancelTimeoutForSimulation();
void setActiveFallEventId(String eventId);
bool isCancelTimeoutActive();
bool consumeCancelButtonConfirmed();
void cancelFallAlert();
bool isFallAlertActive();
unsigned long getFallCancelTimeoutMs();
void sensorLogf(uint16_t category, const char *fmt, ...);

// ============================================================================
// [3] การเริ่มต้นและอัปเดตปุ่ม (Initialization & Update Flow)
// ============================================================================

/**
 * เริ่มต้นปุ่มยกเลิก false alarm
 *
 * ใช้ INPUT_PULLUP เพราะปุ่มทำงานแบบ active-low
 *
 * @return true เมื่อปุ่มพร้อมใช้งาน
 */
bool initFalseAlarmCancelButton()
{
  pinMode(FALSE_ALARM_BTN_PIN, INPUT_PULLUP);

  // อ่านสถานะเริ่มต้น
  cancelButtonState.lastState = digitalRead(FALSE_ALARM_BTN_PIN);
  cancelButtonState.currentState = cancelButtonState.lastState;
  cancelButtonState.isInitialized = true;

  sensorLogf(SENSOR_LOG_SYSTEM,
             "False alarm cancel button initialized (GPIO27)");

  return true;
}

/**
 * อัปเดตสถานะปุ่มใน main loop
 *
 * flow นี้ใช้ debounce แบบง่ายด้วย delay สั้น ๆ เพื่อกันการสั่นของสวิตช์
 * โดยยังคงขนาด delay ให้น้อยพอสำหรับฮาร์ดแวร์ปุ่มกดลักษณะนี้
 */
void updateFalseAlarmCancelButton()
{
  if (!cancelButtonState.isInitialized && !initFalseAlarmCancelButton()) {
    return;
  }

  // อ่านสถานะปุ่มปัจจุบัน
  cancelButtonState.currentState = digitalRead(FALSE_ALARM_BTN_PIN);

  // ตรวจการเปลี่ยนสถานะ (กด = LOW, ปล่อย = HIGH)
  if (cancelButtonState.currentState != cancelButtonState.lastState) {
    // หน่วง debounce
    delay(DEBOUNCE_DELAY);

    // อ่านซ้ำหลัง debounce
    cancelButtonState.currentState = digitalRead(FALSE_ALARM_BTN_PIN);

    if (cancelButtonState.currentState != cancelButtonState.lastState) {
      // ยืนยันการเปลี่ยนสถานะแล้ว
      if (cancelButtonState.currentState == LOW) {
        // ปุ่มถูกกด
        handleCancelButtonPress();
      } else {
        // ปุ่มถูกปล่อย
        handleCancelButtonRelease();
      }

      cancelButtonState.lastState = cancelButtonState.currentState;
    }
  }
}

// ============================================================================
// [4] การจัดการเหตุการณ์กด/ปล่อยปุ่ม (Button Event Handling)
// ============================================================================

/**
 * จัดการเหตุการณ์ตอนกดปุ่ม
 *
 * ถ้ายังอยู่ใน cancel window จะ publish `fall_cancelled` และหยุดเสียงทันที
 * แต่ถ้า timeout หมดแล้วจะ log ไว้เฉย ๆ โดยไม่ย้อนสถานะ
 */
void handleCancelButtonPress()
{
  cancelButtonState.isPressed = true;
  cancelButtonState.pressStartTime = millis();
  cancelActionHandledOnPress = false;

  sensorLogf(SENSOR_LOG_FALL_FLOW, "False alarm cancel button pressed");

  // อนุญาตให้ cancel ได้ถ้ายังอยู่ในช่วง cancel timeout
  // หรือเป็น simulated fall ที่จัดการ timeout จากส่วนกลาง
  if (!isCancelTimeoutActive() && !isFallAlertActive()) {
    sensorLogf(SENSOR_LOG_FALL_FLOW, "Cancel timeout expired (%lus) - ignored",
               getFallCancelTimeoutMs() / 1000UL);
    return;
  }

  // ส่ง event ยกเลิก
  publishCancelEvent();
  cancelButtonConfirmed = true;
  cancelActionHandledOnPress = true;
  cancelFallAlert();

  // นโยบาย speaker: detect-only จึงไม่เล่น beep ยืนยันตอน cancel
}

/**
 * จัดการเหตุการณ์ตอนปล่อยปุ่ม
 *
 * release บางครั้งต้องถูกข้ามหลังเพิ่ง cancel สำเร็จ
 * เพื่อไม่ให้ flow เดิมถูกประมวลผลซ้ำจากขอบสัญญาณตอนยกนิ้ว
 */
void handleCancelButtonRelease()
{
  unsigned long pressDuration = millis() - cancelButtonState.pressStartTime;
  sensorLogf(SENSOR_LOG_FALL_FLOW, "Cancel button press duration: %lu ms",
             pressDuration);

  if (suppressNextReleaseAction) {
    // ข้าม release ครั้งแรกหลังจากจัดการ cancel/stop แล้ว
    suppressNextReleaseAction = false;
    cancelActionHandledOnPress = false;
    cancelButtonState.isPressed = false;
    cancelButtonState.lastPressTime = millis();
    sensorLogf(SENSOR_LOG_FALL_FLOW,
               "Cancel button release ignored (post-cancel)");
    return;
  }

  if (!cancelActionHandledOnPress) {
    sensorLogf(SENSOR_LOG_FALL_FLOW, "Cancel timeout expired (%lus) - release",
               getFallCancelTimeoutMs() / 1000UL);
  }

  cancelActionHandledOnPress = false;
  cancelButtonState.isPressed = false;
  cancelButtonState.lastPressTime = millis();
}

// ============================================================================
// [5] การ publish และ state helper (Publish & State Helpers)
// ============================================================================

/**
 * ส่ง event ยกเลิกไปยัง MQTT
 *
 * ฝั่ง backend จะเป็นผู้จัดการ persistence ของ cancellation ต่อ
 * ส่วน ESP32 มีหน้าที่ส่ง `fall_cancelled` เฉพาะตอนยังอยู่ใน cancel window เท่านั้น
 */
void publishCancelEvent()
{
  if (!mqtt.connected()) {
    sensorLogf(SENSOR_LOG_FALL_FLOW,
               "Cannot publish fall_cancelled - MQTT not connected");
    return;
  }

  String topic = "device/" + deviceSerial + "/event";
  JsonDocument doc;
  doc["type"] = "fall_cancelled";
  doc["timestamp"] = millis();
  if (cancelButtonState.activeFallEventId.length() > 0) {
    doc["eventId"] = cancelButtonState.activeFallEventId;
  }

  char buffer[256];
  serializeJson(doc, buffer);

  if (mqtt.publish(topic.c_str(), buffer)) {
    sensorLogf(SENSOR_LOG_FALL_FLOW, "fall_cancelled published (eventId=%s)",
               cancelButtonState.activeFallEventId.c_str());
  } else {
    sensorLogf(SENSOR_LOG_FALL_FLOW, "Failed to publish fall_cancelled");
  }
}

/**
 * บันทึกเวลาที่เริ่ม suspected fall รอบล่าสุด
 *
 * ค่า timestamp นี้ใช้เป็นจุดเริ่มนับ cancel window ของปุ่ม
 */
void setLastFallTimestamp(unsigned long timestamp)
{
  cancelButtonState.lastFallTimestamp = timestamp;
  sensorLogf(SENSOR_LOG_FALL_FLOW, "Cancel timeout started (%lus)",
             getFallCancelTimeoutMs() / 1000UL);
}

/** รีเซ็ต timestamp ของ cancel timeout แบบเงียบ ๆ สำหรับ simulation */
void refreshCancelTimeoutForSimulation()
{
  cancelButtonState.lastFallTimestamp = millis();
}

/**
 * ผูก event ID ปัจจุบันไว้กับรอบ suspected fall นี้
 *
 * ใช้เพื่อแนบ eventId กลับไปพร้อม `fall_cancelled` เมื่อมีค่า
 */
void setActiveFallEventId(String eventId)
{
  cancelButtonState.activeFallEventId = eventId;
  sensorLogf(SENSOR_LOG_FALL_FLOW, "Active fall event ID set: %s",
             eventId.c_str());
}

/** ตรวจว่าตอนนี้ยังอยู่ในช่วง cancel timeout หรือไม่ */
bool isCancelTimeoutActive()
{
  if (cancelButtonState.lastFallTimestamp == 0) {
    // ยังไม่เคยตรวจพบ fall
    return false;
  }

  unsigned long elapsed = millis() - cancelButtonState.lastFallTimestamp;
  unsigned long cancelTimeout = getFallCancelTimeoutMs();
  bool timeoutActive = elapsed <= cancelTimeout;

  if (!timeoutActive) {
    sensorLogf(SENSOR_LOG_FALL_FLOW,
               "Cancel timeout expired: %lu ms elapsed (max=%lu ms)", elapsed,
               cancelTimeout);
  }

  return timeoutActive;
}

/**
 * เก็บ timestamp ตอนตรวจพบ fall ล่าสุด
 * ใช้เริ่มนับ cancel timeout ตามค่าที่กำหนดไว้
 */
FalseAlarmCancelButtonState getFalseAlarmCancelButtonState() {
  return cancelButtonState;
}

/** ตรวจว่าปุ่มยกเลิกเริ่มต้นแล้วหรือยัง */
bool isFalseAlarmCancelButtonReady() { return cancelButtonState.isInitialized; }

/**
 * รีเซ็ตสถานะปุ่มยกเลิกหลังจบรอบ fall เดิม
 *
 * ถ้าปุ่มยังถูกกดค้างอยู่ตอน reset ต้องระวังไม่ให้ปล่อยปุ่มครั้งถัดไป
 * ไป trigger flow ซ้ำโดยไม่ตั้งใจ
 */
void resetFalseAlarmCancelButton()
{
  bool buttonStillPressed = digitalRead(FALSE_ALARM_BTN_PIN) == LOW;

  cancelButtonState.isPressed = false;
  cancelButtonState.pressStartTime =
      buttonStillPressed ? cancelButtonState.pressStartTime : 0;
  cancelButtonState.lastPressTime = 0;
  cancelButtonState.lastFallTimestamp = 0;
  cancelButtonState.activeFallEventId = "";
  cancelButtonConfirmed = false;
  cancelActionHandledOnPress = buttonStillPressed;
  suppressNextReleaseAction = buttonStillPressed;
}

/** ดึงสถานะยืนยัน cancel ออกมาใช้ครั้งเดียวต่อการกดแต่ละครั้ง */
bool consumeCancelButtonConfirmed()
{
  bool confirmed = cancelButtonConfirmed;
  cancelButtonConfirmed = false;
  return confirmed;
}
