-- AlterTable
ALTER TABLE "Order" ADD COLUMN "orderEmailSentAt" DATETIME;
ALTER TABLE "Order" ADD COLUMN "paymentEmailSentAt" DATETIME;
ALTER TABLE "Order" ADD COLUMN "paymentFailedEmailSentAt" DATETIME;
ALTER TABLE "Order" ADD COLUMN "paymentVerifiedAt" DATETIME;
ALTER TABLE "Order" ADD COLUMN "razorpayOrderId" TEXT;
ALTER TABLE "Order" ADD COLUMN "razorpayPaymentId" TEXT;
ALTER TABLE "Order" ADD COLUMN "razorpaySignature" TEXT;

-- CreateTable
CREATE TABLE "PaymentWebhookEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL DEFAULT 'razorpay',
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "orderId" TEXT,
    "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StoreSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "storeName" TEXT NOT NULL DEFAULT 'PREMAL KAIZEN',
    "storeEmail" TEXT NOT NULL DEFAULT 'support@premalkaizen.com',
    "storePhone" TEXT NOT NULL DEFAULT '+91-XXX-XXX-XXXX',
    "businessAddress" TEXT NOT NULL DEFAULT '',
    "businessState" TEXT NOT NULL DEFAULT '',
    "gstin" TEXT NOT NULL DEFAULT '',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "locale" TEXT NOT NULL DEFAULT 'en-IN',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "shippingMethods" TEXT NOT NULL DEFAULT '[]',
    "defaultTaxRate" REAL NOT NULL DEFAULT 0,
    "taxCalculationMode" TEXT NOT NULL DEFAULT 'exclusive',
    "guestCheckoutEnabled" BOOLEAN NOT NULL DEFAULT true,
    "minimumOrderValue" INTEGER NOT NULL DEFAULT 0,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceMessage" TEXT NOT NULL DEFAULT '',
    "orderConfirmationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "paymentNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "shippingNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lowStockNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "stripeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "razorpayEnabled" BOOLEAN NOT NULL DEFAULT false,
    "codEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "smsNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastModifiedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastModifiedBy" TEXT
);
INSERT INTO "new_StoreSettings" ("businessAddress", "businessState", "currency", "defaultTaxRate", "emailNotificationsEnabled", "gstin", "guestCheckoutEnabled", "id", "lastModifiedAt", "lastModifiedBy", "locale", "lowStockNotificationsEnabled", "maintenanceMessage", "maintenanceMode", "minimumOrderValue", "orderConfirmationEnabled", "paymentNotificationsEnabled", "razorpayEnabled", "shippingMethods", "shippingNotificationsEnabled", "smsNotificationsEnabled", "storeEmail", "storeName", "storePhone", "stripeEnabled", "taxCalculationMode", "timezone") SELECT "businessAddress", "businessState", "currency", "defaultTaxRate", "emailNotificationsEnabled", "gstin", "guestCheckoutEnabled", "id", "lastModifiedAt", "lastModifiedBy", "locale", "lowStockNotificationsEnabled", "maintenanceMessage", "maintenanceMode", "minimumOrderValue", "orderConfirmationEnabled", "paymentNotificationsEnabled", "razorpayEnabled", "shippingMethods", "shippingNotificationsEnabled", "smsNotificationsEnabled", "storeEmail", "storeName", "storePhone", "stripeEnabled", "taxCalculationMode", "timezone" FROM "StoreSettings";
DROP TABLE "StoreSettings";
ALTER TABLE "new_StoreSettings" RENAME TO "StoreSettings";
CREATE UNIQUE INDEX "StoreSettings_id_key" ON "StoreSettings"("id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_orderId_idx" ON "PaymentWebhookEvent"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookEvent_provider_eventId_key" ON "PaymentWebhookEvent"("provider", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_razorpayOrderId_key" ON "Order"("razorpayOrderId");

