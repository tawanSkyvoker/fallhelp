/**
 * Emergency Contact Service Tests
 * Tests: createEmergencyContact, getEmergencyContacts, updateEmergencyContact,
 *        deleteEmergencyContact, reorderEmergencyContacts
 * หมายเหตุ: service functions รับ elderId จาก controller โดยตรง (canonical nested route)
 */

// Mock Prisma
const mockElderFindUnique = jest.fn();
const mockContactFindUnique = jest.fn();
const mockContactFindFirst = jest.fn();
const mockContactFindMany = jest.fn();
const mockContactCreate = jest.fn();
const mockContactUpdate = jest.fn();
const mockContactDelete = jest.fn();
const mockTransaction = jest.fn();

jest.mock('../../../prisma', () => ({
  __esModule: true,
  default: {
    elder: {
      findUnique: mockElderFindUnique,
    },
    emergencyContact: {
      findUnique: mockContactFindUnique,
      findFirst: mockContactFindFirst,
      findMany: mockContactFindMany,
      create: mockContactCreate,
      update: mockContactUpdate,
      delete: mockContactDelete,
    },
    $transaction: mockTransaction,
  },
}));

import {
  createEmergencyContact,
  getEmergencyContacts,
  updateEmergencyContact,
  deleteEmergencyContact,
  reorderEmergencyContacts,
} from '../../../services/emergencyContactService';

// ==========================================
// Test Data
// ==========================================
const mockContact = {
  id: 'contact-001',
  elderId: 'elder-001',
  name: 'สมศรี',
  phone: '0891234567',
  relationship: 'ลูกสาว',
  priority: 1,
};

