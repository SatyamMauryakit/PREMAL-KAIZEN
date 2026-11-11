-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "originalPrice" INTEGER,
    "categoryId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    "colors" TEXT NOT NULL DEFAULT '[]',
    "sizes" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("categoryId", "colors", "createdAt", "description", "id", "isActive", "name", "originalPrice", "price", "sizes", "sku", "updatedAt") SELECT "categoryId", "colors", "createdAt", "description", "id", "isActive", "name", "originalPrice", "price", "sizes", "sku", "updatedAt" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");
CREATE INDEX "Product_isActive_idx" ON "Product"("isActive");
CREATE INDEX "Product_isDeleted_idx" ON "Product"("isDeleted");
CREATE INDEX "Product_sku_idx" ON "Product"("sku");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
