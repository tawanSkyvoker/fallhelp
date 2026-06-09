/**
 * emergencyContactService.ts — listContacts, createContact, updateContact, reorderContacts, deleteContact
 */

import * as ecService from '../../services/emergencyContactService';

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPatch = jest.fn();
const mockDelete = jest.fn();

jest.mock('../../services/api', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
  toApiError: (err: unknown) => err,
}));

const ELDER_ID = 'elder-1';
const CONTACT_ID = 'ec-1';
const contact = { id: CONTACT_ID, name: 'ลูก', phone: '0812345678' };

describe('emergencyContactService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listContacts', () => {
    it('calls GET /api/elders/:elderId/emergency-contacts', async () => {
      mockGet.mockResolvedValue({ data: { data: [contact] } });

      const result = await ecService.listContacts(ELDER_ID);

      expect(mockGet).toHaveBeenCalledWith(`/api/elders/${ELDER_ID}/emergency-contacts`);
      expect(result).toEqual([contact]);
    });

    it('throws when API fails', async () => {
      mockGet.mockRejectedValue(new Error('Forbidden'));
      await expect(ecService.listContacts(ELDER_ID)).rejects.toThrow('Forbidden');
    });
  });

  describe('createContact', () => {
    it('calls POST /api/elders/:elderId/emergency-contacts', async () => {
      mockPost.mockResolvedValue({ data: { data: contact } });

      const payload = { name: 'ลูก', phone: '0812345678', relationship: 'บุตร' };
      const result = await ecService.createContact(ELDER_ID, payload);

      expect(mockPost).toHaveBeenCalledWith(`/api/elders/${ELDER_ID}/emergency-contacts`, payload);
      expect(result).toEqual(contact);
    });
  });

  describe('updateContact', () => {
    it('calls PATCH /api/elders/:elderId/emergency-contacts/:contactId', async () => {
      const updated = { ...contact, name: 'หลาน' };
      mockPatch.mockResolvedValue({ data: { data: updated } });

      const result = await ecService.updateContact(ELDER_ID, CONTACT_ID, { name: 'หลาน' });

      expect(mockPatch).toHaveBeenCalledWith(
        `/api/elders/${ELDER_ID}/emergency-contacts/${CONTACT_ID}`,
        { name: 'หลาน' },
      );
      expect(result).toEqual(updated);
    });
  });

  describe('reorderContacts', () => {
    it('calls PATCH /api/elders/:elderId/emergency-contacts/order', async () => {
      mockPatch.mockResolvedValue({});
      const ids = ['ec-2', 'ec-1', 'ec-3'];

      await ecService.reorderContacts(ELDER_ID, ids);

      expect(mockPatch).toHaveBeenCalledWith(`/api/elders/${ELDER_ID}/emergency-contacts/order`, {
        contactIds: ids,
      });
    });
  });

  describe('deleteContact', () => {
    it('calls DELETE /api/elders/:elderId/emergency-contacts/:contactId', async () => {
      mockDelete.mockResolvedValue({});

      await ecService.deleteContact(ELDER_ID, CONTACT_ID);

      expect(mockDelete).toHaveBeenCalledWith(
        `/api/elders/${ELDER_ID}/emergency-contacts/${CONTACT_ID}`,
      );
    });
  });
});
