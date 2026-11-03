-- AlterTable
ALTER TABLE "Address" ADD COLUMN "landmark" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paymentMethod" TEXT NOT NULL DEFAULT 'cod',
    "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
    "subtotal" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "shipping" INTEGER NOT NULL DEFAULT 0,
    "tax" INTEGER NOT NULL DEFAULT 0,
    "cgst" INTEGER NOT NULL DEFAULT 0,
    "sgst" INTEGER NOT NULL DEFAULT 0,
    "igst" INTEGER NOT NULL DEFAULT 0,
    "taxRate" REAL NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "promotionId" TEXT,
    "couponCode" TEXT,
    "shippingMethod" TEXT NOT NULL DEFAULT 'standard',
    "carrier" TEXT,
    "addressId" TEXT,
    "trackingNumber" TEXT,
    "estimatedDelivery" DATETIME,
    "notes" TEXT,
    "internalNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Order_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("addressId", "carrier", "couponCode", "createdAt", "discount", "estimatedDelivery", "id", "internalNotes", "notes", "orderNumber", "paymentMethod", "paymentStatus", "promotionId", "shipping", "shippingMethod", "status", "subtotal", "tax", "total", "trackingNumber", "updatedAt", "userId") SELECT "addressId", "carrier", "couponCode", "createdAt", "discount", "estimatedDelivery", "id", "internalNotes", "notes", "orderNumber", "paymentMethod", "paymentStatus", "promotionId", "shipping", "shippingMethod", "status", "subtotal", "tax", "total", "trackingNumber", "updatedAt", "userId" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
CREATE INDEX "Order_userId_idx" ON "Order"("userId");
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE INDEX "Order_paymentStatus_idx" ON "Order"("paymentStatus");
CREATE INDEX "Order_promotionId_idx" ON "Order"("promotionId");
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");
CREATE INDEX "Order_orderNumber_idx" ON "Order"("orderNumber");
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
    "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "smsNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastModifiedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastModifiedBy" TEXT
);
INSERT INTO "new_StoreSettings" ("businessAddress", "currency", "defaultTaxRate", "emailNotificationsEnabled", "guestCheckoutEnabled", "id", "lastModifiedAt", "lastModifiedBy", "locale", "lowStockNotificationsEnabled", "maintenanceMessage", "maintenanceMode", "minimumOrderValue", "orderConfirmationEnabled", "paymentNotificationsEnabled", "razorpayEnabled", "shippingMethods", "shippingNotificationsEnabled", "smsNotificationsEnabled", "storeEmail", "storeName", "storePhone", "stripeEnabled", "taxCalculationMode", "timezone") SELECT "businessAddress", "currency", "defaultTaxRate", "emailNotificationsEnabled", "guestCheckoutEnabled", "id", "lastModifiedAt", "lastModifiedBy", "locale", "lowStockNotificationsEnabled", "maintenanceMessage", "maintenanceMode", "minimumOrderValue", "orderConfirmationEnabled", "paymentNotificationsEnabled", "razorpayEnabled", "shippingMethods", "shippingNotificationsEnabled", "smsNotificationsEnabled", "storeEmail", "storeName", "storePhone", "stripeEnabled", "taxCalculationMode", "timezone" FROM "StoreSettings";
DROP TABLE "StoreSettings";
ALTER TABLE "new_StoreSettings" RENAME TO "StoreSettings";
CREATE UNIQUE INDEX "StoreSettings_id_key" ON "StoreSettings"("id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
