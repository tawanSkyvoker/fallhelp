
/**
 * @file FalseAlarmCancelButton.ino
 * @brief FalseAlarmCancelButton: ระบบปุ่มยกเลิก false alarm ของผู้สวมอุปกรณ์
 *
 * หน้าที่หลัก:
 * - ตรวจปุ่ม GPIO27 พร้อม debounce
 * - อนุญาตให้กด cancel ได้เฉพาะใน cancel window ที่เปิด alert อยู่
 * - ส่ง `fall_cancelled` กลับขึ้น MQTT เพื่อให้ backend ปิดเคสที่รออยู่
 */

#include "types.h"

// ============================================================================
// [1] ค่าคงที่ของปุ่มกด (Button Configuration)
// ============================================================================

#define FALSE_ALARM_BTN_PIN 27
#define DEBOUNCE_DELAY 50

// ============================================================================
// [2] สถานะภายในของปุ่มยกเลิก (Cancel Button State)
// ============================================================================

FalseAlarmCancelButtonState cancelButtonState = {HIGH, HIGH, 0, 0, false, false, 0, ""};
bool cancelButtonConfirmed = false;
bool cancelActionHandledOnPress = false;
bool suppressNextReleaseAction = false;

// non-blocking debounce state
bool debouncePending = false;
unsigned long debounceStartTime = 0;
int debounceCandidateState = HIGH;

// ============================================================================
// [3] ประกาศฟังก์ชันล่วงหน้า (Forward Declarations)
// ============================================================================

bool initFalseAlarmCancelButton();
void updateFalseAlarmCancelButton();
void handleCancelButtonPress();
void handleCancelButtonRelease();
void publishCancelEvent();
void setLastFallTimestamp(unsigned long timestamp);

void setActiveFallEventId(String eventId);
bool isCancelTimeoutActive();
bool consumeCancelButtonConfirmed();
void cancelFallAlert();
bool isFallAlertActive();
unsigned long getFallCancelTimeoutMs();
void sensorLogf(uint16_t category, const char *fmt, ...);

// ============================================================================
// [4] การเริ่มต้นปุ่มกด (Initialization)
// ============================================================================

bool initFalseAlarmCancelButton() {
  pinMode(FALSE_ALARM_BTN_PIN, INPUT_PULLUP);

  cancelButtonState.lastState = digitalRead(FALSE_ALARM_BTN_PIN);
  cancelButtonState.currentState = cancelButtonState.lastState;
  cancelButtonState.isInitialized = true;

  sensorLogf(SENSOR_LOG_SYSTEM, "False alarm cancel button initialized (GPIO27)");

  return true;
}

// ============================================================================
// [5] วงรอบตรวจจับการกดปุ่ม (Button Polling Loop)
// ============================================================================

void updateFalseAlarmCancelButton() {
  if (!cancelButtonState.isInitialized && !initFalseAlarmCancelButton()) {
    return;
  }

  int reading = digitalRead(FALSE_ALARM_BTN_PIN);

  // ตรวจจับ edge และเริ่มจับเวลา debounce (non-blocking)
  if (reading != cancelButtonState.lastState && !debouncePending) {
    debouncePending = true;
    debounceStartTime = millis();
    debounceCandidateState = reading;
  }

  // ยืนยันสถานะหลังครบ debounce window
  if (debouncePending && millis() - debounceStartTime >= DEBOUNCE_DELAY) {
    debouncePending = false;
    int confirmed = digitalRead(FALSE_ALARM_BTN_PIN);
    if (confirmed == debounceCandidateState && confirmed != cancelButtonState.lastState) {
      cancelButtonState.currentState = confirmed;
      cancelButtonState.lastState = confirmed;
      if (confirmed == LOW) {
        handleCancelButtonPress();
      } else {
        handleCancelButtonRelease();
      }
    }
  }
}

// ============================================================================
// [6] การจัดการตอนกดและปล่อยปุ่ม (Press/Release Handling)
// ============================================================================

