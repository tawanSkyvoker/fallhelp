# Project-Aligned Research References

## Doc Meta

- Audience: Dev, QA, Stakeholder, ผู้วิจัย
- Source of Truth: cited papers + current firmware owner docs
- Status: Active
- Last Updated: May 18, 2026

---

## Overview

ไฟล์นี้รวบรวมแหล่งอ้างอิงที่ใช้รองรับการออกแบบ ESP32 firmware ของ FallHelp

ใช้ไฟล์นี้เพื่อ:

1. อ้างงานวิจัยในรายงาน
2. อธิบาย limitation ของ sensor placement และ motion artifact
3. แยก future full-study scope ออกจาก Fall Detection Sensor Lab ปัจจุบัน

---

## Fall Detection References

1. Bagala F, et al. (2012). _Accelerometer-based fall detection algorithms on real-world falls_. PLOS ONE. DOI: `10.1371/journal.pone.0037062`
   Link: <https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0037062>
   ใช้เพื่ออ้างอิงความต่างระหว่าง lab conditions และ real-world falls รวมถึงความสำคัญของ false alarm tracking

2. Wang FT, et al. (2018). _Threshold-based fall detection using a hybrid of tri-axial accelerometer and gyroscope_. Physiological Measurement. DOI: `10.1088/1361-6579/aae0eb`
   Link: <https://pubmed.ncbi.nlm.nih.gov/30207983/>
   ใช้รองรับแนวคิด threshold-based hybrid method ที่ใช้ acceleration และ gyroscope/posture information ร่วมกัน

3. Harari Y, et al. (2021). _A smartphone-based online system for fall detection with alert notifications and contextual information of real-life falls_. J Neuroeng Rehabil. DOI: `10.1186/s12984-021-00918-z`
   Link: <https://pubmed.ncbi.nlm.nih.gov/34376199/>
   ใช้อ้างแนวคิด online fall detection + alert notification และ burden จาก false alarm

---

## Sensor Placement Reference

1. Teng S, et al. (2024). _Analyzing Optimal Wearable Motion Sensor Placement for Accurate Classification of Fall Directions_. Sensors. DOI: `10.3390/s24196432`
   Link: <https://pmc.ncbi.nlm.nih.gov/articles/PMC11479374/>
   ใช้เป็น limitation ของ FallHelp: โปรเจกต์เลือก neck-mounted device เพราะต้องรวม IMU + PPG ในอุปกรณ์เดียว แม้ตำแหน่งคอไม่ใช่ตำแหน่งที่เหมาะที่สุดสำหรับ IMU ในวรรณกรรม

---

## MPU6050 Implementation References

1. Hsieh ST, Lin CL. (2020). _Fall Detection Algorithm Based on MPU6050 and Long-Term Short-Term Memory network_. CACS 2020. DOI: `10.1109/CACS50047.2020.9289769`  
   Link: <https://www.researchgate.net/publication/347691533_Fall_Detection_Algorithm_Based_on_MPU6050_and_Long-Term_Short-Term_Memory_network>  
   ใช้อ้างว่า MPU6050 เป็น sensor ที่ใช้ได้จริงในงาน fall-detection research แต่ FallHelp ไม่ได้นำ LSTM มาใช้ใน firmware ปัจจุบัน

2. Kulkarni, et al. (2016). _Design and Implementation of Fall Detection System Using MPU6050 Arduino_. ResearchGate.  
   Link: <https://www.researchgate.net/publication/303404955_Design_and_Implementation_of_Fall_Detection_System_Using_MPU6050_Arduino>  
   ใช้อ้างแนวทาง MPU6050 + microcontroller และ threshold-based implementation

3. MPU6050 Arduino library (i2cdevlib): <https://github.com/jrowberg/i2cdevlib/tree/master/Arduino/MPU6050>

4. MPU-6000/6050 Datasheet: <https://invensense.tdk.com/wp-content/uploads/2015/02/MPU-6000-Datasheet1.pdf>

5. MPU-6000/6050 Register Map: <https://invensense.tdk.com/wp-content/uploads/2015/02/MPU-6000-Register-Map1.pdf>

---

## PPG References

1. Allen J. (2007). _Photoplethysmography and its application in clinical physiological measurement_. Physiological Measurement. DOI: `10.1088/0967-3334/28/3/R01`  
   Link: <https://pubmed.ncbi.nlm.nih.gov/17322588/>  
   ใช้เป็นพื้นฐานด้าน PPG

2. Hartmann V, et al. (2019). _Quantitative Comparison of Photoplethysmographic Waveform Characteristics: Effect of Measurement Site_. Front Physiol. DOI: `10.3389/fphys.2019.00198`  
   Link: <https://pubmed.ncbi.nlm.nih.gov/30890959/>  
   ใช้อธิบายผลของ measurement site ต่อ waveform quality

3. Warren KM, et al. (2016). _Improving Pulse Rate Measurements during Random Motion Using a Wearable Multichannel Reflectance Photoplethysmograph_. Sensors. DOI: `10.3390/s16030342`  
   Link: <https://pubmed.ncbi.nlm.nih.gov/26959034/>  
   ใช้อ้างปัญหา motion artifact ใน PPG

4. PulseSensorPlayground ESP32 example: <https://github.com/WorldFamousElectronics/PulseSensorPlayground/blob/master/examples/PulseSensor_ESP32/PulseSensor_ESP32.ino>

5. PulseSensor XIAO ESP32S3 Tutorial: <https://pulsesensor.com/pages/pulsesensor_xiao_esp32s3>

---

## Current Boundary

Fall Detection Sensor Lab ปัจจุบันคือ Basic Activity Collection:

1. เก็บ IMU trial เพื่อแสดงตัวอย่าง `decision`, `magnitude`, และ `postureDelta`
2. ไม่ใช่ full-study dataset
3. ไม่รายงานผลเชิงสถิติเป็นผลปัจจุบัน
4. งาน full-study ในอนาคตต้องมี protocol และ dataset พอรองรับ

---

## How To Use These References

1. ใช้ firmware source เป็นหลักสำหรับค่าที่ระบบใช้อยู่จริง
2. ใช้ paper เพื่ออธิบาย rationale, limitation, และ future full-study scope
3. อย่าเปลี่ยน threshold เพราะ paper แนะนำค่าใดค่าหนึ่งโดยไม่มีรอบ tuning ของ FallHelp
4. ระบุเสมอว่า FallHelp เป็น monitoring system ไม่ใช่ medical diagnostic device

---

## Related Docs

- [SensorTheoryReference.md](SensorTheoryReference.md)
- [TechnicalGlossary.md](TechnicalGlossary.md)
- [../components/mpu6050.md](../components/mpu6050.md)
- [../components/pulse-sensor.md](../components/pulse-sensor.md)
