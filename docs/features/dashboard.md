# หน้าแดชบอร์ด (Dashboard)

## Doc Meta

- **Audience**: Dev / QA / Stakeholder / ผู้วิจัย
- **Source of Truth**: `apps/mobile/app/(tabs)/dashboard.tsx`
- **Status**: **Active** — ฟีเจอร์ที่พัฒนาแล้วและใช้งานจริง
- Last Updated: May 31, 2026

## Overview

หน้าจอหลักที่ผู้ดูแลเปิดใช้งานทุกวัน แสดงสถานะผู้สูงอายุแบบ Real-time ทั้งสถานะอุปกรณ์ (Online/Offline) สถานะการหกล้ม และค่าชีพจร พร้อมปุ่มโทรฉุกเฉินลัด ข้อมูลอัปเดตผ่าน Socket.io แบบ Real-time และดึง API เป็น Fallback เมื่อยังไม่ได้รับสัญญาณ

## Users

- **ญาติผู้ดูแล (Caregiver)** — ติดตามสถานะและตอบสนองเหตุฉุกเฉิน

## Features

### 1. การแสดงสถานะแบบ Real-time

**ข้อมูลที่อัปเดตแบบ Real-time:**

- **สถานะอุปกรณ์** — Online (เขียว) / Offline (แดง) / กำลังเชื่อมต่อ (เหลือง)
- **สถานะการหกล้ม** — ปกติ / กำลังตรวจสอบ / ตรวจพบการหกล้ม / เหตุการณ์ก่อนหน้า
- **อัตราการเต้นหัวใจ** — ค่า BPM แบบ Real-time พร้อมการแจ้งเตือนค่าผิดปกติ

### 2. การดำเนินการของผู้ใช้

**ปุ่มและการกระทำ:**

- **การ์ดผู้สูงอายุ** — กดเข้าดูข้อมูลเพิ่มเติม
- **การ์ดอุปกรณ์** — กดเข้าดูรายละเอียดอุปกรณ์
- **ปุ่มรับทราบแล้ว** — รับทราบเหตุการณ์และคืนหน้าจอเป็นปกติ (UI เท่านั้น)
- **ปุ่มโทรฉุกเฉิน** — กดเข้าหน้าโทรฉุกเฉินทันที
- **ไอคอนกระดิ่งแจ้งเตือน** — เปิด Notification Modal

## Related Screens

### หน้าแดชบอร์ดหลัก (Home Tab)

**ไฟล์:** `(tabs)/dashboard.tsx`
**สิ่งที่ผู้ใช้เห็น:**

- **Header** — รูปโปรไฟล์ผู้ใช้ + ชื่อผู้ใช้ + ไอคอนกระดิ่งแจ้งเตือน (Badge จำนวนที่ยังไม่อ่าน)
- **การ์ดผู้สูงอายุ** — ชื่อ, อายุ, เพศ พร้อม Shortcut กดเข้าดูข้อมูลเพิ่มเติม
- **การ์ดสถานะอุปกรณ์** — Online/Offline/กำลังเชื่อมต่อ พร้อมชื่ออุปกรณ์
- **การ์ดสถานะการหกล้ม** — ปกติ/กำลังตรวจสอบ/ตรวจพบการหกล้ม/เหตุการณ์ก่อนหน้า
- **การ์ดอัตราการเต้นหัวใจ** — ค่า BPM แบบ Real-time พร้อม Badge ค่าผิดปกติ
- **ปุ่มโทรฉุกเฉิน** — ปุ่มลอยด้านล่าง
  **สิ่งที่ผู้ใช้ทำได้:**
- กดการ์ดผู้สูงอายุ → ไปหน้า Elder Profile
- กดการ์ดอุปกรณ์ → ไปหน้า Device Details
- กดไอคอนกระดิ่ง → เปิด Notification Modal
- กดปุ่ม "รับทราบแล้ว" → รับทราบเหตุการณ์และคืนหน้าจอเป็นปกติ (UI เท่านั้น)
- กดปุ่มโทรฉุกเฉิน → ไปหน้า Emergency Call

## Business Rules

