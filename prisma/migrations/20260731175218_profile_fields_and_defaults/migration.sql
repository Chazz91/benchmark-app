-- AlterTable
ALTER TABLE "ClientTicketRequirement" ALTER COLUMN "discipline" SET DEFAULT 'ALL';

-- AlterTable
ALTER TABLE "Consultant" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "emergencyContactName" TEXT,
ADD COLUMN     "emergencyContactPhone" TEXT,
ALTER COLUMN "discipline" SET DEFAULT 'ALL';

-- AlterTable
ALTER TABLE "TicketType" ALTER COLUMN "discipline" SET DEFAULT 'ALL';
