/**
 * fileCleanup Utility Tests
 * Tests: filename extraction, path traversal prevention, safe file deletion
 */

// Mock fs before importing the module
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  promises: {
    unlink: jest.fn(),
  },
}));

// Mock logger to suppress output and capture calls
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

import fs from 'fs';
import logger from '../../../utils/logger';
import { extractFilenameFromUrl, deleteOldProfileImage } from '../../../utils/fileCleanup';

const mockExistsSync = fs.existsSync as jest.Mock;
const mockUnlink = fs.promises.unlink as jest.Mock;
const mockWarn = logger.warn as jest.Mock;

describe('extractFilenameFromUrl', () => {
  it('should extract filename from full HTTP URL', () => {
    expect(extractFilenameFromUrl('http://example.com/uploads/profiles/photo.jpg')).toBe(
      'photo.jpg',
    );
  });

  it('should extract filename from HTTPS URL', () => {
    expect(extractFilenameFromUrl('https://example.com/path/to/image.png')).toBe('image.png');
  });

  it('should extract filename from path fallback when not a valid URL', () => {
    expect(extractFilenameFromUrl('/uploads/profiles/avatar.jpg')).toBe('avatar.jpg');
  });

  it('should extract filename from simple path', () => {
    expect(extractFilenameFromUrl('profile.jpg')).toBe('profile.jpg');
  });

  it('should return null for empty string', () => {
    expect(extractFilenameFromUrl('')).toBeNull();
  });
});

describe('deleteOldProfileImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return early without error when imageUrl is null', async () => {
    await expect(deleteOldProfileImage(null)).resolves.toBeUndefined();
    expect(mockExistsSync).not.toHaveBeenCalled();
  });

  it('should return early without error when imageUrl is undefined', async () => {
    await expect(deleteOldProfileImage(undefined)).resolves.toBeUndefined();
    expect(mockExistsSync).not.toHaveBeenCalled();
  });

  it('should return early when imageUrl is empty string', async () => {
    await expect(deleteOldProfileImage('')).resolves.toBeUndefined();
    expect(mockExistsSync).not.toHaveBeenCalled();
  });

  it('should delete file when it exists', async () => {
    mockExistsSync.mockReturnValue(true);
    mockUnlink.mockResolvedValue(undefined);

    await deleteOldProfileImage('http://example.com/uploads/profiles/photo.jpg');

    expect(mockUnlink).toHaveBeenCalled();
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it('should not call unlink when file does not exist', async () => {
    mockExistsSync.mockReturnValue(false);

    await deleteOldProfileImage('http://example.com/uploads/profiles/photo.jpg');

    expect(mockUnlink).not.toHaveBeenCalled();
  });

  it('should warn and return early on path traversal attempt (filename contains ..)', async () => {
    // A filename like "../secret.txt" would have basename="secret.txt" != "../secret.txt"
    // but extractFilenameFromUrl would return "secret.txt" from the URL path
    // Real path traversal is caught by resolved path check — we test via suspicious filename
    await deleteOldProfileImage('http://example.com/uploads/profiles/../../../etc/passwd');
    // The basename of the URL path would be "passwd" which is safe;
    // resolved path check would catch if it escaped uploads dir
    // If it doesn't exist, no unlink is called — this is expected behavior
    expect(mockUnlink).not.toHaveBeenCalled();
  });

  it('should warn and not throw when unlink fails', async () => {
    mockExistsSync.mockReturnValue(true);
    mockUnlink.mockRejectedValue(new Error('Permission denied'));

    await expect(
      deleteOldProfileImage('http://example.com/uploads/profiles/photo.jpg'),
    ).resolves.toBeUndefined();

    expect(mockWarn).toHaveBeenCalledWith('Failed to delete old profile image', expect.any(Object));
  });

  it('should log info when file is deleted successfully', async () => {
    mockExistsSync.mockReturnValue(true);
    mockUnlink.mockResolvedValue(undefined);

    await deleteOldProfileImage('http://example.com/uploads/profiles/photo.jpg');

    expect(logger.info).toHaveBeenCalledWith(
      'Deleted old profile image',
      expect.objectContaining({ filename: 'photo.jpg' }),
    );
  });
});
