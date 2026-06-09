/**
 * Emergency Contact Controller Tests
 */

const mockCreateEmergencyContact = jest.fn();
const mockGetEmergencyContacts = jest.fn();
const mockUpdateEmergencyContact = jest.fn();
const mockDeleteEmergencyContact = jest.fn();
const mockReorderEmergencyContacts = jest.fn();

jest.mock('../../../services/emergencyContactService', () => ({
  createEmergencyContact: (...args: unknown[]) => mockCreateEmergencyContact(...args),
  getEmergencyContacts: (...args: unknown[]) => mockGetEmergencyContacts(...args),
  updateEmergencyContact: (...args: unknown[]) => mockUpdateEmergencyContact(...args),
  deleteEmergencyContact: (...args: unknown[]) => mockDeleteEmergencyContact(...args),
  reorderEmergencyContacts: (...args: unknown[]) => mockReorderEmergencyContacts(...args),
}));

import * as emergencyContactController from '../../../controllers/emergencyContactController';

const makeReq = (overrides: Record<string, unknown> = {}) =>
  ({
    body: {},
    params: { elderId: 'elder-1' },
    query: {},
    user: { userId: 'user-1', email: 'test@example.com', role: 'CAREGIVER' },
    ...overrides,
  }) as unknown as import('express').Request;

const makeRes = () => {
  const res = {} as { status: jest.Mock; json: jest.Mock; send: jest.Mock };
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res as unknown as import('express').Response & {
    status: jest.Mock;
    json: jest.Mock;
    send: jest.Mock;
  };
};

const next = jest.fn();

describe('emergencyContactController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createEmergencyContact', () => {
    it('should call service.createEmergencyContact and return 201', async () => {
      const contact = { id: 'ec-1', name: 'ลูก', phone: '0812345678' };
      mockCreateEmergencyContact.mockResolvedValue(contact);

      const req = makeReq({ body: { name: 'ลูก', phone: '0812345678', relationship: 'บุตร' } });
      const res = makeRes();

      await emergencyContactController.createEmergencyContact(req, res, next);

      expect(mockCreateEmergencyContact).toHaveBeenCalledWith('user-1', 'elder-1', {
        name: 'ลูก',
        phone: '0812345678',
        relationship: 'บุตร',
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: contact }),
      );
    });

    it('should call next with accessDenied when no userId', async () => {
      const req = makeReq({ user: undefined });
      const res = makeRes();

      await emergencyContactController.createEmergencyContact(req, res, next);

      expect(next.mock.calls[0][0].code).toBe('access_denied');
    });
  });

  describe('getEmergencyContacts', () => {
    it('should call service.getEmergencyContacts and return contacts', async () => {
      const contacts = [{ id: 'ec-1' }, { id: 'ec-2' }];
      mockGetEmergencyContacts.mockResolvedValue(contacts);

      const req = makeReq();
      const res = makeRes();

      await emergencyContactController.getEmergencyContacts(req, res, next);

      expect(mockGetEmergencyContacts).toHaveBeenCalledWith('user-1', 'elder-1');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: contacts }),
      );
    });

    it('should call next with accessDenied when no userId', async () => {
      const req = makeReq({ user: undefined });
      const res = makeRes();

      await emergencyContactController.getEmergencyContacts(req, res, next);

      expect(next.mock.calls[0][0].code).toBe('access_denied');
    });
  });

  describe('updateEmergencyContact', () => {
    it('should call service.updateEmergencyContact and return updated contact', async () => {
      const updated = { id: 'ec-1', name: 'หลาน' };
      mockUpdateEmergencyContact.mockResolvedValue(updated);

      const req = makeReq({
        params: { elderId: 'elder-1', contactId: 'ec-1' },
        body: { name: 'หลาน', phone: '0811111111', relationship: 'หลาน', priority: 1 },
      });
      const res = makeRes();

      await emergencyContactController.updateEmergencyContact(req, res, next);

      expect(mockUpdateEmergencyContact).toHaveBeenCalledWith('user-1', 'elder-1', 'ec-1', {
        name: 'หลาน',
        phone: '0811111111',
        relationship: 'หลาน',
        priority: 1,
      });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: updated }),
      );
    });

    it('should call next with accessDenied when no userId', async () => {
      const req = makeReq({ user: undefined, params: { elderId: 'elder-1', contactId: 'ec-1' } });
      const res = makeRes();

      await emergencyContactController.updateEmergencyContact(req, res, next);

      expect(next.mock.calls[0][0].code).toBe('access_denied');
    });
  });

  describe('deleteEmergencyContact', () => {
    it('should call service.deleteEmergencyContact and return success', async () => {
      mockDeleteEmergencyContact.mockResolvedValue(undefined);

      const req = makeReq({ params: { elderId: 'elder-1', contactId: 'ec-1' } });
      const res = makeRes();

      await emergencyContactController.deleteEmergencyContact(req, res, next);

      expect(mockDeleteEmergencyContact).toHaveBeenCalledWith('user-1', 'elder-1', 'ec-1');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should call next with accessDenied when no userId', async () => {
      const req = makeReq({ user: undefined, params: { elderId: 'elder-1', contactId: 'ec-1' } });
      const res = makeRes();

      await emergencyContactController.deleteEmergencyContact(req, res, next);

      expect(next.mock.calls[0][0].code).toBe('access_denied');
    });
  });

  describe('reorderEmergencyContacts', () => {
    it('should call service.reorderEmergencyContacts and return success', async () => {
      mockReorderEmergencyContacts.mockResolvedValue(undefined);

      const contactIds = ['ec-2', 'ec-1', 'ec-3'];
      const req = makeReq({ body: { contactIds } });
      const res = makeRes();

      await emergencyContactController.reorderEmergencyContacts(req, res, next);

      expect(mockReorderEmergencyContacts).toHaveBeenCalledWith('user-1', 'elder-1', contactIds);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should call next with accessDenied when no userId', async () => {
      const req = makeReq({ user: undefined });
      const res = makeRes();

      await emergencyContactController.reorderEmergencyContacts(req, res, next);

      expect(next.mock.calls[0][0].code).toBe('access_denied');
    });
  });
});