| หัวข้อ              | รายละเอียด                                                                 |
| ------------------- | -------------------------------------------------------------------------- |
| ค่า HR ปกติ         | 60–100 BPM                                                                 |
| HR สูงผิดปกติ       | > 100 BPM (Tachycardia)                                                    |
| HR ต่ำผิดปกติ       | < 60 BPM (Bradycardia)                                                     |
| HR หมดอายุ          | ไม่มีข้อมูลใหม่เกิน 60 วินาที → แสดง "--"                                  |
| สถานะการล้มหมดอายุ  | ไม่มีข้อมูลใหม่เกิน 10 นาที → ถือว่าเก่า                                   |
| สถานะอุปกรณ์ออนไลน์ | คำนวณจาก `lastOnline` และ realtime signal (backend threshold 15 วินาที) |
| Grace Period สัญญาณ | ช่วงเริ่มต้นใช้ startup grace ประมาณ 8 วินาที ก่อนตัดสินว่า Offline       |
| รับทราบแล้ว         | เปลี่ยนเฉพาะ UI — ไม่แก้ไขข้อมูล Event ใน Backend                          |
| Badge กระดิ่ง        | แสดงจาก unread notification จริงหลัง backend สร้าง record แล้ว ไม่ขึ้นล่วงหน้าจาก card realtime |

## Related Docs

- [elder-profile.md](elder-profile.md) — ข้อมูลผู้สูงอายุ
- [emergency-contact.md](emergency-contact.md) — หน้าโทรฉุกเฉิน
- [event-history.md](event-history.md) — ประวัติเหตุการณ์

---

**หมายเหตุ:** เอกสารนี้อธิบายฟีเจอร์ที่พัฒนาแล้วและใช้งานจริงในระบบ FallHelp

---

## UI/UX Guidelines

# FallHelp Mobile UI/UX Specification

## Doc Meta

- Audience: Mobile Dev, PM, QA, reviewers checking screen behavior against implementation
- Source of Truth: `apps/mobile/` screens, shared mobile components, and this screen-level UX specification
- Status: Active
- Last Updated: May 10, 2026

---

## Overview

เอกสารนี้เป็น owner doc ของ UX/UI ฝั่ง mobile โดยถอดจาก implementation จริงใน `apps/mobile/` เพื่ออธิบายว่าแต่ละหน้าจอควรทำงานอย่างไร ไม่ใช่แค่หน้าตาเป็นอย่างไร

เป้าหมายของเอกสารนี้คือ:

- ใช้เป็นจุดอ้างอิงร่วมระหว่าง Dev, PM, QA เวลาเช็กว่า flow ของหน้าจอตรงกับ intent หรือไม่
- สรุป shell, interaction pattern, และ state behavior ที่ใช้ซ้ำกันทั้งแอป
- ระบุความต่างระหว่าง setup flow, auth flow, monitoring flow, และ settings/profile flow ให้ชัด

---

## 1. Mobile Experience Principles

### 1.1 หลักการออกแบบหลัก

- แอปนี้เป็น caregiver app จึงเน้น `อ่านเร็ว`, `ตอบสนองเร็ว`, และ `ลดการตัดสินใจผิด` มากกว่าความหวือหวา
- หน้าจอส่วนใหญ่ใช้พื้นหลังขาว, การ์ดมุมโค้ง, และ hierarchy ของข้อความแบบนิ่งเพื่อให้อ่านภาษาไทยได้ง่าย
- Critical state เช่น fall alert ต้องเด่นด้วยสีและถ้อยคำ แต่ต้องไม่ทำให้ caregiver เข้าใจว่า "กดยกเลิกเหตุการณ์จากแอปได้"
- Setup flow ต้องพา user ไปทีละขั้น ลด branching และลดความจำเป็นต้องจำบริบทเอง

### 1.2 Terminology ที่ UI ต้องรักษา

- `Cancel` สงวนให้ฝั่งอุปกรณ์เท่านั้น
- ฝั่งแอปของ caregiver ใช้คำว่า `รับทราบแล้ว` เป็นหลัก และหลีกเลี่ยงคำที่สื่อว่าเปลี่ยนสถานะจริงของเหตุการณ์
- Fall flow ใน UI ต้องสะท้อน 3 ช่วงหลัก:
  - `SUSPECTED`
  - `FALL`
  - `NORMAL` หลัง resolve/cancelled

### 1.3 Layout Direction