describe('Emergency Contact Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // createEmergencyContact
  // ==========================================
  describe('createEmergencyContact', () => {
    it('should create contact with auto-incremented priority', async () => {
      mockElderFindUnique.mockResolvedValue({ id: 'elder-001', userId: 'user-001' });
      mockContactFindFirst.mockResolvedValue({ priority: 2 }); // last priority
      mockContactCreate.mockResolvedValue({ ...mockContact, priority: 3 });

      const result = await createEmergencyContact('user-001', 'elder-001', {
        name: 'สมศรี',
        phone: '0891234567',
        relationship: 'ลูกสาว',
      });

      expect(result.priority).toBe(3);
      expect(mockContactCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            priority: 3,
          }),
        }),
      );
    });

    it('should start at priority 1 if no existing contacts', async () => {
      mockElderFindUnique.mockResolvedValue({ id: 'elder-001', userId: 'user-001' });
      mockContactFindFirst.mockResolvedValue(null);
      mockContactCreate.mockResolvedValue({ ...mockContact, priority: 1 });

      await createEmergencyContact('user-001', 'elder-001', {
        name: 'สมศรี',
        phone: '0891234567',
        relationship: 'ลูกสาว',
      });

      expect(mockContactCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ priority: 1 }),
        }),
      );
    });

    it('should throw if elder not found', async () => {
      mockElderFindUnique.mockResolvedValue(null);

      await expect(
        createEmergencyContact('user-001', 'elder-999', {
          name: 'Test',
          phone: '0891234567',
          relationship: 'Friend',
        }),
      ).rejects.toMatchObject({ code: 'resource_not_found' });
    });

    it('should throw if user does not own the elder', async () => {
      mockElderFindUnique.mockResolvedValue({ id: 'elder-001', userId: 'user-other' });

      await expect(
        createEmergencyContact('user-001', 'elder-001', {
          name: 'Test',
          phone: '0891234567',
          relationship: 'Friend',
        }),
      ).rejects.toMatchObject({ code: 'access_denied' });
    });
  });

  // ==========================================
  // getEmergencyContacts
  // ==========================================
  describe('getEmergencyContacts', () => {
    it('should return contacts sorted by priority', async () => {
      mockElderFindUnique.mockResolvedValue({ id: 'elder-001', userId: 'user-001' });
      mockContactFindMany.mockResolvedValue([
        { ...mockContact, priority: 1 },
        { ...mockContact, id: 'contact-002', priority: 2 },
      ]);

      const result = await getEmergencyContacts('user-001', 'elder-001');

      expect(result).toHaveLength(2);
      expect(mockContactFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { priority: 'asc' },
        }),
      );
    });

    it('should throw if elder not found', async () => {
      mockElderFindUnique.mockResolvedValue(null);

      await expect(getEmergencyContacts('user-999', 'elder-999')).rejects.toMatchObject({
        code: 'resource_not_found',
      });
    });
  });

  // ==========================================
  // updateEmergencyContact
  // ==========================================
  describe('updateEmergencyContact', () => {
    it('should update contact fields', async () => {
      mockElderFindUnique.mockResolvedValue({ id: 'elder-001', userId: 'user-001' });
      mockContactFindUnique.mockResolvedValue(mockContact);
      mockContactUpdate.mockResolvedValue({ ...mockContact, name: 'สมหญิง' });

      const result = await updateEmergencyContact('user-001', 'elder-001', 'contact-001', {
        name: 'สมหญิง',
      });

      expect(result.name).toBe('สมหญิง');
    });

    it('should throw if contact not found', async () => {
      mockElderFindUnique.mockResolvedValue({ id: 'elder-001', userId: 'user-001' });
      mockContactFindUnique.mockResolvedValue(null);

      await expect(
        updateEmergencyContact('user-001', 'elder-001', 'missing', { name: 'Test' }),
      ).rejects.toMatchObject({ code: 'resource_not_found' });
    });

    it('should throw if contact belongs to different elder', async () => {
      // Contact belongs to elder-999, but path says elder-001
      const otherElderContact = { ...mockContact, elderId: 'elder-999' };
      mockElderFindUnique.mockResolvedValue({ id: 'elder-001', userId: 'user-001' });
      mockContactFindUnique.mockResolvedValue(otherElderContact);

      await expect(
        updateEmergencyContact('user-001', 'elder-001', 'contact-001', { name: 'Test' }),
      ).rejects.toMatchObject({ code: 'access_denied' });
    });

    it('should throw if elder not found', async () => {
      mockElderFindUnique.mockResolvedValue(null);

      await expect(
        updateEmergencyContact('user-001', 'elder-999', 'contact-001', { name: 'Test' }),
      ).rejects.toMatchObject({ code: 'resource_not_found' });
    });
  });

  // ==========================================
  // deleteEmergencyContact
  // ==========================================
  describe('deleteEmergencyContact', () => {
    it('should delete contact with proper access', async () => {
      mockElderFindUnique.mockResolvedValue({ id: 'elder-001', userId: 'user-001' });
      mockContactFindUnique.mockResolvedValue(mockContact);
      mockContactDelete.mockResolvedValue(mockContact);

      await deleteEmergencyContact('user-001', 'elder-001', 'contact-001');

      expect(mockContactDelete).toHaveBeenCalledWith({ where: { id: 'contact-001' } });
    });

    it('should throw if contact not found', async () => {
      mockElderFindUnique.mockResolvedValue({ id: 'elder-001', userId: 'user-001' });
      mockContactFindUnique.mockResolvedValue(null);

      await expect(
        deleteEmergencyContact('user-001', 'elder-001', 'missing'),
      ).rejects.toMatchObject({
        code: 'resource_not_found',
      });
    });
  });

  // ==========================================
  // reorderEmergencyContacts
  // ==========================================
  describe('reorderEmergencyContacts', () => {
    it('should reorder contacts in a transaction', async () => {
      mockElderFindUnique.mockResolvedValue({ id: 'elder-001', userId: 'user-001' });
      const mockTx = {
        emergencyContact: {
          update: jest.fn().mockResolvedValue(mockContact),
        },
      };
      mockTransaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<void>) => {
        await fn(mockTx);
      });

      await reorderEmergencyContacts('user-001', 'elder-001', ['c-1', 'c-2', 'c-3']);

      // Should shift priorities first (increment 1000), then set correct priorities
      expect(mockTx.emergencyContact.update).toHaveBeenCalledTimes(6); // 3 shift + 3 set
    });

    it('should throw for empty contactIds array', async () => {
      await expect(reorderEmergencyContacts('user-001', 'elder-001', [])).rejects.toMatchObject({
        code: 'validation_error',
      });
    });

    it('should throw if elder not found', async () => {
      mockElderFindUnique.mockResolvedValue(null);

      await expect(
        reorderEmergencyContacts('user-001', 'elder-999', ['c-1']),
      ).rejects.toMatchObject({
        code: 'resource_not_found',
      });
    });
  });
});
