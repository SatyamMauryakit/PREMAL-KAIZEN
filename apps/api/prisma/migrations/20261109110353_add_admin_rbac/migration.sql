-- AlterTable
ALTER TABLE "User" ADD COLUMN "adminRole" TEXT;

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "AdminAuditLog_actorId_idx" ON "AdminAuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_action_idx" ON "AdminAuditLog"("action");

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- Backfill: every existing admin becomes SUPER_ADMIN so no current administrator
-- loses any access as a result of introducing granular roles.
UPDATE "User" SET "adminRole" = 'SUPER_ADMIN' WHERE "role" = 'admin';
