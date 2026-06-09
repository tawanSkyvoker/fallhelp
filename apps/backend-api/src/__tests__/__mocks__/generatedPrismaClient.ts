/**
 * Mock for src/generated/prisma/client
 * Replaces the ESM-only generated Prisma client which uses import.meta
 */

export const Prisma = {
  PrismaClientKnownRequestError: class extends Error {
    code: string;
    meta: Record<string, unknown> | undefined;
    constructor(message: string, opts: { code: string; meta?: Record<string, unknown> }) {
      super(message);
      this.code = opts.code;
      this.meta = opts.meta;
    }
  },
  PrismaClientValidationError: class extends Error {},
};

export enum DeviceStatus {
  PAIRED = 'PAIRED',
  UNPAIRED = 'UNPAIRED',
}

export enum WiFiStatus {
  IDLE = 'IDLE',
  CONFIGURING = 'CONFIGURING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

export enum Role {
  ADMIN = 'ADMIN',
  CAREGIVER = 'CAREGIVER',
}

export const PrismaClient = jest.fn().mockImplementation(() => ({}));