- ทุกหน้าหลักใช้ padding ด้านข้าง `24px` เป็นฐานผ่าน [ScreenWrapper.tsx](../../apps/mobile/components/ScreenWrapper.tsx)
- Header กลางของแอปใช้ [AppScreenHeader.tsx](../../apps/mobile/components/AppScreenHeader.tsx)
- Onboarding setup ใช้ [WizardLayout.tsx](../../apps/mobile/components/WizardLayout.tsx) เพื่อให้ progress bar, header, และ spacing คงที่ทั้ง 3 ขั้น

---

## 2. App Shell & Shared Layout

### 2.1 Screen Wrapper

หน้าจอหลักทั้งหมดในแอปวางอยู่บน [ScreenWrapper.tsx](../../apps/mobile/components/ScreenWrapper.tsx) ซึ่งกำหนด behavior ร่วมดังนี้:

- Safe area เป็นค่าเริ่มต้น
- สีพื้นหลังหลักเป็น `white`
- ใช้ `KeyboardAwareScrollView` เป็นค่าเริ่มต้นกับหน้าฟอร์ม
- มี 3 mode:
  - `useScrollView=true` สำหรับฟอร์มหรือหน้า content ยาว
  - `useScrollView=false + keyboardAvoiding=true` สำหรับ fixed layout ที่แตะพื้นหลังเพื่อปิด keyboard ได้
  - `useScrollView=false + keyboardAvoiding=false` สำหรับหน้า interaction เฉพาะทาง เช่น list หรือ fullscreen content

ผลคือ user จะรู้สึกว่าหน้าต่าง ๆ "เป็นแอปเดียวกัน" แม้จะเป็นคนละ flow

### 2.2 App Screen Header

Header กลางอยู่ที่ [AppScreenHeader.tsx](../../apps/mobile/components/AppScreenHeader.tsx)

behavior หลัก:

- ชื่อหน้าอยู่กึ่งกลาง
- ปุ่มกลับอยู่ซ้าย และใช้ `Bounceable`
- slot ด้านขวาเปิดให้ใส่ action เพิ่มได้
- มี 2 mode:
  - ปกติ: พื้นหลังขาว + rounded bottom
  - transparent: ใช้กับ wizard/camera/background พิเศษ

กติกาสำคัญ:

- ทุกหน้าที่ไม่ใช่ tab root ควรใช้ header กลางเดียวกัน เพื่อไม่ให้ระยะ padding และ touch target drift
- ชื่อหน้าควรสั้น อ่านได้ใน 1 บรรทัด

### 2.3 Wizard Layout

[WizardLayout.tsx](../../apps/mobile/components/WizardLayout.tsx) เป็น shell เฉพาะ onboarding setup

มันบังคับสิ่งต่อไปนี้ให้เหมือนกันทุกขั้น:

- header รูปแบบเดียวกัน
- progress bar 3 ขั้น
- label ของแต่ละ step:
  - `กรอกข้อมูลผู้สูงอายุ`
  - `ติดตั้งอุปกรณ์`
  - `ตั้งค่าอินเทอร์เน็ต`
- spacing ระหว่าง header/progress/content

UX intent:

- ลดความรู้สึกว่าผู้ใช้ "หลง"
- ทำให้ back navigation ยังเห็นบริบทเดิม
- สื่อชัดว่าขั้นไหนเสร็จแล้ว ขั้นไหนกำลังทำอยู่

---

## 3. Visual Language

### 3.1 Color Roles

สีที่ใช้ใน mobile ไม่ได้เป็น design token เชิง abstract ล้วน ๆ แต่มีบทบาทค่อนข้างตายตัวจาก implementation:

| Role                  | Color               | Usage                                                        |
| --------------------- | ------------------- | ------------------------------------------------------------ |
| Primary action        | `#16AD78`           | ปุ่มหลัก, active state, success emphasis                     |
| Critical / fall       | Red family          | fall confirmed, destructive confirmation, emergency emphasis |
| Warning / suspected   | Yellow/Amber family | suspected fall, transitional warning state                   |
| Info / low heart rate | Blue family         | informational monitoring state, low alert                    |
| Neutral surface       | White + Gray scale  | card, text hierarchy, border                                 |

กติกา UX:

- สีเขียว = action ที่ไปต่อหรือสำเร็จ
- สีแดง = เหตุการณ์ฉุกเฉินหรือ destructive decision
- สีเหลือง = สถานะรอการยืนยันหรือมีความเสี่ยง แต่ยังไม่ใช่เหตุยืนยันแล้ว
- ห้ามใช้สีม่วงเป็น accent หลักของระบบ

