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
    CONSTRAINT "Order_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Order_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("addressId", "carrier", "cgst", "couponCode", "createdAt", "discount", "estimatedDelivery", "id", "igst", "internalNotes", "notes", "orderNumber", "paymentMethod", "paymentStatus", "promotionId", "sgst", "shipping", "shippingMethod", "status", "subtotal", "tax", "taxRate", "total", "trackingNumber", "updatedAt", "userId") SELECT "addressId", "carrier", "cgst", "couponCode", "createdAt", "discount", "estimatedDelivery", "id", "igst", "internalNotes", "notes", "orderNumber", "paymentMethod", "paymentStatus", "promotionId", "sgst", "shipping", "shippingMethod", "status", "subtotal", "tax", "taxRate", "total", "trackingNumber", "updatedAt", "userId" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
CREATE INDEX "Order_userId_idx" ON "Order"("userId");
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE INDEX "Order_paymentStatus_idx" ON "Order"("paymentStatus");
CREATE INDEX "Order_promotionId_idx" ON "Order"("promotionId");
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");
CREATE INDEX "Order_orderNumber_idx" ON "Order"("orderNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
