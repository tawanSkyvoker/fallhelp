# Firmware References Index

## Doc Meta

- Audience: Hardware Dev, QA, AI Agents, ผู้วิจัย
- Source of Truth: component owner docs, firmware source, cited references
- Status: Active
- Last Updated: May 18, 2026

---

## Overview

`references/` คือชั้นอธิบายเหตุผล ทฤษฎี คำศัพท์ และแหล่งอ้างอิง ไม่ใช่ runbook สำหรับลงมือทดสอบหน้างาน

ถ้าต้องลงมือทำ ให้กลับไป:

1. [../guides/README.md](../guides/README.md)
2. [../components/mpu6050.md](../components/mpu6050.md)
3. [../components/pulse-sensor.md](../components/pulse-sensor.md)

---

## Included References

| ไฟล์ | ใช้เมื่อ |
| --- | --- |
| [SensorTheoryReference.md](SensorTheoryReference.md) | ต้องอธิบายสูตร, threshold rationale, signal processing, หรือข้อจำกัดการตีความ |
| [TechnicalGlossary.md](TechnicalGlossary.md) | ต้องนิยามคำศัพท์ที่ใช้ใน firmware/backend/research docs |
| [ProjectAlignedResearch.md](ProjectAlignedResearch.md) | ต้องอ้าง paper หรือ implementation reference |

---

## Boundaries

1. Reference docs ไม่ประกาศผลเชิงสถิติปัจจุบัน
2. Fall Detection Sensor Lab เป็น Basic Activity Collection เท่านั้น
3. ค่าจาก firmware source เป็น source of truth สำหรับค่าที่ระบบใช้จริง
4. Paper ใช้เป็น rationale หรือ limitation ไม่ใช่ข้ออ้างให้เปลี่ยน threshold โดยไม่มีรอบทดสอบ

---

## Related Docs

- [../README.md](../README.md)
- [../guides/PracticalOperationGuide.md](../guides/PracticalOperationGuide.md)
- [../components/mpu6050.md](../components/mpu6050.md)
- [../components/pulse-sensor.md](../components/pulse-sensor.md)