### 3.2 Typography

ฟอนต์หลักคือ `Kanit` ผ่าน [KanitText.tsx](../../apps/mobile/components/KanitText.tsx)

หลักการใช้งาน:

- ใช้ Kanit ทุกจุดที่เป็นข้อความหลักของระบบ
- ต้องอ่านภาษาไทยได้ชัด โดยเฉพาะบรรทัดที่มีวรรณยุกต์
- แบ่งชั้นความสำคัญผ่านขนาด/weight มากกว่าการใช้สีจำนวนมาก

hierarchy ที่พบจริงในแอป:

- `text-3xl` ถึง `text-2xl` สำหรับ title สำคัญและค่าหลัก
- `text-xl` ถึง `text-lg` สำหรับ section title และข้อมูลเด่น
- `text-base` สำหรับ body ปกติ
- `text-sm` และ `text-xs` สำหรับ secondary/helper/meta text

### 3.3 Shape & Spacing

รูปแบบโดยรวมของ mobile ใช้การ์ดมุมโค้งค่อนข้างมาก:

- card หลัก: radius ใหญ่ระดับ `24px` ถึง `28px`
- button/input: radius เล็กลง แต่ยังคงความโค้งชัด
- พื้นที่ว่างด้านข้างมาตรฐาน: `24px`
- spacing ระหว่าง block มักอยู่ในช่วง `12px`, `16px`, `24px`

ผลเชิง UX:

- ให้ความรู้สึก soft/safe เหมาะกับแอปดูแลสุขภาพ
- ช่วยแยก block ข้อมูลโดยไม่ต้องใช้เส้นเยอะ

---

## 4. Shared Interaction Patterns

### 4.1 Buttons

ปุ่มหลักในแอปใช้ [PrimaryButton.tsx](../../apps/mobile/components/PrimaryButton.tsx)

behavior ที่ผู้ใช้ควรได้รับสม่ำเสมอ:

- disabled/loading state ต้องเห็นชัด
- ปุ่มหลักใช้สีเขียว
- ปุ่ม destructive ใช้สีแดง
- ปุ่ม secondary ใช้ outline หรือพื้นขาว

### 4.2 Press Feedback

touch target ที่เป็น action สำคัญจำนวนมากใช้ `Bounceable`

UX intent:

- ให้ feedback ทันทีเมื่อแตะ
- ลดการกดซ้ำเร็วเกินไป
- ทำให้ card/action ในมือถือรู้สึก responsive โดยไม่กระโดดแรงเกิน

### 4.3 Dialog vs Toast

แอปแยก feedback ออกเป็น 2 ระดับ:

- `showDialog(...)`
  - ใช้กับ validation error
  - ใช้กับ confirmation
  - ใช้กับกรณีที่ user ต้อง "หยุดอ่านก่อน"
- `showSuccessToast(...)` / `showErrorToast(...)`
  - ใช้กับงานสั้น ๆ ที่ไม่ต้องหยุด flow
  - เช่น บันทึกสำเร็จ, รีเซ็ตมุมมองสำเร็จ

กติกา:

- ถ้าต้องการการตัดสินใจจาก user ใช้ dialog
- ถ้าเป็น feedback หลัง action ใช้ toast ได้

### 4.4 Form Behavior

ฟอร์มใน mobile ใช้ pattern ใกล้กันมาก:

- ใช้ `FloatingLabelInput`
- validation เกิดก่อนยิง mutation
- ถ้าข้อมูลไม่ครบหรือ format ไม่ถูกต้อง ใช้ dialog อธิบายตรง ๆ
- ค่าที่กรอกค้างไว้ได้ใน setup flow บางขั้นผ่าน storage

### 4.5 Navigation Safety

navigation ผ่าน [safeRouter.ts](../../apps/mobile/utils/safeRouter.ts)

UX intent:

- กัน double navigation
- ลด race condition ระหว่าง auth/setup transitions
- ป้องกัน user เจอหน้าเด้งไปมาเมื่อ state ยัง resolve ไม่เสร็จ

---

## 5. Screen-by-Screen UX

### 5.1 Auth Flow

Owner screens:

