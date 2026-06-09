# Development Plan: 4 Phases (แผนการพัฒนา 4 ระยะ)

## Doc Meta

- Audience: PM/Dev/QA
- Source of Truth: Roadmap + codebase
- Status: Active
- Last Updated: May 21, 2026

---

## Overview

แผนการพัฒนานี้แบ่งออกเป็น 2 ส่วนหลัก: **Software** (Mobile App + Backend + Admin) และ **Hardware** (IoT Device) โดยใช้บอกลำดับงานที่ยังเหลือและระดับความพร้อมของโปรเจกต์ในมุม roadmap

## ภาพรวมความคืบหน้า (Progress Overview)

| ส่วน           | เสร็จแล้ว | ทั้งหมด |     สถานะ     |
| -------------- | :-------: | :-----: | :-----------: |
| **Software**   |    27     |   27    | ✅ **100.0%** |
| **Hardware**   |    27     |   27    | ✅ **100.0%** |
| **รวมทั้งหมด** |    54     |   54    | ✅ **100.0%** |

> สรุปสั้น: โปรเจกต์เสร็จครบสำหรับการสาธิต (Demo Scope) — Software + Hardware core features ทั้งหมด ✅

### Software ที่เสร็จแล้ว (27/27):

**Core Features:**

- ✅ Auth
- ✅ Elder (Add/View/Edit)
- ✅ Emergency Call
- ✅ Device Pairing
- ✅ WiFi Config
- ✅ Dashboard Real-time

**Monitoring & Alerts:**

- ✅ Push Notification
- ✅ Monthly Report
- ✅ Notification History
- ✅ False Alarm Handling

**Admin & Quality:**

- ✅ Admin Devices (with stats — Dashboard merged into Devices page)
- ✅ Security Audit (24 fixes)
- ✅ Unit Tests (196)
- ✅ Integration Tests (44)

### Hardware ที่เสร็จแล้ว — Demo Scope (27/27)

> **หมายเหตุ:** Hardware core features ครบสำหรับการสาธิต ทั้งหมด 27 รายการ ไม่นับรวม production variants (PCB manufacturing, mass production setup เป็นต้น)

**Connectivity & Provisioning:**

- ✅ ESP32 Wi-Fi + MQTT
- ✅ BLE WiFi Configuration

**Sensing & Detection:**

- ✅ MPU6050 อ่านค่า Accel/Gyro
- ✅ SMV + Complementary Filter
- ✅ Pulse Sensor อ่านค่า HR
- ✅ Fall Detection Algorithm (threshold-based)

**Alert & Event Flow:**

- ✅ Grove Speaker
- ✅ ส่ง JSON ผ่าน MQTT
- ✅ ยกเลิก False Alarm ผ่านปุ่ม

**Power & Hardware Build:**

- ✅ แบตเตอรี่ LiPo + TP4056
- ✅ Step-Up 5V
- ✅ ปุ่มกดทำงาน
- ✅ ประกอบ Prototype เสร็จ
- ✅ ออกแบบ PCB/กล่อง
- ✅ Slide Switch
- ✅ สายคล้องคอ/Earclip

---

## ⚡ สิ่งที่เหลือต้องทำ (Remaining Work)

> อัปเดต: 10 พฤษภาคม 2026 — งานหลักฝั่ง Device/Integration ที่ยืนยันแล้วทำครบ เหลือเตรียมการนำเสนอเดโม

### ลำดับความสำคัญ (Priority Order)

| #   | งาน                                                      | ส่วน    | ความสำคัญ | สถานะ |
| --- | -------------------------------------------------------- | ------- | :-------: | :---: |
| 1   | **Demo/Presentation** — เตรียมสาธิตให้อาจารย์/คณะกรรมการ | ทุกส่วน |  🟢 ต่ำ   |  ⏳   |

### รายละเอียดแต่ละงาน

#### 1. ทดสอบล้มจริง (Real Fall Test)

