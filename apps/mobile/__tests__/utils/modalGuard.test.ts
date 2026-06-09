/**
 * modalGuard Utility Tests
 * Tests: lock acquisition, owner-only release, overlapping prevention
 */
import { modalGuard } from '../../utils/modalGuard';

describe('modalGuard utils', () => {
  afterEach(() => {
    // Reset state after each test
    const active = modalGuard.getActiveKey();
    if (active) {
      modalGuard.release(active);
    }
  });

  describe('acquire', () => {
    it('should allow acquiring a lock if none exists', () => {
      expect(modalGuard.acquire('modal1')).toBe(true);
      expect(modalGuard.getActiveKey()).toBe('modal1');
    });

    it('should allow acquiring the same lock multiple times', () => {
      expect(modalGuard.acquire('modal1')).toBe(true);
      expect(modalGuard.acquire('modal1')).toBe(true);
      expect(modalGuard.getActiveKey()).toBe('modal1');
    });

    it('should block acquiring a different lock if one is active', () => {
      modalGuard.acquire('modal1');
      expect(modalGuard.acquire('modal2')).toBe(false);
      expect(modalGuard.getActiveKey()).toBe('modal1'); // Should still be modal1
    });
  });

  describe('release', () => {
    it('should release the active lock if the correct key is provided', () => {
      modalGuard.acquire('modal1');
      modalGuard.release('modal1');
      expect(modalGuard.getActiveKey()).toBeNull();
    });

    it('should not release the active lock if the wrong key is provided', () => {
      modalGuard.acquire('modal1');
      modalGuard.release('modal2');
      expect(modalGuard.getActiveKey()).toBe('modal1'); // Should remain locked
    });

    it('should do nothing if releasing when no lock is active', () => {
      modalGuard.release('modal1');
      expect(modalGuard.getActiveKey()).toBeNull();
    });
  });
});