- `apps/mobile/app/(auth)/login.tsx`
- `apps/mobile/app/(auth)/register.tsx`
- `apps/mobile/app/(auth)/forgot-password.tsx`
- `apps/mobile/app/(auth)/verify-otp.tsx`
- `apps/mobile/app/(auth)/reset-password.tsx`
- `apps/mobile/app/(auth)/success.tsx`

UX characteristics:

- เป็น form-first flow
- ใช้ spacing กว้างกว่า tab screens เล็กน้อย
- ลดสิ่งรบกวนเพื่อให้ user โฟกัสงานเดียวต่อหน้า

รายละเอียดสำคัญ:

- `login`
  - ข้อผิดพลาดจาก credential หรือ validation ใช้ dialog
  - ต้องนำทางไป flow ถัดไปอย่างเสถียรผ่าน safe router
- `verify-otp`
  - ใช้ hidden input + OTP boxes 6 ช่อง
  - มี countdown ทั้ง expiry และ resend cooldown
  - เน้นลดความงงของผู้ใช้เวลา OTP ไม่ผ่าน
- `success`
  - เป็นหน้าปิดจบ flow
  - ใช้ visual positive feedback และ CTA เดียวให้ไปต่อ

### 5.2 Setup Entry

Owner screen:

- `apps/mobile/app/(setup)/empty-state.tsx`

บทบาท:

- เป็นจุดเริ่ม wizard เมื่อ user ยังไม่มี elder/device setup
- อธิบายขั้นตอนล่วงหน้าแบบเข้าใจง่าย
- ถ้ามี elder อยู่แล้วจากระบบ ให้ข้ามออกจาก setup อัตโนมัติ

UX patterns:

- ใช้ step cards 4 ใบสรุป flow
- ปุ่มหลักเดียว `เริ่มลงทะเบียน`
- มี `ออกจากระบบ` เป็น secondary action

### 5.3 Setup Step 1 — Elder Information

Owner screen:

- `apps/mobile/app/(setup)/step1-elder-info.tsx`

บทบาท:

- เก็บข้อมูลผู้สูงอายุที่จำเป็นสำหรับระบบ
- รองรับทั้ง create ใหม่และ resume/edit ข้อมูลเดิม

UX rules:

- form ยาว ต้อง scroll ได้ดีและ keyboard ไม่บัง
- validation ต้องสั้น ชัด และบอก field ที่ต้องแก้
- ข้อมูลที่กรอกไว้ต้องไม่หายง่าย ถ้าผู้ใช้ย้อนกลับหรือแอปสลับสถานะ

field groups ที่ชัดเจนจาก implementation:

- ชื่อ / นามสกุล
- เพศ
- วันเกิด
- ส่วนสูง / น้ำหนัก
- โรคประจำตัว
- บ้านเลขที่ / หมู่ที่ / หมู่บ้าน / ที่อยู่แบบ picker

### 5.4 Setup Step 2 — Device Pairing

Owner screen:

- `apps/mobile/app/(setup)/step2-device-pairing.tsx`

บทบาท:

- จับคู่อุปกรณ์ผ่าน QR scan หรือ manual code
- เป็นจุดเชื่อมโลก physical device เข้ากับ user/elder

UX rules:

- camera scan เป็น happy path หลัก
- manual entry เป็น fallback
- ถ้าพบว่ามีอุปกรณ์ผูกแล้ว ต้องบอก user ชัดว่า:
  - ไปขั้นตอนต่อไปได้
  - หรือเปลี่ยนอุปกรณ์ใหม่ได้

behavior สำคัญ:

- ป้องกันสแกนซ้ำหลายครั้ง
- ถ้าสแกน QR ได้ `deviceCode` + `serialNumber` ต้องเก็บพอสำหรับ step ถัดไป
- back จาก step 2 ต้องกลับ step 1 ได้จริง

### 5.5 Setup Step 3 — WiFi Setup via BLE

Owner screen:

- `apps/mobile/app/(setup)/step3-wifi-setup.tsx`

บทบาท:

- ตั้งค่า WiFi ให้ ESP32 ผ่าน BLE provisioning
- เป็นขั้นที่ซับซ้อนที่สุดใน setup flow

sub-steps จริงในหน้าจอ:

- `initializing`
- `bluetooth-check`
- `ble-connecting`
- `wifi-scanning`
- `wifi-list`
- `wifi-password`
- `provisioning`
- `success`