```
สิ่งที่ต้องทำ:
- ทดสอบการล้มจริงในสภาพแวดล้อมที่ปลอดภัย
- ครอบคลุมท่าหลัก: Forward Fall, Backward Fall, Side Fall
- ตรวจดูว่าอุปกรณ์ส่ง event และแจ้งเตือนได้ถูกต้อง
- บันทึกผลการทดสอบ

ผลลัพธ์ที่ต้องการ:
- ยืนยันว่าระบบตรวจจับและส่งเหตุการณ์หกล้มได้
- ยืนยันว่าการกดปุ่มยกเลิก False Alarm ยังทำงานตามปกติ
```

#### 2. ตรวจสอบการอ่านชีพจร (Heart Rate Readout Check)

```
สิ่งที่ต้องทำ:
- ยืนยันว่า Pulse Sensor XD-58C อ่านค่า HR จากอุปกรณ์จริงได้
- ตรวจดูว่าค่า BPM ถูกส่งเข้าระบบและแนบกับ FALL event ได้เมื่อมีข้อมูล
- ปรับ Band-Pass Filter เฉพาะกรณีที่สัญญาณอ่านไม่ออกหรือมี noise มาก

ผลลัพธ์ที่ต้องการ:
- อ่านค่า HR ได้จากอุปกรณ์จริง
- แนบ BPM กับ FALL event ได้เมื่อมีข้อมูลพร้อมใช้งาน
```

#### 3. System Integration Test (End-to-End)

```
Test Flow ที่ต้องทดสอบ:

Flow A — Fall Detection:
  Sensors (MPU6050 + Pulse Sensor) อ่านข้อมูล → ESP32 ประมวลผล → ตรวจจับล้ม
  → MQTT → Backend → Push Notification → Mobile แสดงแจ้งเตือน → Event History บันทึก

Flow B — False Alarm Cancel:
  Sensors ตรวจจับล้ม → ESP32 ส่งค่า → ผู้สูงอายุกดปุ่มยกเลิกใน 15 วินาที
  → MQTT fall_cancelled → Backend อัปเดต event เป็น CANCELLED โดยไม่แจ้ง Mobile

Flow C — Heart Rate at Fall:
  Pulse Sensor วัด HR → ESP32 ตรวจจับล้ม + cache BPM → MQTT → Backend แนบ BPM ล่าสุด (cache ≤ 5 นาที) ใน FALL event.bpm
  → Mobile แสดง BPM ณ ขณะล้มบนหน้า Fall Alert

Flow D — Device Status:
  ESP32 เปิดเครื่อง → MQTT status ONLINE → Backend อัปเดต → Mobile แสดง Online
  ESP32 ปิดเครื่อง → timeout → Backend อัปเดต OFFLINE → Mobile แสดง Offline
```

---

# ส่วนที่ 1: แผนพัฒนา (Development Plan)

## Software Development Plan (แผนพัฒนาซอฟต์แวร์)

### ภาพรวมสำหรับนำเสนอ (Summary)

| Phase | ระยะ                              | ช่วงเวลา      |  สถานะ   |
| :---: | --------------------------------- | ------------- | :------: |
|   1   | ฟังก์ชันหลัก (Core Functions)     | ก.ย.-พ.ย. 68  | ✅ 100%  |
|   2   | ฟังก์ชันรอง (Secondary Functions) | พ.ย.-ธ.ค. 68  | ✅ 100%  |
|   3   | ฟังก์ชันทั้งหมด (Full Functions)  | ธ.ค.-ม.ค. 69  | ✅ 100%  |
|   4   | การทดสอบ (Testing & Deployment)   | ก.พ.-มี.ค. 69 | 🔄 66.7% |

**Phase 3 ที่เหลือ (0 รายการ):**

- ไม่มี (สำเร็จครบถ้วน)

**Phase 4 งานหลัก (3 รายการ):**

