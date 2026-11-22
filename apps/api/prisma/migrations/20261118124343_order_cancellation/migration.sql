-- AlterTable
ALTER TABLE "Order" ADD COLUMN "cancellationComment" TEXT;
ALTER TABLE "Order" ADD COLUMN "cancellationReason" TEXT;
ALTER TABLE "Order" ADD COLUMN "cancelledAt" DATETIME;
ALTER TABLE "Order" ADD COLUMN "cancelledBy" TEXT;
ALTER TABLE "Order" ADD COLUMN "refundId" TEXT;
ALTER TABLE "Order" ADD COLUMN "refundStatus" TEXT;