UX rules:

- ต้องอธิบายสถานะที่กำลังทำอยู่เสมอ
- ถ้า Bluetooth หรือ WiFi ปิดอยู่ ต้องบอกวิธีไปต่อชัด
- provisioning ต้องมี progress message ตามเวลาที่ผ่านไป
- ถ้า socket ยังไม่กลับมา สามารถ fallback เป็น polling ได้โดย user ไม่ต้องรู้ implementation detail

หลักคิด:

- user ต้องรู้ว่า "ระบบยังทำงานอยู่" แม้ provisioning จะนาน
- error message ต้อง actionable มากกว่าแค่ "ล้มเหลว"

### 5.6 Setup Success

Owner screen:

- `apps/mobile/app/(setup)/saved-success.tsx`

บทบาท:

- ปิด setup flow
- ยืนยันว่า setup เสร็จสมบูรณ์แล้ว
- พาผู้ใช้เข้าแท็บหลักแบบ state พร้อมใช้งาน

UX rules:

- ใช้ positive confirmation เต็มหน้า
- มี CTA เดียว `ไปที่หน้าหลัก`
- ไม่ควรมี action รองที่ทำให้ user สับสน

### 5.7 Dashboard / Home

Owner screen:

- `apps/mobile/app/(tabs)/dashboard.tsx`

บทบาท:

- เป็นศูนย์รวมข้อมูล realtime ของ caregiver
- ต้องอ่านสถานะผู้สูงอายุได้เร็วที่สุด

information priority:

1. fall status
2. heart rate / abnormality
3. device connectivity
4. elder summary / navigation ไป feature อื่น

UX rules:

- critical card ของ fall ต้องเด่นที่สุด
- suspected กับ confirmed ต้องต่างกันชัด
- ปุ่ม `รับทราบแล้ว` ในหน้า home ใช้เพื่อคืนมุมมองในแอปเป็นปกติเท่านั้น
- emergency-related action ต้องแยกจาก normal monitoring state

state intent:

- `NORMAL` = มั่นคง/สงบ
- `SUSPECTED` = ต้องเฝ้าดู
- `FALL` = ฉุกเฉิน
- stale state ต้องไม่ทำให้เข้าใจว่าเป็น realtime สดเสมอ

### 5.8 History

Owner screen:

- `apps/mobile/app/(tabs)/history.tsx`

บทบาท:

- ให้ caregiver ดู event ย้อนหลัง
- เน้นอ่าน timeline และเข้าใจสถานะล่าสุด

UX rules:

- รายการต้องอ่านง่ายและกดดูต่อได้
- รายการล่าสุดควรถูก highlight
- มีทางลัดไป monthly summary
- ไม่ควรแสดง fall ที่ยังไม่ยืนยันเหมือนเป็นเหตุการณ์เต็มรูปแบบ

### 5.9 Device Feature Flow

Owner screens:

- `apps/mobile/app/(features)/(device)/device-pairing.tsx`
- `apps/mobile/app/(features)/(device)/device-wifi-setup.tsx`
- `apps/mobile/app/(features)/(device)/device-wifi-reconfig.tsx`
- `apps/mobile/app/(features)/(device)/device-ble-wifi-setup.tsx`
- `apps/mobile/app/(features)/(device)/device-info.tsx`

บทบาท:

- ดูสถานะอุปกรณ์
- ผูกอุปกรณ์ใหม่
- ตั้งค่า/เปลี่ยน WiFi ผ่าน smart entrypoint ที่เลือก BLE หรือ backend reconfig ตามสถานะ online
- จัดการกรณีซ่อม/เปลี่ยนอุปกรณ์

UX rules:

- flow นี้ต้องชัดเจนเรื่อง "อุปกรณ์ปัจจุบัน" กับ "อุปกรณ์ใหม่"
- BLE/WiFi flow ใน feature mode ต้องมีภาษาคล้าย setup step 3 เพื่อลด cognitive load

### 5.10 Elder & Emergency Contacts

Owner screens:

- `apps/mobile/app/(features)/(elder)/elder-info.tsx`
- `apps/mobile/app/(features)/(elder)/edit.tsx`
- `apps/mobile/app/(features)/(emergency)/contacts.tsx`
- `apps/mobile/app/(features)/(emergency)/add.tsx`
- `apps/mobile/app/(features)/(emergency)/edit.tsx`
- `apps/mobile/app/(features)/(emergency)/call.tsx`

