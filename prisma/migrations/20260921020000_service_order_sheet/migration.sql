-- AlterTable
ALTER TABLE "Consultant" ADD COLUMN     "serviceOrderSheetEndDate" TIMESTAMP(3),
ADD COLUMN     "serviceOrderSheetFileName" TEXT,
ADD COLUMN     "serviceOrderSheetStartDate" TIMESTAMP(3),
ADD COLUMN     "serviceOrderSheetUploadedAt" TIMESTAMP(3),
ADD COLUMN     "serviceOrderSheetUrl" TEXT;
