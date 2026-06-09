/**
 * modalGuard.ts
 *
 * Lock กลางสำหรับกัน modal หลายตัวเปิดทับกันในจังหวะเดียวกัน
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - เก็บ key ของ modal ที่กำลังถือ lock อยู่
 * - อนุญาตให้มี active modal ได้ทีละตัว
 * - ให้ key เดิม acquire ซ้ำได้ เพื่อไม่บล็อก flow ของ modal เดิม
 * - ปล่อย lock เฉพาะเจ้าของเดิม เพื่อกัน component อื่นปลดผิดตัว
 */

// activeKey คือ modal ที่กำลังถือสิทธิ์เปิดอยู่ในตอนนี้
let activeKey: string | null = null;

export const modalGuard = {
  acquire(key: string): boolean {
    // key เดิม acquire ซ้ำได้ แต่ modal อื่นจะถูกกันไว้จนกว่า lock จะถูก release
    if (!activeKey || activeKey === key) {
      activeKey = key;
      return true;
    }

    return false;
  },

  release(key: string): void {
    // ปล่อย lock เฉพาะเจ้าของเดิม เพื่อกัน modal อื่นปลด lock ผิดตัว
    if (activeKey === key) activeKey = null;
  },

  getActiveKey(): string | null {
    return activeKey;
  },
};
