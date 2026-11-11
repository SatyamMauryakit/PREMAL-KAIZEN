-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_VerificationToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_VerificationToken" ("createdAt", "email", "expiresAt", "id", "token", "type") SELECT "createdAt", "email", "expiresAt", "id", "token", "type" FROM "VerificationToken";
DROP TABLE "VerificationToken";
ALTER TABLE "new_VerificationToken" RENAME TO "VerificationToken";
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");
CREATE INDEX "VerificationToken_email_idx" ON "VerificationToken"("email");
CREATE INDEX "VerificationToken_expiresAt_idx" ON "VerificationToken"("expiresAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
