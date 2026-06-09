/**
 * emergencyContactRoutes.ts
 *
 * เส้นทาง API สำหรับผู้ติดต่อฉุกเฉินของผู้สูงอายุ
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - mount ใต้ /api/elders/:elderId/emergency-contacts
 * - ใช้ mergeParams เพื่ออ่าน elderId จาก parent route
 * - บังคับทุก endpoint ให้ผ่าน JWT
 * - ส่ง CRUD และ reorder request ต่อไปยัง controller
 */

import { Router } from 'express';
import * as emergencyContactController from '../controllers/emergencyContactController';
import { authenticate } from '../middlewares/auth';

const router = Router({ mergeParams: true });

// ต้องล็อกอินก่อน เพราะ service จะใช้ userId ตรวจ ownership ของ elderId
router.use(authenticate);

// จัดการผู้ติดต่อฉุกเฉินของผู้สูงอายุ
// ไฟล์ถัดไป: controllers/emergencyContactController.ts
router.get('/', emergencyContactController.getEmergencyContacts);
router.post('/', emergencyContactController.createEmergencyContact);
router.patch('/order', emergencyContactController.reorderEmergencyContacts);
router.patch('/:contactId', emergencyContactController.updateEmergencyContact);
router.delete('/:contactId', emergencyContactController.deleteEmergencyContact);

export default router;
