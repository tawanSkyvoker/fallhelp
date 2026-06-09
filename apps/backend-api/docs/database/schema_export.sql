-- ============================================================
-- FallHelp ER Schema (PostgreSQL)
-- ใช้เป็น schema อ้างอิงของทีม และใช้ import เข้า dbdiagram.io
-- อ้างอิงจาก apps/backend-api/prisma/schema.prisma โดยตรง
-- หาก schema เปลี่ยน ให้ regenerate จาก schema.prisma แทนการอิงชื่อ migration รายรอบ
-- หากต้องการ import เข้า dbdiagram.io โดยตรง แนะนำใช้ schema_export.dbml
-- ============================================================

CREATE SCHEMA IF NOT EXISTS "public";

-- ============================================================
-- TABLES
-- ============================================================
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "gender" TEXT,
    "phone" TEXT,
    "profileImage" TEXT,
    "pushToken" TEXT,
    "role" TEXT NOT NULL DEFAULT 'CAREGIVER',
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "auth_otps" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "auth_otps_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "elders" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "gender" TEXT,
    "dateOfBirth" DATE,
    "height" INTEGER,
    "weight" DOUBLE PRECISION,
    "diseases" TEXT,
    "phone" TEXT,
    "houseNumber" TEXT,
    "villageNumber" TEXT,
    "villageName" TEXT,
    "subdistrict" TEXT,
    "district" TEXT,
    "province" TEXT,
    "zipcode" TEXT,
    "userId" TEXT NOT NULL,
    CONSTRAINT "elders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "deviceCode" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNPAIRED',
    "wifiStatus" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "lastOnline" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "elderId" TEXT,
    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "emergency_contacts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "relationship" TEXT,
    "priority" INTEGER NOT NULL,
    "elderId" TEXT NOT NULL,
    CONSTRAINT "emergency_contacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "fallStage" TEXT NOT NULL,
    "bpm" INTEGER,
    "magnitude" DOUBLE PRECISION,
    "postureDelta" DOUBLE PRECISION,
    "cancelledAt" TIMESTAMP(3),
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "elderId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- INDEXES / UNIQUE CONSTRAINTS
-- ============================================================
CREATE UNIQUE INDEX "users_email_key" ON "users" ("email");
CREATE UNIQUE INDEX "users_phone_key" ON "users" ("phone");

CREATE INDEX "auth_otps_userId_expiresAt_idx" ON "auth_otps" ("userId", "expiresAt");

CREATE UNIQUE INDEX "elders_userId_key" ON "elders" ("userId");

CREATE UNIQUE INDEX "devices_deviceCode_key" ON "devices" ("deviceCode");
CREATE UNIQUE INDEX "devices_serialNumber_key" ON "devices" ("serialNumber");
CREATE UNIQUE INDEX "devices_elderId_key" ON "devices" ("elderId");

CREATE UNIQUE INDEX "emergency_contacts_elderId_priority_key"
ON "emergency_contacts" ("elderId", "priority");

CREATE INDEX "events_elderId_timestamp_idx" ON "events" ("elderId", "timestamp" DESC);
CREATE INDEX "events_deviceId_timestamp_idx" ON "events" ("deviceId", "timestamp" DESC);
CREATE INDEX "events_deviceId_fallStage_cancelledAt_timestamp_idx"
ON "events" ("deviceId", "fallStage", "cancelledAt", "timestamp" DESC);
CREATE INDEX "events_fallStage_timestamp_idx" ON "events" ("fallStage", "timestamp" DESC);
CREATE INDEX "events_timestamp_idx" ON "events" ("timestamp" DESC);

CREATE INDEX "notifications_userId_isRead_createdAt_idx"
ON "notifications" ("userId", "isRead", "createdAt" DESC);
CREATE INDEX "notifications_eventId_idx" ON "notifications" ("eventId");

-- ============================================================
-- FOREIGN KEYS
-- ============================================================
ALTER TABLE "auth_otps"
ADD CONSTRAINT "auth_otps_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users" ("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "elders"
ADD CONSTRAINT "elders_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users" ("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "devices"
ADD CONSTRAINT "devices_elderId_fkey"
FOREIGN KEY ("elderId") REFERENCES "elders" ("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "emergency_contacts"
ADD CONSTRAINT "emergency_contacts_elderId_fkey"
FOREIGN KEY ("elderId") REFERENCES "elders" ("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "events"
ADD CONSTRAINT "events_elderId_fkey"
FOREIGN KEY ("elderId") REFERENCES "elders" ("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "events"
ADD CONSTRAINT "events_deviceId_fkey"
FOREIGN KEY ("deviceId") REFERENCES "devices" ("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users" ("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "events" ("id")
ON DELETE CASCADE ON UPDATE CASCADE;