- ✅ **System Integration:** ทดสอบ Mobile ↔ Backend ↔ ESP32 ครบ loop
- ✅ **Sensor Calibration:** ปรับจูนการตรวจจับล้มและยืนยันการอ่านชีพจรจากอุปกรณ์จริง
- ⏳ **Demo/Presentation:** เตรียมสาธิตให้อาจารย์/คณะกรรมการ

**สิ่งที่ทำไปแล้ว (Phase 4):**

- ✅ System Integration (Mobile ↔ Backend ↔ ESP32)
- ✅ Sensor Calibration (Fall + HR Readout)
- ✅ Deployment (student scope): EAS Build Preview (Mobile), Backend Docker + Cloudflare, Admin Local, MQTT HiveMQ Cloud
- ✅ Security Audit (3 รอบ, 24 fixes)
- ✅ Unit Tests (196 tests)
- ✅ Integration Tests (44 tests)

#### Phase 1: ฟังก์ชันหลัก (Core Functions)

**เป้าหมาย:** ผู้ใช้สามารถลงทะเบียน จัดการข้อมูลผู้สูงอายุ และโทรฉุกเฉินได้ (ก่อนเชื่อมต่อ IoT)

**ฟังก์ชัน (Caregiver):**

- ลงทะเบียน/เข้าสู่ระบบ (Register, Login)
- จัดการข้อมูลผู้สูงอายุ (Elder Profile)
- จัดการผู้ติดต่อฉุกเฉิน (Emergency Contacts)
- โทรฉุกเฉิน (Emergency Call)
- Dashboard เปล่า (Empty State)

**ฟังก์ชัน (Admin):**

- เข้าสู่ระบบ/ออกจากระบบ (Admin Login/Logout)
- จัดการและลบอุปกรณ์ (Device List & Management)

#### Phase 2: ฟังก์ชันรอง (Secondary Functions)

**เป้าหมาย:** ผู้ใช้สามารถจับคู่อุปกรณ์และติดตามสถานะ Online/Offline ได้

**ฟังก์ชัน (Caregiver):**

- เชื่อมต่ออุปกรณ์ (Device Pairing) ผ่าน QR Code
- Dashboard แสดงสถานะ Online/Offline
- ดูเหตุการณ์ย้อนหลัง (Event History)

**ฟังก์ชัน (Admin):**

- ลงทะเบียนอุปกรณ์และสร้าง QR Code (Register Device)
- ดูรายการ/ลบ/ยกเลิกการจับคู่อุปกรณ์ (Device Management)
- Dashboard แสดงภาพรวมระบบ (System Overview)

#### Phase 3: ฟังก์ชันทั้งหมด (Full Functions)

**เป้าหมาย:** ผู้ใช้ได้รับข้อมูล Sensor แบบ Real-time และแจ้งเตือนเมื่อเกิดเหตุการณ์ผิดปกติ

**ฟังก์ชัน (Caregiver):**

- แสดง Heart Rate และ Fall Status แบบ Real-time
- Push Notifications (Fall only, with BPM at time of fall)
- รายงานสุขภาพรายเดือน (Monthly Report)
- ดูประวัติการแจ้งเตือน (Notification History)

#### Phase 4: การทดสอบ (Testing & Deployment)

**เป้าหมาย:** ระบบทดสอบ Integration กับ Hardware จริงและพร้อมสาธิต

**ขั้นตอน:**

- System Integration Testing (Mobile + Backend + Hardware ทำงานร่วมกัน)
- Sensor Calibration (ทดสอบล้มจริงและยืนยันการอ่านชีพจร)
- Demo Preparation

---

## Hardware Development Plan (แผนพัฒนาฮาร์ดแวร์)

### ภาพรวมสำหรับนำเสนอ (Summary)

