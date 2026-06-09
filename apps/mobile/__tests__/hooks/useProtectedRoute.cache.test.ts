/**
 * useProtectedRoute Cache Tests
 * Tests: authentication state caching and hydration during navigation
 */
import {
  resolveCachedRouteFromBootData,
  inferSetupStepFromElder,
} from '../../hooks/useProtectedRoute';
import type { BootData } from '../../utils/setupStorage';
import type { Elder } from '../../services/types';

const createBootData = (overrides: Partial<BootData> = {}): BootData => ({
  hasToken: true,
  setupStep: null,
  elderId: null,
  deviceId: null,
  serialNumber: null,
  lastRoute: null,
  ...overrides,
});

describe('resolveCachedRouteFromBootData', () => {
  it('routes to main when setup is complete', () => {
    const result = resolveCachedRouteFromBootData(createBootData({ setupStep: 'complete' }));
    expect(result).toEqual({
      route: 'main',
      setupStep: null,
      reason: 'setup-complete',
    });
  });

  it('keeps setup step 3 when step cache is valid', () => {
    const result = resolveCachedRouteFromBootData(
      createBootData({
        setupStep: '3',
        elderId: 'elder-1',
        deviceId: 'device-1',
      }),
    );

    expect(result).toEqual({
      route: 'setup-step',
      setupStep: '3',
      reason: 'setup-step-valid-cache',
    });
  });

  it('recovers setup step 3 from cache fragments when last route is not main', () => {
    const result = resolveCachedRouteFromBootData(
      createBootData({
        setupStep: null,
        elderId: 'elder-1',
        deviceId: 'device-1',
        lastRoute: 'setup-step',
      }),
    );

    expect(result).toEqual({
      route: 'setup-step',
      setupStep: '3',
      reason: 'setup-fragments-recovered',
    });
  });

  it('forces API revalidation for stale setup fragments when last route is main', () => {
    const result = resolveCachedRouteFromBootData(
      createBootData({
        setupStep: null,
        elderId: 'elder-1',
        deviceId: 'device-1',
        lastRoute: 'main',
      }),
    );

    expect(result).toBeNull();
  });

  it('forces API revalidation for cached main route when no setup cache exists', () => {
    const result = resolveCachedRouteFromBootData(
      createBootData({
        setupStep: null,
        lastRoute: 'main',
      }),
    );

    expect(result).toBeNull();
  });

  it('returns null when cached setup step is invalid and no other fallback exists', () => {
    const result = resolveCachedRouteFromBootData(
      createBootData({
        setupStep: '3',
        elderId: null,
        deviceId: null,
        lastRoute: null,
      }),
    );

    expect(result).toBeNull();
  });

  it('returns null when all cache is empty — forces API fallback (e.g. after logout mid-setup)', () => {
    // สถานการณ์: user logout จาก empty-state หลังทำ Step 1 เสร็จ
    // clearSetupElderId() + clearSetupStep() ล้าง cache ก่อน signOut
    // → cache path ต้องคืน null เพื่อให้ slow path เรียก API แล้วอนุมาน step ต่อ
    const result = resolveCachedRouteFromBootData(createBootData());
    expect(result).toBeNull();
  });
});

// ─── inferSetupStepFromElder ───────────────────────────────────────────────
const createElder = (overrides: Partial<Elder> = {}): Elder =>
  ({
    id: 'elder-1',
    userId: 'user-1',
    firstName: 'สมชาย',
    lastName: 'ใจดี',
    device: null,
    ...overrides,
  }) as Elder;

describe('inferSetupStepFromElder', () => {
  it('returns null when elder is null', () => {
    expect(inferSetupStepFromElder(null)).toBeNull();
  });

  it('returns null when elder has no device — อนุญาตให้เข้าหน้าหลักได้แม้ไม่มีอุปกรณ์', () => {
    // สถานการณ์: ผ่าน Step 1 แล้ว logout → login ใหม่
    // elder ถูกสร้างแล้วแต่ยังไม่มี device → อนุญาตให้ไปหน้าหลัก (return null) เพื่อแจ้งเตือนบน dashboard
    expect(inferSetupStepFromElder(createElder({ device: null }))).toBeNull();
  });

  it('returns null when elder has a device — setup ครบแล้ว', () => {
    // สถานการณ์: setup เสร็จสมบูรณ์ — ไม่ต้องกลับมา setup wizard
    // device ถูก unpair ภายหลัง ให้จัดการผ่าน features flow ไม่ใช่ wizard
    const elderWithDevice = createElder({
      device: { id: 'device-1' } as unknown as NonNullable<Elder['device']>,
    });
    expect(inferSetupStepFromElder(elderWithDevice)).toBeNull();
  });
});