UX intent:

- เป็นข้อมูลประกอบการดูแล ไม่ใช่จอ monitoring หลัก
- ต้องอ่านง่ายและแก้ไขได้ตรงไปตรงมา
- emergency contact flow ต้องลดความผิดพลาดเวลาเพิ่ม/แก้/เรียงลำดับ

### 5.11 Notification & Report Supporting Screens

Owner screens:

- `apps/mobile/app/(features)/(notification)/notifications.tsx`
- `apps/mobile/app/(features)/(report)/report-summary.tsx`

UX rules:

- notifications = log ที่อ่านย้อนหลังได้
- report summary = ภาพรวมเชิงสรุป ไม่ใช่จอ realtime
- ต้องแยก "สรุป" ออกจาก "เหตุการณ์สด" ให้ผู้ใช้เข้าใจ

### 5.12 User Profile & Feedback

Owner screens:

- `apps/mobile/app/(features)/(profile)/profile-info.tsx`
- `apps/mobile/app/(features)/(profile)/edit-info.tsx`
- `apps/mobile/app/(features)/(profile)/change-email.tsx`
- `apps/mobile/app/(features)/(profile)/change-password.tsx`
- `apps/mobile/app/(features)/(profile)/edit-phone.tsx`

UX rules:

- profile screens ต้องเป็น settings-style flow ที่ตรงไปตรงมา
- success feedback หลังบันทึกควรสั้นและชัด

---

## 6. Realtime UX Rules

### 6.1 Socket-Driven Monitoring

ข้อมูล realtime หลักมาจาก `useSocketConnection` และ Zustand stores (`useSensorStore`, `useFallAlertStore`)

สิ่งที่ UI ต้องรักษา:

- เมื่อสถานะเปลี่ยน ต้องอัปเดตเร็วแต่ไม่กระพริบมั่ว
- stale thresholds ต้องช่วย "ล้างค่าที่ไม่สด" ออกจาก UI
- fallback จาก realtime ไป cached/query state ต้องไม่ทำให้หน้าเด้ง

### 6.2 Offline / Stale Handling

mobile implementation มี threshold หลักสำหรับ data freshness

UX meaning:

- ถ้า status ไม่สด → อย่าแสดงเหมือนอุปกรณ์ยัง online แน่นอน
- ถ้า heart rate ไม่สด → อย่าแสดงค่าค้างแบบเหมือนเพิ่งวัด
- ถ้า fall เป็นเหตุการณ์เก่า → ควรทำให้ผู้ใช้รู้ว่าเป็น historical state ไม่ใช่ active emergency

### 6.3 พฤติกรรมของปุ่มรับทราบแล้ว

บน mobile การกด `รับทราบแล้ว` มีผลเฉพาะในแอป

ห้ามตีความเป็น:

- cancel event ใน backend
- retract push notification
- เปลี่ยน `cancelledAt` ใน DB

---

## 7. QA Checklist for UI Review

เมื่อตรวจหน้าจอ mobile ให้เช็กอย่างน้อย:

- shell ของหน้าตรงกับ role ของมันหรือไม่ (`ScreenWrapper`, `AppScreenHeader`, `WizardLayout`)
- spacing/padding ยังอยู่ในมาตรฐานเดียวกันหรือไม่
- action หลักเด่นกว่ารองหรือไม่
- error/success feedback ใช้ dialog/toast ถูกระดับหรือไม่
- wording เรื่องปุ่มยกเลิกจากอุปกรณ์และปุ่ม `รับทราบแล้ว` ถูกต้องหรือไม่
- step flow และ back navigation ไม่ทำให้ user หลงหรือไม่
- realtime state แสดงสถานะสด/ค้างอย่างซื่อสัตย์หรือไม่
- หน้า setup และ device flow อธิบาย hardware permission / BLE / WiFi failure ได้ actionable หรือไม่

---

## Related Docs (UI/UX section)

- [Mobile AI Context](../ai/mobile.md)
- [System Overview](../ai/system_overview.md)
- [Fall Detection System](fall-detection.md)
- [API Reference](../api/api-reference.md)
- [AGENTS.md](../../AGENTS.md)