| Phase | ระยะ                              | ช่วงเวลา          |  สถานะ  |
| :---: | --------------------------------- | ----------------- | :-----: |
|   1   | ฟังก์ชันหลัก (Core Functions)     | พ.ย. 68 - ม.ค. 69 | ✅ 100% |
|   2   | ฟังก์ชันรอง (Secondary Functions) | พ.ย. 68 - ม.ค. 69 | ✅ 100% |
|   3   | ฟังก์ชันทั้งหมด (Full Functions)  | ธ.ค. 68 - ม.ค. 69 | ✅ 100% |
|   4   | การทดสอบ (Testing & Validation)   | ก.พ.-มี.ค. 69     | ✅ 100% |

> **อัปเดต 10 พฤษภาคม 2026:** ฮาร์ดแวร์ประกอบรวมอุปกรณ์เสร็จแล้ว พร้อมทดสอบจริง

**Phase 3 ที่เหลือ (0 รายการ):**

- ไม่มี (สำเร็จครบถ้วน)

**Phase 4 ที่เหลือ (ทั้งหมด):**

- ไม่มี (งานทดสอบหลักที่วางไว้ทำครบแล้ว)

**สิ่งที่ทำสำเร็จใน Phase 4:**

- ทดสอบล้มจริง: Forward/Backward/Side Fall บนพื้นที่ปลอดภัย
- ตรวจสอบการอ่านชีพจร: อ่านค่า HR จาก Pulse Sensor ได้จากอุปกรณ์จริง
- การเชื่อมต่อพื้นฐาน: ตรวจสอบ Wi-Fi/MQTT ทำงานต่อเนื่องในงานจริง

#### Phase 1: ฟังก์ชันหลัก (Core Functions)

**เป้าหมาย:** พัฒนาฮาร์ดแวร์พื้นฐานให้สามารถตรวจจับการเคลื่อนไหวและสื่อสารกับ Backend ได้

**ฟังก์ชัน:**

- ESP32 + MPU6050 อ่านค่า Accelerometer/Gyroscope
- เชื่อมต่อ Wi-Fi + MQTT
- รองรับ BLE สำหรับตั้งค่า Wi-Fi

#### Phase 2: ฟังก์ชันรอง (Secondary Functions)

**เป้าหมาย:** เพิ่ม Sensor วัดชีพจรและระบบพลังงานแบบพกพา

**ฟังก์ชัน:**

- Pulse Sensor XD-58C วัดชีพจร
- LiPo Battery + TP4056 ชาร์จ
- Grove Speaker เสียงเตือน

#### Phase 3: ฟังก์ชันทั้งหมด (Full Functions)

**เป้าหมาย:** พัฒนา Algorithm ตรวจจับการล้มและระบบแจ้งเตือนครบถ้วน

**ฟังก์ชัน:**

- Fall Detection (Threshold-based)
- ส่ง JSON ผ่าน MQTT
- ออกแบบ PCB/กล่อง และสายคล้องคอ

#### Phase 4: การทดสอบ (Testing & Validation)

**เป้าหมาย:** ทดสอบการล้มจริงและยืนยันการอ่านชีพจรจากอุปกรณ์จริง

**ขั้นตอน:**

- ทดสอบการล้มจริง (Forward/Backward/Side Fall)
- ตรวจสอบการอ่านค่า HR และการแนบ BPM กับ FALL event
- ตรวจสอบการเชื่อมต่อ Wi-Fi/MQTT ในการใช้งานปกติ

---

# ส่วนที่ 2: Checklist สำหรับติดตามงาน

## Software Development Tracker

### Phase 1: ฟังก์ชันหลัก (Core Functions)

**เป้าหมาย:** ผู้ใช้สามารถลงทะเบียน จัดการข้อมูลผู้สูงอายุ และโทรฉุกเฉินได้ (ก่อนเชื่อมต่อ IoT)

**Actor: ญาติผู้ดูแล (Caregiver):**

