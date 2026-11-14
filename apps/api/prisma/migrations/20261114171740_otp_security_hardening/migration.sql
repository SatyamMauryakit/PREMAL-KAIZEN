-- AlterTable
ALTER TABLE "VerificationToken" ADD COLUMN "userId" TEXT;

-- CreateTable
CREATE TABLE "OtpLockout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "destination" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "lockedUntil" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "OtpSendLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "destination" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PendingPhoneChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "newPhone" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "verifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PendingPhoneChange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PendingEmailChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "newEmail" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "verifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PendingEmailChange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "OtpLockout_lockedUntil_idx" ON "OtpLockout"("lockedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "OtpLockout_destination_purpose_key" ON "OtpLockout"("destination", "purpose");

-- CreateIndex
CREATE INDEX "OtpSendLog_destination_purpose_createdAt_idx" ON "OtpSendLog"("destination", "purpose", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PendingPhoneChange_userId_key" ON "PendingPhoneChange"("userId");

-- CreateIndex
CREATE INDEX "PendingPhoneChange_expiresAt_idx" ON "PendingPhoneChange"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PendingEmailChange_userId_key" ON "PendingEmailChange"("userId");

-- CreateIndex
CREATE INDEX "PendingEmailChange_expiresAt_idx" ON "PendingEmailChange"("expiresAt");

-- CreateIndex
CREATE INDEX "VerificationToken_userId_idx" ON "VerificationToken"("userId");