void handleCancelButtonPress() {
  cancelButtonState.isPressed = true;
  cancelButtonState.pressStartTime = millis();
  cancelActionHandledOnPress = false;

  sensorLogf(SENSOR_LOG_FALL_FLOW, "False alarm cancel button pressed");

  // cancel จะเกิดได้เฉพาะใน cancel window ที่ยังเปิด alert อยู่เท่านั้น
  if (!isCancelTimeoutActive() && !isFallAlertActive()) {
    sensorLogf(SENSOR_LOG_FALL_FLOW, "Cancel timeout expired (%lus) - ignored",
               getFallCancelTimeoutMs() / 1000UL);
    return; // ถ้าหมดเวลาแล้ว การกดปุ่มครั้งนี้จะไม่มีผลอะไร
  }

  publishCancelEvent();
  cancelButtonConfirmed = true;
  cancelActionHandledOnPress = true;
  cancelFallAlert(); // สั่งให้ลำโพงหยุดร้องเตือนหกล้ม

  // ยกเลิกแล้วไม่เล่นเสียงสำเร็จ ให้ยืนยันแบบเงียบเท่านั้น
}

void handleCancelButtonRelease() {
  unsigned long pressDuration = millis() - cancelButtonState.pressStartTime;
  sensorLogf(SENSOR_LOG_FALL_FLOW, "Cancel button press duration: %lu ms", pressDuration);

  if (suppressNextReleaseAction) {
    suppressNextReleaseAction = false;
    cancelActionHandledOnPress = false;
    cancelButtonState.isPressed = false;
    cancelButtonState.lastPressTime = millis();
    sensorLogf(SENSOR_LOG_FALL_FLOW, "Cancel button release ignored (post-cancel)");
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
// [7] การส่ง fall_cancelled ผ่าน MQTT (MQTT Publishing)
// ============================================================================

void publishCancelEvent() {
  if (!mqtt.connected()) {
    sensorLogf(SENSOR_LOG_FALL_FLOW, "Cannot publish fall_cancelled - MQTT not connected");
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

// ============================================================================
// [8] การจัดการ cancel window (Timeout Management)
// ============================================================================

void setLastFallTimestamp(unsigned long timestamp) {
  cancelButtonState.lastFallTimestamp = timestamp;
  sensorLogf(SENSOR_LOG_FALL_FLOW, "Cancel timeout started (%lus)",
             getFallCancelTimeoutMs() / 1000UL);
}



void setActiveFallEventId(String eventId) {
  cancelButtonState.activeFallEventId = eventId;
  sensorLogf(SENSOR_LOG_FALL_FLOW, "Active fall event ID set: %s", eventId.c_str());
}

bool isCancelTimeoutActive() {
  if (cancelButtonState.lastFallTimestamp == 0) {
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

// ============================================================================
// [9] Utility / Reset / Status API
// ============================================================================

FalseAlarmCancelButtonState getFalseAlarmCancelButtonState() {
  return cancelButtonState;
}

bool isFalseAlarmCancelButtonReady() { return cancelButtonState.isInitialized; }

void resetFalseAlarmCancelButton() {
  // ถ้ามีการกดค้างตอน reset ให้กัน side effect จาก release รอบถัดไป
  bool buttonStillPressed = digitalRead(FALSE_ALARM_BTN_PIN) == LOW;

  cancelButtonState.isPressed = false;
  cancelButtonState.pressStartTime = buttonStillPressed ? cancelButtonState.pressStartTime : 0;
  cancelButtonState.lastPressTime = 0;
  cancelButtonState.lastFallTimestamp = 0;
  cancelButtonState.activeFallEventId = "";
  cancelButtonConfirmed = false;
  cancelActionHandledOnPress = buttonStillPressed;
  suppressNextReleaseAction = buttonStillPressed;
}

bool consumeCancelButtonConfirmed() {
  bool confirmed = cancelButtonConfirmed;
  cancelButtonConfirmed = false;
  return confirmed;
}