- [x] พัฒนาฟังก์ชันการลงทะเบียนบัญชีผู้ใช้ (Register) เข้าสู่ระบบ (Login) และจัดการข้อมูลส่วนตัว
- [x] พัฒนาฟังก์ชันการเพิ่ม ดู แก้ไข ข้อมูลผู้สูงอายุ (Elder Profile)
- [x] พัฒนาฟังก์ชันการจัดการรายชื่อผู้ติดต่อฉุกเฉิน (Emergency Contacts) เพิ่ม/ลบ/จัดลำดับ
- [x] พัฒนาฟังก์ชันโทรฉุกเฉิน (Emergency Call) รองรับทั้งการกดเองและผ่านการแจ้งเตือน
- [x] พัฒนาฟังก์ชันแสดงหน้า Dashboard เปล่า (Empty State) รองรับการเริ่มใช้งาน

**Actor: ผู้ดูแลระบบ (Admin):**

- [x] พัฒนาฟังก์ชันเข้าสู่ระบบ (Admin Login) และจัดการบัญชีผู้ดูแล
- [x] พัฒนาฟังก์ชันดูภาพรวมสถานะอุปกรณ์ ได้แก่ จำนวนอุปกรณ์ทั้งหมด จำนวนอุปกรณ์ที่จับคู่แล้ว และอุปกรณ์ที่ยังไม่จับคู่

---

### Phase 2: ฟังก์ชันรอง (Secondary Functions)

**เป้าหมาย:** ผู้ใช้สามารถจับคู่อุปกรณ์และติดตามสถานะ Online/Offline ได้

**Actor: ญาติผู้ดูแล (Caregiver):**

- [x] พัฒนาฟังก์ชันเชื่อมต่ออุปกรณ์ (Device Pairing) ผ่าน QR Code และ Manual Entry
- [x] พัฒนาฟังก์ชันอัปเดตการตั้งค่า Wi-Fi ให้กับอุปกรณ์ (WiFi Update)
- [x] พัฒนาฟังก์ชัน Dashboard แสดงสถานะอุปกรณ์ Online/Offline แบบ Real-time
- [x] พัฒนาฟังก์ชันดูเหตุการณ์ย้อนหลัง (Event History) พร้อมตัวกรอง (25, 50, ทั้งหมด)

**Actor: ผู้ดูแลระบบ (Admin):**

- [x] พัฒนาฟังก์ชันลงทะเบียนอุปกรณ์เข้าระบบ (Register Device) และสร้าง QR Code
- [x] พัฒนาฟังก์ชันดูรายการอุปกรณ์ทั้งหมดและสถานะการเชื่อมต่อ

---

### Phase 3: ฟังก์ชันทั้งหมด (Full Functions)

**เป้าหมาย:** ผู้ใช้ได้รับข้อมูล Sensor แบบ Real-time และแจ้งเตือนเมื่อเกิดเหตุการณ์ผิดปกติ

**Actor: ผู้สูงอายุ (Elder):**

- [x] พัฒนาฟังก์ชันการยกเลิกการแจ้งเตือน (False Alarm) ผ่านปุ่มบนอุปกรณ์ (False Alarm Cancel Button)

**Actor: ญาติผู้ดูแล (Caregiver):**

- [x] พัฒนาฟังก์ชันแสดงข้อมูลสุขภาพ Real-time (Heart Rate, Fall Status) บน Dashboard
- [x] พัฒนาฟังก์ชันการแจ้งเตือน (Push Notifications) สำหรับการหกล้ม (`fall_confirmed` พร้อม BPM ณ ขณะล้ม)
- [x] พัฒนาฟังก์ชันรายงานสุขภาพรายเดือน (Monthly Health Report) และข้อมูลสรุป
- [x] พัฒนาฟังก์ชันดูประวัติการแจ้งเตือน (Notification History) จัดการสถานะและลบรายการได้
**Actor: ผู้ดูแลระบบ (Admin):**

- [x] พัฒนาฟังก์ชัน Dashboard แสดงข้อมูลสรุปภาพรวมของระบบ (System Overview)
  - แสดงจำนวนอุปกรณ์ทั้งหมด อุปกรณ์ที่จับคู่แล้ว และอุปกรณ์ที่ยังไม่จับคู่

---

### Phase 4: การทดสอบ (Testing & Deployment) - ก.พ.-มี.ค. 2569

**เป้าหมาย:** ระบบทดสอบ Integration กับ Hardware จริงและพร้อมสาธิต

**Actor: ทีมพัฒนาและทดสอบ (Dev & QA Team):**

- [x] **System Integration:** ทดสอบการทำงานร่วมกันทั้งระบบ (Mobile - Backend - Firmware)
- [x] **Sensor Calibration:** ปรับจูนความแม่นยำในการตรวจจับการหกล้มและวัดชีพจร
- [x] **Deployment (Student Scope):** ใช้งานจริงผ่าน EAS Preview + Backend Docker/Cloudflare + Admin Local + HiveMQ Cloud
- [ ] **Demo/Presentation:** เตรียมสาธิตให้อาจารย์/คณะกรรมการ

---

## Hardware Development Tracker

### Phase 1: ฟังก์ชันหลัก (Core Functions) - พ.ค. 2569 ถึง ก.ค. 2569

**เป้าหมาย:** พัฒนาฮาร์ดแวร์พื้นฐานให้สามารถตรวจจับการเคลื่อนไหวและสื่อสารกับ Backend ได้

**พื้นฐาน (ESP32 + MPU6050):**

- [x] ESP32-DevKitC V4 สามารถอ่านค่า Accelerometer และ Gyroscope จาก MPU6050 ผ่าน I²C ได้
- [x] เขียนโค้ดคำนวณค่า Signal Magnitude Vector (SMV) จากข้อมูล Accelerometer 3 แกน
- [x] ใช้ Complementary Filter รวมสัญญาณจาก Accelerometer และ Gyroscope เพื่อประมาณมุม Pitch/Roll

**การเชื่อมต่อ (Connectivity):**

- [x] ESP32 เชื่อมต่อ Wi-Fi และส่งข้อมูลพื้นฐาน (เช่น "Hello World") ไปยัง MQTT Broker ได้สำเร็จ
- [x] รองรับ BLE สำหรับตั้งค่า Wi-Fi ผ่าน Mobile App

**ปฏิสัมพันธ์ (User Interaction):**

- [x] ปุ่มกด (Large Push Button) ทำงานได้และตรวจจับสถานะ HIGH/LOW ได้ถูกต้อง

---

### Phase 2: ฟังก์ชันรอง (Secondary Functions) - พ.ค. 2569 ถึง ก.ค. 2569

**เป้าหมาย:** เพิ่ม Sensor วัดชีพจรและระบบพลังงานแบบพกพา

**Sensor เพิ่มเติม (Pulse Sensor XD-58C):**

- [x] เพิ่ม Pulse Sensor (XD-58C) เชื่อมต่อผ่าน GPIO34 (Analog)
- [x] เขียนโค้ดอ่านค่าสัญญาณ PPG และคำนวณอัตราการเต้นของหัวใจ (BPM)
- [x] ใช้ Band-Pass Filter (0.5-5 Hz) กรองสัญญาณรบกวนจากการเคลื่อนไหว (ปรับจูนสำหรับการใช้งานจริงแล้ว)

**ระบบพลังงาน (Power System):**

- [x] ประกอบวงจรพื้นฐานด้วยแบตเตอรี่ LiPo 3.7V 450mAh
- [x] ติดตั้งโมดูลชาร์จ TP4056 พร้อมวงจรป้องกันการชาร์จเกินและคายประจุเกิน
- [x] ใช้ Power Module (Step-Up Boost 3.7V → 5V) จ่ายไฟให้ ESP32

**การแจ้งเตือน (Alert System):**

- [x] เพิ่มโมดูลลำโพง Grove Speaker สำหรับเสียงเตือน
- [x] เขียนโค้ดสร้างเสียงเตือนเมื่อตรวจพบเหตุการณ์ผิดปกติ

---

### Phase 3: ฟังก์ชันทั้งหมด (Full Functions) - มิ.ย. 2569 ถึง ส.ค. 2569

**เป้าหมาย:** พัฒนา Algorithm ตรวจจับการล้มและระบบแจ้งเตือนครบถ้วน

**Algorithm ตรวจจับการล้ม (Fall Detection):**

- [x] พัฒนาและปรับจูน Algorithm การตรวจจับการล้มโดยใช้ Threshold-based Analysis
- [x] กำหนดค่า Threshold สำหรับ:
  - ค่าความเร่งรวม (SMV) ≈ 2.5g-3.2g สำหรับตรวจจับ Impact
  - อัตราการหมุน ≈ 250-300 °/s สำหรับตรวจจับการเสียการทรงตัว
  - ช่วงนิ่งหลัง Impact (Post-Fall Phase) 0.5-1 วินาที
- [x] ใช้ Orientation Features (Pitch/Roll) ยืนยันท่าทางหลังการล้ม

**การแจ้งเตือน (MQTT Messaging):**

- [x] เขียนโค้ดส่งข้อมูลที่มีโครงสร้าง JSON ไปยัง MQTT Broker เมื่อตรวจจับ:
  - การหกล้ม (Fall Detection)
  - ค่าชีพจร (HR) เพื่อ cache ไว้แนบกับ FALL event (ถ้าเกิดล้มภายใน 5 นาที)
- [x] รองรับการยกเลิกการแจ้งเตือน (False Alarm) ผ่านปุ่มกดภายใน 15 วินาที (False Alarm Cancel Button)

**การออกแบบ (Physical Design):**

- [x] เริ่มออกแบบและประกอบอุปกรณ์ลงบนแผงวงจร PCB หรือกล่องที่เหมาะสม
- [x] ติดตั้ง Slide Switch SS12D00 สำหรับเปิด/ปิดอุปกรณ์
- [x] ออกแบบสายคล้องคอ (Neck Strap) และตำแหน่งติดตั้ง Easy Earclip สำหรับ Pulse Sensor

> **หมายเหตุ:** ประกอบ Prototype รวมอุปกรณ์บน proto board เสร็จแล้ว และ **ออกแบบ PCB/กล่องสำหรับ final version เรียบร้อยแล้ว**

---

### Phase 4: การทดสอบ (Testing & Validation) - ก.พ.-มี.ค. 2569

**เป้าหมาย:** ทดสอบการล้มจริงและยืนยันการอ่านชีพจรจากอุปกรณ์จริง

**การทดสอบการล้มจริง (Real Fall Test):**

- [x] ทดสอบ Algorithm การตรวจจับการล้มในสภาพแวดล้อมที่ปลอดภัย:
  - การล้มไปข้างหน้า (Forward Fall)
  - การล้มหงายหลัง (Backward Fall)
  - การล้มไปด้านข้าง (Side Fall)
- [x] ยืนยันว่าอุปกรณ์ส่ง event และแจ้งเตือนได้ถูกต้อง

**การอ่านชีพจร (Heart Rate Readout):**

- [x] ตรวจสอบว่า Pulse Sensor อ่านค่า HR ได้จากอุปกรณ์จริง
- [x] ตรวจสอบว่า BPM แนบกับ FALL event ได้เมื่อมีข้อมูล

**การใช้งานพื้นฐาน (Basic Validation):**

- [x] ตรวจสอบการเชื่อมต่อ Wi-Fi และ MQTT ในการใช้งานปกติ

---

## Related Docs

- [Functional Requirements](functional-requirements.md)
- [Local Deployment Guide](../ops/local-deployment.md)
- [Firmware Practical Operation Guide](../../firmware/esp32/docs/guides/PracticalOperationGuide.md)
